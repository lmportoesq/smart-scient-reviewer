import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  VerificationProvider,
  PaperVerificationInput,
  VerificationResult,
  VerificationSignal,
} from './verification-provider.interface';
import { VerificationStatus, SignalSeverity } from '../../common/enums';

// Zod schema for OpenAlex work response validation
const openAlexAuthorshipSchema = z.object({
  author: z.object({
    display_name: z.string().optional(),
    id: z.string().optional(),
  }).optional(),
});

const openAlexWorkSchema = z.object({
  id: z.string().optional(),
  doi: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  publication_year: z.number().nullable().optional(),
  publication_date: z.string().nullable().optional(),
  primary_location: z.object({
    source: z.object({
      display_name: z.string().nullable().optional(),
      issn_l: z.string().nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
  authorships: z.array(openAlexAuthorshipSchema).optional(),
  cited_by_count: z.number().optional(),
  is_retracted: z.boolean().optional(),
  referenced_works: z.array(z.string()).optional(),
  type: z.string().optional(),
});

type OpenAlexWork = z.infer<typeof openAlexWorkSchema>;

@Injectable()
export class OpenAlexProvider implements VerificationProvider {
  readonly name = 'openalex';
  private readonly logger = new Logger(OpenAlexProvider.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OPENALEX_API_URL || 'https://api.openalex.org';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/works?per_page=1`);
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
      const work = await this.fetchByDoi(input.doi);

      if (!work) {
        return {
          provider: this.name,
          status: VerificationStatus.NOT_FOUND,
          metadata: { doi: input.doi },
          signals: [
            {
              type: 'SIGNAL-001',
              severity: SignalSeverity.MEDIUM,
              title: 'DOI not found in OpenAlex',
              evidence: { doi: input.doi },
            },
          ],
        };
      }

      const signals: VerificationSignal[] = [];

      // SIGNAL-001: DOI verified
      signals.push({
        type: 'SIGNAL-001',
        severity: SignalSeverity.LOW,
        title: 'DOI verified in OpenAlex',
        evidence: { doi: work.doi, openAlexId: work.id },
      });

      // SIGNAL-002: Metadata consistency
      const metadataSignal = this.checkMetadataConsistency(input, work);
      if (metadataSignal) {
        signals.push(metadataSignal);
      }

      // SIGNAL-003: Retraction via is_retracted flag
      if (work.is_retracted) {
        signals.push({
          type: 'SIGNAL-003',
          severity: SignalSeverity.CRITICAL,
          title: 'Retraction signal detected',
          evidence: {
            source: 'OpenAlex',
            is_retracted: true,
            openAlexId: work.id,
          },
        });
      }

      // Determine overall status
      const hasRetraction = work.is_retracted;
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
      this.logger.error(`OpenAlex verification failed for DOI: ${input.doi}`, error);
      return {
        provider: this.name,
        status: VerificationStatus.ERROR,
        metadata: { doi: input.doi, error: 'Provider request failed' },
        signals: [],
      };
    }
  }

  private async fetchByDoi(doi: string): Promise<OpenAlexWork | null> {
    const url = `${this.baseUrl}/works/https://doi.org/${encodeURIComponent(doi)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SmartScientReviewer/1.0 (mailto:dev@scientificguard.local)',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`OpenAlex API returned ${response.status}`);
    }

    const rawData = await response.json();

    // Validate with Zod
    const parsed = openAlexWorkSchema.safeParse(rawData);

    if (!parsed.success) {
      this.logger.warn('OpenAlex response validation failed', parsed.error.errors);
      throw new Error('Invalid OpenAlex response format');
    }

    return parsed.data;
  }

  private checkMetadataConsistency(
    input: PaperVerificationInput,
    work: OpenAlexWork,
  ): VerificationSignal | null {
    const mismatches: string[] = [];

    // Compare title
    const workTitle = work.title || work.display_name;
    if (input.title && workTitle) {
      if (!this.normalizedMatch(input.title, workTitle)) {
        mismatches.push('title');
      }
    }

    // Compare year
    if (input.year && work.publication_year) {
      if (work.publication_year !== input.year) {
        mismatches.push('year');
      }
    }

    // Compare journal
    const workJournal = work.primary_location?.source?.display_name;
    if (input.journal && workJournal) {
      if (!this.normalizedMatch(input.journal, workJournal)) {
        mismatches.push('journal');
      }
    }

    if (mismatches.length === 0) {
      return {
        type: 'SIGNAL-002',
        severity: SignalSeverity.LOW,
        title: 'Metadata consistent with OpenAlex',
        evidence: { checkedFields: ['title', 'year', 'journal'] },
      };
    }

    const severity = mismatches.length >= 2 ? SignalSeverity.HIGH : SignalSeverity.MEDIUM;

    return {
      type: 'SIGNAL-002',
      severity,
      title: `Metadata mismatch (OpenAlex): ${mismatches.join(', ')}`,
      evidence: { mismatchedFields: mismatches },
    };
  }

  private extractMetadata(work: OpenAlexWork): Record<string, unknown> {
    return {
      openAlexId: work.id,
      doi: work.doi,
      title: work.title || work.display_name,
      year: work.publication_year,
      journal: work.primary_location?.source?.display_name || null,
      authors: work.authorships?.map((a) => a.author?.display_name).filter(Boolean) || [],
      citedByCount: work.cited_by_count || 0,
      isRetracted: work.is_retracted || false,
      referencedWorksCount: work.referenced_works?.length || 0,
      type: work.type || null,
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

    return intersection / union > 0.8;
  }
}
