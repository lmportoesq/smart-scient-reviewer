import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  VerificationProvider,
  PaperVerificationInput,
  VerificationResult,
  VerificationSignal,
} from './verification-provider.interface';
import { VerificationStatus, SignalSeverity } from '../../common/enums';

// Zod schemas for PubMed/NCBI API responses
const esearchResultSchema = z.object({
  esearchresult: z.object({
    count: z.string(),
    idlist: z.array(z.string()),
  }),
});

const pubmedArticleSchema = z.object({
  uid: z.string(),
  pubdate: z.string().optional(),
  title: z.string().optional(),
  authors: z.array(z.object({
    name: z.string().optional(),
    authtype: z.string().optional(),
  })).optional(),
  source: z.string().optional(), // journal
  pubtype: z.array(z.string()).optional(),
  articleids: z.array(z.object({
    idtype: z.string(),
    value: z.string(),
  })).optional(),
  pubstatus: z.string().optional(),
});

const esummaryResultSchema = z.object({
  result: z.record(z.unknown()),
});

type PubMedArticle = z.infer<typeof pubmedArticleSchema>;

@Injectable()
export class PubMedProvider implements VerificationProvider {
  readonly name = 'pubmed';
  private readonly logger = new Logger(PubMedProvider.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NCBI_API_URL || 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/einfo.fcgi?db=pubmed&retmode=json`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async verify(input: PaperVerificationInput): Promise<VerificationResult> {
    // PubMed is primarily for biomedical. If no PMID and no DOI, it's not applicable.
    if (!input.pmid && !input.doi) {
      return {
        provider: this.name,
        status: VerificationStatus.NOT_APPLICABLE,
        metadata: {},
        signals: [],
      };
    }

    try {
      const article = await this.fetchArticle(input.pmid, input.doi);

      if (!article) {
        // Per spec §13: not found in PubMed must NOT be considered suspicious
        return {
          provider: this.name,
          status: VerificationStatus.NOT_FOUND,
          metadata: {
            pmid: input.pmid,
            doi: input.doi,
            note: 'Not found in PubMed. This is not necessarily suspicious.',
          },
          signals: [],
        };
      }

      const signals: VerificationSignal[] = [];

      // Check publication type for retraction signals
      const retractionSignal = this.checkRetraction(article);
      if (retractionSignal) {
        signals.push(retractionSignal);
      }

      // Check metadata consistency
      const metadataSignal = this.checkMetadataConsistency(input, article);
      if (metadataSignal) {
        signals.push(metadataSignal);
      }

      const hasRetraction = retractionSignal?.severity === SignalSeverity.CRITICAL;

      return {
        provider: this.name,
        status: hasRetraction ? VerificationStatus.ALERT : VerificationStatus.VERIFIED,
        metadata: this.extractMetadata(article),
        signals,
      };
    } catch (error) {
      this.logger.error('PubMed verification failed', error);
      return {
        provider: this.name,
        status: VerificationStatus.ERROR,
        metadata: { error: 'PubMed unavailable' },
        signals: [],
      };
    }
  }

  private async fetchArticle(
    pmid?: string,
    doi?: string,
  ): Promise<PubMedArticle | null> {
    let resolvedPmid = pmid;

    // If we only have DOI, search for PMID first
    if (!resolvedPmid && doi) {
      const found = await this.searchByDoi(doi);
      resolvedPmid = found || undefined;
    }

    if (!resolvedPmid) {
      return null;
    }

    // Fetch article summary
    const url = `${this.baseUrl}/esummary.fcgi?db=pubmed&id=${resolvedPmid}&retmode=json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`PubMed esummary returned ${response.status}`);
    }

    const rawData = await response.json();

    // Validate top-level structure
    const parsed = esummaryResultSchema.safeParse(rawData);
    if (!parsed.success) {
      this.logger.warn('PubMed esummary validation failed');
      throw new Error('Invalid PubMed response format');
    }

    const articleData = parsed.data.result[resolvedPmid];
    if (!articleData) {
      return null;
    }

    // Validate article
    const articleParsed = pubmedArticleSchema.safeParse(articleData);
    if (!articleParsed.success) {
      this.logger.warn('PubMed article validation failed', articleParsed.error.errors);
      // Try to use partial data
      return articleData as any;
    }

    return articleParsed.data;
  }

  private async searchByDoi(doi: string): Promise<string | null> {
    const url = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[doi]&retmode=json`;

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const rawData = await response.json();
    const parsed = esearchResultSchema.safeParse(rawData);

    if (!parsed.success) {
      return null;
    }

    const idList = parsed.data.esearchresult.idlist;
    return idList.length > 0 ? idList[0] : null;
  }

  private checkRetraction(article: PubMedArticle): VerificationSignal | null {
    const pubTypes = article.pubtype || [];

    const retractionTypes = pubTypes.map((t) => t.toLowerCase());

    if (retractionTypes.includes('retracted publication') ||
        retractionTypes.includes('retraction of publication')) {
      return {
        type: 'SIGNAL-003',
        severity: SignalSeverity.CRITICAL,
        title: 'Retraction signal detected',
        evidence: {
          source: 'PubMed',
          pmid: article.uid,
          pubTypes: pubTypes,
        },
      };
    }

    if (retractionTypes.includes('expression of concern')) {
      return {
        type: 'SIGNAL-004',
        severity: SignalSeverity.HIGH,
        title: 'Expression of concern detected (PubMed)',
        evidence: {
          source: 'PubMed',
          pmid: article.uid,
          pubTypes: pubTypes,
        },
      };
    }

    return null;
  }

  private checkMetadataConsistency(
    input: PaperVerificationInput,
    article: PubMedArticle,
  ): VerificationSignal | null {
    const mismatches: string[] = [];

    if (input.title && article.title) {
      if (!this.normalizedMatch(input.title, article.title)) {
        mismatches.push('title');
      }
    }

    if (input.journal && article.source) {
      if (!this.normalizedMatch(input.journal, article.source)) {
        mismatches.push('journal');
      }
    }

    if (mismatches.length === 0) {
      return null; // Only report mismatches for PubMed (supplementary source)
    }

    return {
      type: 'SIGNAL-002',
      severity: mismatches.length >= 2 ? SignalSeverity.HIGH : SignalSeverity.MEDIUM,
      title: `Metadata mismatch (PubMed): ${mismatches.join(', ')}`,
      evidence: { mismatchedFields: mismatches, pmid: article.uid },
    };
  }

  private extractMetadata(article: PubMedArticle): Record<string, unknown> {
    return {
      pmid: article.uid,
      title: article.title || null,
      journal: article.source || null,
      pubDate: article.pubdate || null,
      authors: article.authors?.map((a) => a.name).filter(Boolean) || [],
      pubTypes: article.pubtype || [],
    };
  }

  private normalizedMatch(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\s\-–—]+/g, ' ')
        .replace(/[.,;:'"!?()[\]{}]/g, '')
        .trim();

    const na = normalize(a);
    const nb = normalize(b);

    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;

    const wordsA = new Set(na.split(' '));
    const wordsB = new Set(nb.split(' '));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    return intersection / union > 0.7;
  }
}
