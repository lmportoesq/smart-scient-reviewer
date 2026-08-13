export interface AIAnalysisInput {
  text: string;
  metadata: {
    title?: string;
    doi?: string;
    pmid?: string;
    journal?: string;
    year?: number;
    authors?: string[];
  };
  verificationResults: Array<{
    provider: string;
    status: string;
    signals: Array<{ type: string; severity: string; title: string }>;
  }>;
  references: Array<{
    number: number;
    title: string;
    doi?: string;
  }>;
  signals: Array<{
    type: string;
    severity: string;
    title: string;
  }>;
}

export interface AIAnalysisRawResult {
  summary: string;
  claims: Array<{
    claim: string;
    page: number | null;
    supportingText: string | null;
    supportLevel: string;
    confidence: number;
    needsHumanReview: boolean;
  }>;
  methodologySignals: Array<{
    concern: string;
    severity: string;
    explanation: string;
    page: number | null;
  }>;
  uncertainties: string[];
}

export interface AIProvider {
  readonly name: string;
  analyzePaper(input: AIAnalysisInput): Promise<AIAnalysisRawResult>;
}
