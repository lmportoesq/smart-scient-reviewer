import { z } from 'zod';
import { SignalSeverity, DataTrustLevel } from '../../types';

export const evidenceSchema = z.object({
  id: z.string().uuid(),
  paperId: z.string().uuid(),
  signalId: z.string(),
  severity: z.nativeEnum(SignalSeverity),
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string().url().nullable(),
  evidenceData: z.record(z.unknown()),
  trustLevel: z.nativeEnum(DataTrustLevel).optional(),
  createdAt: z.string().datetime(),
});

export type EvidenceResponse = z.infer<typeof evidenceSchema>;
