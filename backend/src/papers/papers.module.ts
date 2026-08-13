import { Module } from '@nestjs/common';
import { PapersController } from './papers.controller';
import { PapersService } from './papers.service';
import { VerificationModule } from '../verification/verification.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [VerificationModule, EvidenceModule, AiModule],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
