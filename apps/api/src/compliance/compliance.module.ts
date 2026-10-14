import { Module, OnApplicationBootstrap } from '@nestjs/common'
import { FISCAL_SOFTWARE } from '@erp/types'
import { ComplianceService } from './compliance.service'
import { ComplianceController } from './compliance.controller'
import { ClosuresService } from './closures.service'
import { ArchivesService } from './archives.service'
import { FiscalEventsService } from './fiscal-events.service'
import { ReceiptOpsService } from './receipt-ops.service'
import { SigningKeyService } from './signing-key.service'
import { AttestationService } from './attestation.service'
import { AttestationController, FiscalPublicController } from './attestation.controller'

@Module({
  controllers: [ComplianceController, AttestationController, FiscalPublicController],
  providers: [ComplianceService, ClosuresService, ArchivesService, FiscalEventsService, ReceiptOpsService, SigningKeyService, AttestationService],
  exports: [ComplianceService, ClosuresService, FiscalEventsService, SigningKeyService],
})
export class ComplianceModule implements OnApplicationBootstrap {
  constructor(private events: FiscalEventsService) {}

  // Chaque démarrage du serveur est tracé avec la version du logiciel
  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return
    await this.events.log({ organizationId: null, code: 'SOFTWARE_STARTED', detail: { version: FISCAL_SOFTWARE.version, node: process.version } })
  }
}
