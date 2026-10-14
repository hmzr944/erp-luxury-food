import { Controller, Get, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { FISCAL_SOFTWARE, Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AttestationService, COVERED, NOT_COVERED } from './attestation.service'
import { SigningKeyService } from './signing-key.service'

// Attestation individuelle de conformité (BOI-LETTRE-000242), une par
// organisation, délivrée en un clic par le titulaire ou le gérant
@Controller('organizations/me/attestation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class AttestationController {
  constructor(private attestation: AttestationService) {}

  @Get('status')
  status(@CurrentUser() user: { organizationId: string }) {
    return {
      available: this.attestation.editorConfigured(),
      software: FISCAL_SOFTWARE,
      licence: this.attestation.licenceNumber(user.organizationId),
      covered: COVERED,
      notCovered: NOT_COVERED,
    }
  }

  @Get()
  async download(@CurrentUser() user: { id: string; organizationId: string }, @Res() res: Response) {
    const { filename, pdf } = await this.attestation.generate(user.organizationId, user.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  }
}

// Clé publique de l'éditeur, sans connexion : un contrôleur ou un expert
// vérifie une archive ou une attestation sans compte FLŌW
@Controller('fiscal')
export class FiscalPublicController {
  constructor(private keys: SigningKeyService) {}

  @Get('public-key')
  publicKey() {
    return this.keys.publicKey()
  }
}
