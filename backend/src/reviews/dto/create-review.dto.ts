import { IsEnum, IsString, MinLength } from 'class-validator';

enum ReviewDecisionDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  NEEDS_MORE_REVIEW = 'NEEDS_MORE_REVIEW',
}

export class CreateReviewDto {
  @IsEnum(ReviewDecisionDto, {
    message: 'Decision must be APPROVE, REJECT, or NEEDS_MORE_REVIEW',
  })
  decision: ReviewDecisionDto;

  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  reason: string;
}
