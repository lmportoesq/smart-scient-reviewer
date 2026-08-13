import { Injectable } from '@nestjs/common';

@Injectable()
export class DoiExtractorService {
  // DOI regex pattern: 10.XXXX/any-characters
  private readonly doiPattern = /\b(10\.\d{4,9}\/[^\s]+)\b/gi;

  // PMID patterns
  private readonly pmidPatterns = [
    /PMID[:\s]*(\d{5,10})/i,
    /PubMed[:\s]*(\d{5,10})/i,
    /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{5,10})/i,
  ];

  /**
   * Extract the primary DOI from text.
   * Returns the first valid DOI found, cleaned of trailing punctuation.
   */
  extractDoi(text: string): string | null {
    const matches = text.match(this.doiPattern);

    if (!matches || matches.length === 0) {
      return null;
    }

    // Clean the first DOI found (remove trailing punctuation)
    const doi = this.cleanDoi(matches[0]);
    return doi;
  }

  /**
   * Extract all DOIs from text (useful for reference extraction).
   */
  extractAllDois(text: string): string[] {
    const matches = text.match(this.doiPattern);

    if (!matches) {
      return [];
    }

    return [...new Set(matches.map((doi) => this.cleanDoi(doi)))];
  }

  /**
   * Extract PMID from text.
   */
  extractPmid(text: string): string | null {
    for (const pattern of this.pmidPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Clean DOI by removing trailing punctuation that's not part of the DOI.
   */
  private cleanDoi(doi: string): string {
    // Remove common trailing punctuation
    return doi.replace(/[.,;:)\]}>]+$/, '').trim();
  }
}
