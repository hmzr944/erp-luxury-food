# Fonctions des caisses retail de référence (2025-2026) : benchmark pour FLŌW

Notes de recherche, octobre 2026. Les prix sont HT sauf mention contraire. Plusieurs pages officielles n'ont pas pu être lues : Lightspeed FR renvoie une 404, Square FR une erreur 429, et Odoo FR n'affiche que des USD. Les prix en € viennent donc parfois de comparateurs tiers, ce qui est signalé à chaque fois. Le symbole ⚠ marque une source tierce ou un point non confirmé.

## 1. Matrice synthétique fonctions × éditeurs (offre et tier)

### Takeaway
Les caisses retail grand public (Lightspeed, Shopify POS Pro, Square Plus) traitent toutes comme un socle payant les fonctions suivantes : bons de commande fournisseurs, comptages d'inventaire, transferts entre magasins, fidélité, cartes cadeaux et e-commerce intégré. Ces fonctions sont presque toujours réservées au tier payant (« Plus » ou « Pro »), facturé environ 60 à 80 € par magasin et par mois. Côté différenciation, seules les solutions françaises haut de gamme mode et luxe (Cegid, Fastmag) ajoutent la détaxe, le clienteling, l'endless aisle et l'e-réservation.

### Cited Findings

**Lightspeed Retail (X-Series, ex-Vend)**
- Prix US : Basic à 89 $/mois, Core à 149 $/mois, Plus à 289 $/mois. La facturation annuelle fait économiser « jusqu'à 18 % ». Chaque plan inclut une caisse, les paiements intégrés et l'app Mobile Scanner — [Lightspeed Retail pricing](https://www.lightspeedhq.com/pos/retail/pricing/)
- D'après la page de prix, tous les plans incluent les éléments suivants :
  - e-commerce intégré (version « Basic » sur le plan Basic) ;
  - fidélité en magasin et en ligne ;
  - rapports avancés ventes, staff et stock, plus Insights (prévisions, recommandations de commande, rapports personnalisés) ;
  - PO Sync, Lightspeed Wholesale et le catalogue NuORDER ;
  - gestion de stock avec landed costs (coûts de revient complets) ;
  - rôles utilisateurs personnalisés et SSO, accès API.
  — [Lightspeed Retail pricing](https://www.lightspeedhq.com/pos/retail/pricing/)
- Le plan Plus ajoute API, workflows personnalisés, contrôles utilisateurs personnalisés, support 24/7 et un Custom Report Builder (UK). Les achats peuvent se commander pour tous les magasins à la fois ou magasin par magasin — [Lightspeed Retail Plus UK](https://product-info.lightspeedhq.com/lightspeed-retail-x-series-plus-plan-uk) ; [comparatif Core vs Plus](https://product-info.lightspeedhq.com/lightspeed-retail-x-series-lightspeed-insights-core-vs-plus-comparison-noam/)
- ⚠ Le centre d'aide se contredit sur la fidélité : elle serait « disponible sur Core et Plus », mais aussi « Advanced ou module Loyalty ». La page semble obsolète — [X-Series support](https://x-series-support.lightspeedhq.com/hc/articles/25535057310235)
- Commandes spéciales (articles non en stock) et mises de côté (layaway) se prennent directement depuis l'écran de vente, et Lightspeed les dit « included in the POS for free ». Je n'ai pas pu vérifier la page exacte. Elle apparaît dans un lot de résultats contenant [Lightspeed vs Square (AU)](https://www.lightspeedhq.com/au/pos/lightspeed-vs-square/) ⚠
- Pointeuse (Time Clock) intégrée à la caisse depuis 2023 : pointage d'entrée et de sortie, avec export paie via intégrations tierces — [Retail Insider, août 2023](https://retail-insider.com/bulletin/2023/08/lightspeed-commerce-inc-introduces-cutting-edge-features-to-empower-merchants/)
- Prix en € : ⚠ les comparateurs FR donnent Basic 89 €, Core 159 € et Pro 249 € HT/mois, plus 49 € par caisse supplémentaire. Ces chiffres concernent en réalité l'offre restaurant ; je n'ai trouvé aucune grille € officielle pour Retail — [tool-advisor Lightspeed](https://tool-advisor.fr/logiciel-de-caisse/comparatif/lightspeed/) ; [saask.fr](https://saask.fr/softwares/lightspeed/prix/)

**Shopify POS (relevé France, septembre-octobre 2026)**
- Forfaits Shopify au mois : Basic 36 €, Grow 105 €, Advanced 384 €. En annuel : 27, 79 et 289 €. Shopify Plus démarre à 2 100 €/mois avec 20 emplacements POS Pro inclus — [Kanal, Shopify POS France](https://getkanal.com/fr/blog/shopify-pos)
- POS Pro coûte 79 €/mois par emplacement, ou 59 €/mois sur une offre annuelle de 12 mois. Shopify n'indique pas si ces prix sont HT ou TTC — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
- Inclus dans tous les forfaits payants : stock, commandes et clients multi-emplacements, remboursements, cartes cadeaux, PIN employés, paiements mixtes ou partiels — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
- Réservé à POS Pro :
  - échanges ;
  - retrait en magasin, expédition à domicile, livraison locale ;
  - paniers envoyés par e-mail ;
  - transferts de stock et comptages dans l'app ;
  - utilisateurs illimités avec rôles et permissions ;
  - réductions automatiques, rapports de ventes quotidiens.
  — [Kanal](https://getkanal.com/fr/blog/shopify-pos) ; [Shopify POS pricing](https://www.shopify.com/fr/pos/pricing)
- POS Pro apporte aussi des fiches clients riches avec valeur vie client (LTV), des insights fidélité et des rapports de stock approfondis — [Shopify POS pricing](https://www.shopify.com/fr/pos/pricing)
- Bons de commande fournisseurs, transferts et alertes de stock bas se gèrent dans l'admin Shopify. Le POS Terminal (229 €) intègre un écran côté client — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
- La fidélité, l'impression d'étiquettes et la détaxe ne sont pas natives. Il faut passer par des apps du Shopify App Store (inférence, voir la section 3) — [Kanal](https://getkanal.com/fr/blog/shopify-pos)

**Square pour détaillants**
- Le plan Plus coûte 69 € HT/mois par point de vente, avec 30 jours d'essai gratuit. Premium est sur devis ; ⚠ son seuil serait d'environ 200 k€ d'encaissement par an — [Mobile Transaction FR](https://fr.mobiletransaction.org/square-pour-detaillants-avis/) ; [Square FR détaillants](https://squareup.com/fr/fr/solutions/retailers)
- Le plan gratuit ne gère pas les stocks avancés. D'après le centre d'aide US, le reporting stock, les bons de commande, la gestion fournisseurs et l'impression d'étiquettes ne sont pas disponibles en Free — [Square help (US)](https://square.com/help/us/en/article/6498-navigate-your-retail-dashboard)
- Le plan Plus apporte :
  - les bons de commande, avec commandes suggérées quand le stock est bas ;
  - la gestion fournisseurs (envoi et réception des commandes) ;
  - le transfert de stock en masse entre magasins ou entrepôt ;
  - les comptages d'inventaire.
  — [Square PO (UK)](https://squareup.com/gb/en/point-of-sale/retail/features/purchase-orders) ; [Vendor management (UK)](https://squareup.com/gb/en/point-of-sale/retail/features/vendor-management) ; [Inventory counting (AU)](https://square.com/au/en/point-of-sale/retail/features/inventory-counting) ; [Retail pricing UK](https://square.com/gb/en/point-of-sale/retail/pricing)
- ⚠ L'article Mobile Transaction (mis à jour en janvier 2024) mentionne aussi en Plus : étiquettes code-barres, synchronisation avec la boutique en ligne Square et retours multi-magasins. La gestion avancée des employés coûterait 25 € HT de plus — [Mobile Transaction FR](https://fr.mobiletransaction.org/square-pour-detaillants-avis/)
- Je n'ai trouvé aucune source sur la mise de côté (layaway) ou les commandes spéciales chez Square.

**SumUp POS (POS Lite et POS Pro, ex-Goodtill)**
- POS Pro est l'ancien Goodtill, racheté en 2020. Il apporte stock et analyses avancés, promotions et intégrations ; il est surtout orienté restauration — [Mobile Transaction](https://www.mobiletransaction.org/sumup-point-of-sale-review)
- La page retail FR met en avant un catalogue illimité, le suivi des stocks et des statistiques (heures de pointe, tendances) — [SumUp FR retail](https://www.sumup.com/fr-fr/types-d-entreprise/commerce-de-detail/)
- ⚠ Aux États-Unis, les promotions personnalisables sont réservées à POS Pro — [tech.co](https://tech.co/pos-system/sumup-pos-review)
- Je n'ai trouvé aucune grille € 2025-2026 pour POS Pro.

**Zettle by PayPal**
- L'app de caisse est gratuite et sans abonnement. Elle prélève 1,75 % par transaction carte. ⚠ Le lecteur coûterait 29 € HT selon une source, 19 € selon une autre ; le terminal tout-en-un démarre à 199 € HT — [tool-advisor Zettle](https://tool-advisor.fr/logiciel-de-caisse/comparatif/zettle/) ; [detective-banque](https://www.detective-banque.fr/terminal-de-paiement/zettle-avis/)
- Le stock est suivi en temps réel, avec une alerte de rupture au moment de l'ajout au panier et une synchronisation bidirectionnelle avec une boutique en ligne (WiziShop) — [WiziShop](https://www.wizishop.fr/integrations/zettle-by-paypal) ; [ePages](https://blog.epages.com/fr/zettle-by-paypal)
- Je n'ai trouvé aucune source sur un programme de fidélité natif.

**Hiboutik (France, web)**
- Tarifs 2026 HT : Gratuit à 0 €, Premium à 14,90 €/mois, multi-boutiques à 11,90 €/mois par boutique (en plus du Premium) — [La Caisse Idéale 2026](https://www.lacaisseideale.fr/articles/hiboutik-avis/)
- ⚠ Des sources plus anciennes donnent d'autres prix Premium : 9,90 € ou 15,90 € — [CCI Store](https://www.ccistore.fr/produit/213/Hiboutik) ; [mon-petit-paiement](https://mon-petit-paiement.com/avis-hiboutik/)
- La formule gratuite comprend :
  - encaissement, rapport Z ;
  - stocks (entrées et sorties, alertes de stock minimum, inventaire exportable), fournisseurs ;
  - fiches clients et fidélité par points ;
  - variantes tailles et couleurs ;
  - comptes clients avec avances et soldes (ce qui couvre en partie les acomptes).
  — [La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)
- L'inventaire peut se faire en continu : les écarts s'accumulent dans une liste que l'on valide quand on veut. Les points de fidélité se paramètrent par produit et se convertissent en remise ou en produit offert — [independant.io](https://independant.io/avis/hiboutik/) ; [appvizer](https://www.appvizer.fr/finance-comptabilite/gestion-de-caisse/hiboutik)
- Premium débloque les statistiques avancées, la comptabilité, l'API et une boutique en ligne. Multi-boutiques ajoute la synchronisation, les transferts de stock et une base clients partagée — [La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)
- ⚠ CCI Store mentionne l'édition de devis et de bons de commande, sans détailler le workflow — [CCI Store](https://www.ccistore.fr/produit/213/Hiboutik)

**Odoo Point de Vente + Inventaire**
- Prix affichés en USD par utilisateur et par mois : One App Free à 0 (une seule app), Standard à 24,90 ou 31,10 $, Custom à 49 ou 61,10 $ (Studio, multi-société, API externe). Le POS est inclus dans Standard et Custom. Je n'ai pas obtenu de prix € — [Odoo pricing](https://www.odoo.com/fr_FR/pricing)
- Un même moteur de règles gère fidélité, coupons et cartes cadeaux. Les points se gagnent par euro dépensé, par produit ou par visite. Les récompenses sont un pourcentage, un produit offert ou un montant fixe. Une carte cadeau achetée en caisse est utilisable en ligne — [Octura Solutions, mai 2026](https://octurasolutions.com/fr/resources/12-fonctionnalites-point-of-sale-odoo-pour-commerce-et-restauration) ; [ecosire](https://ecosire.com/fr/blog/odoo-pos-retail-guide)
- Les cartes cadeaux rechargeables se gèrent par scan de code-barres — [Odoo, magasin de jouets](https://www.odoo.com/fr_FR/industries/toy-store)
- Mode hors ligne avec cache des produits, listes de prix et clients. Les mouvements de stock sont créés à la validation de chaque vente — [Octura](https://octurasolutions.com/fr/resources/12-fonctionnalites-point-of-sale-odoo-pour-commerce-et-restauration)
- Inférence : Odoo Inventaire (achats, réapprovisionnement, valorisation FIFO ou coût moyen, lots et séries, unités de mesure, kits) est connu pour couvrir toute la profondeur ERP. Je n'ai pas de source lue dans cette session pour le confirmer ; voir les Gaps.

**Spécialistes français mode, luxe et cave**
- Cegid Retail (ex-Y2, mode, luxe et retail spécialisé) propose en encaissement :
  - e-réservation, click & collect, endless aisle ;
  - détaxe, retours, prise de commande, queue busting ;
  - clienteling avec vue client à 360°.
  — [Cegid (page produit)](https://www.cegid.com/fr/?p=58301) ; [LSA, Shopping](https://www.lsa-conso.fr/shopping-la-nouvelle-solution-d-encaissement-de-cegid,257991) ; [LSA NRF19, inventaire](https://www.lsa-conso.fr/nrf19-cegid-ajoute-la-brique-gestion-de-l-inventaire-magasin-a-son-catalogue,308121)
- Fastmag Boutique (mode et textile) couvre :
  - cartes cadeaux, paiements différés, commandes ;
  - click & collect et web-to-store ;
  - fidélité, remises, avoirs, acomptes et réservations ;
  - des tableaux de bord : CA, marge, panier moyen, indice de vente, taux de transformation, top/flop, performance par vendeur.
  — [tool-advisor Fastmag](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/)
- Fastmag propose aussi Mobile Sales (encaissement nomade) et des modules E-commerce, Négoce, Production et Copilot. ⚠ Le prix diverge selon la source : 119 € HT/mois chez tool-advisor, 69 €/mois par utilisateur chez Appvizer — [tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/) ; [Appvizer](https://www.appvizer.fr/finance-comptabilite/gestion-de-caisse/fastmag/avis)
- Wino (cavistes et épiceries fines, iPad, NF525) : catalogue métier, seuils de stock et inventaire, analyses (CA, panier moyen, top produits), fiches clients pour la fidélité. Le module de vente en ligne coûte environ 15 €/mois en plus. Wino ne publie pas ses prix — [independant.io Wino](https://independant.io/avis/wino/) ; [tool-advisor cavistes](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-caviste/)
- Cashmag et Clover : je n'ai rien trouvé d'exploitable dans cette session.

### Inferences
- **Socle attendu en 2026.** Pour un commerçant indépendant multi-boutiques, les fonctions suivantes sont « table stakes » chez Lightspeed, Shopify POS Pro et Square Plus, et Hiboutik les propose même à bas prix :
  - fiche client avec historique ;
  - fidélité et cartes cadeaux ;
  - bons de commande fournisseurs, avec suggestions de réassort ;
  - comptages d'inventaire, au scanner ;
  - transferts inter-magasins ;
  - étiquettes code-barres ;
  - remises automatiques ;
  - click & collect.
- **Différenciants.** Prévisions et recommandations de commande, landed costs, pointeuse, endless aisle, détaxe, clienteling, e-réservation, ainsi que les mises de côté et commandes spéciales (Lightspeed, Fastmag).
- **Prix de marché.** Le « tier Pro » coûte entre 59 et 79 € par magasin et par mois (Shopify POS Pro 59-79 €, Square Plus 69 €). Les spécialistes mode facturent environ 69 à 119 €, et Hiboutik reste low-cost (environ 27 € pour Premium + multi-boutiques).

### Gaps
- Pas de grille € officielle pour Lightspeed Retail en France : la page FR renvoie une 404.
- Pas de page Square FR lue directement (erreur 429), ni de liste officielle FR des fonctions du plan Plus.
- SumUp POS Pro : aucun prix ni détail des fonctions retail en France.
- Clover et Cashmag : rien trouvé. Prestashop POS : non recherché.
- Odoo : je n'ai pas lu la documentation Inventaire (valorisation FIFO ou PMP, réassort min/max, lots et séries, kits, unités de mesure) dans cette session. À vérifier sur odoo.com/documentation.

## 2. Couverture par domaine fonctionnel (inventaire, ventes, omnicanal, staff, reporting)

### Takeaway
Les domaines les mieux couverts par les leaders, et absents de FLŌW, sont :
- les achats fournisseurs (bons de commande, suggestions de réassort, réception) ;
- l'inventaire tournant au scanner ;
- la fidélité, les cartes cadeaux et le moteur de promotions automatiques ;
- les échanges et l'omnicanal (click & collect, ship-from-store, panier envoyé par e-mail) ;
- le reporting avancé (marges, prévisions, performance par vendeur).

### Cited Findings
- **Inventaire.**
  - Bons de commande avec suggestions automatiques : Square Plus — [Square PO](https://squareup.com/gb/en/point-of-sale/retail/features/purchase-orders)
  - Prévisions et recommandations de commande, landed costs, app scanner : Lightspeed, tous plans — [Lightspeed pricing](https://www.lightspeedhq.com/pos/retail/pricing/)
  - Comptages et transferts : Shopify POS Pro — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
  - Inventaire continu avec validation des écarts : Hiboutik — [independant.io](https://independant.io/avis/hiboutik/)
- **Ventes et CRM.**
  - Fidélité en magasin et en ligne : Lightspeed — [Lightspeed pricing](https://www.lightspeedhq.com/pos/retail/pricing/)
  - Fidélité gratuite : Hiboutik — [La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)
  - Fidélité, coupons et cartes cadeaux dans un moteur commun : Odoo — [Octura](https://octurasolutions.com/fr/resources/12-fonctionnalites-point-of-sale-odoo-pour-commerce-et-restauration)
  - Réductions automatiques et fiches clients avec valeur vie client (LTV) : Shopify POS Pro — [Shopify POS pricing](https://www.shopify.com/fr/pos/pricing)
- **Mise de côté, commandes spéciales, acomptes.**
  - Lightspeed (inclus) — [Lightspeed AU](https://www.lightspeedhq.com/au/pos/lightspeed-vs-square/) ⚠
  - Fastmag (acomptes et réservations) — [tool-advisor Fastmag](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/)
  - Hiboutik (avances sur compte client) — [La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)
  - ⚠ Square n'accepterait pas les cautions ni les paiements fractionnés (article de 2024) — [Mobile Transaction FR](https://fr.mobiletransaction.org/square-pour-detaillants-avis/)
- **Omnichannel.**
  - Retrait en magasin, expédition à domicile, livraison locale, panier par e-mail : Shopify POS Pro — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
  - E-commerce intégré : Lightspeed — [Lightspeed pricing](https://www.lightspeedhq.com/pos/retail/pricing/)
  - E-réservation, endless aisle, click & collect : Cegid — [Cegid](https://www.cegid.com/fr/?p=58301)
  - Web-to-store : Fastmag — [tool-advisor Fastmag](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/)
  - Synchronisation de stock bidirectionnelle : Zettle — [WiziShop](https://www.wizishop.fr/integrations/zettle-by-paypal)
- **Staff.**
  - Rôles et permissions illimités : Shopify POS Pro — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
  - Rôles personnalisés et SSO : Lightspeed — [Lightspeed pricing](https://www.lightspeedhq.com/pos/retail/pricing/)
  - Pointeuse : Lightspeed — [Retail Insider](https://retail-insider.com/bulletin/2023/08/lightspeed-commerce-inc-introduces-cutting-edge-features-to-empower-merchants/)
  - Gestion avancée des employés à 25 € HT de plus : Square ⚠ — [Mobile Transaction FR](https://fr.mobiletransaction.org/square-pour-detaillants-avis/)
  - Performance par vendeur : Fastmag — [tool-advisor Fastmag](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/)
- **Reporting.**
  - Rapports ventes, staff et stock, rapports personnalisés : Lightspeed — [Lightspeed Plus UK](https://product-info.lightspeedhq.com/lightspeed-retail-x-series-plus-plan-uk)
  - Marge, indice de vente, taux de transformation, top/flop : Fastmag — [tool-advisor Fastmag](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/)
  - Rapports de ventes quotidiens : Shopify POS Pro — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
- **Détaxe (tax-free).** Je l'ai trouvée explicitement chez Cegid seulement — [Cegid](https://www.cegid.com/fr/?p=58301)

### Inferences
- **Must-have pour FLŌW (manques), par ordre de fréquence chez les concurrents :**
  1. Fiche client, CRM et fidélité.
  2. Cartes cadeaux, si FLŌW n'a que des « vouchers ».
  3. Bons de commande fournisseurs avec suggestions de réassort.
  4. Inventaire et comptage au scanner.
  5. Transferts entre magasins, au-delà des commandes internes.
  6. Étiquettes et prix.
  7. Remises et promotions automatiques.
  8. Click & collect, ou au minimum la synchronisation avec un e-shop.
  9. Mises de côté et acomptes, commandes spéciales.
- **Différenciants à envisager pour la bijouterie, la mode et le luxe :** détaxe, clienteling, endless aisle, prévisions de commande, landed costs, pointeuse, commissions vendeurs.
- **Atouts de FLŌW vis-à-vis de ce panel.** Ce sont rarement des arguments de marketing chez les concurrents :
  - commandes internes vers un laboratoire central (production) ;
  - gestion des allergènes ;
  - mode hors ligne dans le navigateur (Hiboutik n'a pas de mode hors ligne) ;
  - webhooks et API sans surcoût (Hiboutik réserve l'API au Premium, Odoo à Custom).
  — [La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/) ; [Odoo pricing](https://www.odoo.com/fr_FR/pricing)

### Gaps
- Commissions vendeurs, objectifs de vente, analyse ABC, sell-through, rapports programmés : aucune source spécifique lue pour aucun éditeur.
- Tarifs par liste de prix, BOGO et happy hour : non documentés en détail, sauf la mention générique « réductions automatiques » chez Shopify et le moteur de règles d'Odoo.
- Valorisation des stocks (PMP ou FIFO), kits et produits composés, articles au poids : non vérifiés.
- Écran client : confirmé seulement sur le Shopify POS Terminal.

## 3. Plaintes fréquentes dans les avis

### Takeaway
Les plaintes portent surtout sur le support et sur le coût cumulé (abonnement par magasin et options). Viennent ensuite les problèmes de synchronisation de stock et d'e-commerce, l'absence de mode hors ligne chez les solutions web, et des fonctions clés réservées aux tiers supérieurs.

### Cited Findings
- **Lightspeed Retail.**
  - Capterra FR : 4,0/5 sur 975 avis (support 3,9, rapport qualité-prix 3,8, fonctionnalités 3,9) — [Capterra FR](https://www.capterra.fr/software/120491/lightspeed-retail)
  - Trustpilot UK : 3,8 sur 126 avis, dont des plaintes sur la fiabilité et la précision — [Trustpilot](https://fr-be.trustpilot.com/review/lightspeedhq.co.uk?page=4)
  - Un avis de décembre 2024 (2/5) dénonce un support insuffisant, un problème de stock et un fort turnover des account managers — [Capterra IN](https://www.capterra.in/software/120491/lightspeed-retail)
- **Hiboutik.**
  - Pas de mode hors ligne, interface datée, pas d'app iOS ;
  - statistiques et API payantes, support limité à l'e-mail en gratuit, coût cumulé en multi-boutiques ;
  - problèmes de synchronisation avec WooCommerce, pas de gestion avancée des commandes différées ni de la production.
  — [La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)
- **Shopify POS.**
  - POS Pro est « quasi indispensable » pour une boutique physique et se paie par emplacement ;
  - les taux carte en magasin ne sont pas publiés en France, Shopify Payments est obligatoire ;
  - le matériel disponible en France est limité, et il n'existe pas d'app pour ordinateur.
  — [Kanal](https://getkanal.com/fr/blog/shopify-pos)
- **Square** (article de 2024) : version gratuite trop limitée, pas de compatibilité Android, prix élevé, ni cautions ni paiement fractionné — [Mobile Transaction FR](https://fr.mobiletransaction.org/square-pour-detaillants-avis/)
- **Wino** : prix et matériel peu transparents — [tool-advisor cavistes](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-caviste/)

### Inferences
- Plusieurs points faibles des concurrents sont des angles de positionnement pour FLŌW :
  - tarif transparent et unique par magasin, avec les fonctions de stock incluses ;
  - mode hors ligne fiable ;
  - API incluse ;
  - support en français ;
  - gestion de la production et des commandes différées.

### Gaps
- Je n'ai pas lu d'avis App Store ni de G2 dans cette session.
- Je n'ai trouvé aucune plainte documentée pour SumUp POS, Zettle, Odoo, Cegid et Fastmag.
