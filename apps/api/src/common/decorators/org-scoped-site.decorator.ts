import { SetMetadata } from '@nestjs/common'

export const ORG_SCOPED_SITE = 'orgScopedSite'

// Pour la seule synchronisation des ventes signées : le garde vérifie que le
// site est de la même organisation, mais plus que l'utilisateur y est encore
// rattaché. Une vente déjà signée par la caisse doit toujours pouvoir remonter,
// sinon la chaîne fiscale de cette caisse reste bloquée. Sa validité vient de
// la clé de la caisse et de la chaîne, pas de l'identité de qui la transmet
export const OrgScopedSite = () => SetMetadata(ORG_SCOPED_SITE, true)
