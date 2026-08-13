import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { ReviewPriorityService } from './review-priority.service';

@Module({
  providers: [EvidenceService, ReviewPriorityService],
  exports: [EvidenceService, ReviewPriorityService],
})
export class EvidenceModule {}
