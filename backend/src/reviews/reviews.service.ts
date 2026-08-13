import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums';

export interface CreateReviewInput {
  decision: 'APPROVE' | 'REJECT' | 'NEEDS_MORE_REVIEW';
  reason: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Create a review decision for a paper.
   * The reviewerId comes from the authenticated session — NEVER from frontend input (spec §44).
   */
  async createReview(
    paperId: string,
    reviewerId: string,
    input: CreateReviewInput,
    requestMeta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    // Verify paper exists
    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    // Validate reason length
    if (!input.reason || input.reason.trim().length < 10) {
      throw new BadRequestException('Reason must be at least 10 characters');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        paperId,
        reviewerId, // From authenticated session
        decision: input.decision,
        reason: input.reason.trim(),
      },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit the decision
    await this.auditService.log({
      userId: reviewerId,
      paperId,
      action: AuditAction.REVIEW_CREATED,
      entityType: 'review',
      entityId: review.id,
      metadata: {
        decision: input.decision,
        // Do NOT log the full reason in metadata to keep audit concise
      },
      ...requestMeta,
    });

    return review;
  }

  /**
   * Get all reviews for a paper.
   */
  async getReviewsForPaper(paperId: string) {
    return this.prisma.review.findMany({
      where: { paperId },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
