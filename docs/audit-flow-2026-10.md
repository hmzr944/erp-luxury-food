# Audit complet de FLŌW, octobre 2026

Synthèse des six volets (`docs/audit/01` à `06`). Hébergement et infrastructure exclus : le fondateur s'en charge seul. Le positionnement est dans `docs/positionnement.md`.

Méthode : pour chaque domaine, la documentation officielle des concurrents (Tactill, Hiboutik, SumUp, Lightspeed, Square, Shopify POS, Zettle, Zelty quand elle est lisible), comparée au code de FLŌW avec preuve (fichier:ligne). Plusieurs centres d'aide étaient illisibles (403 ou 503) : les lignes concernées sont marquées « extrait » dans les volets. Les chiffres et prix de concurrents sont de seconde main et à revérifier avant tout support écrit.

## Verdict

FLŌW a un socle technique rare pour son prix : ventes signées hors ligne sur tout appareil, chaîne fiscale, attestation, fidélité et cartes cadeaux inclus, multi-boutiques, pont local automatique. Mais **il n'est pas prêt pour un pilote** : des fonctions que le commerçant touchera dès la première semaine n'ont pas d'écran (remises, stock, lots, inventaire), deux défauts menacent l'intégrité (vente refusée qui fige la caisse, détail des ventes non verrouillé), et plusieurs promesses affichées ne sont pas tenables (API publique, attestation).

Le constat le plus important pour le positionnement : **la cible « épicerie fine et cave » est exactement le domaine où FLŌW est le moins complet à l'écran** (stock, lots, DLC, millésimes, étiquettes). Soit on comble ce trou avant les pilotes, soit on commence par une cible où le stock pèse moins.

## P0 : à corriger avant tout pilote

| # | Sujet | Constat vérifié | Volet |
|---|---|---|---|
| 1 | Vente refusée par le serveur | Une vente refusée (400, 404, 422) fige la file de la caisse : les suivantes reçoivent 409. Correction conçue, **en attente de l'avis de l'expert-comptable** | 1, 5 |
| 2 | Détail des ventes non verrouillé | Six tables fiscales sont en ajout seul, pas `Order`, `OrderItem`, `OrderPayment`. `verifyChain` ne recalcule pas `contentDigest` : une ligne altérée n'est pas détectée. Formulation de l'attestation corrigée le 20/10 ; reste à verrouiller ou vérifier | 6 |
| 3 | Remboursement | Aucun rôle, aucun plafond, y compris en espèces ; un double clic peut rembourser deux fois une carte | 1, 5 |
| 4 | Remises manuelles | Le moteur existe, aucun écran ne permet de remiser une ligne ou un ticket | 1 |
| 5 | Facture entreprise | Numérotation tirée au hasard (`FA-année-4 chiffres`) sur le chemin « commande interne » : doublons possibles, suite non continue. Source officielle à confirmer par l'expert-comptable | 3 |
| 6 | Stock inutilisable à l'écran | Seuil d'alerte jamais saisi ; ajustement impossible à la baisse (vérifié) ; lots et DLC sans écran ; pas d'inventaire ; pas de prix d'achat | 2 |
| 7 | Ventes en attente fragiles | Stockées dans IndexedDB seulement, sans demande de stockage persistant ni export de secours : un vidage fait perdre les ventes non envoyées et la clé de signature | 5 |
| 8 | Attestation de l'éditeur | Signature « machine » : vaut-elle signature du représentant légal ? Formulation pour un entrepreneur individuel. Variables `EDITOR_*` à renseigner en production. À faire valider par un avocat | 6 |
| 9 | RGPD | Accord de sous-traitance art. 28 à rédiger ; durées de conservation à définir | 3, 6 |
| 10 | Promesses non tenables | « API sans surcoût » (PRODUCT.md) : la validation des jetons n'est appelée nulle part. À retirer ou à construire | 4 |

## P1 : avant d'ouvrir largement

- **Caisse** : mise en attente de tickets, droits par action avec déblocage par un responsable, promotions automatiques, échange en un écran, mouvements de caisse en journée et ticket Z imprimé, ticket de remboursement imprimé et part carte envoyée au TPE, acomptes et paiement partiel (volet 1).
- **Stock** : fournisseurs et bons de commande externes, étiquettes imprimées, allergènes visibles à la vente, attributs de cave saisissables, import qui met à jour (volet 2).
- **Clients** : import et export du fichier particuliers, consentement avec date et texte, retrait en magasin réellement utilisable, devis converti en facture, avoir B2B et Factur-X vérifié avant le 01/09/2027 (volet 3).
- **Pilotage** : export comptable et connecteur (Pennylane d'abord), pilotage par vendeur, catégorie, moyen de paiement, marge ; webhooks complets ; alertes (écart de caisse, stock bas, clôture) ; centre d'aide, page d'état, notes de version ; double authentification (volet 4).
- **Sécurité et robustesse** : route de simulation de paiement réservée aux gérants et mode test impossible en vente réelle, contournement IPv6 de la protection des webhooks, annulation de paiement TPE qui ne confirme pas l'annulation côté TPE, vendeur qui crée des produits et saisit du stock, index manquants, tests de la synchronisation, des remboursements, des clôtures et du contrôle d'accès, textes sous 4,5:1, erreurs de formulaire peu reliées aux champs (volet 5).
- **Conformité** : TVA sur place ou à emporter, rattachement d'une vente hors ligne au bon jour de clôture et borne sur l'heure du ticket, titres-restaurant (plafond par jour et non par ticket ; dérogation produits alimentaires qui s'achève le 31/12/2026, source secondaire), plafond d'espèces (10 000 ou 15 000 € selon le professionnel), cartes cadeaux à usage unique (TVA), allergènes restitués au client, RGPD (purge, effacement qui laisse des données dans les ventes) (volet 6).

## P2 et plus tard

Fidélité avec paliers et segments, rapprochement de catalogue avec prix locaux entre boutiques, transfert de stock entre boutiques, clôture consolidée, planning et pointage (hors positionnement), plusieurs plateformes de facturation, application mobile pour le gérant.

## Corrections de nos propres documents

- Le rapport du 15/10 disait le hors ligne de SumUp non documenté : l'aide SumUp le décrit, limité à un seul iPad. Notre argument reste « hors ligne sur tout appareil, ventes signées », pas « les autres n'ont pas de hors ligne ».
- `conformite_france.md` : compteurs remis à zéro, le BOFiP 2026 § 170 dit matériel ou logiciel ; décret AGEC (2022-1565 ou 2023-237) à confirmer ; articles sur les allergènes à confirmer.
- Le simulateur de paiement n'est actif qu'en mode test (nuance au volet 5).

## Points forts confirmés (preuves dans les volets)

Ventes signées hors ligne par terminal, déverrouillage vendeur sans réseau, fond de caisse et comptage par coupures, fidélité et cartes cadeaux dans tous les forfaits, carte cadeau native, facture B2B en un geste (une fois corrigée), lots par boutique avec sortie du plus ancien (une fois l'écran ajouté), étiquettes de balance configurables, réassort suggéré avec raison, webhooks signés avec protection SSRF, pont local solide, isolation entre organisations vérifiée sur les 17 contrôleurs par boutique.

## Plan proposé

**Lot A, avant le premier pilote** (le P0 ci-dessus). Les points 1 et 8 attendent l'avis de l'expert-comptable ou de l'avocat. Les autres ne dépendent que du code : 2 (vérification de l'empreinte et verrou), 3, 4, 5, 6, 7, 10, 9 (rédaction à faire relire).

**Lot B, pendant les pilotes** : les P1 que les commerçants demandent réellement. On ne construit aucun P1 « au cas où » : chaque fonction doit être réclamée par un pilote, sinon elle reste dans la liste.

**Lot C, après les premiers abonnés payants** : P2 et P3.

## Questions ouvertes

1. Cible de départ : épicerie fine et cave (stock exigeant) ou une cible où le stock pèse moins (boutique de mode, beauté) ? Voir `docs/positionnement.md`.
2. L'avis de l'expert-comptable sur la vente refusée, la numérotation des factures et les dix points de la recette.
3. API publique : la construire (sa valeur : intégrations, argument de vente) ou retirer la promesse en attendant ?
