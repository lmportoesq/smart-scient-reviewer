import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockPrisma: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockPrisma = {
      paper: { findUnique: jest.fn() },
      review: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new ReviewsService(mockPrisma, mockAuditService);
  });

  describe('createReview', () => {
    it('should create a review with valid input', async () => {
      mockPrisma.paper.findUnique.mockResolvedValue({ id: 'paper-1' });
      mockPrisma.review.create.mockResolvedValue({
        id: 'review-1',
        paperId: 'paper-1',
        reviewerId: 'user-1',
        decision: 'REJECT',
        reason: 'Retraction confirmed by external evidence.',
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewer: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      });

      const result = await service.createReview('paper-1', 'user-1', {
        decision: 'REJECT',
        reason: 'Retraction confirmed by external evidence.',
      });

      expect(result.decision).toBe('REJECT');
      expect(result.reviewerId).toBe('user-1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          paperId: 'paper-1',
          action: 'REVIEW_CREATED',
        }),
      );
    });

    it('should throw NotFoundException when paper does not exist', async () => {
      mockPrisma.paper.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview('nonexistent', 'user-1', {
          decision: 'APPROVE',
          reason: 'All evidence checks pass.',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when reason is too short', async () => {
      mockPrisma.paper.findUnique.mockResolvedValue({ id: 'paper-1' });

      await expect(
        service.createReview('paper-1', 'user-1', {
          decision: 'APPROVE',
          reason: 'Short',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use reviewerId from authenticated session, not from input', async () => {
      mockPrisma.paper.findUnique.mockResolvedValue({ id: 'paper-1' });
      mockPrisma.review.create.mockResolvedValue({
        id: 'review-1',
        paperId: 'paper-1',
        reviewerId: 'authenticated-user-id',
        decision: 'APPROVE',
        reason: 'Evidence verified and consistent.',
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewer: { id: 'authenticated-user-id', name: 'Auth User', email: 'auth@test.com' },
      });

      const result = await service.createReview(
        'paper-1',
        'authenticated-user-id', // This comes from JWT, not from body
        { decision: 'APPROVE', reason: 'Evidence verified and consistent.' },
      );

      expect(mockPrisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewerId: 'authenticated-user-id',
          }),
        }),
      );
    });
  });
});
