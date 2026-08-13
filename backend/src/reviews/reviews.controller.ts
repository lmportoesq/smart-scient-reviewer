import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('papers/:paperId/review')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  async create(
    @Param('paperId') paperId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    // reviewerId comes from authenticated session — NEVER from frontend (spec §44)
    return this.reviewsService.createReview(
      paperId,
      user.id,
      { decision: dto.decision, reason: dto.reason },
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'] as string,
      },
    );
  }

  @Get()
  async findAll(@Param('paperId') paperId: string) {
    return this.reviewsService.getReviewsForPaper(paperId);
  }
}
