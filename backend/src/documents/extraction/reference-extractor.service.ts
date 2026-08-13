import { Injectable } from '@nestjs/common';
import { DoiExtractorService } from './doi-extractor.service';

export interface ExtractedReference {
  number: number;
  rawText: string;
  title: string | null;
  doi: string | null;
  authors: string | null;
  year: number | null;
}

@Injectable()
export class ReferenceExtractorService {
  constructor(private doiExtractor: DoiExtractorService) {}

  /**
   * Extract references from text.
   * Returns up to 20 references (MVP limit per spec §22).
   */
  extractReferences(text: string): ExtractedReference[] {
    const referencesSection = this.findReferencesSection(text);

    if (!referencesSection) {
      return [];
    }

    const references = this.parseReferences(referencesSection);

    // MVP: limit to 20 references
    return references.slice(0, 20);
  }

  private findReferencesSection(text: string): string | null {
    // Look for "References" or "Bibliography" section
    const patterns = [
      /(?:\n\s*References\s*\n)([\s\S]+?)(?:\n\s*(?:Appendix|Supplementary|$))/i,
      /(?:\n\s*Bibliography\s*\n)([\s\S]+?)(?:\n\s*(?:Appendix|Supplementary|$))/i,
      /(?:\n\s*References\s*\n)([\s\S]+)$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] && match[1].length > 50) {
        return match[1];
      }
    }

    return null;
  }

  private parseReferences(section: string): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // Try numbered references: [1], 1., (1)
    const numberedPattern = /(?:\[(\d+)\]|^(\d+)\.|^\((\d+)\))\s*(.+?)(?=(?:\[\d+\]|^\d+\.|^\(\d+\)|\z))/gms;

    let match: RegExpExecArray | null;
    while ((match = numberedPattern.exec(section)) !== null) {
      const num = parseInt(match[1] || match[2] || match[3], 10);
      const rawText = match[4]?.trim() || '';

      if (rawText.length > 10) {
        references.push({
          number: num,
          rawText,
          title: this.extractReferenceTitle(rawText),
          doi: this.doiExtractor.extractDoi(rawText),
          authors: this.extractReferenceAuthors(rawText),
          year: this.extractReferenceYear(rawText),
        });
      }
    }

    // If numbered extraction failed, try line-by-line
    if (references.length === 0) {
      const lines = section
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 20);

      lines.forEach((line, index) => {
        references.push({
          number: index + 1,
          rawText: line,
          title: this.extractReferenceTitle(line),
          doi: this.doiExtractor.extractDoi(line),
          authors: this.extractReferenceAuthors(line),
          year: this.extractReferenceYear(line),
        });
      });
    }

    return references;
  }

  private extractReferenceTitle(text: string): string | null {
    // Try to find text in quotes or after author/year pattern
    const quotedMatch = text.match(/"([^"]{10,200})"|"([^"]{10,200})"/);
    if (quotedMatch) {
      return (quotedMatch[1] || quotedMatch[2]).trim();
    }

    // Try to find title after year pattern: (2020). Title.
    const afterYearMatch = text.match(/\(\d{4}\)\.\s*(.{10,200}?)(?:\.|,\s*[A-Z])/);
    if (afterYearMatch?.[1]) {
      return afterYearMatch[1].trim();
    }

    return null;
  }

  private extractReferenceAuthors(text: string): string | null {
    // Authors are usually at the beginning before the year
    const authorsMatch = text.match(/^(.{5,200}?)(?:\(\d{4}\)|,\s*\d{4})/);
    if (authorsMatch?.[1]) {
      return authorsMatch[1].trim();
    }

    return null;
  }

  private extractReferenceYear(text: string): number | null {
    const yearMatch = text.match(/\(?((?:19|20)\d{2})\)?/);
    if (yearMatch?.[1]) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1900 && year <= new Date().getFullYear() + 1) {
        return year;
      }
    }

    return null;
  }
}
