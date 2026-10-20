# Audit 02 : catalogue, stock, approvisionnement

Date : 20/10/2026. Lecture seule du dépôt. Complète `reports/Benchmark caisses et manques FLŌW.md`, `reports/Concurrence caisses et axes de victoire.md` et `docs/veille-concurrence-2026-10.md`, sans les refaire. Les fonctions des concurrents viennent de leurs pages d'aide, lues entre le 19 et le 20/10/2026. Les preuves FLŌW sont des fichiers du dépôt.

## Ce qui a pu être lu, ce qui ne l'a pas été

| Concurrent | Accès | Remarque |
| --- | --- | --- |
| Hiboutik | Lu en détail (faq.hiboutik.com) | Meilleure source : pages stock, DLC, inventaire, transfert, import, balance, package |
| Tactill | Lu (help.tactill.com) | Fiche article, stock, inventaire, duplication de catalogue. La page déclinaisons Excel ne détaille pas les colonnes |
| Square | Lu (pages fr et en) | Suivi de stock, import de bons de commande, balances, glossaire d'import |
| Shopify | Lu en partie | Transferts, import CSV, étiquettes et stocktake (via résultats de recherche). Page bons de commande non trouvée |
| Lightspeed X-Series | Lu en partie | Page bons de commande lue. Les pages support répondent 403 : étiquettes, série, composites, comptages ne sont connus que par les extraits de recherche |
| SumUp | Illisible | La page catalogue ne rend que son titre. Rien d'officiel sur stock ou import n'a pu être cité |
| Zelty | Pas de centre d'aide accessible | Seule la page marketing dit « stocks en temps réel » et « inventaires et fiches techniques », sans détail |
| Cashpad | Pas de centre d'aide accessible | Le stock passe par un partenaire (Yokitup, d'après le site) |
| L'Addition | Page produit stock lue | Mouvements, seuil, motifs de sortie. Pas de fiche technique ni de bon de commande décrits |

## Tableau

Priorités : P0 bloque un pilote, P1 avant ouverture large, P2 différenciant ou attendu, P3 plus tard, HP hors positionnement. Effort : S, M, L. Préfixes d'URL : T = `https://help.tactill.com/fr/articles/`, H = `https://faq.hiboutik.com/fr/`, S = `https://squareup.com/help/fr/fr/article/`, L = `https://x-series-support.lightspeedhq.com/hc/en-us/articles/`, Sh = `https://help.shopify.com/`.

| # | Fonction | Qui la propose (page d'aide) | État FLŌW et preuve | Prio | Effort |
| --- | --- | --- | --- | --- | --- |
| 1 | Fiche produit : nom, sous-titre, description, SKU, code-barres, prix, TVA | Tactill sans description ni prix d'achat (T913423-creer-modifier-supprimer-un-article). Hiboutik (H produits-prestations/creer-un-produit-simple) | PRÉSENT. `apps/api/prisma/schema.prisma:256-311`, `apps/web/src/components/products/ProductDrawer.tsx:20-32` | HP | |
| 2 | Photo produit | Tactill l'exige (image ou couleur) (T913423) | PARTIEL. `imageUrl` en base (schema.prisma, modèle Product) et dans le DTO (`apps/api/src/products/dto`, ligne 144), aucun champ photo dans `ProductDrawer.tsx` | P2 | S |
| 3 | Catégories | Tous. Hiboutik ajoute marques et tags (H produits-prestations/configurer-les-tags-produits) | PARTIEL. `Category` (schema.prisma:244), CRUD `products.controller.ts:165-189`. Ni tags ni marques | P2 | S |
| 4 | Prix multiples : prix par boutique, listes, périodes (soldes, happy hour) | Square prix par point de vente (squareup.com/help/au/en/article/8211-item-import-spreadsheet-glossary). Hiboutik périodes de remises (H produits-prestations/configurer-les-periodes-de-remises-happy-hour-soldes) | ABSENT. Un seul `Product.price` par site (schema.prisma:256) | P2 | M |
| 5 | Prix d'achat, marge | Hiboutik prix d'achat HT à l'import (H produits-prestations/importer-les-produits). Shopify « Cost per item » (Sh en/manual/products/import-export/using-csv). Tactill via le champ Référence (T1369026-suivre-et-gerer-le-stock-de-vos-articles) | ABSENT. Aucun champ de coût dans le schéma, hors `supplyPrice` interne (schema.prisma, modèle Product). L'import écarte volontairement `prix_achat` (`packages/utils/src/import-mapping.ts`, liste NOT_PRICE) | P1 | M |
| 6 | TVA multiples par produit, changement en masse | Tactill change la taxe de tous les articles (T3753602-changez-rapidement-la-taxe-de-vos-articles) | PARTIEL. `Product.taxRate` et `TaxRate` d'organisation (schema.prisma:731). Pas de changement en masse | P2 | S |
| 7 | Plusieurs codes-barres par produit, génération interne | Hiboutik, EAN13 interne généré en 243 (H produits-prestations/gerer-les-codes-barres). Shopify jusqu'à 20 codes | PARTIEL. Un `barcode` par produit et par variante (schema.prisma:256, 382). Recherche par code : `products.controller.ts:71`. Pas de génération | P2 | S |
| 8 | Fiche pré-remplie par code-barres | Aucun concurrent lu ne l'affiche | PRÉSENT. `apps/api/src/products/lookup.ts` (Open Food Facts), route `products.controller.ts:100` | HP | |
| 9 | Unités et conditionnements | Hiboutik champ « Multiple » (H produits-prestations/gerer-les-decimales-vente-kg-litre-metre). Tactill vrac en kg, l, m, minute | PARTIEL. `StockItem.unit` libre, par défaut « unité » (schema.prisma:584), `supplyUnit` seulement pour le labo. Pas de contenance (75 cl, 6 x 75 cl) structurée | P2 | S |
| 10 | Variantes : tailles, couleurs, matrice | Tactill (T3220754-creer-des-declinaisons-d-un-article-depuis-le-tableau-de-bord). Lightspeed 3 attributs et 200 combinaisons (extrait de recherche, L25534215660955). Shopify 3 options | PRÉSENT. `ProductOption` (schema.prisma:782), `Variant` (:382), aperçu de matrice `products.controller.ts:105`, `packages/utils/src/variants.ts` | HP | |
| 11 | Attributs de cave : millésime, appellation, région, degré | Hiboutik par tags et déclinaisons de contenance (page caviste et épicerie, hiboutik.com/fr/logiciel-de-caisse/caviste-epicerie/) | PARTIEL. `AttributeDefinition` avec pack WINE (schema.prisma:698, 765), validation `products/attributes.ts`. Aucun écran de saisie : `ProductDrawer.tsx` ne manipule pas `attributes` | P1 | S |
| 12 | Formules et menus | Tactill (T4570706-creer-un-menu), Hiboutik package (H produits-prestations/creer-un-produit-package-produit-groupe) | PRÉSENT. `MenuStep`, `MenuChoice` (schema.prisma:354, 368), `packages/utils/src/composition.ts` | HP | |
| 13 | Coffret composé qui sort les stocks des composants | Hiboutik package : chaque composant est décrémenté (même page). Lightspeed composites, prix non calculé (L50084912660635, extrait) | PARTIEL. Le coffret existe comme variante ou formule. La sortie de stock est faite sur la ligne vendue (`orders.service.ts:450-460`), aucune preuve de sortie des composants | P1 | M |
| 14 | Options et modificateurs | Square, Tactill | PRÉSENT. `ModifierGroup`, `Modifier` (schema.prisma:313, 329) | HP | |
| 15 | Nomenclatures, recettes, fiches techniques, coût matière | L'Addition ne les décrit pas (laddition.com/fr/logiciel-caisse-gestion-de-stock). Zelty les cite sans détail (page marketing). Cashpad via partenaire | ABSENT (confirme Benchmark #15). Rien dans le schéma | P2 pour boulangerie, HP pour la restauration lourde | L |
| 16 | Vente au poids, saisie manuelle | Tactill vrac (T913423). Hiboutik en grammes entiers (H produits-prestations/gerer-les-decimales-vente-kg-litre-metre) | PRÉSENT. `Product.soldByWeight` (schema.prisma:~296), `WeightSheet` (`apps/web/src/components/pos/Composition.tsx`), sortie de stock au poids (`orders.service.ts:455`) | HP | |
| 17 | Étiquettes de balance EAN-13 (prix ou poids) | Square : préfixe 02 fixe et SKU à 5 chiffres (S7419-scanning-bar-codes-from-label-printing-scales-on-point-of-sale). Hiboutik lit prix et poids | PRÉSENT et plus souple. Préfixes 20 à 29 et longueur du code réglables (`packages/utils/src/scale-barcode.ts`), `Product.scaleCode`, test dans `Catalog.tsx:64` | HP | |
| 18 | Tare | Aucune page lue ne la décrit (Tactill et Hiboutik non plus) | ABSENT. Aucune occurrence dans `apps/web/src` | P2 | S |
| 19 | Balance connectée directe | Cashmag, JDC (Benchmark) | ABSENT. Benchmark #33 | HP | |
| 20 | Lots et DLC | Hiboutik : date par ligne d'arrivage, FEFO implicite, commun à tout le compte, sans alerte (H stock/gerer-les-dates-de-peremption). Tactill, Square, Shopify : rien trouvé | PARTIEL, important. `StockLot` par site (schema.prisma:808), `TrackingMode` (:707), réception `stock.service.ts:127`, sortie FEFO `:102-120`, liste des lots proches de la limite `stock.controller.ts:51`. Mais aucun écran web : ni choix du suivi dans `ProductDrawer.tsx`, ni saisie de lot, ni liste des DLC. La réception de livraison interne ne crée pas de lot | P0 | M |
| 21 | Numéros de série | Hiboutik (H produits-prestations/gerer-les-n-de-serie). Lightspeed en module complémentaire (L25534199507483, extrait) | PARTIEL. Unicité `@@unique([productId, serialNumber])` (schema.prisma:808), panier avec série (`cart.store.ts:39`). Saisie à la réception seulement par l'API | P2 | S |
| 22 | Produits inactifs et archivés | Square « Archived », Hiboutik suppression refusée si liée | PRÉSENT. `Product.isActive`, filtre `products.service.ts:57` | HP | |
| 23 | Import CSV ou Excel | Hiboutik CSV à point-virgule, modèle, tableau d'erreurs (H produits-prestations/importer-les-produits). Tactill matrice Excel (T5224302). Square modèle et correspondance de colonnes. Shopify CSV avec option d'écrasement | PARTIEL. `apps/api/src/data/product-import.ts` (2000 lignes max, variantes par noms répétés), simulation `dryRun` (`data.service.ts:195`), reconnaissance de colonnes d'autres logiciels et .xlsx (`import-mapping.ts`, `DataSettings.tsx:128`). Création seule : les produits au nom déjà connu sont ignorés. Ni mise à jour, ni prix d'achat, fournisseur, lot, seuil, stock par site | P1 | M |
| 24 | Modèles et migration par concurrent | Tactill duplique par Excel sans les identifiants (T3928193). SumUp annonce un service de bascule (Benchmark) | PARTIEL. Synonymes génériques (« Désignation », « EAN13 », « PV TTC ») mais aucun modèle nommé Tactill, Hiboutik, Lightspeed | P1 | S |
| 25 | Export catalogue et stock | Tactill, Hiboutik, Square | PRÉSENT. `products.csv`, `stock.csv` (`data.controller.ts:46-52`), export sans surcoût | HP | |
| 26 | Étiquettes et codes-barres imprimés | Hiboutik ZPL ou TSPL automatique (H produits-prestations/gerer-les-codes-barres). Lightspeed depuis la fiche produit ou un bon de commande, planches Avery (L25533677279771, extrait). Shopify via une application | ABSENT. Aucune impression d'étiquette produit (`apps/web/src/lib/printing` ne traite que le ticket). Benchmark #23 | P1 | M |
| 27 | Entrées, sorties, casse, motifs | Square : motifs listés (S8331-set-up-inventory-tracking). L'Addition : casse, périmé, rebut | PARTIEL. Types `MovementType` (schema.prisma:651), `stock.service.ts:249`. Défaut : le type ADJUSTMENT est toujours ajouté (`:275-277`), donc aucun ajustement à la baisse. `StockClient.tsx` n'offre qu'un bouton « +10 ». Pas de variante ni de lot dans cette saisie | P0 | S |
| 28 | Inventaire (tournant et complet), écarts | Hiboutik : partiel par catégorie, marque ou fournisseur, import de scans, validation (H stock/gerer-les-inventaires). Tactill : remise à zéro par le support (T6820875-realiser-un-inventaire). Shopify : stocktake réservé à POS Pro d'après un extrait | ABSENT. Aucun modèle de comptage, aucun écran (`StockClient.tsx` : Inventaire, Mouvements, Alertes seulement) | P0 | M |
| 29 | Seuils et alertes | Hiboutik (H stock/gerer-les-alertes-stock-stock-minimum), Square, L'Addition | PARTIEL, défaut bloquant. `alertAt` existe (schema.prisma:584, 795) et `getLowStockAlerts` (`stock.service.ts:233`), mais aucun code n'écrit jamais `alertAt` : ni DTO produit, ni import, ni écran. Les alertes sont donc toujours vides. La détection à la vente se limite à un `logger.warn` (`:76`) | P0 | S |
| 30 | Transferts entre boutiques | Hiboutik (option multi-boutiques, H stock/creer-un-transfert). Shopify (Sh manual/products/inventory/transfers) | PARTIEL. Seulement labo vers boutique, par commande interne (`supply.service.ts:374`). Pas de transfert libre ni de réception partielle. Vue consolidée du stock du réseau : `stock-network.service.ts` | P1 | M |
| 31 | Multi-dépôts | Shopify emplacements, Lightspeed points de vente | PARTIEL. Un `Site` peut être fournisseur (`isSupplier`, schema.prisma:113). Pas de notion d'emplacement dans un site | P3 | M |
| 32 | Fournisseurs (fiche, références, conditions) | Hiboutik un fournisseur par produit, archivable (H stock/configurer-les-fournisseurs). Lightspeed, Square (vendeurs) | ABSENT. Seuls les sites internes `isSupplier`. Aucun modèle de fournisseur externe | P1 | M |
| 33 | Bons de commande, réception, coûts d'approche | Lightspeed : envoi par e-mail, réception partielle, frais répartis, prix moyen (product-info.lightspeedhq.com/x-lightspeed-purchase-orders-101/). Square : import CSV, plan Plus (S7656-import-purchase-orders-with-square-for-retail). Hiboutik « arrivages » (faq.hiboutik.com/en/inventory/create-a-stock-order) | PARTIEL. Cycle complet mais interne : `SupplyOrder`, statuts DRAFT à RECEIVED, quantités reçues et écarts (schema.prisma:978-1033, `supply.service.ts`). Aucun achat auprès d'un fournisseur extérieur, aucun prix d'achat | P1 | L |
| 34 | Prix d'achat moyen pondéré, valorisation | Lightspeed moyenne pondérée à chaque réception (même page). Hiboutik valorisation à date (H stock/gerer-un-stock-avec-des-arrivages, méthode non précisée) | ABSENT. Dépend de la ligne 5 | P1 | M |
| 35 | Rupture et réapprovisionnement suggéré | Lightspeed recommandations et min/max. Hiboutik : liste des produits vendus, sans suggestion (H stock/creer-un-reassort) | PARTIEL, atout. `suggestQuantity` (`supply-plan.ts:60`) : ventes du même jour de semaine plus marge moins stock. Limité au flux labo vers boutique. Rien pour un produit acheté à un fournisseur | P1 | M |
| 36 | Historique des mouvements | Tactill (T1369026), Lightspeed | PARTIEL. `StockMovement` avec lot, commande, utilisateur (schema.prisma:598). Lecture limitée à 50 lignes, un filtre produit (`stock.service.ts:239`), pas d'export ni de filtre par type ou période | P1 | S |
| 37 | Stock par variante | Tactill, Hiboutik, Square | PARTIEL. `VariantStock` (schema.prisma:795) décrémenté à la vente. L'écran Stock ne liste que `StockItem` (`getInventory`, `stock.service.ts:219`) donc pas les variantes | P1 | S |
| 38 | Robustesse de la sortie de stock | Hiboutik interdit de vendre sans stock en mode arrivages | PARTIEL. Sortie différée sans suite en cas d'échec (`orders.service.ts:450-461`, `.catch(() => {})`), plancher à zéro (`stock.service.ts:85-98`) : une vente en rupture perd l'écart | P1 | S |
| 39 | Catalogue partagé et prix locaux | Tactill duplique par Excel, sans prix locaux (T3928193). Square prix par point de vente | PARTIEL. Catalogue propre à chaque site (`Product.siteId`). Copie ponctuelle `catalog-copy.service.ts:58`. Pas de synchronisation ni de surcharge locale | P1 | M |
| 40 | Allergènes (14 INCO) en base | Cashpad les montre en cuisine (cashpad.io, extrait). Zelty, L'Addition : non décrits | PRÉSENT en back-office. `Allergen`, `ProductAllergen` avec traces (schema.prisma:616-634), page `apps/web/src/app/(app)/allergens` | HP | |
| 41 | Allergènes visibles au comptoir, sur étiquette ou en QR | Aucun concurrent lu ne le décrit | ABSENT côté vente : aucun usage dans `components/pos`, `app/r`, ni `lib/printing`. Benchmark ligne 30 le signale. Obligation d'information à faire valider (texte primaire non vérifié, voir Benchmark) | P1 | M |
| 42 | Traçabilité aval d'un lot (quels tickets, quels clients) | Hiboutik pour les séries (historique d'entrée à sortie, H produits-prestations/gerer-les-n-de-serie) | PARTIEL. `StockMovement.lotId` renseigné à la vente (`stock.service.ts:59-69`). Aucune requête ni écran de rappel de lot. Obligations de traçabilité non vérifiées, à valider | P2 | M |
| 43 | Alcool : droits d'accises, contrôle d'âge | JDC gestion des alcools (Concurrence) | ABSENT. Texte primaire non vérifié (Benchmark). À valider avant tout développement | P2 | M |
| 44 | Produits composés au poids ou vrac (cave à huile, épicerie en vrac) | Hiboutik par unités entières | PARTIEL. Poids décimal géré (`priceForWeight`). Pas de tare ni de contenant | P2 | S |

## Synthèse

FLŌW couvre mieux que prévu la partie vente du catalogue : variantes en matrice, formules, modificateurs, poids, étiquettes de balance, import avec simulation, export. Le manque est de l'autre côté de la caisse : tout ce qui fait vivre le stock. Le dépôt contient les briques (lots, FEFO, séries, seuils, mouvements) mais l'écran de stock ne propose qu'un bouton « +10 ». Pour un épicier fin ou un caviste, la promesse « stock inclus dès Pulse » (Benchmark) n'est pas tenue sans trois corrections rapides.

### Les 10 écarts les plus importants

1. **Seuils d'alerte jamais renseignables** (ligne 29, P0, S). `alertAt` n'est écrit nulle part, les alertes restent vides.
2. **Lots et DLC sans écran** (ligne 20, P0, M). Le moteur FEFO existe, mais personne ne peut créer un lot ni voir les DLC proches.
3. **Inventaire absent** (ligne 28, P0, M). Hiboutik propose le comptage partiel, par scan, avec écarts validés. Un commerçant a besoin de cela avant la fin de l'exercice.
4. **Ajustement impossible à la baisse** (ligne 27, P0, S). `addMovement` rend toute quantité positive pour ADJUSTMENT.
5. **Prix d'achat, marge, moyenne pondérée, valorisation** (lignes 5 et 34, P1, M). Aucun concurrent lu ne laisse un caviste sans marge.
6. **Fournisseurs et bons de commande extérieurs** (lignes 32 et 33, P1, L). L'approvisionnement actuel suppose un labo FLŌW. Un épicier achète à des producteurs.
7. **Étiquettes imprimées** : prix, code-barres, DLC, allergènes (lignes 26 et 41, P1, M).
8. **Attributs de cave sans formulaire** (ligne 11, P1, S) : millésime, appellation.
9. **Import en création seule et sans modèle par concurrent** (lignes 23 et 24, P1, M).
10. **Catalogue partagé et prix locaux** (ligne 39, P1, M) pour les enseignes à deux boutiques ou plus.

Restent hors de ce haut de liste mais proches : stock par variante invisible (ligne 37), sortie de stock silencieuse en cas d'échec (ligne 38), tare (ligne 18).

### Les 5 points où FLŌW fait mieux ou autrement

1. **Lots tenus par site avec sortie FEFO automatique** (`schema.prisma:808`, `stock.service.ts:102`). Hiboutik rend ses dates communes à tout le compte et ne retient pas la date de chaque unité vendue. À condition d'ajouter l'écran (écart 2).
2. **Étiquettes de balance configurables** (`packages/utils/src/scale-barcode.ts`) : préfixes 20 à 29 et longueur de code réglables, modes prix et poids. Square impose le préfixe 02 et un SKU à 5 chiffres.
3. **Réassort suggéré avec raison affichée** (`supply-plan.ts:60`). Hiboutik liste seulement les produits vendus.
4. **Numéros de série avec unicité par produit et sortie à l'encaissement**, sans module payant (Lightspeed les vend en complément d'après un extrait).
5. **Fiche produit pré-remplie par code-barres depuis Open Food Facts** (`lookup.ts`), absente des pages d'aide lues, avec import simulé ligne par ligne et export sans surcoût.

### Les 5 fonctions à ne pas copier

1. **Stock avancé réservé aux paliers** (Shopify POS Pro, Square Plus) : contraire au principe « inclus, pas en option » de `apps/web/PRODUCT.md`.
2. **Inventaire par remise à zéro demandée au support** (Tactill) : l'autonomie du commerçant est l'argument.
3. **Vente impossible sans stock en mode arrivages** (Hiboutik) : incompatible avec une vente hors ligne dont le stock arrive après coup.
4. **Poids en unités entières et un seul fournisseur par produit** (Hiboutik) : un modèle décimal est déjà en place.
5. **ERP de restauration complet et lecture de factures par IA** (fiches techniques détaillées, KDS, bêta Lightspeed) : hors cœur retail et métiers de bouche. Ne viser les recettes que pour la boulangerie, plus tard.

## À faire valider

- Information allergènes sur les denrées non préemballées, traçabilité par lot, droits d'accises et contrôle d'âge : textes primaires non lus dans ce lot (Benchmark, lignes 30 et 33). Ne rien écrire de juridique sans eux.
- Les comparatifs de prix et de forfaits cités par les pages d'aide (Square Plus, Shopify POS Pro) viennent d'extraits de recherche pour certains. À relire avant toute comparaison publique.
- Les pages Lightspeed X-Series ne sont connues que par extraits de recherche. Une relecture en navigateur est nécessaire avant publication.
