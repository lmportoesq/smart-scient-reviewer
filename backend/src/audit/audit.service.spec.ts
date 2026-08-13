import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new AuditService(mockPrisma);
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      await service.log({
        userId: 'user-1',
        paperId: 'paper-1',
        action: 'REVIEW_CREATED',
        entityType: 'review',
        entityId: 'review-1',
        metadata: { decision: 'REJECT' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          paperId: 'paper-1',
          action: 'REVIEW_CREATED',
          entityType: 'review',
          entityId: 'review-1',
        }),
      });
    });

    it('should sanitize sensitive metadata', async () => {
      await service.log({
        action: 'LOGIN',
        metadata: {
          email: 'test@test.com',
          password: 'secret123',
          apiKey: 'sk-abc123',
          normalField: 'visible',
        },
      });

      const createCall = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.metadata.password).toBe('[REDACTED]');
      expect(createCall.data.metadata.apiKey).toBe('[REDACTED]');
      expect(createCall.data.metadata.email).toBe('test@test.com');
      expect(createCall.data.metadata.normalField).toBe('visible');
    });

    it('should not crash if prisma fails (audit never stops the app)', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(
        service.log({ action: 'LOGIN', userId: 'user-1' }),
      ).resolves.toBeUndefined();
    });

    it('should truncate long user agents', async () => {
      const longUA = 'A'.repeat(1000);

      await service.log({
        action: 'LOGIN',
        userAgent: longUA,
      });

      const createCall = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.userAgent.length).toBe(500);
    });

    it('should handle null/undefined fields gracefully', async () => {
      await service.log({
        action: 'DOCUMENT_UPLOADED',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          paperId: null,
          action: 'DOCUMENT_UPLOADED',
          entityType: null,
          entityId: null,
          ipAddress: null,
          userAgent: null,
          requestId: null,
        }),
      });
    });
  });

  describe('getForPaper', () => {
    it('should return audit logs for a specific paper', async () => {
      const mockLogs = [
        { id: '1', action: 'REVIEW_CREATED', createdAt: new Date() },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getForPaper('paper-1');

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paperId: 'paper-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
