import { z } from 'zod';
import { VerificationStatus, SignalSeverity } from '../../types';

export const verificationSignalSchema = z.object({
  type: z.string(),
  severity: z.nativeEnum(SignalSeverity),
  title: z.string(),
  evidence: z.record(z.unknown()).optional(),
});

export type VerificationSignal = z.infer<typeof verificationSignalSchema>;

export const verificationResultSchema = z.object({
  provider: z.string(),
  status: z.nativeEnum(VerificationStatus),
  metadata: z.record(z.unknown()),
  signals: z.array(verificationSignalSchema),
});

export type VerificationResult = z.infer<typeof verificationResultSchema>;

// Reference verification
export const referenceVerificationSchema = z.object({
  referenceNumber: z.number().int(),
  title: z.string(),
  doi: z.string().nullable(),
  status: z.enum(['VERIFIED', 'PARTIAL_MATCH', 'NOT_CONFIDENTLY_MATCHED', 'MISMATCH']),
  source: z.string(),
});

export type ReferenceVerification = z.infer<typeof referenceVerificationSchema>;
