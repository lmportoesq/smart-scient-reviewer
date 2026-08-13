import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  // Paper-specific audit (available to all authenticated users)
  @Get('papers/:paperId/audit')
  async getForPaper(@Param('paperId') paperId: string) {
    return this.auditService.getForPaper(paperId);
  }

  // Global audit (admin only)
  @Get('admin/audit')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getGlobal() {
    return this.auditService.getGlobal();
  }
}
