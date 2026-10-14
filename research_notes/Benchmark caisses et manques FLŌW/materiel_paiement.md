# Matériel et paiements attendus d'une caisse professionnelle en France (2026) : benchmark pour FLŌW

Périmètre : ce que les éditeurs de caisse grand public prennent en charge en standard (matériel, TPE, moyens de paiement), comment les caisses web/PWA accèdent au matériel, et ce que FLŌW doit ajouter. Recherche faite en octobre 2026 avec environ 20 appels search/fetch. Plusieurs pages officielles de vendeurs (Square, Shopify, Lightspeed) n'ont pas pu être lues directement (429 ou absentes des résultats). Les manques sont donc signalés explicitement.

## 1. Imprimantes de tickets, tiroir-caisse, imprimantes cuisine : comment une caisse web imprime

### Takeaway
Les deux grandes familles d'imprimantes de tickets (Epson TM, Star mC-Print) exposent toutes deux des API d'impression natives pour le navigateur via le réseau local : Epson ePOS SDK for JavaScript / ePOS-Print, Star WebPRNT. Star propose aussi l'impression cloud (CloudPRNT). Une PWA peut donc imprimer sans pont local si on choisit des imprimantes LAN/Wi-Fi compatibles. Le tiroir-caisse est presque toujours relié à l'imprimante (port RJ11/RJ12 DK) et s'ouvre par une commande de l'imprimante.

### Cited Findings
- Le SDK Epson ePOS for JavaScript (v2.27.0) sert à créer des applications web qui impriment sur les imprimantes Epson TM. Il liste le TM-m30 parmi les modèles pris en charge. La matrice navigateurs du PDF (Chrome/Edge/Firefox jusqu'à la v108, Safari 15.6.1) est datée d'octobre 2023 — [Epson ePOS SDK JS v2.27.0 PDF](https://download3.ebz.epson.net/dsc/f/03/00/15/16/08/912403dcd72ccb22fc13f41eec229b35e2a1ea9c/ov_ePOS_SDK_JavaScript_v2.27.0.pdf)
- Le TM-m30 existe en USB, Ethernet, Wi-Fi, Bluetooth et NFC. Il prend en charge 2 tiroirs-caisses ou 1 buzzer externe. Les kits revendeurs relient le tiroir à l'imprimante — [fiche UMD TM-m30](https://apu-lb2.umd.com.au/itd/products/epson_tmm30.html) ; [kit revendeur Hike](https://www.hospitalityhub.com.au/hike-point-of-sale-bundle-model-hphb3/p/160144)
- Le WebPRNT de Star génère les données d'impression depuis un navigateur web, avec HTML et JavaScript standards, sans pilote. Modèles compatibles : mC-Print3, mC-Print2, TSP654II, TSP743II, TSP847II, SP742 — [Star EMEA WebPRNT](https://star-emea.com/products/webprnt/)
- Limites de WebPRNT : il faut connaître l'adresse IP de l'imprimante et configurer un certificat SSL. C'est un vrai sujet pour une PWA servie en HTTPS, à cause du blocage du contenu mixte — [Star : WebPRNT vs CloudPRNT](https://headless.starmicronics.com/?p=187336)
- CloudPRNT imprime directement depuis un serveur, en général dans le cloud : l'imprimante interroge le serveur. Toutes les imprimantes CloudPRNT actuelles gèrent aussi WebPRNT. Le mC-Print3 (mCP30) a l'USB et le LAN, et intègre WebPRNT et CloudPRNT — [Star WebPRNT vs CloudPRNT](https://headless.starmicronics.com/?p=187336) ; [Star EMEA](https://star-emea.com/?p=820)
- L'Epson TM-T20III existe en version Ethernet avec port tiroir, ce qui permet de piloter le tiroir directement — [résumé de recherche citant la fiche Epson TM-T20III FR](https://www.scansource.com/~/media/pos-and-barcode-us/brands/epson/training/pdf2/Epson-TMT20III-Specsheet-FR)
- Odoo POS : le tiroir-caisse se branche sur l'imprimante de tickets, pas sur l'IoT Box. L'imprimante, la balance et l'afficheur client passent par l'IoT Box, c'est-à-dire un pont matériel local — [Odoo 14 IoT pour PdV](https://www.odoo.com/documentation/user/14.0/fr/iot/config/pos.html)
- Lightspeed Restaurant fonctionne avec des imprimantes Epson et Star. Ses kits comprennent des imprimantes de tickets LAN, un tiroir-caisse, un support iPad et une imprimante cuisine. Selon un site tiers, pour Lightspeed Retail le tiroir-caisse doit être relié via une imprimante Star Micronics — [Aide Lightspeed Resto, matériel supporté](https://resto-support.lightspeedhq.com/hc/en-us/articles/115000742913-About-supported-hardware) ; [Lightspeed CH matériel restaurant](https://www.lightspeedhq.com/ch/caisse/restaurant/materiel/) ; [independant.io avis Lightspeed](https://independant.io/avis/lightspeed/)
- Shopify POS (France) : la communauté cite comme matériel validé des imprimantes Star et Epson, des tiroirs-caisses et des scanners Socket Mobile ou Zebra — [Communauté Shopify FR](https://community.shopify.com/t/france-retour-dexperience-sur-shopify-pdv-quel-materiel-choisir/312432/6)
- Hiboutik (caisse web française) renvoie vers materiel-caisse.com pour le matériel compatible : imprimantes de tickets, lecteurs de codes-barres, tiroirs-caisses, détecteurs de faux billets, imprimantes d'étiquettes. La configuration se fait dans « Réglages/Impression/Tests d'impression » — [Matériel Hiboutik](https://hiboutik.com/en/hardware)

### Inferences
- Pour FLŌW (PWA), la voie la moins chère vers une « vraie » impression : (1) Star CloudPRNT, où le serveur FLŌW sert les tickets et l'imprimante les récupère, ce qui évite le contenu mixte et la gestion des IP ; (2) Epson ePOS-Print / Server Direct Print en LAN ; (3) en secours, WebUSB/WebSerial (Chrome desktop/Android uniquement, pas iOS Safari) ou une petite application pont locale, à la manière de l'IoT Box Odoo. Envoyer la commande d'ouverture du tiroir (ESC p) par l'imprimante couvre le pilotage du tiroir.
- Les imprimantes cuisine/préparation sont simplement des imprimantes LAN supplémentaires, adressées par catégorie de produit. Le même mécanisme suffit.
- Les tickets avec QR code (lien vers le ticket dématérialisé, avis, fidélité) sont pris en charge par les commandes ESC/POS des imprimantes Epson et Star. FLŌW envoie déjà les tickets par e-mail ; ajouter un QR qui pointe vers le ticket en ligne est peu coûteux.

### Gaps
- Je n'ai pas lu le guide API actuel d'Epson ePOS pour vérifier le nom exact de la méthode du tiroir (addPulse) ni la prise en charge des navigateurs en 2026. Ce sont des connaissances générales, non vérifiées ici.
- Rien de trouvé sur le comportement des imprimantes intégrées Sunmi (T2/V2) avec une PWA. Le SDK Sunmi est une application Android native (non vérifié).
- Aucune source ne documente précisément la prise en charge de WebUSB/WebSerial pour les imprimantes de tickets. C'est à confirmer sur la documentation MDN/Chrome.

## 2. Terminaux de paiement en France : protocoles, fournisseurs, Tap to Pay, commissions

### Takeaway
En France, l'intégration caisse-TPE « universelle » passe par le protocole **Caisse-AP** (Association du Paiement), indépendant du fabricant. Il est mis en œuvre sur les TPE Ingenico/Verifone déployés en France et fonctionne sur IP (texte ASCII sur socket TCP brute) depuis la v3.x. Un navigateur ne peut pas ouvrir de socket TCP brute : il faut un serveur ou un pont local. Tap to Pay sur iPhone est disponible en France depuis novembre 2023 chez Adyen, myPOS, Revolut, SumUp, Viva Wallet et Worldline. Stripe le propose dans son SDK Terminal, mais sa disponibilité en France n'est pas confirmée par la page Stripe consultée.

### Cited Findings
- Caisse-AP : protocole indépendant du fabricant, conçu par l'Association du Paiement, pris en charge par les terminaux Ingenico et Verifone, entre autres. Depuis la v3.x il fonctionne sur IP, la caisse (client) et le TPE (serveur) échangeant du texte ASCII sur une socket TCP brute. Le module Odoo passe donc par le serveur Odoo, car le JS du navigateur ne peut pas ouvrir de socket TCP brute. Déroulé : envoi du montant au TPE, attente de la fin de transaction, puis lecture du statut — [Odoo l10n_fr_pos_caisse_ap_ip (PyPI)](https://pypi.org/project/odoo-addon-l10n-fr-pos-caisse-ap-ip) ; [Odoo Apps v14](https://apps.odoo.com/apps/modules/14.0/l10n_fr_pos_caisse_ap_ip)
- Selon Companeo, la connexion IP (Ethernet/Wi-Fi) est la plus répandue en 2026. Le protocole dépend du modèle de TPE, du logiciel de caisse et de la banque — [Companeo, raccordement TPE et caisse](https://www.companeo.com/caisse-enregistreuse/FAQ/raccordement-tpe-et-caisse-enregistreuse)
- Lancement d'Apple Tap to Pay en France (nov. 2023) : Adyen, myPOS, Revolut, SumUp, Viva Wallet et Worldline au lancement. BNP Paribas, Crédit Coopératif, Market Pay, Stancer et Stripe étaient annoncés « prochainement ». Il faut un iPhone XS ou plus récent — [Apple Newsroom FR](https://www.apple.com/fr/newsroom/2023/11/apple-introduces-tap-to-pay-on-iphone-in-france) ; [Blog du Modérateur](https://www.blogdumoderateur.com/iphone-tap-to-pay-disponible-france/)
- Le guide France de Stripe indique que Stripe propose Tap to Pay via le SDK iOS et Android de Stripe Terminal (iPhone XS ou plus récent, Android 12 ou plus). Au-delà de 50 €, le client saisit son code PIN sur l'écran de l'appareil du commerçant. Autres fournisseurs listés : Banque Populaire, Caisse d'Épargne, BNP Paribas, Crédit Mutuel, Revolut, PayPal, Adyen, Worldline, Mollie, Square. La page ne confirme pas explicitement la disponibilité de Stripe en France — [Stripe : Tap to Pay en France](https://stripe.com/resources/more/tap-to-pay-in-france)
- SumUp : lecteurs Air et Solo Lite baissés de 39 € à 34 € HT en janvier 2025. Une autre source donne le Solo à 79 € HT. Commission standard de 1,75 % par paiement carte. L'abonnement SumUp One (19 €/mois) ramènerait les frais à 0,79 % sur les cartes nationales (source tierce, à vérifier). L'Air a besoin d'un téléphone en Bluetooth, le Solo est autonome (Wi-Fi + SIM) — [ComparateurBanque, SumUp 2026](https://www.comparateurbanque.com/?p=156969) ; [Indy, frais SumUp](https://www.indy.fr/guide/creation-entreprise/idees/artisans-et-commercants/frais-sumup/)
- Square France : à partir de 1,65 % par transaction avec une carte UE/EEE, plus 1,5 % pour les cartes UK/hors EEE. Square pour restaurants payant : 59 € HT/mois par point de vente — [Tarifs Square FR](https://squareup.com/fr/pricing)
- Shopify : kit de comptoir WisePad 3 pour iPad Lightning à 179 € TTC sur la boutique matériel Shopify FR. POS Pro à 79 €/mois par emplacement (guide Kanal, sept. 2026). Un fil de la communauté indiquait que Shopify Payments en point de vente n'était pas disponible en France : contournement par un TPE tiers + « marquer comme payé » (fil ancien, situation actuelle non vérifiée) — [Shopify Hardware FR WisePad 3](https://hardware.shopify.com/fr-fr/products/wisepad-3-countertop-kit-for-lightning-ipads-fr) ; [Kanal, Shopify POS France](https://getkanal.com/fr/blog/shopify-pos) ; [Communauté Shopify FR](https://community.shopify.com/t/france-retour-dexperience-sur-shopify-pdv-quel-materiel-choisir/312432/6)
- Lightspeed : compatible avec des TPE comme Zettle et Verifone. Un TPE bancaire non intégré oblige à saisir deux fois le montant — [independant.io avis Lightspeed](https://independant.io/avis/lightspeed/)
- Paiement hors ligne Stripe Terminal (store-and-forward) : paiements stockés sur disque et transmis au retour du réseau. L'autorisation n'a lieu qu'après la transmission, donc le commerçant porte le risque de refus. Plafond hors ligne de 10 000 USD par transaction. **Disponible dans les SDK mobiles, Java et .NET, mais pas dans le SDK JavaScript ni dans l'intégration server-driven** — [Stripe docs operate offline](https://docs.stripe.com/terminal/features/operate-offline/overview) ; [Stripe FAQ offline](https://support.stripe.com/questions/terminal-offline-mode-faq)

### Inferences
- L'intégration actuelle de FLŌW avec SumUp et Stripe couvre les commerçants qui acceptent de changer d'acquéreur. Mais une grande partie des commerces français garde le TPE de sa banque (Ingenico/Verifone/PAX loué au Crédit Agricole, à BNP, à la Société Générale, etc.). Pour ceux-là, **Caisse-AP sur IP est le standard incontournable**. Comme une PWA ne peut pas ouvrir de socket TCP, FLŌW doit fournir un relais serveur, si le TPE est joignable (rarement : il est sur le LAN du magasin), ou plus réalistement **un petit agent local / pont** (application de bureau, application Android ou boîtier), à la manière de l'IoT Box Odoo.
- Le mode hors ligne pour les cartes : comme FLŌW est une PWA JS, le SDK JS de Stripe Terminal **ne peut pas** faire de paiement carte hors ligne. Les vrais paiements carte hors ligne demandent une application native (Android/iOS) ou des lecteurs qui stockent eux-mêmes les transactions. C'est un argument pour une enveloppe native (Capacitor/TWA) sur Android/Sunmi.
- Tap to Pay demande aussi une application native (Proximity Reader d'Apple ; SDK Android). Une PWA seule ne peut pas le proposer.

### Gaps
- Je n'ai pas trouvé de page publique Nepting ni de page technique Worldline France pour vérifier le protocole « Concert » ni la version actuelle de Caisse-AP (la spécification n'est pas publique dans les résultats).
- Je n'ai pas vérifié les tarifs 2026 de Zettle, Viva Wallet, myPOS, Adyen et Stripe France (frais Terminal, prix des lecteurs WisePOS E/S700).
- Je n'ai pas trouvé de liste de « quels TPE de banque un POS doit parler ». En pratique, la réponse est : Caisse-AP couvre la plupart des TPE Ingenico/Verifone vendus par les banques françaises (inférence tirée de la source Odoo).

## 3. Autres moyens de paiement courants en France

### Takeaway
Les titres-restaurant dématérialisés passent par **Conecs** (GIE de l'acceptation commun à Edenred, Pluxee, Up et Swile/Bimpli). L'acceptation se fait sur le TPE, si l'acquéreur est affilié à Conecs, et non dans le logiciel de caisse. Une caisse doit donc surtout savoir gérer un **mode de paiement « TR » distinct, des paiements partiels et le plafond journalier**. Chèque-Vacances Connect (ANCV) est une application installée sur le TPE. Wero n'est pas encore généralisé en magasin (QR seulement, sans contact visé pour 2027). La détaxe s'intègre via l'API Global Blue, pas via Wevat.

### Cited Findings
- Conecs : plateforme technique d'acheminement des paiements par titres-restaurant dématérialisés depuis les TPE et le web, au service des émetteurs Edenred, Pluxee (ex-Sodexo), Up, Swile (ex-Bimpli) — [Lyra/Conecs PDF](https://www.lyra.com/fr/wp-content/uploads/sites/3/2018/06/CP_LYRA_CONECS_Tech.pdf) ; [Partenariat SumUp Conecs](https://www.sumup.com/fr-fr/press/partenariat-sumup-conecs/)
- SumUp accepte les titres-restaurant Conecs (Edenred, Pluxee, Up, Swile) sur tous ses lecteurs et sur la caisse SumUp Pro (2024). myPOS accepte aussi les titres-restaurant Conecs sur tous ses terminaux — [SumUp press](https://www.sumup.com/fr-fr/press/partenariat-sumup-conecs/) ; [myPOS blog](https://www.mypos.com/fr-fr/blog/notre-histoire/mypos-partnaires-avec-conecs)
- Les cartes titres-restaurant permettent le paiement fractionné et le complément par une seconde carte si l'émetteur gère l'autorisation partielle — [Monetico/Lyra support](https://gateway.monetico-retail.support.lyra.com/hc/fr/articles/19103082533394-Fonctionnement-d-une-carte-Titre-Restaurant)
- Les conditions d'affiliation Pluxee définissent le TPE comme le terminal d'acceptation. Les remises se font par télécollecte ou par fichier « grand remettant » — [CG affiliation Pluxee](https://www.pluxee.fr/sites/g/files/jclxxe296/files/2023-10/231106%20PXF%20CG%20Affiliation%20PXE%20RESTAURANT%20D%C3%A9mat%C3%A9rialis%C3%A9%20vLD.pdf)
- Chèque-Vacances Connect : application installée sur le TPE et activée depuis l'espace pro ANCV. Remboursement sous 5 jours ouvrés. L'ANCV verse une subvention de 50 € pour l'installation sur TPE (fin d'offre 31/12/2025 ou 31/12/2026 selon les sources, non confirmé auprès de l'ANCV). Le réseau d'acceptation serait passé de 62 500 points (fin 2024) à 125 500 (2026) — [GHR / ANCV](https://www.ghr.fr/nos-partenaires/ancv/) ; [CGV ANCV PE 2025.12](https://static.ancv.com/ddmc/externe/site/espace_client/documents/cgv/CGV%20PE%202025.12.pdf) ; [MoneyVox](https://www.moneyvox.fr/votre-argent/actualites/109921/cheques-vacances-connect-comment-eviter-les-mauvaises-surprises-au-moment-de-payer)
- Wero (EPI) : en avril 2026, seul le paiement en magasin par QR code existait, le sans contact étant prévu pour un déploiement en point de vente en 2027. Paiement en ligne chez de grands commerçants (Air France, Decathlon, Fnac Darty, Orange) annoncé par BNP Paribas en septembre 2026 — [Journal du Geek avr. 2026](https://www.journaldugeek.com/2026/04/22/deux-banques-vont-bientot-vous-permettre-de-payer-avec-wero/) ; [BNP Paribas CP](https://cdn-group.bnpparibas.com/uploads/file/CP%20-%20BNP%20Paribas%20accompagne%20l'acc%C3%A9l%C3%A9ration%20du%20d%C3%A9ploiement%20de%20Wero%20aupr%C3%A8s%20de%20ses%20clients%20commer%C3%A7ants%20et%20particuliers%20en%20Europe.pdf) ; [Café du Geek](https://lecafedugeek.fr/wero-le-paiement-en-ligne-et-en-magasin-retarde-en-france/)
- Détaxe : Wevat est une application grand public, sans API développeur publique. Pour la caisse, le flux documenté passe par Global Blue : après la vente, la caisse appelle l'API d'éligibilité Global Blue puis soumet une demande d'émission (documenté par Shift4). Global Blue présente ses solutions RetailTech comme intégrables aux systèmes existants — [Shift4 Tax-Free Shopping](https://docs.shift4.com/guides/advanced-concepts/tax-free-shopping) ; [API Evangelist, Wevat](https://providers.apievangelist.com/providers/wevat/) ; [Global Blue France, Paris je t'aime](https://parisjetaime.com/pro/global-blue-france-p3964)

### Inferences
- FLŌW a déjà le paiement fractionné. Pour les titres-restaurant, il faut : un type de paiement « Titre-restaurant (carte) » et « Titre-restaurant (papier) », un marquage des produits éligibles (alimentaire), l'application du plafond journalier légal et le rendu de monnaie interdit sur le papier. Le TPE (SumUp/myPOS/banque) fait l'autorisation.
- Les modes de paiement chèque, chèque-vacances papier et ANCV Connect relèvent surtout d'une **liste de types de paiement configurables** dans la caisse, plus le rapprochement. Les lecteurs de chèques sont des périphériques série/USB (non recherchés).
- Pour une clientèle d'épicerie fine de luxe, l'intégration détaxe (Global Blue en priorité, Planet ensuite) et le DCC (fourni par l'acquéreur ou le TPE) comptent. American Express est géré au niveau de l'acquéreur ou du TPE.

### Gaps
- Je n'ai pas vérifié le plafond titres-restaurant 2026 (25 € par jour en 2023-2026 ; prolongation pour les produits non directement consommables : à vérifier sur le site officiel).
- Je n'ai trouvé aucune documentation développeur de Planet (ex-Premier Tax Free) ni de Global Blue (le portail développeur n'est pas apparu).
- Je n'ai pas couvert Lydia/Paylib (désormais absorbé par Wero), Alma/Oney (BNPL en magasin), la crypto ni le multidevise.

## 4. Monnayeurs automatiques (Glory CI-10, Cashlogy, SUZOHAPP)

### Takeaway
Les monnayeurs se pilotent depuis le logiciel de caisse sur le LAN. Le Glory CI-10 expose une interface **SOAP sur HTTP(S)**. L'intégration dépend du pilote de chaque éditeur de caisse : il n'y a pas de liste de compatibilité universelle.

### Cited Findings
- Glory CI-10 = module billets CI-10B + module pièces CI-10C, piloté par le logiciel de caisse, raccordé en LAN via l'interface « SOAP over HTTP(S) » (une source française écrit « SOPA », probablement une coquille). La capacité varie selon les sources (600 à 750 billets) — [HelloPro, top 10 des monnayeurs](https://conseils.hellopro.fr/top-10-des-marques-de-monnayeur-automatique-3105.html) ; [Brochure Glory PDF via HelloPro](https://www.hellopro.fr//documentation/pdf_prod/8/1/7/1184813_705584d15d11ef828ba005feed26e3f5.pdf)
- Fiducial Pointex vend les monnayeurs CI-10/CI-5, présentés comme certifiés UE et compatibles avec sa caisse certifiée NF525 — [Fiducial Pointex Monnayeur](https://www.fiducial.fr/Pointex/Monnayeur)
- Des intergiciels tiers (ImaCash) prennent en charge le Glory CI-10 — [ImaCash Glory](https://imaginaits.com/en/imacash/maquinas/glory/)

### Inferences
- Une interface SOAP/HTTP sur LAN reste inaccessible à une PWA HTTPS, à cause du contenu mixte, du CORS et des certificats auto-signés. FLŌW aurait besoin du même agent local que pour Caisse-AP. Priorité basse pour une petite boutique, plus haute pour la boulangerie et la grande distribution.

### Gaps
- Aucune donnée trouvée sur le protocole de Cashlogy (Azkoyen) ni de SUZOHAPP, ni sur les prix (souvent 4 000 à 8 000 € selon le marché, non sourcé ici).

## 5. Balances poids-prix et codes-barres à poids/prix variable

### Takeaway
En France, une balance utilisée dans la transaction doit être un instrument de métrologie légale certifié. Odoo signale lui-même ne pas être certifié pour une balance intégrée en France. L'approche la plus courante et la moins risquée pour une caisse logicielle : **balance étiqueteuse autonome + lecture d'un EAN-13 à prix intégré (préfixe 02/2x)** à la caisse. Je n'ai trouvé aucune source sur le « protocole Dialog 06 ».

### Cited Findings
- Odoo : la certification est légalement requise dans les États membres de l'UE pour utiliser une balance comme périphérique intégré. Odoo n'est pas certifié dans plusieurs pays, dont la France, l'Allemagne et la Suisse. La balance se branche en USB sur l'IoT Box — [Odoo 15, connecter une balance](https://www.odoo.com/documentation/15.0/fr/applications/general/iot/devices/scale.html)
- Square (FR) : le préfixe EAN-13 « 02 » indique un prix intégré, au format 02AAAAAPPPPPC (AAAAA = PLU, aussi saisi comme UGS de l'article). Les étiquettes de balance doivent encoder le prix, pas le poids — [Aide Square FR 7419](https://squareup.com/help/fr/fr/article/7419-scanning-bar-codes-from-label-printing-scales-on-point-of-sale)
- GS1 réserve les préfixes 020 à 029 à un usage interne au commerçant (structure laissée à chaque commerçant) — [EAN-13, Wikipédia (miroir)](https://wiki.krisyotam.com/content/wikipedia_en_all_nopic_2026-03/EAN13)
- Exemple de certificat LNE pour un système de caisse Mettler-Toledo UC3 avec module fiscal (exigences françaises d'inaltérabilité, de sécurisation, de conservation et d'archivage) — [Certificat LNE 34604-2 Mettler](https://www.mt.com/dam/product_organizations/Retail/2020docs/certificate_LNE_34604-2.pdf)

### Inferences
- FLŌW devrait au minimum décoder les EAN-13 à prix ou poids intégré, avec préfixe, longueur et position configurables (prix ou poids, décimales). C'est un ajout purement logiciel qui couvre fromagers, épiceries fines, traiteurs et primeurs avec une balance étiqueteuse certifiée. Une liaison directe caisse-balance demande une certification de métrologie légale et un pont série (WebSerial ou agent local) : à reporter.
- La tare et la gestion des articles au poids (prix au kg, quantité décimale) restent nécessaires même sans balance connectée (saisie manuelle du poids).

### Gaps
- « Dialog 06 » / protocole caisse-balance français : aucune source trouvée. Prix de Mettler/Bizerba/Dibal/Marel non relevés.

## 6. Afficheurs client, bornes, KDS, terminaux portables, étiquettes, étiquettes électroniques

### Takeaway
Les sources trouvées sont peu nombreuses. Dans Odoo, l'afficheur client est un écran relié à l'IoT Box ou une page web ouverte sur un second appareil. Pour une PWA, la même approche (deuxième onglet ou appareil synchronisé en temps réel) est la plus simple.

### Cited Findings
- Odoo : afficheur client = écran relié à l'IoT Box, qui montre la commande en cours. Il peut aussi être ouvert depuis un autre ordinateur via le bouton « POS Display » de la page d'accueil de l'IoT Box — [Odoo 13 IoT PdV](https://www.odoo.com/documentation/user/13.0/fr/iot/config/pos.html)
- Odoo 20 introduit « Obox » pour gérer les IoT Boxes (imprimantes, balances, caméras, TPE, Android). Source tierce testée sur une préversion — [Octura, Odoo 20 Obox](https://octurasolutions.com/fr/resources/odoo-20-obox-iot-imprimantes-balances-cameras-et-android)
- Hiboutik prend en charge les imprimantes d'étiquettes via sa liste de matériel compatible — [Matériel Hiboutik](https://hiboutik.com/en/hardware)
- Square vend le Square Register (2e génération, avec écran client intégré), le Square Terminal et le Square Stand en France. Le kit Register « à partir de 1 019 € » vient d'une source ancienne. Les terminaux coûtent de 19 à 165 € selon une source indépendante — [Comparatif matériel Square FR](https://squareup.com/fr/fr/hardware/compare) ; [independant.io avis Square](https://independant.io/avis/square/) ; [Communiqué Square Register FR](https://squareup.com/fr/fr/press/square-lance-square-register-et-square-pour-detaillants)

### Inferences
- Afficheur client pour FLŌW : une route « /affichage-client » synchronisée en temps réel (BroadcastChannel sur le même appareil avec un second écran, WebSocket entre appareils, ou l'API Window Management pour le second écran). Ajout logiciel peu coûteux.
- Étiquettes de prix : générer un PDF ou du ZPL (Zebra) ou passer par l'impression du navigateur. Les étiquettes électroniques (VusionGroup, Hanshow) passent par des API cloud des vendeurs : priorité basse.

### Gaps
- Aucune donnée de prix pour les bornes, KDS, Sunmi, PAX A920, ni pour les API VusionGroup ou Hanshow. Je n'ai pas pu lire les pages matériel de Tiller, Zelty, L'Addition, Cashmag, Zettle ni Clover dans le budget d'appels.

## 7. Fiabilité : hors ligne, bascule, secours 4G

### Takeaway
Les vrais paiements carte hors ligne existent (store-and-forward), mais le commerçant porte le risque de refus. Chez Stripe, ils ne sont **pas disponibles depuis le SDK JavaScript**. Les TPE autonomes avec SIM (SumUp Solo) offrent un secours 4G indépendant du Wi-Fi du magasin.

### Cited Findings
- Paiement hors ligne Stripe Terminal : stocké sur l'appareil, transmis à la reconnexion, plafond de 10 000 USD, risque de refus pour le commerçant. SDK mobiles, Java et .NET seulement, ni JS ni server-driven. Désinstaller l'application ou effacer son stockage fait perdre les paiements non transmis — [Stripe docs offline](https://docs.stripe.com/terminal/features/operate-offline/overview) ; [Stripe offline collect payments](https://docs.stripe.com/terminal/features/operate-offline/collect-card-payments)
- Le SumUp Solo est autonome, avec Wi-Fi et carte SIM intégrée. L'Air dépend d'un smartphone en Bluetooth — [ComparateurBanque, SumUp 2026](https://www.comparateurbanque.com/?p=156969)

### Inferences
- FLŌW encaisse déjà hors ligne. Pour les cartes, le scénario robuste est un TPE autonome avec SIM (SumUp Solo, TPE bancaire 4G) utilisé en « mode non intégré » : la caisse saisit « Carte (TPE externe) » et le rapprochement se fait plus tard. Il faut donc prévoir un mode de paiement « carte manuelle/externe » plus un rapprochement, en complément des intégrations SumUp et Stripe.

### Gaps
- Je n'ai pas vérifié le comportement hors ligne de SumUp ni d'Adyen, ni les conditions de « mode dégradé » des TPE bancaires (plafonds hors ligne EMV).

## Liste de priorités pour FLŌW (synthèse, inférences)
1. **Impression réelle de tickets** : Star CloudPRNT et WebPRNT, Epson ePOS (LAN). Ouverture du tiroir par l'imprimante, QR sur le ticket, routage vers l'imprimante cuisine.
2. **Agent local / pont** (Android/desktop) pour Caisse-AP sur IP (TPE bancaires), le monnayeur Glory (SOAP), les balances série, ESC/POS en USB. Une enveloppe native (TWA/Capacitor) débloquerait aussi Tap to Pay et la carte hors ligne.
3. **Moyens de paiement configurables** : titres-restaurant carte et papier (plafond, éligibilité, pas de rendu de monnaie), chèque, chèque-vacances papier et Connect, carte sur TPE externe, Amex, devises/DCC (au niveau de l'acquéreur).
4. **EAN-13 à prix ou poids intégré** (préfixe 02/2x configurable) + articles au poids et tare.
5. **Afficheur client** (second écran ou appareil) ; impression d'étiquettes (PDF/ZPL).
6. **Détaxe via l'API Global Blue** pour le luxe.
7. Plus tard : intégrations de monnayeurs, étiquettes électroniques, bornes et KDS.
