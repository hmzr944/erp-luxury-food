// Identification du logiciel pour la conformité fiscale (art. 286 I 3° bis
// CGI). La version majeure est la racine attestée ; les versions mineures
// en sont des subdivisions (BOI-TVA-DECLA-30-10-30 § 340 et 380).
// Toute évolution touchant l'inaltérabilité, la sécurisation, la
// conservation ou l'archivage impose une nouvelle version majeure.
export const FISCAL_SOFTWARE = {
  name: 'FLŌW',
  majorVersion: '1',
  version: '1.0.0',
  releasedAt: '2026-10-14',
} as const

export type ClosurePeriodName = 'DAY' | 'MONTH' | 'YEAR'

// Codes du journal des événements techniques
export const FISCAL_EVENTS = {
  SOFTWARE_STARTED: 'Démarrage du logiciel',
  CLOSURE_DAY: 'Clôture journalière',
  CLOSURE_MONTH: 'Clôture mensuelle',
  CLOSURE_YEAR: 'Clôture annuelle',
  ARCHIVE_CREATED: 'Archive fiscale créée',
  ARCHIVE_DOWNLOADED: 'Archive fiscale téléchargée',
  DUPLICATE_PRINTED: 'Duplicata de ticket',
  TRAINING_STARTED: 'Mode formation activé',
  TRAINING_STOPPED: 'Mode formation désactivé',
  TRAINING_TICKET: 'Ticket fictif (mode formation)',
  TERMINAL_REGISTERED: 'Caisse enregistrée',
  TERMINAL_REVOKED: 'Caisse désactivée',
  CHAIN_VERIFIED: 'Vérification du grand livre',
  CHAIN_ERROR: 'Anomalie du grand livre',
  ATTESTATION_ISSUED: 'Attestation de conformité délivrée',
  DATA_EXPORTED: 'Export des données',
} as const

export type FiscalEventCode = keyof typeof FISCAL_EVENTS
