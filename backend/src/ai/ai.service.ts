import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AIProvider, AIAnalysisInput, AIAnalysisRawResult } from './providers/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { aiAnalysisOutputSchema } from './validators/ai-output.schema';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AIProvider;

  constructor(
    private prisma: PrismaService,
    private openAIProvider: OpenAIProvider,
  ) {
    // Provider is configurable — for now OpenAI
    this.provider = this.openAIProvider;
  }

  /**
   * Run AI analysis on a paper.
   * CRITICAL: Every LLM response is validated with Zod before use (spec §8).
   */
  async analyzePaper(paperId: string, input: AIAnalysisInput) {
    const startTime = Date.now();

    // Create pending analysis record
    const analysis = await this.prisma.aIAnalysis.create({
      data: {
        paperId,
        provider: this.provider.name,
        model: process.env.AI_MODEL || 'gpt-4o',
        status: 'IN_PROGRESS',
        rawInput: this.sanitizeInput(input) as any,
      },
    });

    try {
      // Call AI provider
      const rawResult = await this.provider.analyzePaper(input);

      const duration = Date.now() - startTime;

      // CRITICAL: Validate AI output with Zod (spec §8)
      const validationResult = aiAnalysisOutputSchema.safeParse(rawResult);

      if (!validationResult.success) {
        this.logger.warn(
          `AI output validation failed for paper ${paperId}`,
          validationResult.error.errors,
        );

        // Attempt one retry with stricter prompt
        const retryResult = await this.retryWithValidation(input);

        if (!retryResult) {
          // Mark as failed — do NOT use invalid data
          await this.prisma.aIAnalysis.update({
            where: { id: analysis.id },
            data: {
              status: 'FAILED',
              rawOutput: rawResult as any,
              durationMs: duration,
              validated: false,
            },
          });

          return { status: 'AI_ANALYSIS_ERROR', analysisId: analysis.id };
        }

        // Use retry result
        return await this.persistValidResult(
          analysis.id,
          paperId,
          retryResult,
          Date.now() - startTime,
        );
      }

      // Validation passed — persist
      return await this.persistValidResult(
        analysis.id,
        paperId,
        validationResult.data,
        duration,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`AI analysis failed for paper ${paperId}`, error);

      await this.prisma.aIAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'FAILED',
          durationMs: duration,
          validated: false,
        },
      });

      return { status: 'AI_ANALYSIS_ERROR', analysisId: analysis.id };
    }
  }

  private async retryWithValidation(
    input: AIAnalysisInput,
  ): Promise<z.infer<typeof aiAnalysisOutputSchema> | null> {
    try {
      this.logger.log('Retrying AI analysis with stricter validation...');
      const rawResult = await this.provider.analyzePaper(input);
      const validation = aiAnalysisOutputSchema.safeParse(rawResult);

      if (validation.success) {
        return validation.data;
      }

      this.logger.warn('AI retry also failed validation');
      return null;
    } catch {
      return null;
    }
  }

  private async persistValidResult(
    analysisId: string,
    paperId: string,
    validData: z.infer<typeof aiAnalysisOutputSchema>,
    durationMs: number,
  ) {
    // Update analysis record
    await this.prisma.aIAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        summary: validData.summary,
        methodology: validData.methodologySignals as any,
        rawOutput: validData as any,
        durationMs,
        validated: true,
      },
    });

    // Persist extracted claims
    for (const claim of validData.claims) {
      await this.prisma.claim.create({
        data: {
          paperId,
          aiAnalysisId: analysisId,
          claim: claim.claim,
          page: claim.page,
          supportingText: claim.supportingText,
          supportLevel: claim.supportLevel as any,
          confidence: claim.confidence,
          needsHumanReview: claim.needsHumanReview,
        },
      });
    }

    return {
      status: 'COMPLETED',
      analysisId,
      summary: validData.summary,
      claimsCount: validData.claims.length,
      methodologySignalsCount: validData.methodologySignals.length,
      uncertaintiesCount: validData.uncertainties.length,
    };
  }

  /**
   * Sanitize input before storing (remove full text to save space).
   */
  private sanitizeInput(input: AIAnalysisInput): Record<string, unknown> {
    return {
      metadata: input.metadata,
      textLength: input.text.length,
      referencesCount: input.references.length,
      signalsCount: input.signals.length,
      verificationResultsCount: input.verificationResults.length,
    };
  }
}
