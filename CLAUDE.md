# FLŌW

Caisse française multi-commerces. Monorepo pnpm : `apps/api` (NestJS + Prisma), `apps/web` (Next 15), `apps/bridge` (agent local), `packages/utils` et `packages/types`.

## Règles de travail

- Interface et messages en français. Pas de tiret cadratin dans les textes.
- Ne rien inventer de juridique : s'appuyer sur `docs/legal`, `research_notes` et `reports`, et signaler ce qui reste à faire valider.
- Chaque modification est commitée et poussée sur `feat/plateforme-multi-secteurs` dès qu'elle est terminée et vérifiée.
- Passer par les skills disponibles : design et expérience utilisateur (`impeccable`, `web-design-guidelines`, `accessibility`, `ui-ux-pro-max`, `frontend-design`), revue (`code-review`, `security-review`). Pour en ajouter, la bibliothèque skills.sh.
- Le format des tickets signés (`packages/utils/src/receipt.ts`, `ledger.ts`) ne change jamais : on ajoute des champs en fin de ligne, seulement quand ils existent.

## Vérifications

- API : `pnpm --filter api exec tsc --noEmit -p tsconfig.json` et `pnpm --filter api test`
- Web : `pnpm --filter web exec tsc --noEmit` et `pnpm --filter web test`
