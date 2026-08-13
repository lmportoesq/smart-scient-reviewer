import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  userId?: string;
  paperId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Record an audit event. Append-only — no updates or deletes (spec §42).
   */
  async log(input: AuditLogInput) {
    try {
      // Sanitize metadata — never store passwords, tokens, or keys
      const safeMetadata = input.metadata
        ? this.sanitizeMetadata(input.metadata)
        : undefined;

      await this.prisma.auditLog.create({
        data: {
          userId: input.userId || null,
          paperId: input.paperId || null,
          action: input.action,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          metadata: safeMetadata as any,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent ? input.userAgent.substring(0, 500) : null,
          requestId: input.requestId || null,
        },
      });
    } catch (error) {
      // Audit logging should never crash the application
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Get audit logs for a specific paper.
   */
  async getForPaper(paperId: string) {
    return this.prisma.auditLog.findMany({
      where: { paperId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get global audit logs (admin only).
   */
  async getGlobal(options?: { limit?: number; offset?: number }) {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    return this.prisma.auditLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get audit logs for a specific user.
   */
  async getForUser(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Remove sensitive fields from metadata before storing.
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'passwordhash',
      'token',
      'apikey',
      'api_key',
      'secret',
      'authorization',
      'cookie',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
