import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PapersService } from './papers.service';

@Controller('papers')
@UseGuards(JwtAuthGuard)
export class PapersController {
  constructor(private papersService: PapersService) {}

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.papersService.findById(id);
  }

  @Post(':id/analyze')
  async analyze(@Param('id') id: string) {
    return this.papersService.analyzePaper(id);
  }

  @Get(':id/report')
  async getReport(@Param('id') id: string) {
    return this.papersService.getReport(id);
  }

  @Get(':id/evidence')
  async getEvidence(@Param('id') id: string) {
    return this.papersService.getEvidence(id);
  }
}
