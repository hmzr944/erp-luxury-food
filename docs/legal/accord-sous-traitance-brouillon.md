# Accord de sous-traitance de données personnelles (RGPD, article 28) : BROUILLON

**Statut : brouillon technique, non relu par un avocat.** Ce document n'est pas un avis juridique. Chaque clause marquée **À valider par un avocat** est une proposition de rédaction à faire relire avant toute signature. Les données de l'éditeur et tout ce que le code ou les documents du dépôt ne permettent pas d'affirmer sont marqués « [à compléter] ». Version du brouillon : 20 octobre 2026.

## Sources réellement lues (20 octobre 2026)

| Source | URL | Ce qui a été lu |
| --- | --- | --- |
| Texte de l'article 28 du RGPD (règlement UE 2016/679), reproduit par la CNIL | https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4#Article28 | Les paragraphes 1 à 10 (extraits courts et reformulation fournis par l'outil de lecture) |
| Article 33, paragraphes 1 et 2 du RGPD (notification des violations : le sous-traitant notifie le responsable « dans les meilleurs délais », le responsable notifie l'autorité « dans les meilleurs délais et, si possible, 72 heures au plus tard ») | https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4#Article33 | Lu |
| CNIL, « Sous-traitance : exemples de clauses » (publié le 4 octobre 2017, la page précise qu'il s'agit d'exemples à adapter, qui ne constituent pas à eux seuls un contrat) | https://www.cnil.fr/fr/sous-traitance-exemple-de-clauses | Lu en entier : le plan de ce brouillon le suit |

**Non lus ou non vérifiés** : EUR-Lex (https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) a renvoyé une page vide à l'outil de lecture, donc le texte du règlement n'a pas été lu sur EUR-Lex ; le guide du sous-traitant de la CNIL n'a pas pu être ouvert (adresses essayées en erreur 404), il est **non vérifié** ; les clauses contractuelles types de la Commission européenne pour la sous-traitance (article 28, paragraphe 7, décision d'exécution de 2021) n'ont pas été lues ; les articles 29, 30, 32 et 44 à 49 du règlement ne sont cités que d'après les exemples de clauses de la CNIL, sans relecture du texte. La CNIL signale elle-même de vérifier si ses exemples de 2017 reflètent ses recommandations actuelles et celles du CEPD.

## Parties

- **Responsable de traitement** : le commerçant, client de FLŌW, identifié dans le contrat d'abonnement (ou le contrat pilote, `docs/commercial/contrat-pilote.md`) : [dénomination, SIREN, adresse, représentant, contact].
- **Sous-traitant** : l'éditeur du logiciel FLŌW, entrepreneur individuel : [nom et prénom à compléter], SIREN [à compléter], adresse [à compléter], e-mail de contact données personnelles [à compléter], délégué à la protection des données : [à compléter, désigné ou non, voir `pages-a-valider.md`].

**Articulation des rôles (À valider par un avocat)** : FLŌW est sous-traitant pour les données des clients finaux du commerçant (fichier clients, fidélité, e-mails des reçus). FLŌW est responsable de traitement pour les comptes des commerçants et de leurs équipes, ce qui relève de la politique de confidentialité (`/legal/confidentialite`) et non du présent accord. Si FLŌW déterminait lui-même des finalités ou des moyens pour les données des clients finaux (par exemple en les réutilisant), il serait considéré comme responsable de ce traitement (article 28, paragraphe 10, lu sur la page CNIL ci-dessus).

## 1. Objet

Le sous-traitant traite des données personnelles pour le compte du responsable de traitement, uniquement pour fournir le service de caisse FLŌW décrit à l'article 2. Les parties s'engagent à respecter le RGPD. Le présent accord complète le contrat d'abonnement ou le contrat pilote ; en cas de contradiction sur les données personnelles, il prévaut [À valider par un avocat].

## 2. Description du traitement

- **Services fournis** : caisse en ligne et hors ligne, fichier clients, programme de fidélité, envoi de tickets et de factures par e-mail, cartes cadeaux nominatives [à vérifier : une carte cadeau peut être rattachée à un client, voir `apps/api/src/customers`].
- **Nature des opérations** : collecte par saisie du commerçant, enregistrement, consultation, modification, restitution, envoi d'e-mails, sauvegarde, effacement.
- **Finalités** : gestion de la relation commerciale du commerçant avec ses clients, fidélité (points, avantages), remise du ticket ou de la facture par e-mail. Aucune autre finalité : pas de réutilisation, pas de publicité par FLŌW.
- **Données traitées** (d'après le modèle `Customer` et les ventes, voir `pages-a-valider.md`, section confidentialité) : prénom, nom, téléphone, e-mail, points de fidélité, total dépensé, nombre et date des visites, `marketingOptIn` (booléen), e-mail du reçu (`Order.customerEmail`, `invoiceSentTo`), historique des ventes rattachées au client. Pour la facturation B2B : dénomination, SIRET, TVA, adresse, e-mail des entreprises clientes (`B2BClient`) ; ce sont en général des données de personnes morales, mais l'e-mail et le nom d'un entrepreneur individuel sont des données personnelles.
- **Catégories de personnes concernées** : clients finaux du commerçant, personnes de contact des clients professionnels.
- **Données sensibles** : le service n'est pas conçu pour en traiter. Le champ de note libre d'un client ou d'une vente peut en recevoir si le commerçant y écrit : le responsable s'engage à ne pas y saisir de données de santé ou autres catégories particulières [À valider par un avocat].
- **Informations fournies par le responsable** : celles que son personnel saisit en caisse ou dans le back-office.

## 3. Durée

L'accord entre en vigueur à la souscription (ou à la signature du contrat pilote) et dure autant que le contrat principal. Date d'effet : [à compléter]. Les obligations de confidentialité et de restitution ou de suppression (article 12) lui survivent.

## 4. Obligations du sous-traitant

### 4.1 Finalité et instructions documentées

Le sous-traitant ne traite les données que pour les finalités de l'article 2 et sur instruction documentée du responsable. Les instructions sont : le présent accord, le contrat principal, les actions faites par le responsable et son personnel dans l'application (créer, modifier, effacer un client, exporter, régler la fidélité), et toute demande écrite complémentaire. Si le sous-traitant estime qu'une instruction viole le RGPD, il en informe le responsable immédiatement. Si le droit applicable lui impose un transfert hors de l'Union, il en informe le responsable avant le traitement, sauf interdiction légale pour motif d'intérêt public (formulation reprise des exemples de la CNIL, partie IV, point 2). **À valider par un avocat.**

### 4.2 Confidentialité du personnel

Les personnes autorisées à traiter les données sont soumises à une obligation de confidentialité. État actuel : l'éditeur est entrepreneur individuel et [à compléter : seul à accéder aux données de production, ou liste des personnes et prestataires ayant accès]. Un engagement écrit de confidentialité est à faire signer à toute personne qui aurait accès [à compléter]. La CNIL prévoit aussi une formation appropriée du personnel habilité : [à compléter, rien n'existe aujourd'hui dans le dépôt]. **À valider par un avocat.**

### 4.3 Protection des données dès la conception et par défaut

Constats vérifiables dans le code : case de consentement marketing non cochée par défaut (`apps/web/src/components/pos/LoyaltySheets.tsx`), effacement d'un client disponible (`apps/api/src/customers/customers.service.ts`), aucun traceur publicitaire ni outil de mesure d'audience trouvé (`pages-a-valider.md`). Limites connues : voir l'article 6.

### 4.4 Mesures de sécurité (article 32 du RGPD)

Le sous-traitant met en oeuvre les mesures suivantes. Chacune renvoie à ce que le code ou les documents du dépôt font réellement ; rien n'est promis au delà. La répartition des responsabilités de sécurité entre les parties (identifiants des équipes, appareils de caisse, réseau de la boutique) est à fixer : **À valider par un avocat.**

| Mesure | Ce que fait réellement le produit | Où le vérifier |
| --- | --- | --- |
| Chiffrement en transit | HTTPS par le frontal Caddy, certificats Let's Encrypt automatiques ; base et Redis non joignables hors des conteneurs | `docs/installation-production.md`, `deploy/Caddyfile` |
| En-têtes de sécurité de l'API | Helmet, politique de contenu `default-src 'none'`, CORS limité à `FRONTEND_URL`, taille des corps limitée (256 Ko, 3 Mo pour l'import de catalogue), validation stricte des entrées (champs inconnus refusés) | `apps/api/src/main.ts` |
| Secrets de production | L'API refuse de démarrer en production si `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PIN_SECRET` ou `SECRETS_KEY` sont absents, courts (moins de 32 caractères) ou d'exemple | `apps/api/src/main.ts` |
| Chiffrement des identifiants des prestataires | AES-256-GCM avec `SECRETS_KEY` pour les clés des prestataires stockées en base | `apps/api/src/common/crypto/secrets.ts` |
| Authentification | Mots de passe hachés avec bcrypt (12 tours) ; jeton d'accès de 15 minutes par défaut, jeton de renouvellement de 30 jours par défaut ; code vendeur et badge conservés sous forme d'empreinte ; limitation du nombre de requêtes (throttler global et limites par route) | `apps/api/src/auth/auth.service.ts`, `auth.module.ts`, `app.module.ts` |
| Cloisonnement | Accès par organisation et par site (gardes `JwtAuthGuard`, `SiteGuard`, `RolesGuard`) ; rôles dont propriétaire et gérant | `apps/api/src/common/guards` |
| Traçabilité | Journal d'audit des actions (avec adresse IP), journal chaîné des événements fiscaux, tickets signés et chaînés | `apps/api/src/audit`, `docs/audit/06-conformite.md` |
| Sauvegardes | `pg_dump` chaque nuit, contrôlé puis chiffré avec age, envoyé hors du serveur sur un stockage compatible S3 ; rétention 30 quotidiennes, 12 mensuelles, 7 annuelles ; contrôle de fraîcheur toutes les 6 heures ; essai de restauration mensuel ; la clé privée n'est pas sur le serveur | `docs/sauvegardes.md` |
| Disponibilité et reprise | Fonctionnement hors ligne de la caisse, alerte si la dernière sauvegarde a plus de 26 heures | `docs/sauvegardes.md` |

Limites à ne pas taire au responsable (À valider par un avocat quant à la formulation) :
- les données en base ne sont **pas chiffrées au repos au niveau applicatif** (hors identifiants des prestataires) : le chiffrement des sauvegardes est celui d'age ; le chiffrement du disque de l'hébergeur est [à compléter] ;
- les sauvegardes annuelles gardent 7 ans des données qui auraient été supprimées entre-temps (`docs/sauvegardes.md`, points à valider) ;
- le journal d'audit contient des adresses IP et n'a pas de durée de conservation définie (`pages-a-valider.md`) ;
- un code vendeur à 4 chiffres peut être retrouvé si l'on copie le stockage d'un appareil de caisse (limite assumée, `docs/recette-terrain.md`, anomalie 6) ;
- aucun test d'intrusion, aucune certification de sécurité : [à compléter si réalisés].

### 4.5 Sous-traitants ultérieurs (article 28, paragraphes 2 et 4)

**Option retenue par défaut : autorisation générale avec information préalable** (option A des exemples CNIL), le sous-traitant informant le responsable par écrit, avec un préavis de [à compléter] jours, de tout ajout ou remplacement, et le responsable pouvant s'y opposer dans ce délai. Option B (autorisation spécifique, chaque nouveau sous-traitant à autoriser par écrit) : au choix du juriste. **À valider par un avocat.**

Le sous-traitant impose à chaque sous-traitant ultérieur les mêmes obligations de protection et reste pleinement responsable envers le responsable de leur défaillance (article 28, paragraphe 4).

Liste initiale, établie d'après le code et les documents (à vérifier un par un) :

| Sous-traitant ultérieur | Rôle pour les données des clients finaux | Source dans le dépôt | Lieu de traitement et garanties |
| --- | --- | --- | --- |
| Resend | Envoi des e-mails (reçus, factures, réinitialisations) : l'adresse e-mail du client final et le contenu du message passent par lui | `apps/api/src/common/mail/mail.service.ts` | [à compléter : pays, transfert hors Union, garanties, accord de sous-traitance Resend non lu] |
| Hébergeur de l'API, de la base et de Redis | Hébergement de toutes les données | Registre d'images `registry.gra.cloud.ovh.net` (`k8s/`) laisse supposer OVHcloud, Gravelines ; non confirmé (`pages-a-valider.md`, mentions légales point 2) | [à compléter : nom, adresse, région, contrat] |
| Stockage des sauvegardes (compatible S3) | Reçoit les sauvegardes chiffrées de toute la base, donc des données des clients finaux sous forme chiffrée | `docs/sauvegardes.md` ; `deploy/.env.prod.example` donne OVHcloud Object Storage comme exemple, rien n'impose ce choix | [à compléter : fournisseur, région] |
| Stripe | Abonnement du commerçant (compte du commerçant, pas de données des clients finaux a priori) ; à lister par prudence | `apps/api/src/billing` | [à compléter]. Si le module de paiement en ligne ou de terminal virtuel est utilisé pour les paiements des clients finaux, la qualification de Stripe (sous-traitant ou responsable) est à examiner : **À valider par un avocat** |
| PrintNode | Impression à distance : le contenu imprimé (ticket, qui peut porter un nom de client ou de vendeur) transite par ce service si le commerçant l'active | `apps/api/src/sites/sites.service.ts`, `apps/api/src/printing/printing.service.ts` | [à compléter : seulement si la fonction est utilisée en production] |
| Prestataires de terminal de paiement (SumUp, autres connecteurs) | Montants de paiement transmis à la demande du commerçant ; ils ont leur propre contrat avec le commerçant | `apps/api/src/payments/connectors` | Hors du présent accord a priori : [à qualifier avec un avocat] |

Non actifs au 20 octobre 2026 : Sentry (`@sentry/nextjs` non installé ; s'il est activé avec enregistrement de sessions, l'ajouter et revoir le consentement). Service public de recherche d'entreprises (`recherche-entreprises.api.gouv.fr`) : reçoit un SIREN ou un nom d'entreprise lors de la saisie d'un client professionnel, pas de donnée de client particulier ; à confirmer.

### 4.6 Information des personnes

C'est le responsable de traitement qui informe ses clients au moment de la collecte (option A des exemples CNIL). Le sous-traitant lui fournit, à sa demande, la description des traitements de l'article 2 pour rédiger son information. Le produit n'affiche aujourd'hui aucun texte d'information au client final lors de la saisie de son e-mail ou de sa fiche : [à compléter, voir `docs/audit/03-clients-ventes.md`]. **À valider par un avocat.**

### 4.7 Exercice des droits des personnes

Le sous-traitant aide le responsable à répondre aux demandes d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité. S'il reçoit directement une demande d'une personne concernée, il la transmet sans délai au responsable à l'adresse [à compléter], sans y répondre lui-même (option A des exemples CNIL). Moyens actuels :
- **effacement** : le responsable efface la fiche d'un client (`customers.service.ts`, méthode `remove`) ; les ventes restent sans lien avec lui ; **mais** `Order.customerEmail` et `invoiceSentTo` restent sur les ventes déjà envoyées (point ouvert, `pages-a-valider.md` confidentialité point 5 et `docs/audit/06-conformite.md` risque 10) ;
- **accès, portabilité** : l'export CSV existant (`GET /organizations/me/data/clients.csv`, `apps/api/src/data/data.controller.ts`) ne reprend aujourd'hui que les clients professionnels (`docs/audit/03-clients-ventes.md`, ligne « Export fichier clients ») ; l'export de la fiche d'un client particulier est donc **manuel, sur demande écrite au sous-traitant** [à compléter : délai] ;
- **rectification** : modification de la fiche dans l'application.

Délai de réponse d'un mois (article 12 du RGPD) : non vérifié sur le texte officiel (`pages-a-valider.md`). **À valider par un avocat.**

### 4.8 Notification des violations (article 33)

Le sous-traitant notifie le responsable de toute violation de données personnelles « dans les meilleurs délais » après en avoir pris connaissance (article 33, paragraphe 2, lu sur la page CNIL ci-dessus). Les exemples de la CNIL laissent un délai en heures à fixer : proposition **[48 heures] au plus tard, à valider par un avocat et à tenir par l'éditeur**, ce qui laisse au responsable le temps de notifier la CNIL « dans les meilleurs délais et, si possible, 72 heures au plus tard » après qu'il en a eu connaissance (article 33, paragraphe 1). La notification précise : nature de la violation, catégories et nombre approximatif de personnes et d'enregistrements concernés, contact, conséquences probables, mesures prises ou proposées, et peut être échelonnée sans retard indu. Le sous-traitant ne notifie pas la CNIL ni les personnes au nom du responsable sans son accord écrit préalable (option des exemples CNIL). Moyens actuels de détection : alerte de sauvegarde, journal d'audit, journal chaîné des événements fiscaux ; aucune procédure écrite de gestion d'incident n'existe aujourd'hui : [à compléter]. **À valider par un avocat.**

### 4.9 Assistance pour les analyses d'impact et les consultations préalables

Le sous-traitant aide le responsable, dans la limite des informations dont il dispose, pour les analyses d'impact et la consultation préalable de l'autorité de contrôle. **À valider par un avocat** (étendue de l'assistance et éventuelle facturation).

### 4.10 Registre

Le sous-traitant tient par écrit un registre des activités de traitement effectuées pour le compte du responsable (identité des parties, catégories de traitements, transferts hors Union, description générale des mesures de sécurité). Ce registre : [à créer, n'existe pas aujourd'hui dans le dépôt ; le présent accord, articles 2, 4.4 et 7, peut en être la base].

### 4.11 Documentation et audits

Le sous-traitant fournit au responsable la documentation nécessaire pour démontrer le respect de ses obligations et permet les audits, y compris les inspections, réalisés par le responsable ou par un auditeur qu'il mandate. Modalités proposées : demande écrite, préavis de [à compléter] jours, au plus une fois par an sauf violation avérée, confidentialité de l'auditeur, frais de [à compléter]. L'éditeur étant seul ou presque, la portée d'un audit sur l'hébergeur ne peut dépasser ce que l'hébergeur autorise : [à compléter]. **À valider par un avocat.**

## 5. Obligations du responsable de traitement

Le responsable fournit les données, documente ses instructions par écrit, veille à la licéité de la collecte (base légale, information, consentement marketing recueilli avant d'activer `marketingOptIn`), respecte la durée de conservation qu'il se fixe (les référentiels de la CNIL cités par `docs/audit/06-conformite.md` : client pendant la relation commerciale plus 3 ans, prospect 3 ans, compte inactif 2 ans, à confirmer), supervise le traitement et réalise les audits qu'il estime utiles (parties IV et V des exemples CNIL).

## 6. Durées de conservation par le sous-traitant

Les fiches clients restent tant que le responsable ne les efface pas : **aucune purge automatique n'existe** (`docs/audit/06-conformite.md`, risque 10). Les sauvegardes quotidiennes sont gardées 30 jours, mensuelles 12 mois, annuelles 7 ans (`docs/sauvegardes.md`) : une fiche effacée dans l'application peut donc rester dans une sauvegarde chiffrée jusqu'à 7 ans, sauf réduction de `BACKUP_KEEP_YEARLY`. Le sous-traitant s'engage à ne jamais restaurer une sauvegarde sans ré-effacer les données qui avaient été supprimées depuis [À valider par un avocat : engagement réaliste ? aucune procédure n'existe aujourd'hui].

## 7. Localisation et transferts hors Union européenne

Les données sont hébergées [à compléter : pays et région], sauvegardées [à compléter]. Aucun transfert hors de l'Union n'est voulu par le sous-traitant. Les transferts éventuels par Stripe, Resend ou un autre sous-traitant ultérieur (par exemple vers les États-Unis) et leurs garanties (clauses contractuelles types, cadre de protection des données UE-États-Unis) sont [à compléter, non vérifiés ; articles 44 à 49 du RGPD non relus]. **À valider par un avocat.**

## 8. Sort des données en fin de contrat

Au terme du contrat, au choix du responsable (parmi les options des exemples CNIL) : restitution puis destruction, ou destruction. Moyens existants :
- **Exports** : CSV des ventes, des paiements, des produits, du stock (`GET /sites/:siteId/data/sales.csv`, `payments.csv`, `products.csv`, `stock.csv`) et des clients professionnels (`GET /organizations/me/data/clients.csv`), plus les **archives fiscales signées** téléchargeables depuis la page Conformité (`docs/sauvegardes.md`). Le fichier des clients particuliers et de la fidélité n'a pas d'export en libre-service : sur demande écrite, **[à compléter : délai, format]**.
- **Destruction** : aucun mécanisme de suppression d'un compte ou d'une organisation n'existe dans le code (`pages-a-valider.md`, CGV point 8). Procédure manuelle à définir : suppression de la base de production, puis expiration des sauvegardes (jusqu'à 7 ans pour les annuelles). Délai de destruction proposé : [à compléter], avec attestation écrite de destruction (les exemples CNIL demandent que la destruction soit justifiée par écrit).
- **Données fiscales** : le commerçant doit conserver ses documents fiscaux 6 ans (article L102 B du livre des procédures fiscales, fiche service-public F10029 lue le 20 octobre 2026) ; la même fiche donne 10 ans pour les pièces comptables. Qui conserve les archives fiscales après la fin du contrat (le commerçant avec l'export, ou l'éditeur pour son compte) n'est **pas tranché** : voir `docs/legal/dossier-rendez-vous-professionnels.md`, question (j). **À valider par un avocat.**

## 9. Responsabilité

Répartition de la responsabilité entre les parties pour les manquements au RGPD, éventuel plafond : [à compléter]. Clause à risque, cohérente avec la limitation de responsabilité des CGV (`pages-a-valider.md`, CGV point 10). **À valider par un avocat.**

## 10. Droit applicable et juridiction

[à compléter] (voir `NEXT_PUBLIC_LEGAL_COURT`). **À valider par un avocat.**

## Annexe A : instructions documentées du responsable

[à compléter par le commerçant] : durée de conservation souhaitée de ses fiches clients, usage du programme de fidélité, consentement marketing, contact pour les demandes de droits, contact pour les violations.

## Annexe B : récapitulatif des clauses à risque

1. Rôles et qualification (préambule, article 4.5 pour Stripe et les terminaux de paiement).
2. Instructions et information en cas d'instruction illicite (4.1).
3. Personnel, confidentialité et formation (4.2).
4. Répartition de la sécurité et limites déclarées (4.4).
5. Sous-traitants ultérieurs : option A ou B, préavis (4.5).
6. Information des personnes (4.6) et exercice des droits, délai d'un mois (4.7).
7. Délai de notification d'une violation (4.8).
8. Audits (4.11), durées et sauvegardes (6), transferts (7).
9. Fin de contrat, destruction et conservation fiscale (8).
10. Responsabilité et juridiction (9, 10).
