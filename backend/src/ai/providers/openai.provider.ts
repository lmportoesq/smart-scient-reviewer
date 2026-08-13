import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, AIAnalysisInput, AIAnalysisRawResult } from './ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gpt-4o';
  }

  async analyzePaper(input: AIAnalysisInput): Promise<AIAnalysisRawResult> {
    if (!this.apiKey) {
      throw new Error('AI_API_KEY not configured');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    const startTime = Date.now();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    const duration = Date.now() - startTime;
    this.logger.log(`OpenAI response received in ${duration}ms`);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed as AIAnalysisRawResult;
  }

  private buildSystemPrompt(): string {
    return `You are a scientific paper analysis assistant for ScientificGuard AI.

Your role is to analyze scientific papers and extract structured information.

RULES:
- You MUST respond with valid JSON matching the exact schema below.
- You MUST NOT make final approval/rejection decisions about the paper.
- You MUST NOT use terms like: APPROVED, REJECTED, VALID, INVALID, FAKE, FRAUDULENT.
- You MAY identify concerns, claims that need verification, and methodology issues.
- If you are uncertain about something, set supportLevel to "PENDING_REVIEW".
- Confidence values must be between 0 and 1.
- If you cannot extract a page number, use null.

REQUIRED JSON SCHEMA:
{
  "summary": "string - brief summary of the paper's main contribution",
  "claims": [
    {
      "claim": "string - the scientific claim",
      "page": number | null,
      "supportingText": "string | null - relevant quote from the paper",
      "supportLevel": "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "PENDING_REVIEW",
      "confidence": number (0-1),
      "needsHumanReview": boolean
    }
  ],
  "methodologySignals": [
    {
      "concern": "string - methodology aspect that deserves attention",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "explanation": "string - why this deserves attention",
      "page": number | null
    }
  ],
  "uncertainties": ["string - things you cannot determine with confidence"]
}`;
  }

  private buildUserPrompt(input: AIAnalysisInput): string {
    let prompt = `Analyze the following scientific paper.\n\n`;

    // Metadata
    if (input.metadata.title) {
      prompt += `TITLE: ${input.metadata.title}\n`;
    }
    if (input.metadata.doi) {
      prompt += `DOI: ${input.metadata.doi}\n`;
    }
    if (input.metadata.journal) {
      prompt += `JOURNAL: ${input.metadata.journal}\n`;
    }
    if (input.metadata.year) {
      prompt += `YEAR: ${input.metadata.year}\n`;
    }
    if (input.metadata.authors?.length) {
      prompt += `AUTHORS: ${input.metadata.authors.join(', ')}\n`;
    }

    // Verification results
    if (input.verificationResults.length > 0) {
      prompt += `\nVERIFICATION RESULTS:\n`;
      for (const result of input.verificationResults) {
        prompt += `- ${result.provider}: ${result.status}`;
        if (result.signals.length > 0) {
          prompt += ` (signals: ${result.signals.map((s) => s.title).join('; ')})`;
        }
        prompt += `\n`;
      }
    }

    // Signals
    if (input.signals.length > 0) {
      prompt += `\nDETECTED SIGNALS:\n`;
      for (const signal of input.signals) {
        prompt += `- [${signal.severity}] ${signal.type}: ${signal.title}\n`;
      }
    }

    // Paper text (truncated to fit context)
    const maxTextLength = 12000;
    const text = input.text.length > maxTextLength
      ? input.text.substring(0, maxTextLength) + '\n\n[TEXT TRUNCATED]'
      : input.text;

    prompt += `\nPAPER TEXT:\n${text}\n`;

    // References
    if (input.references.length > 0) {
      prompt += `\nREFERENCES (first ${Math.min(input.references.length, 10)}):\n`;
      for (const ref of input.references.slice(0, 10)) {
        prompt += `[${ref.number}] ${ref.title}${ref.doi ? ` (${ref.doi})` : ''}\n`;
      }
    }

    prompt += `\nPlease analyze this paper and respond with the required JSON structure.`;

    return prompt;
  }
}
