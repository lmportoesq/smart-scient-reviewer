import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  VerificationProvider,
  PaperVerificationInput,
  VerificationResult,
  VerificationSignal,
} from './verification-provider.interface';
import { VerificationStatus, SignalSeverity } from '@scientificguard/shared';

// Zod schema for Crossref API response validation
const crossrefWorkSchema = z.object({
  DOI: z.string().optional(),
  title: z.array(z.string()).optional(),
  author: z
    .array(
      z.object({
        given: z.string().optional(),
        family: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  'container-title': z.array(z.string()).optional(),
  published: z
    .object({
      'date-parts': z.array(z.array(z.number())).optional(),
    })
    .optional(),
  'published-print': z
    .object({
      'date-parts': z.array(z.array(z.number())).optional(),
    })
    .optional(),
  publisher: z.string().optional(),
  type: z.string().optional(),
  'update-to': z
    .array(
      z.object({
        DOI: z.string().optional(),
        type: z.string().optional(),
        label: z.string().optional(),
        updated: z
          .object({
            'date-parts': z.array(z.array(z.number())).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  'is-referenced-by-count': z.number().optional(),
  'references-count': z.number().optional(),
  subject: z.array(z.string()).optional(),
});

const crossrefResponseSchema = z.object({
  status: z.string(),
  'message-type': z.string(),
  message: crossrefWorkSchema,
});

type CrossrefWork = z.infer<typeof crossrefWorkSchema>;

@Injectable()
export class CrossrefProvider implements VerificationProvider {
  readonly name = 'crossref';
  private readonly logger = new Logger(CrossrefProvider.name);
  private readonly baseUrl: string;
  private readonly mailto: string;

  constructor() {
    this.baseUrl = process.env.CROSSREF_API_URL || 'https://api.crossref.org';
    this.mailto = process.env.CROSSREF_MAILTO || 'dev@scientificguard.local';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/works?rows=0&mailto=${this.mailto}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async verify(input: PaperVerificationInput): Promise<VerificationResult> {
    if (!input.doi) {
      return {
        provider: this.name,
        status: VerificationStatus.NOT_APPLICABLE,
        metadata: {},
        signals: [],
      };
    }

    try {
      const work = await this.fetchWork(input.doi);

      if (!work) {
        return {
          provider: this.name,
          status: VerificationStatus.NOT_FOUND,
          metadata: { doi: input.doi },
          signals: [
            {
              type: 'SIGNAL-001',
              severity: SignalSeverity.HIGH,
              title: 'DOI not found in Crossref',
              evidence: { doi: input.doi },
            },
          ],
        };
      }

      const signals: VerificationSignal[] = [];

      // SIGNAL-001: DOI Verification
      signals.push({
        type: 'SIGNAL-001',
        severity: SignalSeverity.LOW,
        title: 'DOI verified in Crossref',
        evidence: { doi: work.DOI, publisher: work.publisher },
      });

      // SIGNAL-002: Metadata Consistency
      const metadataSignal = this.checkMetadataConsistency(input, work);
      if (metadataSignal) {
        signals.push(metadataSignal);
      }

      // SIGNAL-003: Retraction
      const retractionSignal = this.checkRetraction(work);
      if (retractionSignal) {
        signals.push(retractionSignal);
      }

      // SIGNAL-004: Post-publication updates
      const updateSignals = this.checkPostPublicationUpdates(work);
      signals.push(...updateSignals);

      // Determine overall status
      const hasRetraction = signals.some(
        (s) => s.type === 'SIGNAL-003' && s.severity === SignalSeverity.CRITICAL,
      );
      const hasMismatch = signals.some(
        (s) => s.type === 'SIGNAL-002' && s.severity === SignalSeverity.HIGH,
      );

      let status = VerificationStatus.VERIFIED;
      if (hasRetraction) {
        status = VerificationStatus.ALERT;
      } else if (hasMismatch) {
        status = VerificationStatus.MISMATCH;
      }

      return {
        provider: this.name,
        status,
        metadata: this.extractMetadata(work),
        signals,
      };
    } catch (error) {
      this.logger.error(`Crossref verification failed for DOI: ${input.doi}`, error);
      return {
        provider: this.name,
        status: VerificationStatus.ERROR,
        metadata: { doi: input.doi, error: 'Provider request failed' },
        signals: [],
      };
    }
  }

  private async fetchWork(doi: string): Promise<CrossrefWork | null> {
    const url = `${this.baseUrl}/works/${encodeURIComponent(doi)}?mailto=${this.mailto}`;

    const response = await fetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Crossref API returned ${response.status}`);
    }

    const rawData = await response.json();

    // Validate response with Zod
    const parsed = crossrefResponseSchema.safeParse(rawData);

    if (!parsed.success) {
      this.logger.warn('Crossref response validation failed', parsed.error.errors);
      // Try to use the message directly if top-level validation fails
      const workParsed = crossrefWorkSchema.safeParse(rawData?.message);
      if (workParsed.success) {
        return workParsed.data;
      }
      throw new Error('Invalid Crossref response format');
    }

    return parsed.data.message;
  }

  private checkMetadataConsistency(
    input: PaperVerificationInput,
    work: CrossrefWork,
  ): VerificationSignal | null {
    const mismatches: string[] = [];

    // Compare title
    if (input.title && work.title?.[0]) {
      if (!this.normalizedMatch(input.title, work.title[0])) {
        mismatches.push('title');
      }
    }

    // Compare year
    if (input.year) {
      const crossrefYear = this.extractYear(work);
      if (crossrefYear && crossrefYear !== input.year) {
        mismatches.push('year');
      }
    }

    // Compare journal
    if (input.journal && work['container-title']?.[0]) {
      if (!this.normalizedMatch(input.journal, work['container-title'][0])) {
        mismatches.push('journal');
      }
    }

    if (mismatches.length === 0) {
      return {
        type: 'SIGNAL-002',
        severity: SignalSeverity.LOW,
        title: 'Metadata consistent with Crossref',
        evidence: { checkedFields: ['title', 'year', 'journal'] },
      };
    }

    const severity =
      mismatches.length >= 2 ? SignalSeverity.HIGH : SignalSeverity.MEDIUM;

    return {
      type: 'SIGNAL-002',
      severity,
      title: `Metadata mismatch detected: ${mismatches.join(', ')}`,
      evidence: { mismatchedFields: mismatches },
    };
  }

  private checkRetraction(work: CrossrefWork): VerificationSignal | null {
    const updates = work['update-to'] || [];

    const retraction = updates.find(
      (u) => u.type?.toLowerCase() === 'retraction',
    );

    if (retraction) {
      return {
        type: 'SIGNAL-003',
        severity: SignalSeverity.CRITICAL,
        title: 'Retraction signal detected',
        evidence: {
          type: 'retraction',
          doi: retraction.DOI,
          label: retraction.label,
          date: retraction.updated?.['date-parts']?.[0]?.join('-'),
          source: 'Crossref',
        },
      };
    }

    return null;
  }

  private checkPostPublicationUpdates(work: CrossrefWork): VerificationSignal[] {
    const updates = work['update-to'] || [];
    const signals: VerificationSignal[] = [];

    for (const update of updates) {
      const type = update.type?.toLowerCase() || '';

      // Skip retractions (handled separately)
      if (type === 'retraction') continue;

      let severity = SignalSeverity.MEDIUM;
      if (type === 'expression-of-concern' || type === 'expression_of_concern') {
        severity = SignalSeverity.HIGH;
      } else if (type === 'correction' || type === 'erratum') {
        severity = SignalSeverity.MEDIUM;
      }

      signals.push({
        type: 'SIGNAL-004',
        severity,
        title: `Post-publication update: ${update.label || type}`,
        evidence: {
          type: update.type,
          doi: update.DOI,
          label: update.label,
          date: update.updated?.['date-parts']?.[0]?.join('-'),
          source: 'Crossref',
        },
      });
    }

    return signals;
  }

  private extractMetadata(work: CrossrefWork): Record<string, unknown> {
    return {
      doi: work.DOI,
      title: work.title?.[0] || null,
      authors: work.author?.map((a) => a.name || `${a.given || ''} ${a.family || ''}`.trim()) || [],
      journal: work['container-title']?.[0] || null,
      publisher: work.publisher || null,
      year: this.extractYear(work),
      type: work.type || null,
      citationCount: work['is-referenced-by-count'] || 0,
      referencesCount: work['references-count'] || 0,
      subjects: work.subject || [],
    };
  }

  private extractYear(work: CrossrefWork): number | null {
    const dateParts =
      work.published?.['date-parts']?.[0] ||
      work['published-print']?.['date-parts']?.[0];

    if (dateParts && dateParts[0]) {
      return dateParts[0];
    }

    return null;
  }

  /**
   * Normalize strings for comparison:
   * - lowercase
   * - remove extra whitespace
   * - remove common punctuation differences
   */
  private normalizedMatch(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\s\-–—]+/g, ' ')
        .replace(/[.,;:'"!?()[\]{}]/g, '')
        .trim();

    const na = normalize(a);
    const nb = normalize(b);

    // Exact match after normalization
    if (na === nb) return true;

    // One contains the other (handles subtitle differences)
    if (na.includes(nb) || nb.includes(na)) return true;

    // High similarity (simple Jaccard on words)
    const wordsA = new Set(na.split(' '));
    const wordsB = new Set(nb.split(' '));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    const similarity = intersection / union;

    return similarity > 0.8;
  }
}
