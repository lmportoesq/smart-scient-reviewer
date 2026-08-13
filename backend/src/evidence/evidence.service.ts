import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationResult, VerificationSignal } from '../verification/providers/verification-provider.interface';
import { SignalSeverity } from '@scientificguard/shared';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Process verification results into evidence records.
   * Each significant signal becomes an evidence entry.
   */
  async processVerificationResults(
    paperId: string,
    results: VerificationResult[],
  ) {
    for (const result of results) {
      for (const signal of result.signals) {
        // Only create evidence for signals with MEDIUM severity or higher,
        // or any signal that represents a finding (not just "all ok")
        if (this.isSignificantSignal(signal)) {
          await this.createEvidence(paperId, signal, result.provider);
        }
      }
    }
  }

  /**
   * Get all evidence for a paper.
   */
  async getEvidenceForPaper(paperId: string) {
    return this.prisma.evidence.findMany({
      where: { paperId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private isSignificantSignal(signal: VerificationSignal): boolean {
    // All signals except LOW severity "verified/consistent" are significant
    if (signal.severity === SignalSeverity.CRITICAL || signal.severity === SignalSeverity.HIGH) {
      return true;
    }
    if (signal.severity === SignalSeverity.MEDIUM) {
      return true;
    }
    // LOW severity: only include if it's a finding (not just "ok")
    if (signal.title.toLowerCase().includes('not found') ||
        signal.title.toLowerCase().includes('mismatch')) {
      return true;
    }
    return false;
  }

  private async createEvidence(
    paperId: string,
    signal: VerificationSignal,
    provider: string,
  ) {
    await this.prisma.evidence.create({
      data: {
        paperId,
        signalId: signal.type,
        severity: signal.severity as any,
        title: signal.title,
        source: provider,
        sourceUrl: null,
        evidenceData: (signal.evidence || {}) as any,
      },
    });
  }
}
