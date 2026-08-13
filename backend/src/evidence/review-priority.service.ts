import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewPriority, SignalSeverity } from '../common/enums';

/**
 * Deterministic Review Priority calculation.
 * AI does NOT determine this — it's calculated from signals.
 * 
 * Rules (from spec §27):
 * - Retraction → CRITICAL
 * - Expression of concern → HIGH
 * - Major metadata mismatch → HIGH
 * - Reference mismatch → MEDIUM
 * - AI methodology concern → MEDIUM
 * - Minor metadata discrepancy → LOW
 */
@Injectable()
export class ReviewPriorityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate and persist the review priority for a paper.
   * This is deterministic based on accumulated signals.
   */
  async calculateAndPersist(paperId: string): Promise<ReviewPriority> {
    const priority = await this.calculate(paperId);

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { reviewPriority: priority },
    });

    return priority;
  }

  /**
   * Pure calculation of review priority from stored evidence.
   */
  async calculate(paperId: string): Promise<ReviewPriority> {
    const evidences = await this.prisma.evidence.findMany({
      where: { paperId },
    });

    const verifications = await this.prisma.verification.findMany({
      where: { paperId },
    });

    // Collect all severities
    const severities: SignalSeverity[] = [];

    for (const evidence of evidences) {
      severities.push(evidence.severity as SignalSeverity);
    }

    for (const verification of verifications) {
      if (verification.severity) {
        severities.push(verification.severity as SignalSeverity);
      }
    }

    return this.determinePriority(severities);
  }

  /**
   * Deterministic priority logic:
   * - Any CRITICAL signal → CRITICAL
   * - Any HIGH signal → HIGH
   * - Any MEDIUM signal → MEDIUM
   * - Otherwise → LOW
   */
  private determinePriority(severities: SignalSeverity[]): ReviewPriority {
    if (severities.includes(SignalSeverity.CRITICAL)) {
      return ReviewPriority.CRITICAL;
    }

    if (severities.includes(SignalSeverity.HIGH)) {
      return ReviewPriority.HIGH;
    }

    if (severities.includes(SignalSeverity.MEDIUM)) {
      return ReviewPriority.MEDIUM;
    }

    return ReviewPriority.LOW;
  }
}
