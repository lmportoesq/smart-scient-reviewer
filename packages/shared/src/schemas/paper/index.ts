import { z } from 'zod';
import { AnalysisStatus, ReviewPriority } from '../../types';

export const paperResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  doi: z.string().nullable(),
  pmid: z.string().nullable(),
  journal: z.string().nullable(),
  publicationYear: z.number().int().nullable(),
  authors: z.array(z.string()).nullable(),
  analysisStatus: z.nativeEnum(AnalysisStatus),
  reviewPriority: z.nativeEnum(ReviewPriority).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PaperResponse = z.infer<typeof paperResponseSchema>;

export const documentUploadResponseSchema = z.object({
  documentId: z.string().uuid(),
  paperId: z.string().uuid(),
  status: z.literal('UPLOADED'),
});

export type DocumentUploadResponse = z.infer<typeof documentUploadResponseSchema>;
