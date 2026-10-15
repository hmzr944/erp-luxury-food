# Acteurs « payment-first » et internationaux de la caisse en France (état au 15 octobre 2026)

Périmètre : SumUp (dont l'ex-Tiller, devenu SumUp POS Pro), Square France, Zettle (devenu PayPal POS), Shopify POS, Lightspeed (Restaurant K-Series et Retail), Yavin.

Méthode et réserves (à lire avant tout usage) :
- Pages officielles consultées le 15/10/2026 : squareup.com/fr/fr/pricing, zettle.com/fr/tarifs, sumup.com/fr-fr/tarifs, squareup.com/help/fr/fr/article/7628, yavin.com/fr. Plusieurs pages officielles n'ont pas pu être lues (404 ou contenu US servi) : grille caisse SumUp, shopify.com/fr (tarifs en €), grille Lightspeed FR. Pour ces trois acteurs, les prix viennent de comparateurs tiers datés, signalés comme tels.
- Les comparateurs tiers (lacaisseideale.fr, quelle-caisse.fr, stellarprojects.fr, entrepreneurhero.fr, independant.io) se contredisent souvent ; les écarts sont notés.
- Contexte juridique déjà documenté dans le dépôt : l'attestation individuelle de l'éditeur est rétablie par l'art. 125 de la loi n° 2026-103 du 19/02/2026 (en vigueur au 21/02/2026), modèle BOI-LETTRE-000242 du 25/03/2026 (voir `docs/legal/BOI-LETTRE-000242-20260325.md` et `research_notes/Benchmark caisses et manques FLŌW/conformite_france.md`). Un éditeur « sous attestation » n'est donc pas en infraction de ce seul fait en octobre 2026. À faire valider par un juriste.

## 1. Couverture fonctionnelle (catalogue, stock, hors-ligne, tickets, B2B, titres-restaurant, KDS, click & collect, e-commerce, fidélité, reporting, API, exports comptables, matériel)

### Takeaway
Les acteurs se séparent en deux familles : les « paiement d'abord » à caisse légère (Zettle/PayPal POS, SumUp Lite, Square gratuit, Yavin) qui monétisent la commission, et les caisses métier abonnées (SumUp POS Pro ex-Tiller, Lightspeed K-Series, Shopify POS Pro) qui facturent chaque module. Point faible commun et marqué : le hors-ligne (désactivé en France chez Shopify, boîtier payant chez Lightspeed, non documenté chez SumUp POS Pro).

### Cited Findings

**SumUp POS Pro (ex-Tiller, restauration)**
- Fonctions listées : écran cuisine (KDS), plan de salle interactif, bornes de commande et menus QR code, programme de fidélité et CRM, fiches recettes et stock, rapports par produit/service/employé, planning et pointage du personnel, division d'addition, paiement multi-modes, intégrations Deliveroo / Uber Eats / Just Eat avec menus synchronisés, comptabilité par exports ou API. [Quelle Caisse, fiche SumUp POS Pro (2026)](https://quelle-caisse.fr/solution/sumup-pos-pro)
- Hors-ligne, titres-restaurant et click & collect ne sont pas mentionnés sur cette fiche. [Quelle Caisse](https://quelle-caisse.fr/solution/sumup-pos-pro)
- Exige un iPad et un TPE SumUp séparé ; peu adapté au commerce de détail et aux activités saisonnières. [Quelle Caisse](https://quelle-caisse.fr/solution/sumup-pos-pro)
- SumUp présente en restauration : gestion des tables, envoi en cuisine, intégrations livraison, reporting. [SumUp UK, POS Pro](https://www.sumup.com/en-gb/point-of-sale-overview/pos-pro/)
- L'interface SumUp POS reprend largement celle de Tiller et ses intégrations. [Tool-Advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/tiller/code-promo)

**SumUp (offre caisse sans abonnement / Caisse Plus)**
- L'application inclut des « fonctions de caisse conformes » sans frais ; Caisse Plus à 49 € HT/mois (plans de salle, multi-établissements, intégrations comptables selon un relevé tiers de juin 2026). [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/) ; [detective-banque.fr](https://www.detective-banque.fr/terminal-de-paiement/sumup-caisse-enregistreuse-prix/)
- Offres connexes : Factures Plus 10 € HT/mois, Compte pro Plus 25 € TTC/mois (banque intégrée, cartes SumUp encaissées à 0 %). [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)

**Square France**
- Briques : Square pour restaurants (KDS inclus dans les forfaits payants restaurant, sinon 15 € HT/mois), Vente en ligne Square (site e-commerce), Factures Square (Factures Plus 20 € HT/mois), paiements à distance (saisie manuelle, carte enregistrée, terminal virtuel). [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- Matériel propriétaire : Square Register, Square Terminal, Square Handheld, Square Reader. [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- Tap to Pay sur Android en France depuis avril 2023, sur iPhone depuis juillet 2024. [Moneyvox](https://www.moneyvox.fr/epargne/square)

**Zettle / PayPal POS**
- Application caisse gratuite, lecteur PayPal Reader, PayPal Terminal tout-en-un (Android, avec ou sans lecteur code-barres), kit caisse ; liens de paiement. [Zettle tarifs FR](https://www.zettle.com/fr/tarifs) ; [Boutique Zettle, PayPal Terminal](https://shop.zettle.com/fr/paypal-terminal)
- Le PayPal Terminal ne fonctionne qu'avec l'application PayPal POS (ex-Zettle), pas avec une caisse tierce. [Boutique Zettle](https://shop.zettle.com/fr/paypal-terminal)

**Shopify POS**
- POS Lite inclus dans tout forfait Shopify ; POS Pro payant par emplacement (stock multi-boutiques, rôles, etc.). Force principale : stock et clients unifiés avec la boutique en ligne Shopify. [Stellar Projects, guide Shopify POS 2026 (25/06/2026, prix relevés août 2026)](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)
- En France, fonctions désactivées pour la conformité : **mode hors-ligne**, éditeur de ticket (structure figée), modification manuelle de TVA en caisse, transactions partiellement payées, vente de lots (bundles). [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)
- Imprimante ticket physique obligatoire en France. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)
- Matériel : WisePad 3, POS Terminal, POS Hub, Verifone Victa Mobile, imprimantes Star/OmniLink, tiroir Star, douchettes Zebra DS2278 et Socket S720 ; iPad non fourni. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)

**Lightspeed Restaurant (K-Series)**
- Inclus selon plans : plan de salle, menus, rapports, Lightspeed Pulse (Basic) ; caisse mobile ou KDS, commande QR, inventaires, fidélité, Advanced Insights (Core) ; multi-sites, click & collect avec créneaux, commandes en ligne tierces (Pro). [La Caisse Idéale, avis Lightspeed (maj 16/09/2026)](https://www.lacaisseideale.fr/articles/lightspeed-avis/)
- Hors forfait sur tous les plans : réservations, borne de commande, intégrations comptables et paie, API, PMS. [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/)
- Envoi par vague et par siège, environ 60 niveaux de permissions, ardoises, happy hours, paiement à table par QR, plus de 100 intégrations. [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/)
- Hors-ligne uniquement avec le « Lite Server », boîtier vendu séparément ; iOS uniquement (iPad/iPhone), pas d'Android. [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/)
- Matériel : Smart Terminal, Mobile Tap (liés à Lightspeed Payments), écrans cuisine ELO, imprimantes LAN, boîtiers de commande à table ; support limité à la gamme Lightspeed. [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/)
- Un TPE bancaire tiers impose une double saisie (Lightspeed Payments est le TPE natif). [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/)

**Yavin**
- Positionnement « paiement » plus que caisse : terminaux, Tap to Pay sur iPhone, back-office centralisé, bornes de commande, click & collect, foodcourt, multi-établissements. [Yavin](https://yavin.com/fr)
- Accepte tous les titres-restaurant, AMEX et ANCV ; fidélité automatique basée sur la carte bancaire du client ; pourboires séparés et redistribués ; paiement à table et partage d'addition ; plus de 60 intégrations (caisses, livraison, fidélité, comptabilité) ; synchronisation temps réel avec des logiciels de caisse partenaires. [Yavin](https://yavin.com/fr)
- Gamme citée par des tiers : Yavin X, Mini X, PinPad Pro, Yavin Borne, SoftPOS ; fonction de clôture intégrée remplaçant le ticket de télécollecte. [Entrepreneur Hero, comparatif TPE 2026](https://www.entrepreneurhero.fr/terminal-de-paiement/comparatif-meilleure-offre-de-terminal-de-paiement/) ; [independant.io](https://independant.io/avis/yavin/)

### Inferences
- Aucun de ces acteurs ne met en avant un mode hors-ligne complet et natif en France avec signature fiscale locale : c'est un axe de différenciation fort pour une caisse qui signe hors-ligne (cas FLŌW).
- Le titre-restaurant (papier et carte) n'est revendiqué explicitement que par Yavin ; chez les autres, il n'est pas documenté dans les sources lues (ne pas conclure à l'absence).
- Facture B2B : seuls Square (Factures) et SumUp (Factures Plus) ont un produit facture, vendu séparément de la caisse. La facture SIRET en un geste depuis le ticket n'apparaît chez aucun.
- Lightspeed et SumUp POS Pro facturent à part ce que les restaurateurs considèrent comme du socle (KDS, fidélité, API, compta) ; le prix réel est sensiblement plus élevé que le prix d'appel.

### Gaps
- Pas de liste officielle des fonctions de la caisse gratuite SumUp (Lite) ni de Caisse Plus : page caisse SumUp en 404 lors de la consultation.
- Fonctions détaillées de Square Point of Sale en France (stock multi-sites, fidélité, Square Kiosk disponible en France ou non) : non vérifiées.
- Mode hors-ligne de Square, Zettle et SumUp en France : non documenté dans les sources lues.
- Facture électronique (réforme 2026-2027) : aucune annonce trouvée pour ces six acteurs.
- Lightspeed Retail (X-Series) : aucune fiche française exploitable trouvée.

## 2. Tarifs France (abonnements € HT/mois, commissions, matériel, engagement)

### Takeaway
Payment-first : 0 € d'abonnement et 1,65 % à 1,75 % par transaction (Square, Zettle, SumUp), ou forfait paiement (SumUp 19 €/mois pour 0,89 %). Caisses métier : 49 à 79 € HT/mois en entrée (SumUp Caisse Plus 49 €, SumUp POS Pro 79 €, Shopify POS Pro 79 €/emplacement en plus du forfait Shopify, Lightspeed 79 à 89 €), avec engagement de 12 mois chez SumUp POS Pro et Lightspeed.

### Cited Findings

**SumUp** (page officielle consultée le 15/10/2026)
- Paiement à l'utilisation : 1,75 %/transaction, 0 €/mois ; cartes SumUp encaissées à 0 %. [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)
- Paiements Plus : 0,89 %, 19 €/mois ou 189 €/an, sans engagement, 7 jours offerts, remplacement du TPE gratuit. [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)
- Personnalisé : sur devis au-delà de 10 000 €/mois d'encaissement. [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)
- Caisse Plus : 49 € HT/mois (engagement non précisé sur la page). [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)
- SumUp POS Pro (ex-Tiller) : à partir de 79 €/mois, engagement 12 mois minimum, TPE SumUp dès 25 € HT en promotion, iPad non inclus. [Quelle Caisse (FAQ datée du 27/07/2026)](https://quelle-caisse.fr/solution/sumup-pos-pro)
- Matériel caisse : caisse double écran 399 € HT selon un site, coût total « tablette + TPE » 349 € selon un autre (non confirmé par SumUp). [detective-banque.fr](https://www.detective-banque.fr/terminal-de-paiement/sumup-caisse-enregistreuse-prix/) ; [independant.io](https://independant.io/avis/sumup-caisse/)
- Taux FAQ par type de carte et taux en ligne : vides sur la page officielle au moment de la lecture. [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)

**Square France** (page officielle consultée le 15/10/2026)
- Paiement en personne : dès 1,65 % (cartes UE/EEE) ; +1,5 % pour cartes UK/hors EEE. [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- En ligne : dès 1,4 % + 0,25 € (UE/EEE), 2,9 % + 0,25 € (hors EEE). [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- À distance : 2 % saisie manuelle ; 2,5 % carte enregistrée, terminal virtuel et Factures ; +1,5 % hors UE/EEE. [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- Square pour restaurants : gratuit ou 59 € HT/mois par point de vente (appareils illimités) ; KDS 15 € HT/mois ou inclus ; Vente en ligne dès 10 €/mois ; Factures Plus 20 € HT/mois. [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- Matériel HT : Register 699 € (ou 12 x 59 €), Terminal 165 € (ou 6 x 28 €), Handheld 199 €, Reader 19 €. [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- Sans engagement, « Annulez à tout moment ». [Square tarifs FR](https://squareup.com/fr/fr/pricing)

**Zettle / PayPal POS** (page officielle consultée le 15/10/2026)
- 1,75 % par transaction, taux unique y compris American Express ; application caisse gratuite ; « Aucun contrat ni aucuns frais récurrents ». [Zettle tarifs FR](https://www.zettle.com/fr/tarifs)
- Liens de paiement 2,5 %, réservés aux comptes ouverts avant le 18/02/2025. [Zettle tarifs FR](https://www.zettle.com/fr/tarifs)
- Matériel HT : PayPal Reader dès 29 € (nouveaux clients, puis 79 € le lecteur supplémentaire), PayPal Terminal dès 199 € (sans douchette), kit caisse dès 229 € ; frais de livraison en sus. [Zettle tarifs FR](https://www.zettle.com/fr/tarifs)
- PayPal Terminal avec douchette : 249 € HT selon une source, 229 € HT selon une autre. [Tool-Advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/zettle/) ; [meilleur-tpe.fr](https://www.meilleur-tpe.fr/avis-marque/zettle-terminal)

**Shopify POS** (prix en € : source tierce, page officielle FR non lisible)
- POS Lite inclus ; POS Pro 79 €/mois/emplacement en mensuel, 59 € en annuel (relevé août 2026). [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide) ; contredit par [Shopify blog FR 2025](https://www.shopify.com/fr/blog/cout-d-un-systeme-pos) (89 €/mois, 79 € en annuel, ancienne grille) et par une autre source à 69 € en annuel. [lacaisseideale.fr](https://www.lacaisseideale.fr/articles/shopify-pos-avis/)
- Le prix POS Pro s'ajoute au forfait Shopify (Basic, Grow, Advanced) et aux commissions. Montants € des forfaits et taux en personne Shopify Payments France non trouvés. Pour référence US : POS Pro 89 $/mois/emplacement, Basic 39 $/mois, taux en personne 2,6 % + 0,10 $ (Basic) à 2,4 % (Advanced). [Shopify pricing (US)](https://www.shopify.com/pricing)
- Matériel € (août 2026) : WisePad 3 59 €, POS Hub 59 €, POS Terminal 229 €, dock 79 €, Victa Mobile 344,95 €, support Eddy 119 €, imprimante 299 à 319 €, tiroir 99 €, douchette 189 à 339 € ; configuration minimale conforme (WisePad 3 + imprimante) 358 €, comptoir complet 954 €, iPad en sus. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)
- Application Comply (Storelink) gratuite mais obligatoire. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)

**Lightspeed Restaurant** (sources tierces, contradictoires)
- Basic 89 €/mois (1 licence), Core 159 € (2 licences), Pro 249 € (3 licences), caisse supplémentaire 49 €/mois ; engagement annuel « difficile à quitter sans pénalité » ; matériel sur devis. [La Caisse Idéale (tarifs relevés 16/09/2026)](https://www.lacaisseideale.fr/articles/lightspeed-avis/) ; même grille Basic/Core chez [Entrepreneur Hero](https://www.entrepreneurhero.fr/logiciels-de-caisse/avis-sur-lightspeed-restaurant/)
- Grille divergente : Essentiel 79 €, Plus 119 €, Pro 349 € (annuel) ; Basic 79 € HT ; fourchette 89 à 249 € (revue 27/07/2026). [lacaisseideale.fr (autre version)](https://www.lacaisseideale.fr/articles/lightspeed-avis/) ; [Outilios](https://outilios.fr/lightspeed-avis/) ; [Quelle Caisse](https://quelle-caisse.fr/solution/lightspeed)
- Taux Lightspeed Payments non publiés en 2026, sur devis selon volume. [Entrepreneur Hero](https://www.entrepreneurhero.fr/logiciels-de-caisse/avis-sur-lightspeed-restaurant/)
- Lightspeed Retail : prix FR introuvables ; repère allemand 69 / 119 / 349 €/mois (Essentials, Plus, Pro). [trusted.de](https://trusted.de/lightspeed-pos-kosten)

**Yavin** (pas de grille publique, sources tierces divergentes)
- Location 29 €/mois (1 mois offert), commissions cartes européennes 0,4 % à 0,9 %. [Entrepreneur Hero](https://www.entrepreneurhero.fr/terminal-de-paiement/comparatif-meilleure-offre-de-terminal-de-paiement/)
- Formules Starter 9 €, Pro 29 €, Premium 75 € HT/mois avec 0,6 %, 0,5 %, 0,4 % + 0,05 € de passerelle par transaction ; achat terminal 279 à 499 € HT. [independant.io](https://independant.io/avis/yavin/)
- Prix d'achat : Yavin X 379 €, Mini X 279 €, X fixe PinPad 499 €, PinPad Pro 299 €. [guide-terminal-paiement.be](https://www.guide-terminal-paiement.be/type-terminal-de-paiement/yavin/)
- Yavin affiche sa marge au-dessus des frais réseau réels (modèle « interchange + ») et permet de brancher son propre contrat bancaire. [Yavin](https://yavin.com/fr)

### Inferences
- Pour un commerce à 15 000 €/mois de CB : 1,75 % (Zettle/SumUp sans abonnement) = 262,50 €/mois ; Square 1,65 % = 247,50 € ; SumUp Paiements Plus = 19 + 133,50 = 152,50 €. Calcul indicatif, hors cartes premium/hors UE.
- Le modèle « interchange + » de Yavin (0,4 à 0,9 %) est l'étalon de prix bas pour les commerçants à fort volume ; les acteurs à taux fixe y sont moins compétitifs.
- Shopify POS Pro coûte en France au minimum forfait Shopify + 59 à 79 €/emplacement + matériel ~358 € + iPad : produit pertinent surtout pour les marques déjà en e-commerce Shopify.

### Gaps
- Grilles € officielles de Shopify France, Lightspeed France et SumUp POS Pro non lues directement (pages inaccessibles) : à revérifier avant publication.
- Taux SumUp en ligne et par type de carte : champs vides sur la page officielle.
- Prix officiels du matériel SumUp (Solo, Air, Terminal, caisse) non affichés sur la page tarifs.

## 3. Onboarding (self-serve ou commercial, délai de première vente, matériel requis)

### Takeaway
Zettle, Square et SumUp (offres de base) sont en libre-service : compte en ligne, lecteur à 19-29 € ou Tap to Pay, première vente possible le jour même. Lightspeed et SumUp POS Pro passent par démo, devis matériel et engagement annuel ; Shopify impose en France l'installation d'une app tierce (Comply) et une imprimante.

### Cited Findings
- Zettle : lecteur dès 29 € HT, application gratuite, pas de contrat. [Zettle tarifs FR](https://www.zettle.com/fr/tarifs)
- Square : sans engagement, lecteur 19 € HT, Tap to Pay Android (avril 2023) et iPhone (juillet 2024) permettant d'encaisser sans matériel. [Square tarifs FR](https://squareup.com/fr/fr/pricing) ; [Moneyvox](https://www.moneyvox.fr/epargne/square)
- SumUp : Paiements Plus avec 7 jours offerts et sans engagement ; SumUp POS Pro recommande une démo, engagement 12 mois, support saturé aux heures de pointe (plus de 15 min d'attente rapportées). [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/) ; [Quelle Caisse](https://quelle-caisse.fr/solution/sumup-pos-pro)
- SumUp propose un service d'aide à la migration depuis un autre fournisseur. [SumUp switch](https://sumup.com/fr-fr/switch-to-sumup)
- Shopify : à partir de POS 11.3, les ventes en magasin sont bloquées tant que Comply n'est pas activé (SIREN, SIRET par site, NAF, TVA requis) ; Shopify Payments obligatoire ; imprimante obligatoire. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide)
- Lightspeed : matériel sur devis, courbe d'apprentissage élevée, déconseillé aux débutants, avis très dépendants de la qualité de l'accompagnement. [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/)
- Yavin : tarifs non publics (contact commercial), support 7j/7 annoncé, note 4,7/5 revendiquée sur plus de 10 000 commerces. [Yavin](https://yavin.com/fr) ; [independant.io](https://independant.io/avis/yavin/)

### Inferences
- Le « temps jusqu'à la première vente conforme » est plus long que le temps jusqu'au premier paiement : les payment-first encaissent vite, mais la conformité repose sur une attestation que le commerçant doit télécharger, compléter et conserver lui-même (cas Square).

### Gaps
- Aucun délai chiffré de mise en service (heures/jours) publié par ces acteurs.

## 4. Conformité française (NF525 / attestation art. 286 CGI, archives fiscales)

### Takeaway
Certifiés selon leurs pages ou des sources concordantes : Lightspeed K-Series (NF525 via INFOCERT/AFNOR), SumUp POS Pro (listé certifié), Shopify POS (certification Infocert annoncée en mars 2026, sous conditions). Square revendique une auto-certification avec attestation à compléter ; Zettle/PayPal POS ne mentionne pas NF525 sur ses tarifs. Depuis le 21/02/2026, l'attestation individuelle de l'éditeur est de nouveau un moyen de preuve légal (LF 2026), à condition de suivre le modèle BOI-LETTRE-000242.

### Cited Findings
- Lightspeed : « La caisse Lightspeed Restaurant K-Series est certifiée NF525 par AFNOR Certification, via INFOCERT » (page éditeur). [Lightspeed FR, blog certification](https://www.lightspeedhq.fr/blog/certification-caisse-enregistreuse/)
- SumUp POS Pro : listé certifié NF525 ; la fiche rappelle que l'éditeur doit documenter la conformité de chaque version. [Quelle Caisse](https://quelle-caisse.fr/solution/sumup-pos-pro)
- SumUp caisse gratuite : la page tarifs parle de « fonctions de caisse conformes » sans citer NF525 ; un tiers affirme la conformité NF525 incluse. Non confirmé par l'éditeur dans les sources lues. [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/) ; [lacaisseideale.fr, avis SumUp](https://www.lacaisseideale.fr/articles/sumup-avis/)
- Shopify POS : certifié NF525 depuis mars 2026 via Infocert, sous trois conditions : version POS 11.3+, Shopify Payments activé, app Comply (Storelink) activée. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide) ; date du 26/03/2026 citée par d'autres guides, contredits par un guide plus ancien indiquant une simple attestation sur demande. [Huggii](https://www.huggii.com/blogs/huggii-blog/shopify-pos-le-guide-complet-pour-comprendre-comparer-et-choisir-le-bon-systeme-de-point-de-vente-en) ; [Getkanal](https://getkanal.com/fr/blog/shopify-pos)
- Square : a adopté l'auto-certification (« certification individuelle ») ; fournit l'attestation « Square & Loi Anti-Fraude TVA » avec addendum, que le titulaire du compte doit télécharger, compléter et conserver ; en contrôle, citer la « version de conformité en matière de sécurité » (v1.0). La page cite l'art. 88 de la loi de finances 2016, pas l'art. 286 CGI ni NF525, et ne porte pas de date de mise à jour. [Aide Square FR, article 7628](https://squareup.com/help/fr/fr/article/7628-article-88)
- Square : un résumé de recherche de la même aide mentionnait une pré-audit réussie auprès d'un organisme accrédité et une période de transition du 01/09/2025 au 31/08/2026 ; la version lue le 15/10/2026 ne contient plus ces éléments. Un ancien fil communautaire indiquait que Square ne comptait pas renouveler sa certification en France (date non claire). [Aide Square FR](https://squareup.com/help/fr/fr/article/7628-article-88) ; [Square Seller Community](https://www.sellercommunity.com/t5/General-Discussion/Is-NF525-certification-going-to-be-renewed/m-p/108733)
- Square et Zettle délivrent une attestation individuelle plutôt qu'une certification NF525 selon un éditeur concurrent. [Fooderise](https://www.fooderise.com/en/blog/certification-nf525-caisse-enregistreuse-loi)
- Zettle : la page tarifs ne mentionne pas NF525. [Zettle tarifs FR](https://www.zettle.com/fr/tarifs)
- Yavin : aucune mention NF525 sur la page d'accueil ; la conformité fiscale relève du logiciel de caisse partenaire. [Yavin](https://yavin.com/fr)
- Cadre : attestation individuelle rétablie par l'art. 125 de la loi n° 2026-103 du 19/02/2026, en vigueur au 21/02/2026 ; modèle BOI-LETTRE-000242 du 25/03/2026 (fichiers internes `docs/legal/BOI-LETTRE-000242-20260325.md`, `research_notes/Benchmark caisses et manques FLŌW/conformite_france.md`). Amende de 7 500 € par logiciel non conforme. [Fooderise](https://www.fooderise.com/en/blog/certification-nf525-caisse-enregistreuse-loi) ; [Flatpay](https://www.flatpay.com/fr/blog/certification-nf525-ce-qui-change-en-2026-et-comment-verifier-la-conformite-de-votre-caisse)

### Inferences
- L'attestation Square cite un texte de 2016 et un modèle propre (« addendum ») : il faudrait vérifier qu'elle respecte le modèle BOI-LETTRE-000242 de mars 2026. Si ce n'est pas le cas, c'est un argument de vente pour un concurrent conforme au modèle officiel (à faire valider juridiquement).
- La conformité Shopify passe par un tiers (Storelink) et supprime le hors-ligne : la certification a un coût fonctionnel visible.
- Les archives fiscales (JET, clôtures, export) ne sont décrites dans aucune source lue pour ces acteurs.

### Gaps
- Numéros de certificats NF525 / Infocert de Lightspeed, SumUp POS Pro et Shopify non trouvés ; à vérifier sur les listes officielles Infocert et AFNOR.
- Statut Zettle/PayPal POS (attestation ou certificat) : aucune page officielle trouvée.
- Statut de la caisse gratuite SumUp (hors POS Pro) : non confirmé.
- Incidents de contrôle fiscal publiés concernant ces acteurs : aucun trouvé.

## 5. Changements 2025-2026 (rachats, renommages, prix, lancements)

### Takeaway
Le fait marquant est le renommage de Zettle en PayPal POS (août 2025) et la certification Shopify POS en France (mars 2026) assortie de l'app Comply obligatoire. SumUp consolide l'ex-Tiller sous SumUp POS Pro et pousse Caisse Plus à 49 €. Peu d'annonces datées trouvées pour Lightspeed, Square et Yavin.

### Cited Findings
- Zettle by PayPal devient « PayPal POS » / « Point de vente PayPal » en août 2025 ; le logo Zettle disparaît au profit d'un logo PayPal noir et blanc ; les comptes existants restent accessibles. [Newpubmarketing (20/08/2025)](https://newpubmarketing.over-blog.fr/2025/08/branding-zettle-by-paypal-devient-paypal-pos-2025.html) ; [Tool-Advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/zettle/) ; [PayPal FR](https://www.paypal.com/fr/zettle)
- Zettle : liens de paiement réservés aux comptes ouverts avant le 18/02/2025 (fonction retirée pour les nouveaux comptes). [Zettle tarifs FR](https://www.zettle.com/fr/tarifs)
- Shopify POS : certification NF525 annoncée en mars 2026 et blocage des ventes sans Comply à partir de POS 11.3 ; POS Pro passé de 89 € (79 € annuel, grille 2025) à 79 € (59 € annuel) selon les relevés 2026. [Stellar Projects](https://stellarprojects.fr/en/blogs/all-about-shopify/shopify-pos-2026-guide) ; [Shopify blog FR](https://www.shopify.com/fr/blog/cout-d-un-systeme-pos)
- SumUp : rachat de Tiller (Paris) ; produit restauration désormais vendu comme SumUp POS Pro. Date de clôture non indiquée sur la page de l'opération. [Cambon Partners](https://www.cambonpartners.com/en/transactions/tiller-sold-to-sumup) ; [Quelle Caisse](https://quelle-caisse.fr/solution/sumup-pos-pro)
- SumUp : offre Caisse Plus à 49 € HT/mois relevée sur la boutique FR en juin 2026 et présente sur la page tarifs en octobre 2026. [detective-banque.fr](https://www.detective-banque.fr/terminal-de-paiement/sumup-caisse-enregistreuse-prix/) ; [SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/)
- Lightspeed : grille tarifaire FR mise à jour (relevé du 16/09/2026), taux de paiement retirés de la publication en 2026. [La Caisse Idéale](https://www.lacaisseideale.fr/articles/lightspeed-avis/) ; [Entrepreneur Hero](https://www.entrepreneurhero.fr/logiciels-de-caisse/avis-sur-lightspeed-restaurant/)
- Square : nouveaux matériels au catalogue FR (Square Handheld 199 € HT) ; aucune annonce française datée trouvée pour 2025-2026. [Square tarifs FR](https://squareup.com/fr/fr/pricing)
- Yavin : seule levée trouvée 1,2 M€ (Seedcamp), ancienne ; aucune annonce 2025-2026 trouvée. [Infonet](https://infonet.fr/actualite/levees-de-fonds/yavin-leve-12-million-deuros-pour-son-terminal-de-paiement/)

### Inferences
- La tendance 2025-2026 est à l'unification paiement + caisse sous la marque du PSP (PayPal POS, SumUp POS Pro) : le logiciel de caisse devient un produit d'appel pour capter la commission, ce qui limite le choix du TPE (PayPal Terminal réservé à PayPal POS, Lightspeed Payments natif, Shopify Payments obligatoire).
- Selon mes connaissances antérieures (non revérifiées ici), le rachat de Tiller par SumUp date de 2021 ; à confirmer avant citation.

### Gaps
- Pas de source primaire (communiqué) trouvée sur la fin de la marque Tiller ni sur la migration des clients Tiller.
- Fonctions IA, kiosques, écran client, e-invoicing annoncés en 2025-2026 en France par ces acteurs : aucune source française datée trouvée dans le budget de recherche.
- Pas de couverture presse (JDN, LSA, Les Echos, Maddyness) exploitée : à compléter si nécessaire.
