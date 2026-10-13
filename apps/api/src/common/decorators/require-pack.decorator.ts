import { SetMetadata } from '@nestjs/common'
import type { Pack } from '@erp/types'

export const PACK_KEY = 'requiredPack'
export const RequirePack = (pack: Pack) => SetMetadata(PACK_KEY, pack)
