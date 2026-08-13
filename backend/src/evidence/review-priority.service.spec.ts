import { ReviewPriorityService } from './review-priority.service';

describe('ReviewPriorityService', () => {
  let service: ReviewPriorityService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      evidence: { findMany: jest.fn() },
      verification: { findMany: jest.fn() },
      paper: { update: jest.fn() },
    };
    service = new ReviewPriorityService(mockPrisma);
  });

  describe('calculate', () => {
    it('should return CRITICAL when retraction signal exists', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([
        { severity: 'CRITICAL', signalId: 'SIGNAL-003' },
      ]);
      mockPrisma.verification.findMany.mockResolvedValue([]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('CRITICAL');
    });

    it('should return HIGH when expression of concern exists', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([
        { severity: 'HIGH', signalId: 'SIGNAL-004' },
      ]);
      mockPrisma.verification.findMany.mockResolvedValue([]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('HIGH');
    });

    it('should return MEDIUM when reference mismatch exists', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([
        { severity: 'MEDIUM', signalId: 'SIGNAL-005' },
      ]);
      mockPrisma.verification.findMany.mockResolvedValue([]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('MEDIUM');
    });

    it('should return LOW when no significant signals', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([]);
      mockPrisma.verification.findMany.mockResolvedValue([
        { severity: 'LOW' },
      ]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('LOW');
    });

    it('should return LOW when no signals at all', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([]);
      mockPrisma.verification.findMany.mockResolvedValue([]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('LOW');
    });

    it('should use highest severity when multiple signals exist', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([
        { severity: 'LOW', signalId: 'SIGNAL-001' },
        { severity: 'MEDIUM', signalId: 'SIGNAL-005' },
        { severity: 'CRITICAL', signalId: 'SIGNAL-003' },
      ]);
      mockPrisma.verification.findMany.mockResolvedValue([]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('CRITICAL');
    });

    it('should consider verification severities too', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([
        { severity: 'LOW' },
      ]);
      mockPrisma.verification.findMany.mockResolvedValue([
        { severity: 'HIGH' },
      ]);

      const result = await service.calculate('paper-1');
      expect(result).toBe('HIGH');
    });
  });

  describe('calculateAndPersist', () => {
    it('should calculate priority and update the paper', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([
        { severity: 'MEDIUM' },
      ]);
      mockPrisma.verification.findMany.mockResolvedValue([]);
      mockPrisma.paper.update.mockResolvedValue({});

      const result = await service.calculateAndPersist('paper-1');

      expect(result).toBe('MEDIUM');
      expect(mockPrisma.paper.update).toHaveBeenCalledWith({
        where: { id: 'paper-1' },
        data: { reviewPriority: 'MEDIUM' },
      });
    });
  });
});
