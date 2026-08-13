import { z } from 'zod';
import { SupportLevel } from '../../common/enums';

export const aiClaimSchema = z.object({
  claim: z.string(),
  page: z.number().int().nullable(),
  supportingText: z.string().nullable(),
  supportLevel: z.nativeEnum(SupportLevel),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
});

export const aiMethodologySignalSchema = z.object({
  concern: z.string(),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  explanation: z.string(),
  page: z.number().int().nullable(),
});

export const aiAnalysisOutputSchema = z.object({
  summary: z.string(),
  claims: z.array(aiClaimSchema),
  methodologySignals: z.array(aiMethodologySignalSchema),
  uncertainties: z.array(z.string()),
});

export type AIAnalysisOutput = z.infer<typeof aiAnalysisOutputSchema>;
