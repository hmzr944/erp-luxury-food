import { Module } from '@nestjs/common'
import { SupportAgentController, SupportController } from './support.controller'
import { SupportService } from './support.service'
import { SupportConfig } from './support.config'
import { SupportAgentGuard } from './support-agent.guard'

@Module({
  // L'équipe d'abord : « agent » ne doit pas être lu comme un identifiant
  controllers: [SupportAgentController, SupportController],
  providers: [SupportService, SupportConfig, SupportAgentGuard],
})
export class SupportModule {}
