# Conditions de démarrage du pilote : liste Go / No-Go

À cocher avant d'installer chez le premier commerçant pilote. Un seul « No-Go » suffit à reporter l'installation. On peut présenter FLŌW et faire une démonstration avant, on n'installe pas et on ne fait signer rien.

Sources : `docs/recette-terrain.md` (sections 5, 10, 11, 12), `docs/legal/pages-a-valider.md`, `docs/veille-concurrence-2026-10.md`, `docs/installation-production.md`, `docs/sauvegardes.md`, `apps/api/src/support/support.config.ts`. Mise à jour du 20/10/2026. Aucune case n'est cochée : rien n'a été vérifié pour ce document.

## 1. Défauts connus à corriger ou à accepter par écrit

- [ ] **P0 : vente refusée par le serveur.** Une vente refusée (400, 404, 422) est marquée « refusée », la caisse passe à la suivante, mais le serveur attend toujours ce numéro de ticket (409) : toutes les ventes suivantes de la caisse restent « à envoyer ». Fichiers : `apps/web/src/lib/terminal/terminal.ts:184-187`, `apps/api/src/orders/orders.service.ts:125-131` (recette, anomalie 4, cas FIS-04 et RES-02). Le correctif touche la chaîne de ventes signées : **il attend la validation comptable**. No-Go tant que : correction faite, validée, et cas FIS-04 et RES-02 rejoués en OK.
- [ ] Le « grand livre » répond « Tout est intact » à la fin d'une journée type (recette, critères de sortie).
- [ ] **P1 relevés** (recette, section 10), chacun corrigé ou accepté avec un contournement écrit et connu du commerçant, repris à l'annexe 1 de `contrat-pilote.md` :
  - [ ] n° 8 : ticket « REMBOURSEMENT » non imprimé d'office, tiroir fermé pour un remboursement en espèces (`OrderDetailSheet.tsx:478`) ;
  - [ ] n° 10 : parts carte des paiements divisés ou multiples non envoyées au terminal (`PartsPayment.tsx:52`, `CreditPayment.tsx:186`) ;
  - [ ] n° 12 : vente hors ligne reçue après la clôture comptée dans le Z du jour de réception (`compliance.service.ts:63`), question à poser à l'expert-comptable ;
  - [ ] n° 13 : aide hors ligne sans envoi ni numéro (`SupportSheet.tsx:135`) ;
  - [ ] n° 16 : scan hors du champ de recherche perdu (`Catalog.tsx:52`), à tester avec la douchette de la boutique, très concerné pour une épicerie ou une cave.
- [ ] Anomalies P2 (n° 17 à 21) lues et acceptées.
- [ ] Les anomalies marquées « Corrigé » (n° 1 à 3, 5 à 7, 9, 11, 14, 15) sont à revalider sur le vrai matériel, pas seulement sur le banc : le TPE (n° 1 à 3), l'état de l'imprimante (n° 7) et l'iPad (n° 5) sont notés « à valider » dans la recette.
- [ ] Audit : [à compléter : référence de l'audit P0 et P1 complet, s'il existe en dehors de la recette]. La mention d'un audit n'a pas pu être rattachée à un fichier du dépôt autre que `docs/recette-terrain.md`.

## 2. Textes juridiques et attestation

- [ ] CGV (`apps/web/src/app/legal/cgv/page.tsx`) relues par un juriste, les points listés dans `docs/legal/pages-a-valider.md` (CGV 1 à 12) tranchés, notamment : fin d'essai sans souscription (3), retard et limitation d'accès non implémentés (6), sort des données après résiliation (8), responsabilité (10), juridiction (11).
- [ ] CGU (`apps/web/src/app/legal/cgu/page.tsx`) relues, points 1 à 8 tranchés, notamment la phrase « non certifié par un organisme accrédité » et la durée de six ans.
- [ ] Politique de confidentialité relue, accord de sous-traitance (article 28) rédigé, transferts hors UE renseignés.
- [ ] `LEGAL_DRAFT` passé à `false`, `LEGAL_VERSION_DATE` mise à jour, plus aucun « [à compléter] » affiché sur les pages.
- [ ] Attestation de l'éditeur relue par l'expert-comptable (formulation pour un entrepreneur individuel), modèle `docs/legal/BOI-LETTRE-000242-20260325.md` : la carte « Attestation de conformité » de l'application n'affiche plus « Bientôt disponible ».
- [ ] Réponse type à « Vous êtes certifié NF525 ? » validée (`pitch-pilotes.md`, 4.1).
- [ ] Les points juridiques de la recette (section 11) ont chacun un responsable et une date.
- [ ] `contrat-pilote.md` relu et réécrit par un juriste ; chaque clause « À valider par un juriste » traitée ; droit applicable renseigné.

## 3. Recette terrain sur du vrai matériel

À dérouler selon `docs/recette-terrain.md` (suite fumée section 7, suite complète section 8, journée type section 9), sur le matériel réellement installé chez le pilote.

- [ ] Critères d'entrée (section 5) tous cochés : tests API, web et pont verts sur le commit déployé, exécutables du pont construits avec la bonne adresse de caisse, `NEXT_PUBLIC_BRIDGE_DOWNLOAD_BASE` réglée.
- [ ] Imprimante réelle : ticket d'essai lisible (accents, euro), coupe, papier presque fini (cas IMP).
- [ ] Tiroir-caisse : ouverture à chaque vente en espèces (cas TIR).
- [ ] Terminal de paiement bancaire réel, avec de petites sommes : le mode de raccordement et l'IP fixe confirmés par écrit par la banque ou l'installateur (le mode Caisse-AP n'a jamais été essayé sur un vrai terminal). Sinon, présenter le terminal habituel en autonome, sans raccordement (cas TPE).
- [ ] Coupure d'internet pendant la vente, puis reprise : aucune vente perdue ni en double (RES-01, RES-02, RES-05, RES-07).
- [ ] Douchette réglée en AZERTY, balance et préfixes réglés si la boutique en a une (cas ART).
- [ ] Import du catalogue réel du commerçant, y compris un CSV enregistré par Excel français (ONB-05, ONB-06).
- [ ] iPad essayé si la boutique en utilise un (BRG-10, RES-08).
- [ ] Un résultat OK, KO ou « bloqué » noté pour chaque cas P0, 100 % des P0 OK et au moins 90 % des P1 OK, sinon KO avec contournement accepté par écrit (critères de sortie).
- [ ] Une photo de chaque ticket papier vérifié, rangée avec la fiche de recette.

## 4. Serveur en ligne et sauvegarde

Aujourd'hui, il n'y a pas de serveur en ligne : sans lui, aucun pilote.

- [ ] Serveur de production installé selon `docs/installation-production.md`, secrets forts, domaine d'envoi d'e-mails vérifié chez Resend.
- [ ] Hébergeur réel connu et renseigné (`NEXT_PUBLIC_HOST_*`), pas seulement supposé (`docs/legal/pages-a-valider.md`, mentions légales point 2).
- [ ] Sauvegardes chiffrées actives, contrôle de fraîcheur de la dernière sauvegarde en place (`docs/sauvegardes.md`).
- [ ] **Une restauration d'essai réussie**, comptages identiques à la base d'origine, notée avec la date.
- [ ] Clé de déchiffrement des sauvegardes et copie du fichier `.env.production` (`SECRETS_KEY`) conservées hors du serveur.
- [ ] Alerte reçue par le fondateur en cas d'arrêt du serveur ou de sauvegarde ancienne (qui reçoit, sur quel canal, tenable seul).

## 5. Assurance et identité de l'éditeur

- [ ] Assurance responsabilité civile professionnelle souscrite pour l'activité d'éditeur de logiciel, étendue de la garantie lue : [à compléter, aucun contrat dans le dépôt]. À faire valider : couverture d'un logiciel de caisse et de pertes d'exploitation éventuelles.
- [ ] Identité de l'éditeur renseignée de manière identique côté web et côté API (`EDITOR_COMPANY`, `EDITOR_SIREN`, `EDITOR_ADDRESS`, `EDITOR_REPRESENTATIVE`, et les `NEXT_PUBLIC_EDITOR_*` de `docs/legal/pages-a-valider.md`), statut « entrepreneur individuel » indiqué, régime de TVA vérifié avant d'activer la mention de franchise en base, directeur de publication choisi.
- [ ] L'attestation générée par l'application porte la même identité que les mentions légales.
- [ ] Image web reconstruite après les changements de variables `NEXT_PUBLIC_*`.

## 6. Support et suivi des incidents pendant le pilote

Fondateur seul, à temps partiel : décider ici de ce qui est tenable, puis l'afficher.

- [ ] Délai de réponse décidé et réglé (`SUPPORT_SLA_MINUTES`, `SUPPORT_HOURS`, `SUPPORT_URGENT_SLA_MINUTES`, `SUPPORT_AGENT_EMAILS`), e-mails sortants testés. Valeur retenue : [à compléter]. Les valeurs par défaut du code (120 et 30 minutes) ne sont pas tenables seul : à ne pas laisser par défaut.
- [ ] Numéro de téléphone du fondateur imprimé et posé près de la caisse du pilote (SUP-04, anomalie 13).
- [ ] Un registre unique des incidents (tableur, ou fiche d'anomalie de la recette, section 13) : date, boutique, description, gravité P0 à P2, contournement, date de correction. Format : [à choisir].
- [ ] Rythme du retour hebdomadaire fixé avec chaque commerçant (jour, durée, canal).
- [ ] Règle de gravité écrite : un P0 (argent sans vente, vente perdue, impossible d'encaisser plus de 5 minutes, données d'un autre commerçant visibles) arrête le pilote chez ce commerçant jusqu'à correction, et il en est prévenu.
- [ ] Plan quand le fondateur est indisponible (congé, journée de travail ailleurs) : quel message le commerçant reçoit, et quel moyen d'encaisser de secours il garde.
- [ ] Annexe 1 du contrat tenue à jour d'après le registre.

## 7. Avant chaque installation

- [ ] Convention de pilote relue, signée par les deux parties, volet 2 de l'attestation complété et signé par le commerçant.
- [ ] Moyen d'encaisser de secours confirmé par le commerçant.
- [ ] Export complet des données essayé une fois avec lui (CSV et archives).
- [ ] Information donnée sur ce qu'il ne faut pas faire : effacer les données du navigateur d'une caisse avec des ventes « à envoyer », utiliser la navigation privée.
- [ ] Consentement écrit si un témoignage est envisagé ; sinon, rien à publier.

## Décision

| Date | Porteur | Go ou No-Go | Points ouverts acceptés par écrit |
| --- | --- | --- | --- |
| [à compléter] | [fondateur] | [à compléter] | [à compléter] |
