import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PdfExtractorService } from './extraction/pdf-extractor.service';
import { DoiExtractorService } from './extraction/doi-extractor.service';
import { ReferenceExtractorService } from './extraction/reference-extractor.service';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    PdfExtractorService,
    DoiExtractorService,
    ReferenceExtractorService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
