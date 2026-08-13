import { z } from 'zod';
import { ReviewDecision } from '../../types';

// Create review input
export const createReviewSchema = z.object({
  decision: z.nativeEnum(ReviewDecision),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// Review response
export const reviewResponseSchema = z.object({
  id: z.string().uuid(),
  paperId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  decision: z.nativeEnum(ReviewDecision),
  reason: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
