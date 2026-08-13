import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DocumentsModule } from './documents/documents.module';
import { PapersModule } from './papers/papers.module';
import { VerificationModule } from './verification/verification.module';
import { EvidenceModule } from './evidence/evidence.module';
import { AiModule } from './ai/ai.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute globally
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DocumentsModule,
    PapersModule,
    VerificationModule,
    EvidenceModule,
    AiModule,
    ReviewsModule,
    AuditModule,
  ],
})
export class AppModule {}
