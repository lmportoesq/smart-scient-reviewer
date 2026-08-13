import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfExtractorService } from './extraction/pdf-extractor.service';
import { DoiExtractorService } from './extraction/doi-extractor.service';
import { ReferenceExtractorService } from './extraction/reference-extractor.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    private pdfExtractor: PdfExtractorService,
    private doiExtractor: DoiExtractorService,
    private referenceExtractor: ReferenceExtractorService,
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async processUpload(file: Express.Multer.File, userId: string) {
    // Generate safe internal filename
    const fileExtension = '.pdf';
    const storedFilename = `${uuidv4()}${fileExtension}`;
    const storedPath = path.join(this.uploadsDir, storedFilename);

    // Store file
    fs.writeFileSync(storedPath, file.buffer);

    // Create paper and document records
    const paper = await this.prisma.paper.create({
      data: {
        analysisStatus: 'PENDING',
      },
    });

    const document = await this.prisma.document.create({
      data: {
        paperId: paper.id,
        originalName: file.originalname,
        storedFilename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: 'UPLOADED',
      },
    });

    // Start extraction asynchronously (non-blocking)
    this.startExtraction(document.id, storedPath, paper.id).catch((err) => {
      this.logger.error(`Extraction failed for document ${document.id}`, err);
    });

    return {
      documentId: document.id,
      paperId: paper.id,
      status: 'UPLOADED',
    };
  }

  private async startExtraction(
    documentId: string,
    filePath: string,
    paperId: string,
  ) {
    try {
      // Update status to extracting
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'EXTRACTING' },
      });

      // Extract text from PDF
      const extractionResult = await this.pdfExtractor.extract(filePath);

      // Extract DOI
      const doi = this.doiExtractor.extractDoi(extractionResult.fullText);

      // Extract PMID
      const pmid = this.doiExtractor.extractPmid(extractionResult.fullText);

      // Extract references
      const references = this.referenceExtractor.extractReferences(
        extractionResult.fullText,
      );

      // Extract metadata
      const metadata = this.pdfExtractor.extractMetadata(extractionResult.fullText);

      // Update document with extracted data
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'EXTRACTED',
          extractedText: extractionResult.pages as unknown as any,
          extractedMeta: {
            doi,
            pmid,
            references: references as unknown as any[],
            ...metadata,
          } as any,
        },
      });

      // Update paper with extracted bibliographic info
      await this.prisma.paper.update({
        where: { id: paperId },
        data: {
          doi: doi || undefined,
          pmid: pmid || undefined,
          title: metadata.title || undefined,
          authors: metadata.authors?.length ? metadata.authors : undefined,
          journal: metadata.journal || undefined,
          publicationYear: metadata.year || undefined,
        },
      });

      this.logger.log(`Extraction completed for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Extraction failed for document ${documentId}`, error);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'EXTRACTION_FAILED' },
      });
    }
  }
}
