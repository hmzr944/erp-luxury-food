# FLŌW doit verrouiller conformité, matériel et métiers

FLŌW a déjà une architecture plus moderne que la plupart des caisses françaises : PWA multi-appareils, signature ECDSA par terminal, ventes hors ligne incluses, laboratoire central avec écran de production, API et webhooks sans surcoût, prix publics sans engagement. Pour être utilisable par tout commerce français qui encaisse, il lui manque pourtant trois couches que les concurrents traitent comme acquises. **La première est légale.** Depuis l'article 125 de la loi de finances 2026, un commerçant prouve la conformité anti-fraude TVA de sa caisse par un certificat (NF525/LNE ou Infocert) **ou** par une attestation individuelle de l'éditeur. FLŌW peut donc être commercialisé sans certification, mais seulement s'il implémente réellement les clôtures mensuelles et annuelles, le total perpétuel, l'archivage en format ouvert et le mode formation, et s'il délivre à chaque client une attestation conforme au modèle BOI-LETTRE-000242. **La deuxième est matérielle.** Il faut une impression réelle des tickets avec ouverture du tiroir, le dialogue avec les TPE bancaires via le protocole Caisse-AP, les codes-barres à prix ou poids intégré et des moyens de paiement français comme le titre-restaurant et le chèque. Une PWA seule ne couvre pas tout : un agent local ou une enveloppe native devient nécessaire. **La troisième est métier.** Fidélité et cartes cadeaux, achats fournisseurs, inventaire au scanner, étiquettes et promotions automatiques sont le socle retail. TVA sur place/à emporter, formules, plan de salle, KDS par poste, recettes avec coût matière, lots/DLC et vente au poids sont le socle alimentaire et restauration. Le positionnement prix (29 € et 59 € HT par boutique) est bas sur le marché et constitue un vrai atout. Il ne compensera pas l'absence de ces fonctions, que Lightspeed, Shopify POS Pro et Square Plus incluent dans des formules à 59-80 € par magasin.

## La conformité fiscale a changé deux fois en dix-huit mois

Beaucoup de pages d'éditeurs et de cabinets affirment encore que la certification serait obligatoire au 1er septembre 2026. **Elles sont périmées.** La loi de finances 2025 avait supprimé l'auto-attestation, avec une échéance pour les éditeurs reportée du 1er mars au 31 août 2026 ([BOFiP ACTU-2026-00073](https://bofip.impots.gouv.fr/bofip/15035-PGP.html/ACTU-2026-00073) ; [LNE](https://www.lne.fr/fr/actualites/2025/logiciels-caisses-suppression-auto-attestation-conformite-fiscale)). Puis **l'article 125 de la loi n° 2026-103 du 19 février 2026 a rétabli l'attestation individuelle de l'éditeur à compter du 21 février 2026**. La preuve se fait par « soit le certificat délivré par un organisme accrédité, soit l'attestation individuelle établie par l'éditeur », selon le modèle BOI-LETTRE-000242 ([BOFiP ACTU-2026-00073](https://bofip.impots.gouv.fr/bofip/15035-PGP.html/ACTU-2026-00073) ; [LégiFiscal](https://www.legifiscal.fr/actualites-fiscales/4460-loi-finances-2026-retablissement-auto-certification-logiciels-caisse.html)). Parmi les pages encore fausses figurent [Wavesoft](https://www.wavesoft.fr/Certification-obligatoire-des-logiciels-de-caisse-janvier-2026), [BDO](https://www.bdo.fr/fr-fr/blog/l-entreprise-a-360/certification-des-logiciels-et-systemes-de-caisse-nouvelles-obligations) et [Companeo](https://www.companeo.com/logiciels-de-comptabilite/guide/facturation-electronique-commerces). Le régime a déjà basculé une fois. Une nouvelle suppression de l'auto-attestation reste donc un risque politique réel.

L'attestation n'est pas une formalité. Elle engage la **responsabilité pénale de l'éditeur** : faux et usage de faux, 3 ans d'emprisonnement et 45 000 € d'amende. Le commerçant sans justificatif encourt **7 500 € par système** (art. 1770 duodecies CGI) ([BOFiP BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704) ; [AN QE 8260](https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE8260.pdf)). La doctrine fiscale exige quatre conditions, et FLŌW n'en couvre qu'une partie. Le chaînage et la signature par terminal répondent à l'inaltérabilité et à la sécurisation, puisque le BOFiP accepte le chaînage ou la signature électronique. Il manque en revanche plusieurs briques :

- des **clôtures journalières, mensuelles et annuelles cumulatives**, chacune avec le grand total de la période et un **total perpétuel jamais remis à zéro**, même lors d'une mise à jour logicielle ;
- un **mode école** dont les tickets sont marqués comme fictifs et l'opérateur identifié ;
- une **conservation ligne à ligne pendant 6 ans** ;
- une **archive au moins annuelle**, figée, datée de façon fiable, dans un **format ouvert** lisible après un changement de logiciel ([BOFiP §140-260](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)).

Le référentiel NF525 ajoute un journal des événements techniques et le marquage des duplicatas. Ces exigences ne sont pas vérifiées sur le référentiel lui-même, qui est payant. Le mode hors ligne n'est pas un obstacle : le BOFiP admet la centralisation des données si le transfert est traçable. L'écran actuellement nommé « NF525 » pose un problème distinct. NF est une marque collective de l'AFNOR et du LNE, et l'afficher sans certificat est trompeur. Il faut le renommer, par exemple « Conformité anti-fraude TVA (art. 286 CGI) ».

La certification reste un argument commercial. Les parlementaires l'ont chiffrée à **environ 20 000 € au départ, puis 3 800 à 7 000 € par an** d'audit de suivi ([Amendement CF602](https://www.assemblee-nationale.fr/dyn/17/amendements/1906A/CION_FIN/CF602.pdf) ; [QE 6772](https://questions.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE6772.pdf)). Ce sont des ordres de grandeur, pas des tarifs LNE ou Infocert. Les concurrents s'en servent : Shopify POS affiche par exemple un certificat Infocert valable jusqu'au 26/03/2027 ([Kanal](https://getkanal.com/fr/blog/shopify-pos)).

La facturation électronique forme le second front. **Depuis le 1er septembre 2026, toutes les entreprises doivent pouvoir recevoir des e-factures. Les PME et TPE devront en émettre, et transmettre leur e-reporting B2C, au 1er septembre 2027** ([Entreprendre.service-public F39785](https://entreprendre.service-public.gouv.fr/vosdroits/F39785)). Les ventes au comptoir à des particuliers ne deviennent pas des factures. Elles alimentent l'e-reporting : des agrégats HT et TVA par taux et par période, transmis via une plateforme agréée (le terme a remplacé « PDP »). Les sources divergent sur la périodicité pour le régime réel normal mensuel : **par décade** selon [LégiFiscal](https://www.legifiscal.fr/creation-entreprise/e-reporting-periodicite.html), **mensuelle** selon [Certyneo](https://certyneo.com/en/blog/e-reporting-b2c-commercants). FLŌW doit donc rendre la périodicité paramétrable. Les factures B2B doivent porter quatre nouvelles mentions : le SIREN du client, l'adresse de livraison si elle diffère, la nature des opérations et l'option pour les débits ([F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808)). Selon des sources secondaires de 2026, les amendes passeraient à 50 € par facture et 500 € par transmission manquante, plafonnées à 15 000 € par an ([Dougs](https://www.dougs.fr/blog/sanction-facturation-electronique/)). Ces montants sont à confirmer sur Légifrance. Le « stub PDP » de FLŌW doit devenir un vrai raccordement API à une ou plusieurs plateformes agréées. FLŌW n'a pas besoin d'être lui-même plateforme.

Plusieurs règles de consommation se traduisent directement en fonctions de caisse :

- **Ticket sur demande.** Depuis le 1er août 2023, le ticket papier n'est plus imprimé par défaut mais sur demande. Restent remis d'office les produits sous garantie légale de conformité, les produits pesés et les opérations de carte bancaire annulées. Le ticket dématérialisé ne peut jamais être imposé ([DGCCRF](https://www.economie.gouv.fr/dgccrf/tickets-de-caisse-et-de-carte-bancaire-le-1er-aout-remise-la-demande-du-client-0)).
- **Note de service.** Dès 25 € TTC, une note est obligatoire pour les prestations de services, restauration comprise. Elle est remise avant paiement, et son double est conservé 2 ans. La DGCCRF a infligé une amende de 14 850 € pour défaut de note en 2023 ([GHR](https://www.ghr.fr/reglementation-fiscalite/notes-et-factures)).
- **Prix de référence.** Toute annonce de réduction doit afficher le **prix le plus bas des 30 derniers jours** ([DGCCRF](https://www.economie.gouv.fr/dgccrf/des-regles-plus-claires-contre-les-faux-rabais)). FLŌW doit donc conserver l'historique des prix par article.
- **Espèces.** Un paiement en espèces à un professionnel est plafonné à **1 000 €** ([Service-public F10999](https://www.service-public.gouv.fr/particuliers/vosdroits/F10999?lang=fr)).
- **Titres-restaurant.** Le plafond est de **25 € par jour** en 2026. La dérogation « tous produits alimentaires » court jusqu'au 31/12/2026. La dématérialisation totale annoncée pour 2027 dépend de la PPL n° 2892, **toujours en discussion** en octobre 2026 ([Previssima](https://www.previssima.fr/actualite/reforme-des-titres-restaurant-vers-une-utilisation-elargie-et-entierement-dematerialisee-dici-2027.html)).
- **Consentement marketing.** L'e-mail saisi pour un ticket ne vaut pas consentement marketing. Les données d'un client se purgent 3 ans après la fin de la relation commerciale ([CNIL](https://Cnil.fr/sites/cnil/files/atoms/files/referentiel_traitements-donnees-caractere-personnel_gestion-activites-commerciales.pdf)).
- **Allergènes.** L'information écrite sur les allergènes est obligatoire pour les denrées non préemballées ([UFC-Que Choisir](https://www.quechoisir.org/action-ufc-que-choisir-enquete-sur-les-allergenes-les-professionnels-allergiques-a-la-bonne-information-des-consommateurs-n21579/)). FLŌW connaît les allergènes en back-office, mais doit encore les rendre visibles au comptoir.
- **Accessibilité.** L'European Accessibility Act s'applique depuis le 28 juin 2025 aux bornes, aux terminaux de paiement et au commerce électronique, avec exemption des micro-entreprises de services ([DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/la-nouvelle-directive-europeenne-accessibilite-pour-des-produits-et-des-services-accessibles-aux-personnes-en-situation)). Elle concerne la page de retrait et toute future borne de FLŌW.

D'autres obligations sectorielles sont pertinentes, mais leurs textes primaires n'ont pas été vérifiés pendant cette recherche : le livre de police pour la bijouterie d'occasion, le contrôle d'âge sur l'alcool, la traçabilité des lots et les taux de TVA détaillés de la boulangerie. Ils sont repris dans la feuille de route comme points à confirmer.

## Une PWA ne parle pas seule au TPE de la banque

Les éditeurs grand public règlent le matériel par des kits validés : imprimante Epson ou Star, tiroir relié à l'imprimante, lecteur de codes-barres, TPE intégré. Lightspeed propose par exemple des kits Epson/Star avec tiroir et imprimante cuisine ([Lightspeed](https://resto-support.lightspeedhq.com/hc/en-us/articles/115000742913-About-supported-hardware)). Odoo passe par un boîtier local, l'IoT Box, pour l'imprimante, la balance et l'afficheur, et le tiroir est branché sur l'imprimante ([Odoo](https://www.odoo.com/documentation/user/14.0/fr/iot/config/pos.html)).

Pour une caisse web, l'impression a une solution propre. **Star CloudPRNT** laisse l'imprimante interroger le serveur, ce qui évite le contenu mixte HTTPS et la gestion des adresses IP. Star WebPRNT et Epson ePOS SDK for JavaScript permettent aussi d'imprimer depuis le navigateur sur le réseau local ([Star](https://headless.starmicronics.com/?p=187336) ; [Epson ePOS SDK](https://download3.ebz.epson.net/dsc/f/03/00/15/16/08/912403dcd72ccb22fc13f41eec229b35e2a1ea9c/ov_ePOS_SDK_JavaScript_v2.27.0.pdf)). WebPRNT impose toutefois de connaître l'IP de l'imprimante et d'y installer un certificat SSL. La commande d'ouverture du tiroir passe par l'imprimante. Les imprimantes de cuisine sont de simples imprimantes réseau supplémentaires, adressées selon la catégorie du produit.

Le paiement est le vrai verrou. En France, la caisse dialogue avec les TPE Ingenico et Verifone loués par les banques via **Caisse-AP**, un protocole indépendant du fabricant qui échange du texte ASCII sur une socket TCP brute. **Un navigateur ne peut pas ouvrir ce type de socket** : même Odoo fait passer ce dialogue par son serveur ([Odoo Caisse-AP](https://pypi.org/project/odoo-addon-l10n-fr-pos-caisse-ap-ip)). Les intégrations SumUp et Stripe de FLŌW ne couvrent donc que les commerçants prêts à changer d'acquéreur. Les autres doivent saisir deux fois le montant, une friction que l'on reproche aussi à Lightspeed avec un TPE non intégré ([independant.io](https://independant.io/avis/lightspeed/)).

Deux autres capacités exigent une application native :

- **Le paiement carte hors ligne.** Le mode store-and-forward de Stripe Terminal est absent du SDK JavaScript et de l'intégration pilotée par le serveur ([Stripe](https://docs.stripe.com/terminal/features/operate-offline/overview)).
- **Tap to Pay.** Il fonctionne en France depuis novembre 2023 chez SumUp, Adyen, Viva Wallet, Worldline, myPOS et Revolut ([Apple](https://www.apple.com/fr/newsroom/2023/11/apple-introduces-tap-to-pay-on-iphone-in-france)). Pour Stripe, la disponibilité en France n'est pas confirmée par sa propre page ([Stripe](https://stripe.com/resources/more/tap-to-pay-in-france)).

La conclusion technique est nette. **Un agent local ou une enveloppe native Android (TWA ou Capacitor) débloque d'un coup** Caisse-AP, les monnayeurs Glory en SOAP sur HTTP ([HelloPro](https://conseils.hellopro.fr/top-10-des-marques-de-monnayeur-automatique-3105.html)), l'impression USB, le paiement carte hors ligne et Tap to Pay. En attendant, un mode de paiement « carte sur TPE externe », suivi d'un rapprochement, suffit à ne bloquer personne.

Les moyens de paiement français relèvent surtout du paramétrage :

- **Titres-restaurant dématérialisés.** Ils transitent par Conecs (Edenred, Pluxee, Up, Swile) et sont acceptés sur le TPE, notamment chez SumUp et myPOS ([SumUp](https://www.sumup.com/fr-fr/press/partenariat-sumup-conecs/)). La caisse doit gérer un type de paiement dédié, le plafond, l'éligibilité par article et le paiement partiel.
- **Chèque-Vacances Connect.** C'est une application installée sur le TPE ([GHR/ANCV](https://www.ghr.fr/nos-partenaires/ancv/)).
- **Wero.** Il n'est accepté en magasin que par QR code en 2026, le sans contact étant visé pour 2027 ([Journal du Geek](https://www.journaldugeek.com/2026/04/22/deux-banques-vont-bientot-vous-permettre-de-payer-avec-wero/)).
- **Détaxe.** Pour la clientèle touristique du luxe, elle passe par l'API Global Blue, pas par Wevat ([Shift4](https://docs.shift4.com/guides/advanced-concepts/tax-free-shopping)).

Pour la vente au poids, la voie la moins risquée est purement logicielle : **décoder les EAN-13 à prix intégré (préfixe 02 à 029)** imprimés par une balance étiqueteuse certifiée, comme le fait Square ([Square](https://squareup.com/help/fr/fr/article/7419-scanning-bar-codes-from-label-printing-scales-on-point-of-sale)). Une liaison directe entre la caisse et la balance relève de la métrologie légale. Odoo reconnaît d'ailleurs ne pas être certifié pour cet usage en France ([Odoo](https://www.odoo.com/documentation/15.0/fr/applications/general/iot/devices/scale.html) ; [LNE](https://www.lne.fr/sites/default/files/bloc-telecharger/Temoignage-Computer-associes_LNE.pdf)).

Les commissions et prix de lecteurs relevés sont indicatifs :

- **SumUp** : 1,75 % par paiement, lecteurs Air et Solo Lite à 34 € HT ([ComparateurBanque](https://www.comparateurbanque.com/?p=156969)). L'abonnement qui réduit la commission n'a pas de taux cohérent d'une source à l'autre : 0,79 % pour SumUp One selon un tiers, 0,89 % pour « Paiements Plus » selon la grille SumUp ([SumUp tarifs](https://www.sumup.com/fr-fr/tarifs/?path=%2F)).
- **Square** : 1,65 % ([Square](https://squareup.com/fr/pricing)).
- **Zettle** : lecteur à 19 € ou 29 € selon la source.

## Le socle retail se paie 60 à 80 € par magasin chez les leaders

Chez Lightspeed, Shopify POS et Square, les fonctions qui distinguent une caisse « pro » sont presque toujours dans le tier payant :

- les bons de commande fournisseurs avec suggestions de réassort ;
- les comptages d'inventaire et les transferts entre magasins ;
- la fidélité et les cartes cadeaux ;
- les promotions automatiques ;
- le click & collect.

**Shopify POS Pro** (79 € par emplacement et par mois, 59 € en annuel) réserve à ce tier les échanges, le retrait en magasin, les transferts et comptages, les rôles illimités et les réductions automatiques ([Kanal](https://getkanal.com/fr/blog/shopify-pos)). **Square Plus** (69 € HT) apporte les bons de commande avec suggestions, la gestion des fournisseurs, les transferts et les comptages ([Square PO](https://squareup.com/gb/en/point-of-sale/retail/features/purchase-orders) ; [Mobile Transaction](https://fr.mobiletransaction.org/square-pour-detaillants-avis/)). **Lightspeed Retail** inclut dans tous ses plans la fidélité, l'e-commerce, des prévisions de réassort, les coûts de revient complets (landed costs) et une app de scan ([Lightspeed pricing](https://www.lightspeedhq.com/pos/retail/pricing/)). Il a aussi ajouté une pointeuse en 2023 ([Retail Insider](https://retail-insider.com/bulletin/2023/08/lightspeed-commerce-inc-introduces-cutting-edge-features-to-empower-merchants/)). Même la caisse française low-cost **Hiboutik** propose gratuitement les fiches clients, la fidélité par points, les variantes, les alertes de stock et les comptes clients avec avances ([La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)). Odoo gère fidélité, coupons et cartes cadeaux dans un même moteur de règles ([Octura](https://octurasolutions.com/fr/resources/12-fonctionnalites-point-of-sale-odoo-pour-commerce-et-restauration)).

Le haut de gamme mode et luxe français va plus loin. **Cegid Retail** ajoute la détaxe, le clienteling avec vue client à 360°, l'endless aisle, l'e-réservation et le queue busting ([Cegid](https://www.cegid.com/fr/?p=58301)). **Fastmag** propose acomptes, réservations, paiements différés, web-to-store et un reporting par vendeur : indice de vente, taux de transformation, top et flop ([tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/fastmag/)). Ce sont les attentes de la bijouterie et du luxe. Les numéros de série de FLŌW y sont un bon point de départ, mais il manque la détaxe, le clienteling et la gestion des mises de côté. Selon une source tierce non vérifiée, Lightspeed inclut les commandes spéciales et les mises de côté dans sa caisse ([Lightspeed AU](https://www.lightspeedhq.com/au/pos/lightspeed-vs-square/)).

| Fonction retail | Lightspeed | Shopify POS | Square | Hiboutik | Odoo | Cegid / Fastmag | FLŌW |
|---|---|---|---|---|---|---|---|
| Fiche client, fidélité | Inclus | Pro (LTV) | Plus | Gratuit | Inclus | Clienteling 360° | ✗ |
| Cartes cadeaux | ✓ | Tous plans | ? | ? | ✓ | Fastmag ✓ | Bons uniquement |
| Bons de commande fournisseurs + réassort | Prévisions | Admin | Plus | Fournisseurs | ✓ | ✓ | Commandes internes seulement |
| Comptage d'inventaire au scanner | App scanner | Pro | Plus | Inventaire continu | ✓ | Cegid ✓ | ✗ |
| Transferts entre magasins | ✓ | Pro | Plus | Multi-boutique | ✓ | ✓ | Via commandes internes |
| Promotions automatiques | ✓ | Pro | ? | ? | Moteur de règles | ✓ | Remises manuelles |
| Click & collect / e-commerce | E-com intégré | Natif | Plus | Premium | ✓ | E-réservation | Hub + page de retrait |
| Acomptes, mises de côté | ✓ ⚠ | ? | ✗ ⚠ | Avances client | ? | Fastmag ✓ | ✗ |
| Détaxe | ? | App tierce | ? | ? | ? | Cegid ✓ | ✗ |

Les critiques des avis dessinent l'angle d'attaque de FLŌW. Lightspeed obtient 4,0/5 sur 975 avis Capterra, avec des reproches récurrents sur le support et le rapport qualité-prix ([Capterra](https://www.capterra.fr/software/120491/lightspeed-retail)). Hiboutik est critiqué pour l'absence de mode hors ligne, pour son API et ses statistiques payantes, et pour l'absence de gestion de la production ([La Caisse Idéale](https://www.lacaisseideale.fr/articles/hiboutik-avis/)). Shopify POS Pro est jugé « quasi indispensable », sans application pour ordinateur, et avec des taux de paiement en boutique non publiés ([Kanal](https://getkanal.com/fr/blog/shopify-pos)). FLŌW coche déjà les cases que ces concurrents manquent, mais pas encore celles qu'ils remplissent.

## L'alimentaire exige recettes, poids, lots et service en salle

Côté restauration, le plan de salle, les couverts, le transfert et la fusion de tables et la prise de commande mobile sont standard :

- **Square** les propose en formule Plus ou Premium, avec plusieurs plans, des sections et la gestion des suites ([Square](https://squareup.com/help/fr/fr/article/6427-building-your-floor-plan)).
- **Odoo** gère tables, réservations, transfert et fusion, division de note par produit et TVA sur place/à emporter par position fiscale ([Odoo 18](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/restaurant.html)).
- **Hiboutik** propose options et compléments, menus à étapes, écran cuisine par poste, click & collect et QR à table ([Hiboutik](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)).
- **Lightspeed KDS** route la nourriture vers la cuisine et les boissons vers le bar, chronomètre la préparation et émet des alertes sonores ([Lightspeed](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/)).

Même un logiciel de boulangerie comme **Crisalid/Aliris** propose la gestion de tables, les niveaux de tarifs à emporter ou sur place, les formules automatiques, les parts (gâteaux pour 4, 8 ou 12 personnes), la lecture des titres-restaurant avec avoir sur le trop-perçu, et la saisie des invendus et des fabriqués ([Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)). Le **basculement sur place/à emporter qui recalcule la TVA par ligne** est donc le manque le plus critique de FLŌW pour toute boutique avec salon de thé ou snacking. Le pourboire tracé reste aussi un besoin réel : son exonération a été **prolongée jusqu'au 31/12/2028** par la même loi de finances 2026 ([BOFiP](https://bofip.impots.gouv.fr/node/377304) ; [Legisocial](https://www.legisocial.fr/actualites-sociales/7795-loi-finances-2026-publication-journal-officiel.html)).

Pour un réseau avec laboratoire central, le concurrent direct n'est pas Lightspeed mais **Gourmets ERP (GL Info)**. Cet ERP cloud pour chocolatiers et pâtissiers couvre la caisse certifiée, la production, les recettes, les achats, les stocks, la traçabilité et les connecteurs e-commerce et transporteurs. Ses références affichées, identifiées par les logos du site, incluent **Chocolat Alain Ducasse, Ducasse Glace, Pierre Hermé, La Maison du Chocolat et Jean-Paul Hévin**. Ses prix ne sont donnés que sur devis ([gourmets-erp.fr](https://gourmets-erp.fr/)). Aucune source ne précise quels modules la Manufacture Ducasse utilise réellement. Côté américain, **Toast xtraCHEF** montre ce qu'est un coût matière complet : coût du plat en temps réel à partir des factures scannées, déstockage, écart entre consommation réelle et théorique, commande par niveau minimum ([Toast](https://pos.toasttab.com/th-us/products/recipe-costing)). Toast n'est pas présent en France ([Payments Dive](https://www.paymentsdive.com/news/lightspeed-ceo-jp-chauvet-toast-restaurant-pos-payments-european-market/699708/)). FLŌW a l'écran de production consolidée et les commandes internes avec heures limites, mais **ni recettes avec quantités, ni déstockage matière, ni coût matière, ni lots et DLC, ni étiquettes INCO**. C'est la chaîne recette, besoin matière, achat fournisseur que vend Gourmets.

En ligne, Zelty, L'Addition, Lightspeed et Innovorder centralisent Uber Eats, Deliveroo et Just Eat, souvent via Deliverect, qui demande un abonnement séparé ([Deliverect](https://help.deliverect.com/en/articles/14998490-zelty-integration-overview) ; [Fooderise](https://www.fooderise.com/en/blog/meilleures-integrations-pos-livraison-2026)). La boulangerie attend des commandes clients avec calendrier de retrait, que proposent Crisalid et Toporder ([Toporder](https://www.toporder.fr/)). En revanche, **aucune source publique ne documente des acomptes sur précommande avec plafond de capacité de production**. Pour les bûches, galettes et commandes de Pâques, c'est un différenciateur naturel pour FLŌW. Il reste à vérifier en démonstration chez les concurrents.

## Intégrations, support et prix : un avantage tarifaire à transformer

Pour un commerçant, le standard de fait est simple : « mon Z part tout seul chez mon comptable ». L'annuaire Pennylane liste des dizaines de caisses, dont Lightspeed, Hiboutik, Fastmag et Crisalid, qui injectent le Z en écriture de journal à la clôture ([Pennylane intégrations](https://www.pennylane.com/fr/integrations)). Lightspeed a annoncé en 2026 un partenariat Pennylane pour les restaurateurs ([TendanceHotellerie](https://www.tendancehotellerie.fr/articles-breves/communique-de-presse/18632-article/lightspeed-s-associe-a-pennylane-pour-permettre-aux-restaurateurs-de-se-concentrer-sur-l-experience-client)). Combo documente des connexions avec L'Addition, Lightspeed, SumUp et Zelty, notamment via la marketplace intégrée au back-office de Zelty ([Guide Combo](https://guide.combohr.com/en/articles/7983229-integrating-your-cash-register-with-combo)). Hiboutik publie une API REST et des webhooks documentés ([Hiboutik API](https://www.hiboutik.com/de/api-developers/)). Les tokens et webhooks de FLŌW ne comptent commercialement qu'une fois documentés publiquement et visibles dans les annuaires partenaires.

Sur l'exploitation, FLŌW a un avantage rare : **le hors ligne est natif et inclus**. Lightspeed le facture en option (Lite Server). Shopify n'accepte que les espèces hors ligne. Hiboutik et SumUp n'ont pas de mode hors ligne ([La Caisse Idéale](https://www.lacaisseideale.fr/articles/meilleur-logiciel-caisse-enregistreuse/)). En face, la norme annoncée est un **support « gratuit et illimité » par téléphone**, avec conseiller dédié dans la restauration. Zelty et Lightspeed le revendiquent ([tool-advisor Zelty](https://tool-advisor.fr/logiciel-de-caisse/comparatif/zelty/)), et Lightspeed publie une page de statut ([StatusGator](https://statusgator.com/status/lightspeed)). FLŌW n'annonce publiquement ni horaires, ni canaux de support, ni page de statut. C'est à corriger.

Côté prix, **Pulse à 29 € et Tempo à 59 € HT par boutique, sans engagement**, se placent dans le bas du marché :

- Lightspeed : 89 à 249 € HT avec engagement d'un an ;
- Shopify : forfait de base plus 79 € par emplacement ;
- Square restaurants : 59 € HT ;
- L'Addition : 39 à 85 € selon la source ;
- Zelty : sur devis ([tool-advisor Lightspeed](https://tool-advisor.fr/logiciel-de-caisse/comparatif/lightspeed/) ; [Kanal](https://getkanal.com/fr/blog/shopify-pos)).

La jurisprudence 2025-2026 sur les **locations financières de caisse sur 48 mois « irrévocables »** fait de l'absence d'engagement un argument fort ([CA Douai 28/05/2026](https://www.doctrine.fr/d/CA/Douai/2026/CAPB188DA7975D26AF84F77)). FLŌW renonce en revanche au levier de revenu des commissions de paiement et de l'avance de trésorerie, qu'exploitent SumUp, Square et Shopify ([SumUp Cash Advance](https://www.sumup.com/en-gb/press/sumup-cash-advance-expanded/)). Un point de nommage est à vérifier : la page Lightspeed restaurant CH-FR mentionne des produits « Tempo » et « Pulse » ([Lightspeed](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/)). Il faut vérifier l'antériorité des marques avant d'investir dans ces noms de plans.

**Sources incertaines ou contradictoires à garder en tête.** Les grilles officielles en euros de Lightspeed, Square et SumUp n'ont pas pu être lues : elles renvoyaient des erreurs 404 ou 429. Plusieurs prix se contredisent d'une source tierce à l'autre :

- Lightspeed : 89, 119 ou 69 €, et les chiffres en euros relèvent en réalité de l'offre restaurant ;
- Hiboutik Premium : 9,90, 14,90, 15,90 ou 16,90 € ;
- L'Addition : 39, 49, 69 ou 85 € ;
- Popina : 52 ou 70 € ;
- Fastmag : 69 ou 119 €.

D'autres points restent incertains :

- la disponibilité de Shopify Payments en boutique en France, attestée seulement par un fil ancien ;
- Tap to Pay chez Stripe en France ;
- la date de fin de la subvention ANCV ;
- le futur plafond européen de 10 000 € pour les espèces ;
- l'issue de la PPL sur les titres-restaurant.

Enfin, un site tiers affirme que Square n'a pas de plan de salle, ce que dément l'aide officielle de Square.

## Feuille de route priorisée des manques de FLŌW

Légende des segments : **Mode** = mode/retail ; **Bij** = bijouterie-luxe ; **Alim** = alimentaire ; **BP** = boulangerie-pâtisserie ; **Resto** = restauration ; **EF** = épicerie fine/caviste. Les efforts sont des estimations de l'auteur, pour une petite équipe : **S** ≈ 1-2 semaines, **M** ≈ 3-6 semaines, **L** ≈ 2-3 mois, **XL** > 3 mois ou dépendance externe.

### P0 : bloquant légal ou bloquant pour vendre

| # | Manque | Segments débloqués | Effort | Pourquoi |
|---|---|---|---|---|
| 1 | Socle anti-fraude complet : clôtures J/M/A cumulatives, grand total et **total perpétuel** non réinitialisable, archives périodiques signées en format ouvert avec horodatage, **mode formation** marqué « fictif », journal des événements techniques, marquage des duplicatas | Tous | M | Conditions du BOI-TVA-DECLA-30-10-30 ; amende de 7 500 € par système |
| 2 | **Générateur d'attestation individuelle** (modèle BOI-LETTRE-000242 : logiciel, version majeure, n° de licence, client, date) ; renommage de l'écran « NF525 » | Tous | S | Possible depuis le 21/02/2026 ; le modèle exact reste à télécharger sur le BOFiP |
| 3 | Impression réelle : Star CloudPRNT/WebPRNT, Epson ePOS, tiroir par l'imprimante, ticket « à la demande » avec impression forcée pour les produits pesés, sous garantie et les CB échouées, QR vers l'e-ticket | Tous | M | Aucun commerce physique ne tourne sans ticket ni tiroir |
| 4 | Moyens de paiement français configurables : carte sur TPE externe + rapprochement, chèque, **titre-restaurant** (plafond 25 €/jour, éligibilité par article, rendu interdit sur papier), chèque-vacances, alerte espèces > 1 000 € | Tous ; TR critique pour Alim, BP, Resto | S-M | Débloque les commerçants qui gardent le TPE de leur banque |
| 5 | **TVA sur place/à emporter** par commande, recalcul par ligne | BP, Resto, Alim, EF | S-M | Standard même en boulangerie (Aliris, Odoo) |
| 6 | Ticket et note : mentions légales complètes, **note de service dès 25 €** avec double conservé, mentions B2B (SIREN, nature des opérations, adresse de livraison) | Resto, BP (salon), Bij (retouches), tous en B2B | S | Note obligatoire ; amende DGCCRF de 14 850 € en 2023 |
| 7 | Conservation sur 6 ans et réversibilité contractuelle (export d'archive à la résiliation), export comptable des ventes par taux et par mode de paiement | Tous | S-M | Art. L. 102 B LPF |
| 8 | RGPD en caisse : consentement marketing distinct et non précoché, purge à 3 ans, pseudonymisation qui préserve la chaîne fiscale | Tous | S | Référentiel CNIL |
| 9 | **Raccordement à une plateforme agréée** : émission e-facture B2B (Factur-X/UBL), moteur d'**e-reporting B2C** par taux, périodicité paramétrable | Tous (PME/TPE) | L | Échéance ferme au **1/09/2027** ; à livrer avant l'été 2027 |

### P1 : indispensable pour la plupart des commerces

| # | Manque | Segments débloqués | Effort | Pourquoi |
|---|---|---|---|---|
| 10 | **Agent local / enveloppe Android** : Caisse-AP sur IP (TPE bancaires), impression USB, Tap to Pay, paiement carte hors ligne | Tous | L | Une PWA ne peut pas ouvrir de socket TCP ; standard français |
| 11 | Fiche client/CRM, **fidélité**, **cartes cadeaux** rechargeables | Mode, Bij, EF, BP | M | Inclus chez Hiboutik (gratuit), Lightspeed, Odoo |
| 12 | **Achats fournisseurs** : bons de commande, réception, suggestions de réassort | Tous | M-L | Square Plus, Lightspeed, Gourmets |
| 13 | Inventaire au scanner, comptages tournants, transferts entre boutiques hors commande labo | Mode, Bij, EF, Alim | M | Shopify POS Pro, Square Plus |
| 14 | **EAN-13 à prix ou poids intégré** (02-029 configurable), articles au poids, tare, saisie manuelle du poids | Alim, EF, BP | S | Pur logiciel ; évite la métrologie légale |
| 15 | **Recettes et fiches techniques**, déstockage matière, coût matière, saisie des invendus, pertes et fabriqués | BP, Resto, Alim | L | Ce qui manque face à Gourmets ERP et xtraCHEF |
| 16 | **Lots et DLC**, étiquettes INCO (allergènes, ingrédients, DLC, prix, code-barres), affichage allergènes au comptoir (fiche, QR) | BP, Alim, EF | M | Allergènes écrits obligatoires ; standard Aliris |
| 17 | Modificateurs et options, **formules et menus** automatiques, parts et conditionnements | Resto, BP | M | Hiboutik, Aliris, L'Addition |
| 18 | Promotions automatiques (listes de prix, X achetés = Y, seuils) avec **prix de référence sur 30 jours** | Mode, Bij, EF, Alim | M | Règle Omnibus ; Shopify POS Pro, Odoo |
| 19 | Mode service : **KDS par poste** (cuisine, bar), imprimantes de préparation, minuteur, bump/recall ; plan de salle léger, couverts, transfert et fusion, prise de commande sur smartphone ; pourboire tracé | Resto, BP (salon de thé) | M-L | Standard chez tous les acteurs restauration |
| 20 | Click & collect complet : **créneaux avec capacité**, **acompte sur précommande** et solde au retrait, rappels SMS et e-mail | BP, Alim, EF, Resto | M | Aliris, Toporder ; acomptes jamais documentés publiquement |
| 21 | Mises de côté, acomptes, commandes spéciales, réservation d'article | Mode, Bij | S-M | Fastmag, Lightspeed (⚠) |
| 22 | **Connecteur Pennylane**, puis export d'écritures paramétrable (Sage, Cegid, EBP) ; inscription à l'annuaire Pennylane | Tous | M | « Mon Z part chez mon comptable » |
| 23 | Afficheur client (route synchronisée sur un second écran) ; étiquettes prix et codes-barres (PDF/ZPL) | Mode, EF, Alim, Bij | S | Shopify Terminal, Hiboutik |
| 24 | Exploitation : API publique documentée, horaires et canaux de support publiés, onboarding en visio, page de statut publique avec historique | Tous | S-M | Norme « support illimité » de Zelty et Lightspeed |
| 25 | **Certification NF525 ou Infocert** comme option d'assurance | Tous, surtout grands comptes et réseaux | XL (≈20 k€ + 3,8-7 k€/an, ordre de grandeur) | Exigée par les experts-comptables ; protège contre un nouveau retournement législatif |
| 26 | Registre des objets mobiliers (livre de police) pour l'achat d'occasion ; contrôle d'âge sur l'alcool | Bij (occasion), EF (caviste) | S | Pertinent, mais textes primaires **non vérifiés** dans cette recherche |

### P2 : différenciant

| # | Manque | Segments débloqués | Effort | Pourquoi |
|---|---|---|---|---|
| 27 | **Détaxe via l'API Global Blue**, puis Planet ; DCC et devises (via l'acquéreur) | Bij, Mode, EF luxe | M | Cegid seul la documente ; clientèle touristique |
| 28 | Clienteling (vue 360°, wishlist, relances vendeur), endless aisle, e-réservation | Bij, Mode | L | Cegid, Fastmag |
| 29 | Livraison Uber Eats/Deliveroo/Just Eat via **HubRise ou Deliverect** ; QR à table ; réservations | Resto, BP | M | Zelty, Lightspeed, L'Addition |
| 30 | **Prévision de production** à partir de l'historique et des précommandes, reliée au labo | BP, Alim | M-L | Atout naturel du labo central ; Bimedia seul l'évoque |
| 31 | Connecteurs planning (Combo, Skello, Snapshift : CA par heure), pointeuse, commissions et objectifs vendeurs | Tous, surtout Resto et Mode | S-M | Lightspeed Time Clock, Fastmag |
| 32 | Analytique avancée : heatmaps horaires, mix produit, marge, indice de vente, taux de transformation | Tous | M | Lightspeed Insights, Fastmag |
| 33 | Monnayeurs (Glory CI-10 via l'agent local), balance connectée certifiée, étiquettes électroniques, bornes conformes RGAA/EAA | BP, Alim, EF | L-XL | Niche ; dépend de l'agent local (#10) |
| 34 | Wero en QR, BNPL en magasin, landed costs | Mode, Bij | S-M | Marché naissant |

### Forces de FLŌW que les concurrents n'ont pas

Plusieurs atouts de FLŌW sont rares, voire uniques, dans ce panel.

- **Le hors ligne natif avec ventes signées** est inclus dans les deux plans. Lightspeed le facture en option, Hiboutik et SumUp ne l'ont pas, et Shopify n'accepte que les espèces hors ligne ([La Caisse Idéale](https://www.lacaisseideale.fr/articles/meilleur-logiciel-caisse-enregistreuse/)).
- **La signature ECDSA par terminal avec chaînage** donne une avance technique sur l'inaltérabilité, même si la conformité reste incomplète.
- **FLŌW tourne dans le navigateur sur tablette, téléphone ou ordinateur**. L'Addition et Popina imposent Apple ou l'iPad, et Shopify n'a pas d'application pour ordinateur ([independant.io](https://independant.io/avis/l-addition/) ; [Kanal](https://getkanal.com/fr/blog/shopify-pos)).
- **Le laboratoire central** fonctionne déjà de bout en bout : commandes internes avec heures limites, colisage, réception et écran de production consolidé. Seuls Gourmets ERP et Toporder le documentent, et Hiboutik est critiqué précisément pour l'absence de gestion de la production.
- **L'API, les webhooks et les imports/exports CSV sont inclus sans surcoût**. Hiboutik les réserve au Premium et Odoo à la formule Custom ([Odoo pricing](https://www.odoo.com/fr_FR/pricing)).
- **Les prix sont publics, sans engagement, avec 30 jours d'essai et les fonctions de stock incluses dès Pulse**. Zelty, L'Addition et Gourmets vendent sur devis, Lightspeed engage pour un an, Shopify et Square réservent le stock avancé au tier Pro, et les locations sur 48 mois sont sources de litiges.
- **Plusieurs fonctions répondent déjà aux métiers du luxe et de l'alimentaire** : numéros de série (bijouterie), allergènes en base, page de suivi de retrait pour le client, connexion par badge QR/NFC et PIN.

## Conclusion

Le retour de l'auto-attestation change l'ordre des travaux. La conformité n'est plus une certification à acheter : c'est un chantier de développement de quelques semaines, que FLŌW peut mener seul. Il faut le traiter en premier, parce que l'éditeur engage sa responsabilité pénale dès la première attestation signée. Il faut aussi garder la certification comme assurance, puisque la règle a déjà changé deux fois. Le deuxième enseignement est architectural. Le choix de la PWA est un atout commercial contre les caisses liées à l'iPad, mais il ne passe pas la barrière du TPE bancaire français. Un agent local ou une enveloppe Android unique débloque à la fois Caisse-AP, Tap to Pay, la carte hors ligne et les monnayeurs. C'est l'investissement qui a le meilleur ratio de segments débloqués par effort.

Le troisième enseignement est stratégique. FLŌW ne gagnera pas les commerces généralistes en copiant le socle retail de Shopify ou Square, même s'il en a besoin. Il peut en revanche devenir la seule caisse web abordable qui relie la boutique au laboratoire. Pour cela, il doit ajouter aux commandes internes qu'il maîtrise déjà les recettes, le coût matière, les lots et DLC, les précommandes avec acompte et les prévisions de production. C'est le territoire que Gourmets ERP occupe aujourd'hui chez les grandes maisons, sur devis et sans prix publics. La pâtisserie et l'épicerie fine haut de gamme sont donc la tête de pont naturelle. La mode et la bijouterie viendront ensuite, avec la fidélité, la détaxe et le clienteling.
