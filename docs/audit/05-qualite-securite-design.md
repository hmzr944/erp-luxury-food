# Audit volet 5 : qualité du produit (sécurité, code, design, robustesse de caisse)

Périmètre : code de la branche `feat/plateforme-multi-secteurs`, hors hébergement. Lecture seule. Vérifications lancées : `tsc` API et web propres, `pnpm --filter api test` 269 tests verts (35 fichiers), `pnpm --filter web test` 122 tests verts (22 fichiers), `pnpm audit --prod` : 8 alertes, aucune sur un chemin exploitable (voir A.4). Le serveur web (:3000) et l'API (:3001) ne répondaient pas : aucune capture Playwright, la partie C repose sur la lecture du code et sur des calculs de contraste. Rien de juridique n'est tranché ici.

## Synthèse : les 10 points les plus graves

| # | Gravité | Point | Effort |
|---|---|---|---|
| 1 | Critique | Une vente refusée (400, 404, 422) fige toute la file de la caisse : les suivantes reçoivent 409 indéfiniment. Le test unitaire entérine le comportement | M |
| 2 | Haute | Un vendeur peut valider lui-même un paiement « carte » sur le TPE virtuel (aucun contrôle de rôle, simulateur actif en production) | S |
| 3 | Haute | Remboursement sans rôle ni plafond, en espèces, sur toute vente ; remboursement carte exécuté avant le verrou (double remboursement possible) | M |
| 4 | Haute | Temps réel (écran client, alertes, ventes en direct) sans adaptateur Redis alors que les manifestes déclarent 2 réplicas ; compteurs d'essais de code en mémoire | M |
| 5 | Haute | Aucun stockage persistant demandé : ventes en attente et clé de signature uniquement dans IndexedDB, sans export de secours | S à M |
| 6 | Moyenne | Contournement SSRF des webhooks par adresses IPv6 « mappées » | S |
| 7 | Moyenne | Paiement TPE en ligne « annulé » côté caisse même si l'annulation côté TPE échoue : argent encaissé sans vente | M |
| 8 | Moyenne | Un vendeur peut créer, modifier, supprimer des produits et saisir des mouvements de stock (DTO non validé, non transactionnel) | S |
| 9 | Moyenne | Index manquants : `OrderItem.orderId`, `Order.refundOfId`, `Order.customerId` ; recherche historique en `ILIKE` | S |
| 10 | Moyenne | Aucun test sur la synchronisation serveur, les remboursements, les clôtures, le garde de site ; e2e IDOR factice | M |

Hors top 10 : jetons dans `localStorage` (moyenne, L), contraste du texte discret sur fond teinté (moyenne, S), erreurs de formulaire peu reliées aux champs (moyenne, M).

## A. Sécurité

### A.1 Ce qui a été vérifié et tient

- Isolation multi-organisation : les 17 contrôleurs `sites/:siteId/*` passent par `JwtAuthGuard` + `SiteGuard` (`common/guards/site.guard.ts:25-47`), qui compare l'organisation du site à celle du jeton, puis impose le rattachement `UserSite` aux vendeurs. Les lectures par identifiant filtrent systématiquement `siteId` ou `organizationId` (sondage des `findFirst`/`update` de tous les services : `terminals.service.ts:47`, `displays.service.ts:63`, `products.service.ts:180-190` qui revérifie variantes et options, `users.service.ts:29`). Aucun IDOR trouvé.
- Jeton : HS256 imposé, état du compte relu toutes les 10 s (`auth/strategies/jwt.strategy.ts:18-55`), `tokenVersion` pour la révocation. Sockets : même contrôle (`orders.gateway.ts:41-53`, `displays.gateway.ts:36-47`).
- Code vendeur : HMAC avec clé serveur, demande signée par la clé non exportable de la caisse, signature à usage unique, blocage par caisse (5 essais) et par organisation (30), `auth/pin.ts:6-80`, `auth.service.ts:174-195`.
- Mot de passe oublié : jeton 256 bits haché, usage unique (`password-reset.service.ts:14-100`). Webhook Stripe : HMAC, tolérance 300 s, temps constant (`billing/stripe-billing.ts:43-62`).
- Injection : aucune requête brute non paramétrée (`$queryRaw` en gabarit étiqueté ; pas de `Unsafe`). CSV : neutralisation des formules (`packages/utils/src/csv.ts:13-17`). Secrets faibles refusés en production (`main.ts:12-22`), secrets prestataires chiffrés AES-GCM.
- XSS : les 5 `dangerouslySetInnerHTML` injectent le SVG produit par la bibliothèque QR, jamais une saisie ; la fiche badge échappe le prénom (`BadgeSheet.tsx:132`). Jeton de reçu : UUID v4, 122 bits (`receipts.service.ts:12,70`), 60 requêtes par minute.
- CORS : une seule origine, authentification par en-tête Bearer, pas de cookie : pas de surface CSRF.
- Pont local : en-tête Host et Origin contrôlés, `*` refusé (`config.ts:55-62`), appairage par code à 6 chiffres avec blocage doublant jusqu'à une heure (`pairing.ts:72-146`), relais limité aux adresses privées (`lan.ts`), autorité TLS avec contraintes de noms (`cert.ts:199-239`), fichiers en 0600. Solide.

### A.2 Constats retenus

**A1. Haute. Simulateur de paiement ouvert aux vendeurs.** `POST /sites/:siteId/terminal-payments/:id/simulate` (`payments.controller.ts:177`) n'exige que `SiteGuard` ; `payments.service.ts:262-267` règle un paiement `SIMULATOR` en « accepté » sans compte ni rôle. Rien n'interdit le fournisseur `SIMULATOR` en production (`payments.service.ts:83`, `qrProvider` en retombe dessus faute de Stripe, `:186`). Scénario : un gérant a laissé un « TPE virtuel » appairé après l'essai ; un vendeur envoie « Carte acceptée » lui-même, encaisse en carte, garde les espèces. Correction : réserver `simulate` à OWNER/MANAGER, désactiver `SIMULATOR` hors période d'essai et hors mode formation.

**A2. Haute. Remboursement non encadré.** `OrdersController.refund` (`orders.controller.ts`, route `:id/refund`) n'a pas de `@Roles`, l'écran `OrderDetailSheet.tsx` ne filtre pas non plus. Tout vendeur rembourse en espèces (`refunds.service.ts:51`) n'importe quelle vente du site, sans plafond ni validation. Le remboursement carte part chez le prestataire à la ligne 64, avant le verrou de la ligne 70 : deux clics simultanés envoient deux remboursements partiels valides. Correction : rôle ou code responsable au-delà d'un seuil, verrou avant l'appel prestataire, clé d'idempotence côté prestataire.

**A3. Moyenne. SSRF des webhooks et de la plateforme de facturation (PDP).** `common/net/public-url.ts:25-27` ne reconnaît que la forme `::ffff:a.b.c.d`. Node normalise `https://[::ffff:127.0.0.1]/` en `::ffff:7f00:1`, que la fonction juge publique (vérifié par exécution : `::ffff:7f00:1`, `::ffff:a9fe:a9fe`, `::7f00:1`, `64:ff9b::7f00:1` passent). Scénario : un titulaire inscrit librement enregistre ce webhook, l'API envoie un POST JSON signé vers l'interface locale ou un service interne (aveugle, mais l'état de réussite est lisible par `failureCount`). Le contrôle à l'envoi (`webhooks.processor.ts:22`) laisse aussi une fenêtre de DNS rebinding entre `lookup` et `fetch`. Correction : décoder toute adresse IPv6 contenant du v4, bloquer `64:ff9b::/96` et `::/96`, épingler l'adresse résolue.

**A4. Moyenne. Vendeur et catalogue, stock.** `POST/PATCH/DELETE products`, catégories, options (`products.controller.ts:116-137`) et `POST stock/movements` (`stock.controller.ts:86-93`) ne portent pas de rôle. Le DTO du mouvement est un type en ligne : le `ValidationPipe` ne le contrôle pas (`type` quelconque, `quantity` non numérique donnent une 500), et la création du mouvement et la mise à jour du stock ne sont pas dans une transaction (`stock.service.ts:263-288`). Scénario : un vendeur baisse un prix, saisit une « perte » pour dissimuler un vol.

**A5. Moyenne. Jetons en `localStorage`.** Accès et renouvellement (30 jours) stockés en clair (`stores/auth.store.ts:74-75`), CSP avec `script-src 'unsafe-inline'` (`next.config.ts:30`). Toute XSS future vole une session de 30 jours. Aucune XSS connue aujourd'hui, donc moyenne ; correction structurante (cookie httpOnly, nonces CSP) en L.

**A6. Basse. Divers.**
- Connexion : l'utilisateur inconnu répond avant le calcul bcrypt (`auth.service.ts:113`, différence de temps) et l'inscription répond 409 « compte existant » (`:56`) : énumération de comptes. Limitation par IP seulement (20/min), pas de verrou par compte.
- `GET /customers` (liste et recherche) ouvert à tout vendeur : export possible du fichier clients (RGPD) ; `sendLink` et les alertes consignent des e-mails de clients dans les journaux (`receipts.service.ts:175`, `mail.service.ts:41`).
- Paramètres de `GET orders` non validés : 500 au lieu de 400.
- Route publique `/pickup/:code` (`orders.controller.ts:35-55`) et page web associée : `pickupCode` n'est jamais écrit, code mort.
- Jetons d'API : créés et listés (`api-tokens.service.ts`) mais aucune stratégie ne les accepte. Le commerçant croit avoir une API qui n'authentifie rien.
- Signature d'un ticket : la caisse choisit prix et date (`useSignedPrices`) ; l'écart au catalogue n'est que noté (`orders.service.ts:178`). Un vendeur averti peut signer un prix libre depuis la console du navigateur. Aucune borne sur `signedAt`.

### A.3 Faux positifs écartés
`SiteGuard` sans `siteId` (`:22`) : aucune route concernée. `sync` en `OrgScopedSite` : exige une signature de caisse du site. Appairage d'écran client à 6 chiffres : négligeable (10 essais par minute, code valable 10 minutes).

### A.4 Dépendances
Aucune alerte critique. Hautes : `sharp` (via `next`, optimisation d'images distantes non utilisée par la caisse) et `deepmerge-ts` (outillage Prisma, hors exécution). Moyennes : `qs`, `uuid` (via `@nestjs/bull`), basse : `body-parser`. À mettre à jour par routine, pas d'urgence.

## B. Qualité du code et des tests

**Couverture réelle.** Forte sur le calcul pur : prix, composition, règles de paiement, plan de remboursement, chaîne et ticket signé, PIN hors ligne, import, clôture (calculs). Faible là où se joue l'argent : aucun test de `orders.service.ts` (synchronisation, idempotence, concurrence), `refunds.service.ts`, `closures.service.ts` (scellement), `archives.service.ts`, `site.guard.ts`, `jwt.strategy.ts`, paiements TPE côté service (seuls les connecteurs sont testés), clavier de paiement web (`PaymentSheet.tsx`, 857 lignes, aucun test). Le pont est bien couvert (11 fichiers de test). L'e2e « IDOR » (`apps/web/e2e/idor.spec.ts:20-25`) teste un identifiant de site inexistant avec un compte de démonstration : il ne prouve rien sur l'isolation entre deux organisations.

**Test qui consacre un défaut.** `terminal.test.ts:106-118` vérifie que la vente refusée est « mise de côté sans bloquer les suivantes » ; or la suivante porte le `previousHash` de la refusée et reçoit 409 (`orders.service.ts:125-131`). Le test décrit le contraire du comportement réel.

**Erreurs avalées (32 `catch` vides ou `.catch(() => {})`).** Les plus risquées : annulation de paiement TPE (`payments.service.ts:255-256, 329`; `TerminalWait.tsx:80,146`; `QrPayWait.tsx:84`).

**Transactions et concurrence.** Bon : verrous consultatifs par site, par caisse, par TPE, par vente, par remboursement, ordre cohérent (caisse puis site, pas d'interblocage), clé d'idempotence `clientId` avec reprise du gagnant (`orders.service.ts:84-92, 213-219`). Défauts : remboursement carte hors verrou (A2) ; mouvement de stock non transactionnel (A4) ; Z pris sous un verrou distinct de celui des tickets (sans conséquence apparente, non testé).

**Performances.** `OrderItem` n'a aucun index (`schema.prisma:463` et suivantes) alors que chaque liste de commandes charge ses lignes (`orders.service.ts:495-503`, tableaux de bord `dashboard.service.ts:78,141`) ; `Order.refundOfId` et `Order.customerId` non plus. La recherche `ILIKE '%q%'` sur les articles (`orders.service.ts:480-486`) lit toute la table. Invisible aujourd'hui, pénalisant dès quelques centaines de milliers de lignes. `DisplaysGateway.last` croît sans purge.

**Code mort et duplication.** `lib/offline/queue.ts` et `sync.ts` : ancienne file de commandes, appelle une route inexistante (`/api/orders/:id/status`) ; `/pickup` (API et web) ; jetons d'API ; page `/invoice/[orderId]` avec couleurs en dur. Fichiers à découper : `HardwareWizard.tsx` (934 lignes), `POSClient.tsx` (868), `PaymentSheet.tsx` (857).

**Dette qui menace la fiabilité.** Compteurs d'essais et limitation de débit en mémoire de processus (`auth/pin.ts:50-52`, `ThrottlerModule`, `app.module.ts:46`) alors que `k8s/api-deployment.yaml:9` déclare 2 réplicas ; le commentaire du code dit lui-même qu'il faut Redis dans ce cas. Même cause pour le temps réel (D, ligne 9).

## C. Design et accessibilité

À partir du code : la lecture est favorable. Points forts : fond, encre, violet seulement, états portés par libellé et icône (`globals.css:152-167`) ; contrastes mesurés : encre sur papier 15,3:1, violet sur papier 7,0:1, bordure de champ 3,07:1 en clair ; `lang="fr"`, lien d'évitement et `<main>` sur le site (`app/page.tsx:21-24`) ; focus visible global (`globals.css`), `prefers-reduced-motion` géré (`globals.css:272,285,326`, `MotionConfig` dans `providers.tsx`) ; feuille modale avec piège de focus, Échap, retour du focus, cible de fermeture de 44 px (`pos/Sheet.tsx:49-82,113-122`) ; connexion avec libellés, `autoComplete`, `aria-invalid`, `role="alert"` (`app/(auth)/login/page.tsx:150-187`) ; 122 zones `aria-live`, `role="alert"` ou `role="status"`.

Constats :
- **C1. Moyenne, WCAG 1.4.3.** Le texte discret (`--color-text-muted`) mesure 4,68:1 sur le fond, mais 4,21:1 sur `--color-accent-muted` (puces, pastilles, encarts d'aide) : sous le seuil de 4,5:1, alors que 116 usages de `text-xs` (12 px) l'emploient. Remède : `--mix-muted` à 68 % en clair.
- **C2. Moyenne, WCAG 3.3.1 et 4.1.3.** Sur 166 champs, seuls 12 portent `aria-invalid` ; les réglages et l'inscription associent peu l'erreur au champ. Le composant `ui/FieldError.tsx` existe : l'imposer aux formulaires de Paramètres.
- **C3. Basse, WCAG 2.5.8.** Cibles inférieures à 24 px : bouton de formule `size-7` (`Composition.tsx:236-237`, 28 px, juste conforme mais sous 44 px de confort tactile), puce de quantité `h-7` (`Catalog.tsx:264`), bascule de formation `h-9` (`POSClient.tsx:511`). Pour une caisse tactile, viser 44 px.
- **C4. Basse.** `text-[10px]` et couleurs hexadécimales en dur sur `/pickup` et `/invoice` : hors identité, pages héritées.
- **C5. Moyenne, parcours.** « Vente refusée, à vérifier » (`POSHeader.tsx:163-165`) n'offre aucune action de reprise (voir D, ligne 8).

Mise en page réelle (caisse, tableau de bord, assistant matériel, pages légales) non évaluée à l'image : à refaire avec Playwright serveurs lancés.

## D. Robustesse de caisse

| # | Scénario | Ce que fait le code (preuve) | Risque |
|---|---|---|---|
| 1 | Navigateur fermé en pleine vente | Panier gardé 12 h dans `localStorage` (`cart.store.ts:104,179-182`) ; vente signée écrite dans IndexedDB avant tout envoi, compteur et vente dans une même transaction (`terminal.ts:141`) ; paiement TPE en cours gardé et retrouvé (`BridgeTerminalWait.tsx`) | Faible. Paiement carte en ligne (SumUp, Stripe) : pas de reprise, voir ligne 7 |
| 2 | Horloge de l'appareil fausse | Date du ticket prise sur l'appareil (`terminal.ts:117`) ; le serveur n'impose aucune borne (`terminal-receipt.ts`) ; futur ramené à « maintenant » (`orders.service.ts:283`) ; connexion par code refusée si l'écart dépasse 2 minutes (`auth.service.ts:184`) ; durée de 7 jours du code hors ligne calculée avec `Date.now()` (`offline-pin.ts:22`) | Moyen : ticket imprimé daté de travers, vente comptée dans un jour déjà clos ou un mauvais mois. Ajouter un contrôle d'écart avec l'heure serveur |
| 3 | Deux onglets | Verrou `navigator.locks` partagé pour signature et envoi (`terminal.ts:21-25, 98, 160`), RES-06 couvre | Faible. Sans `navigator.locks` (vieux navigateur) : repli sans verrou, doublons de compteur possibles |
| 4 | Stockage local plein ou vidé | Aucune gestion de `QuotaExceededError` (aucune occurrence) ; aucun `navigator.storage.persist()` ; l'enregistrement de la vente échoue, l'erreur remonte comme « vente non enregistrée » après un paiement déjà pris | Haut. Safari efface le stockage des sites peu visités ; Chrome peut évincer en cas de manque d'espace. Vidage = ventes en attente et clé perdues sans trace |
| 5 | Clé de signature perdue (appareil changé, stockage vidé) | Nouvelle caisse enregistrée à la demande, nom « Caisse N+1 » (`terminal.ts:42-70`) ; l'ancienne reste active ; ventes non remontées irrécupérables | Haut pour les ventes non envoyées. Prévoir export de secours, bandeau « ventes non envoyées » avant tout nettoyage, désactivation guidée de l'ancienne caisse |
| 6 | Imprimante en panne | Vente enregistrée d'abord, message précis, « Réessayer l'impression », tiroir rouvert une seule fois (recette IMP-09, IMP-10) ; état papier et capot lu par le pont | Faible. Non validé sur un vrai matériel |
| 7 | TPE ne répond pas | Caisse-AP : issue demandée au pont, bouton « Le TPE a accepté : enregistrer la vente » (`BridgeTerminalWait.tsx`). TPE en ligne : délai puis `FAILED`, annulation côté TPE avalée (`payments.service.ts:329`) ; « Annuler » règle `CANCELED` même si l'annulation prestataire a échoué (`:255-258`), l'état n'est jamais revérifié | Moyen. Cas de la carte débitée après « Annuler » : argent sans vente, non détectable sans rapprochement quotidien TPE / Z |
| 8 | Synchronisation reçoit 409 ou refus | 400, 404, 422 : vente `rejected`, suite à l'envoi (`terminal.ts:185-189`) ; or la vente suivante est chaînée à la refusée donc 409 : « on garde et on réessaiera » (`:191-193`) sans fin. Aucun écran de reprise. Anomalie 4 de `recette-terrain.md` confirmée | Critique. Déclencheurs réalistes : produit retiré ou site différent (404), total recalculé différent (422), moyen de paiement inconnu (400). Perte de visibilité du chiffre d'affaires, Z faux, vendeur sans solution |
| 9 | Deux réplicas d'API | Aucun adaptateur Redis pour Socket.IO : l'écran client et `order:new` n'arrivent que si caisse et écran sont sur la même réplique ; essais de code comptés par réplique (`auth/pin.ts:50`) | Haut pour l'écran client (panne une fois sur deux) ; faible pour la sécurité (limite doublée) |
| 10 | Jeton expiré en pleine vente | `apiClient` redirige vers `/login` si le renouvellement échoue (`lib/api/client.ts:37-42`), sauf caisse reprise hors ligne ; la synchronisation d'arrière-plan ne redirige jamais (`authorizedFetch`) | Moyen : un appel en ligne (TPE, remboursement) peut éjecter le vendeur devant le client ; le panier est conservé |

## Ordre de traitement

Point 1 d'abord : le serveur ne doit jamais refuser une vente déjà signée pour une raison de gestion (la ranger « à vérifier » dans la chaîne) et ne rejeter que la falsification ; corriger le test. Puis points 2, 3, 8 (rôles, verrou), 5 (persistance), 4 (Redis), enfin 6, 7, 9, 10, C1, C2. Ce rapport n'évalue pas la conformité fiscale : la section 11 de `recette-terrain.md` reste à faire valider.

## Vérifications complémentaires (20/10/2026)

- **Remboursement sans contrôle de rôle** : confirmé. `POST sites/:siteId/orders/:id/refund` (`orders.controller.ts`) n'a ni `@Roles` ni plafond : tout vendeur rattaché au site peut rembourser.
- **Simulation de paiement par n'importe quel vendeur** : nuance. `simulate` refuse hors mode test (`payments.service.ts:272-273`, test sur `account.testMode`). Le risque existe donc seulement quand un compte reste en mode test avec le TPE virtuel : un vendeur peut alors valider un paiement carte fictif. À fermer en réservant la route aux gérants et en bloquant le mode test pour une organisation en vente réelle.
- **Deux réplicas et Socket.IO** : le constat vise `k8s/api-deployment.yaml`. Le déploiement sur un seul serveur (`deploy/docker-compose.prod.yml`) ne lance qu'une instance de l'API, le problème ne se pose donc pas tant qu'il n'y a pas deux réplicas.
