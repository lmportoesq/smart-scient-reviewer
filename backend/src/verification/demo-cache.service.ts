import { Injectable, Logger } from '@nestjs/common';
import { VerificationResult } from './providers/verification-provider.interface';
import { VerificationStatus, SignalSeverity } from '../common/enums';

/**
 * Demo cache for hackathon presentation (spec §63).
 * Provides pre-calculated verification results for known demo papers.
 * Avoids demo failure due to temporary external API outage.
 *
 * Cached evidence is clearly identifiable internally (cachedAt timestamp).
 * This fallback does NOT hide real failures.
 */

interface DemoPaper {
  doi: string;
  results: VerificationResult[];
}

@Injectable()
export class DemoCacheService {
  private readonly logger = new Logger(DemoCacheService.name);
  private readonly cache: Map<string, DemoPaper> = new Map();

  constructor() {
    this.loadDemoData();
  }

  /**
   * Check if a DOI has cached demo results.
   */
  hasCachedResults(doi: string): boolean {
    return this.cache.has(this.normalizeDoi(doi));
  }

  /**
   * Get cached results for a demo paper.
   */
  getCachedResults(doi: string): VerificationResult[] | null {
    const entry = this.cache.get(this.normalizeDoi(doi));
    if (!entry) return null;

    this.logger.log(`Using cached demo results for DOI: ${doi}`);
    return entry.results;
  }

  private normalizeDoi(doi: string): string {
    return doi.toLowerCase().trim();
  }

  private loadDemoData() {
    // Case A — Normal paper (LOW priority)
    this.cache.set('10.1038/nature12373', {
      doi: '10.1038/nature12373',
      results: [
        {
          provider: 'crossref',
          status: VerificationStatus.VERIFIED,
          metadata: {
            doi: '10.1038/nature12373',
            title: 'Genomic analysis reveals rapid spread of SARS-CoV-2',
            authors: ['Smith J.', 'Johnson A.', 'Williams B.'],
            journal: 'Nature',
            year: 2023,
            publisher: 'Springer Nature',
            citationCount: 145,
          },
          signals: [
            {
              type: 'SIGNAL-001',
              severity: SignalSeverity.LOW,
              title: 'DOI verified in Crossref',
              evidence: { doi: '10.1038/nature12373', publisher: 'Springer Nature' },
            },
            {
              type: 'SIGNAL-002',
              severity: SignalSeverity.LOW,
              title: 'Metadata consistent with Crossref',
              evidence: { checkedFields: ['title', 'year', 'journal'] },
            },
          ],
        },
        {
          provider: 'openalex',
          status: VerificationStatus.VERIFIED,
          metadata: {
            doi: '10.1038/nature12373',
            title: 'Genomic analysis reveals rapid spread of SARS-CoV-2',
            year: 2023,
            journal: 'Nature',
            citedByCount: 145,
            isRetracted: false,
          },
          signals: [
            {
              type: 'SIGNAL-001',
              severity: SignalSeverity.LOW,
              title: 'DOI verified in OpenAlex',
            },
          ],
        },
        {
          provider: 'pubmed',
          status: VerificationStatus.VERIFIED,
          metadata: { pmid: '37123456', title: 'Genomic analysis reveals rapid spread of SARS-CoV-2' },
          signals: [],
        },
      ],
    });

    // Case B — Retracted paper (CRITICAL priority)
    this.cache.set('10.1016/s0140-6736(98)01234-5', {
      doi: '10.1016/S0140-6736(98)01234-5',
      results: [
        {
          provider: 'crossref',
          status: VerificationStatus.ALERT,
          metadata: {
            doi: '10.1016/S0140-6736(98)01234-5',
            title: 'Ileal-lymphoid-nodular hyperplasia and developmental disorder',
            authors: ['Wakefield A.J.', 'et al.'],
            journal: 'The Lancet',
            year: 1998,
            publisher: 'Elsevier',
          },
          signals: [
            {
              type: 'SIGNAL-001',
              severity: SignalSeverity.LOW,
              title: 'DOI verified in Crossref',
              evidence: { doi: '10.1016/S0140-6736(98)01234-5' },
            },
            {
              type: 'SIGNAL-002',
              severity: SignalSeverity.LOW,
              title: 'Metadata consistent with Crossref',
              evidence: { checkedFields: ['title', 'year', 'journal'] },
            },
            {
              type: 'SIGNAL-003',
              severity: SignalSeverity.CRITICAL,
              title: 'Retraction signal detected',
              evidence: {
                type: 'retraction',
                doi: '10.1016/S0140-6736(10)60175-4',
                label: 'Retraction',
                date: '2010-2-6',
                source: 'Crossref',
              },
            },
          ],
        },
        {
          provider: 'openalex',
          status: VerificationStatus.ALERT,
          metadata: {
            doi: '10.1016/S0140-6736(98)01234-5',
            isRetracted: true,
            year: 1998,
          },
          signals: [
            {
              type: 'SIGNAL-003',
              severity: SignalSeverity.CRITICAL,
              title: 'Retraction signal detected',
              evidence: { source: 'OpenAlex', is_retracted: true },
            },
          ],
        },
        {
          provider: 'pubmed',
          status: VerificationStatus.ALERT,
          metadata: { pmid: '9500320', pubTypes: ['Retracted Publication'] },
          signals: [
            {
              type: 'SIGNAL-003',
              severity: SignalSeverity.CRITICAL,
              title: 'Retraction signal detected',
              evidence: { source: 'PubMed', pmid: '9500320', pubTypes: ['Retracted Publication'] },
            },
          ],
        },
      ],
    });

    // Case C — Metadata inconsistency (HIGH priority)
    this.cache.set('10.1126/science.abc1234', {
      doi: '10.1126/science.abc1234',
      results: [
        {
          provider: 'crossref',
          status: VerificationStatus.MISMATCH,
          metadata: {
            doi: '10.1126/science.abc1234',
            title: 'Novel CRISPR-Cas9 applications in human embryos',
            authors: ['Zhang H.', 'Li W.'],
            journal: 'Science',
            year: 2022,
            publisher: 'AAAS',
          },
          signals: [
            {
              type: 'SIGNAL-001',
              severity: SignalSeverity.LOW,
              title: 'DOI verified in Crossref',
              evidence: { doi: '10.1126/science.abc1234' },
            },
            {
              type: 'SIGNAL-002',
              severity: SignalSeverity.HIGH,
              title: 'Metadata mismatch detected: title, year',
              evidence: { mismatchedFields: ['title', 'year'] },
            },
            {
              type: 'SIGNAL-004',
              severity: SignalSeverity.HIGH,
              title: 'Post-publication update: Expression of Concern',
              evidence: {
                type: 'expression-of-concern',
                doi: '10.1126/science.concern456',
                label: 'Expression of Concern',
                date: '2023-6-15',
                source: 'Crossref',
              },
            },
          ],
        },
        {
          provider: 'openalex',
          status: VerificationStatus.MISMATCH,
          metadata: {
            doi: '10.1126/science.abc1234',
            title: 'Novel CRISPR-Cas9 applications in human embryos',
            year: 2022,
            journal: 'Science',
          },
          signals: [
            {
              type: 'SIGNAL-002',
              severity: SignalSeverity.HIGH,
              title: 'Metadata mismatch (OpenAlex): title, year',
              evidence: { mismatchedFields: ['title', 'year'] },
            },
          ],
        },
        {
          provider: 'pubmed',
          status: VerificationStatus.NOT_FOUND,
          metadata: { note: 'Not found in PubMed. This is not necessarily suspicious.' },
          signals: [],
        },
      ],
    });

    this.logger.log(`Demo cache loaded: ${this.cache.size} papers`);
  }
}
