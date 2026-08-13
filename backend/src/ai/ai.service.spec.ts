import { AiService } from './ai.service';
import { OpenAIProvider } from './providers/openai.provider';

describe('AiService', () => {
  let service: AiService;
  let mockPrisma: any;
  let mockProvider: Partial<OpenAIProvider>;

  const validAIResponse = {
    summary: 'This paper presents a novel approach to gene therapy.',
    claims: [
      {
        claim: 'The treatment reduced tumor size by 50%',
        page: 6,
        supportingText: 'Results show a 50% reduction in tumor volume',
        supportLevel: 'PARTIAL',
        confidence: 0.75,
        needsHumanReview: true,
      },
    ],
    methodologySignals: [
      {
        concern: 'Small sample size (n=12)',
        severity: 'MEDIUM',
        explanation: 'Sample size may not be sufficient for generalizable conclusions',
        page: 4,
      },
    ],
    uncertainties: ['Cannot verify the control group selection criteria'],
  };

  beforeEach(() => {
    mockPrisma = {
      aIAnalysis: {
        create: jest.fn().mockResolvedValue({ id: 'analysis-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      claim: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockProvider = {
      name: 'openai',
      analyzePaper: jest.fn(),
    };

    service = new AiService(mockPrisma, mockProvider as any);
  });

  describe('analyzePaper', () => {
    const mockInput = {
      text: 'Sample paper text...',
      metadata: { title: 'Test Paper', doi: '10.1234/test' },
      verificationResults: [],
      references: [],
      signals: [],
    };

    it('should successfully analyze paper with valid AI response', async () => {
      (mockProvider.analyzePaper as jest.Mock).mockResolvedValue(validAIResponse);

      const result = await service.analyzePaper('paper-1', mockInput) as any;

      expect(result.status).toBe('COMPLETED');
      expect(result.claimsCount).toBe(1);
      expect(result.methodologySignalsCount).toBe(1);
      expect(result.summary).toBe(validAIResponse.summary);

      // Should persist claims
      expect(mockPrisma.claim.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.claim.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paperId: 'paper-1',
          claim: 'The treatment reduced tumor size by 50%',
          supportLevel: 'PARTIAL',
          confidence: 0.75,
          needsHumanReview: true,
        }),
      });

      // Should mark analysis as validated
      expect(mockPrisma.aIAnalysis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validated: true,
            status: 'COMPLETED',
          }),
        }),
      );
    });

    it('should return AI_ANALYSIS_ERROR when response is invalid and retry fails', async () => {
      const invalidResponse = {
        summary: 'Valid summary',
        // Missing required fields: claims, methodologySignals, uncertainties
      };

      (mockProvider.analyzePaper as jest.Mock).mockResolvedValue(invalidResponse);

      const result = await service.analyzePaper('paper-1', mockInput);

      expect(result.status).toBe('AI_ANALYSIS_ERROR');
      expect(mockPrisma.aIAnalysis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validated: false,
            status: 'FAILED',
          }),
        }),
      );
    });

    it('should return AI_ANALYSIS_ERROR when provider throws', async () => {
      (mockProvider.analyzePaper as jest.Mock).mockRejectedValue(
        new Error('API key invalid'),
      );

      const result = await service.analyzePaper('paper-1', mockInput);

      expect(result.status).toBe('AI_ANALYSIS_ERROR');
    });

    it('should retry once when validation fails', async () => {
      // First call: invalid response
      (mockProvider.analyzePaper as jest.Mock)
        .mockResolvedValueOnce({ summary: 'incomplete' })
        // Second call (retry): valid response
        .mockResolvedValueOnce(validAIResponse);

      const result = await service.analyzePaper('paper-1', mockInput);

      expect(result.status).toBe('COMPLETED');
      expect(mockProvider.analyzePaper).toHaveBeenCalledTimes(2);
    });

    it('should validate confidence is between 0 and 1', async () => {
      const badConfidence = {
        ...validAIResponse,
        claims: [
          {
            ...validAIResponse.claims[0],
            confidence: 1.5, // Invalid!
          },
        ],
      };

      (mockProvider.analyzePaper as jest.Mock).mockResolvedValue(badConfidence);

      const result = await service.analyzePaper('paper-1', mockInput);

      // Should fail validation (confidence > 1)
      expect(result.status).toBe('AI_ANALYSIS_ERROR');
    });

    it('should validate supportLevel enum values', async () => {
      const badSupportLevel = {
        ...validAIResponse,
        claims: [
          {
            ...validAIResponse.claims[0],
            supportLevel: 'APPROVED', // PROHIBITED per spec §26
          },
        ],
      };

      (mockProvider.analyzePaper as jest.Mock).mockResolvedValue(badSupportLevel);

      const result = await service.analyzePaper('paper-1', mockInput);

      // Should fail validation (invalid enum)
      expect(result.status).toBe('AI_ANALYSIS_ERROR');
    });
  });
});
