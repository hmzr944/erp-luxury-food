import { Module } from '@nestjs/common'
import { TerminalsController } from './terminals.controller'
import { TerminalsService } from './terminals.service'
import { ComplianceModule } from '../compliance/compliance.module'

@Module({
  imports: [ComplianceModule],
  controllers: [TerminalsController],
  providers: [TerminalsService],
})
export class TerminalsModule {}
