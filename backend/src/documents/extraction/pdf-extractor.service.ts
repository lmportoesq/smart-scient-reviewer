import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

// pdf-parse types
interface PdfData {
  numpages: number;
  text: string;
  info: Record<string, unknown>;
}

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  fullText: string;
  pages: PageContent[];
  numPages: number;
}

export interface ExtractedMetadata {
  title: string | null;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract: string | null;
}

@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);

  async extract(filePath: string): Promise<PdfExtractionResult> {
    // Dynamic import for pdf-parse (CommonJS module)
    const pdfParse = require('pdf-parse');

    const buffer = fs.readFileSync(filePath);
    const data: PdfData = await pdfParse(buffer);

    // pdf-parse doesn't natively split by page well,
    // so we use a heuristic: split by form feed or large whitespace
    const pages = this.splitIntoPages(data.text, data.numpages);

    return {
      fullText: data.text,
      pages,
      numPages: data.numpages,
    };
  }

  private splitIntoPages(text: string, numPages: number): PageContent[] {
    // Try to split by form feed character first
    const formFeedSplit = text.split('\f');

    if (formFeedSplit.length > 1) {
      return formFeedSplit
        .filter((page) => page.trim().length > 0)
        .map((pageText, index) => ({
          pageNumber: index + 1,
          text: pageText.trim(),
        }));
    }

    // Fallback: divide text roughly equally by numPages
    if (numPages <= 1) {
      return [{ pageNumber: 1, text: text.trim() }];
    }

    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / numPages);
    const pages: PageContent[] = [];

    for (let i = 0; i < numPages; i++) {
      const start = i * linesPerPage;
      const end = Math.min(start + linesPerPage, lines.length);
      const pageText = lines.slice(start, end).join('\n').trim();

      if (pageText.length > 0) {
        pages.push({ pageNumber: i + 1, text: pageText });
      }
    }

    return pages;
  }

  extractMetadata(fullText: string): ExtractedMetadata {
    return {
      title: this.extractTitle(fullText),
      authors: this.extractAuthors(fullText),
      journal: this.extractJournal(fullText),
      year: this.extractYear(fullText),
      abstract: this.extractAbstract(fullText),
    };
  }

  private extractTitle(text: string): string | null {
    // Heuristic: first non-empty line that's not a header/number
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    for (const line of lines.slice(0, 10)) {
      // Skip short lines, numbers, common headers
      if (line.length < 10) continue;
      if (/^\d+$/.test(line)) continue;
      if (/^(abstract|introduction|keywords|doi|volume)/i.test(line)) continue;

      return line;
    }

    return null;
  }

  private extractAuthors(text: string): string[] {
    // Look for lines after the title that contain commas and common name patterns
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    for (let i = 1; i < Math.min(lines.length, 15); i++) {
      const line = lines[i];
      // Author lines often have commas, "and", and are relatively short
      if (
        line.includes(',') &&
        line.length < 500 &&
        !line.toLowerCase().includes('abstract') &&
        !line.toLowerCase().includes('doi')
      ) {
        // Split by comma and/or "and"
        const authors = line
          .split(/,|(?:\band\b)/i)
          .map((a) => a.trim())
          .filter((a) => a.length > 2 && a.length < 60);

        if (authors.length >= 1 && authors.length <= 20) {
          return authors;
        }
      }
    }

    return [];
  }

  private extractJournal(text: string): string | null {
    // Look for common journal patterns
    const journalPatterns = [
      /(?:published in|journal[:\s]+)(.+?)(?:\n|,|\d{4})/i,
      /(?:^|\n)([A-Z][a-z]+ (?:of|in) [A-Z][a-z]+.{0,50})(?:\n|,)/m,
    ];

    for (const pattern of journalPatterns) {
      const match = text.match(pattern);
      if (match?.[1] && match[1].length < 100) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractYear(text: string): number | null {
    // Look for 4-digit year in common contexts
    const yearPatterns = [
      /(?:published|received|accepted|©|\(\s*)(\d{4})/i,
      /\b(19\d{2}|20[0-2]\d)\b/,
    ];

    for (const pattern of yearPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const year = parseInt(match[1], 10);
        if (year >= 1900 && year <= new Date().getFullYear() + 1) {
          return year;
        }
      }
    }

    return null;
  }

  private extractAbstract(text: string): string | null {
    const abstractMatch = text.match(
      /(?:abstract[:\s]*\n?)([\s\S]{50,2000}?)(?:\n\s*(?:keywords|introduction|1\.|1\s))/i,
    );

    if (abstractMatch?.[1]) {
      return abstractMatch[1].trim();
    }

    return null;
  }
}
