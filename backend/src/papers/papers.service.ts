import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';
import { EvidenceService } from '../evidence/evidence.service';
import { ReviewPriorityService } from '../evidence/review-priority.service';

@Injectable()
export class PapersService {
  private readonly logger = new Logger(PapersService.name);

  constructor(
    private prisma: PrismaService,
    private verificationService: VerificationService,
    private evidenceService: EvidenceService,
    private reviewPriorityService: ReviewPriorityService,
  ) {}

  async findById(id: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id },
      include: {
        documents: true,
        verifications: true,
        evidences: true,
        claims: true,
        reviews: { include: { reviewer: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return paper;
  }

  /**
   * Run the full analysis pipeline for a paper:
   * 1. Verify with external providers (Crossref, OpenAlex, PubMed)
   * 2. Process results into evidence
   * 3. Calculate Review Priority
   */
  async analyzePaper(paperId: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: { documents: true },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    // Update status
    await this.prisma.paper.update({
      where: { id: paperId },
      data: { analysisStatus: 'IN_PROGRESS' },
    });

    try {
      // Step 1: Run verification providers
      const verificationResults = await this.verificationService.verifyPaper(
        paperId,
        {
          doi: paper.doi || undefined,
          pmid: paper.pmid || undefined,
          title: paper.title || undefined,
          authors: (paper.authors as string[]) || undefined,
          journal: paper.journal || undefined,
          year: paper.publicationYear || undefined,
        },
      );

      // Step 2: Process into evidence
      await this.evidenceService.processVerificationResults(paperId, verificationResults);

      // Step 3: Calculate Review Priority (deterministic)
      const reviewPriority = await this.reviewPriorityService.calculateAndPersist(paperId);

      // Update status to completed
      await this.prisma.paper.update({
        where: { id: paperId },
        data: { analysisStatus: 'COMPLETED' },
      });

      this.logger.log(
        `Analysis completed for paper ${paperId}. Priority: ${reviewPriority}`,
      );

      return {
        paperId,
        status: 'COMPLETED',
        reviewPriority,
        verificationsCount: verificationResults.length,
      };
    } catch (error) {
      this.logger.error(`Analysis failed for paper ${paperId}`, error);

      await this.prisma.paper.update({
        where: { id: paperId },
        data: { analysisStatus: 'FAILED' },
      });

      throw error;
    }
  }

  /**
   * Get the full report for a paper.
   */
  async getReport(paperId: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        documents: { select: { id: true, originalName: true, status: true } },
        verifications: true,
        evidences: { orderBy: { severity: 'asc' } },
        aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 },
        claims: true,
        reviews: {
          include: { reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return paper;
  }

  /**
   * Get evidence for a paper.
   */
  async getEvidence(paperId: string) {
    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return this.evidenceService.getEvidenceForPaper(paperId);
  }
}
