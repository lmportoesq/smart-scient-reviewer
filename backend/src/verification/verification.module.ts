import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { CrossrefProvider } from './providers/crossref.provider';
import { OpenAlexProvider } from './providers/openalex.provider';
import { PubMedProvider } from './providers/pubmed.provider';
import { DemoCacheService } from './demo-cache.service';

@Module({
  providers: [
    VerificationService,
    CrossrefProvider,
    OpenAlexProvider,
    PubMedProvider,
    DemoCacheService,
  ],
  exports: [VerificationService, CrossrefProvider, OpenAlexProvider, PubMedProvider],
})
export class VerificationModule {}
