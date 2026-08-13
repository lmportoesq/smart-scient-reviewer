import { VerificationStatus, SignalSeverity } from '@scientificguard/shared';

export interface PaperVerificationInput {
  doi?: string;
  pmid?: string;
  title?: string;
  authors?: string[];
  journal?: string;
  year?: number;
}

export interface VerificationSignal {
  type: string;
  severity: SignalSeverity;
  title: string;
  evidence?: Record<string, unknown>;
}

export interface VerificationResult {
  provider: string;
  status: VerificationStatus;
  metadata: Record<string, unknown>;
  signals: VerificationSignal[];
  raw?: unknown;
}

export interface VerificationProvider {
  readonly name: string;
  verify(input: PaperVerificationInput): Promise<VerificationResult>;
  isAvailable(): Promise<boolean>;
}
