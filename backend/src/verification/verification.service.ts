import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  VerificationProvider,
  PaperVerificationInput,
  VerificationResult,
} from './providers/verification-provider.interface';
import { CrossrefProvider } from './providers/crossref.provider';
import { OpenAlexProvider } from './providers/openalex.provider';
import { PubMedProvider } from './providers/pubmed.provider';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly providers: VerificationProvider[];

  constructor(
    private prisma: PrismaService,
    private crossrefProvider: CrossrefProvider,
    private openAlexProvider: OpenAlexProvider,
    private pubMedProvider: PubMedProvider,
  ) {
    this.providers = [
      this.crossrefProvider,
      this.openAlexProvider,
      this.pubMedProvider,
    ];
  }

  /**
   * Run all available verification providers for a paper.
   * Provider failures are isolated — one failing doesn't stop others (spec §57).
   */
  async verifyPaper(
    paperId: string,
    input: PaperVerificationInput,
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const provider of this.providers) {
      try {
        this.logger.log(`Running ${provider.name} verification for paper ${paperId}`);
        const result = await provider.verify(input);
        results.push(result);

        // Persist verification result
        await this.persistVerification(paperId, result);
      } catch (error) {
        this.logger.error(
          `Provider ${provider.name} failed for paper ${paperId}`,
          error,
        );

        // Create error result — do NOT stop other providers
        const errorResult: VerificationResult = {
          provider: provider.name,
          status: 'ERROR' as any,
          metadata: { error: `${provider.name} unavailable` },
          signals: [],
        };
        results.push(errorResult);
        await this.persistVerification(paperId, errorResult);
      }
    }

    return results;
  }

  /**
   * Add a provider dynamically (for future extensibility).
   */
  registerProvider(provider: VerificationProvider) {
    this.providers.push(provider);
  }

  private async persistVerification(
    paperId: string,
    result: VerificationResult,
  ) {
    for (const signal of result.signals) {
      await this.prisma.verification.create({
        data: {
          paperId,
          provider: result.provider,
          signalType: signal.type,
          status: result.status,
          severity: signal.severity as any,
          metadata: result.metadata as any,
        },
      });
    }

    // If no signals, still persist the verification attempt
    if (result.signals.length === 0) {
      await this.prisma.verification.create({
        data: {
          paperId,
          provider: result.provider,
          signalType: 'GENERAL',
          status: result.status,
          severity: null,
          metadata: result.metadata as any,
        },
      });
    }
  }
}
