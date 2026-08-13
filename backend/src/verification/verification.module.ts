import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { CrossrefProvider } from './providers/crossref.provider';

@Module({
  providers: [VerificationService, CrossrefProvider],
  exports: [VerificationService, CrossrefProvider],
})
export class VerificationModule {}
