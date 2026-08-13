import { Module } from '@nestjs/common';
import { PapersController } from './papers.controller';
import { PapersService } from './papers.service';
import { VerificationModule } from '../verification/verification.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [VerificationModule, EvidenceModule],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
