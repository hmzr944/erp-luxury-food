# Recette grandeur nature de FLŌW

Liste de contrôle à dérouler dans une vraie boutique, sur le vrai matériel, avant le premier commerçant en production. Priorités : impression des tickets en ESC/POS, ouverture du tiroir-caisse, dialogue avec un vrai TPE bancaire, et tout ce qu'une journée de vente réelle met à l'épreuve.

Les mêmes 147 cas sont dans `docs/recette-terrain.csv`, à ouvrir dans Excel ou Numbers pour cocher les résultats. Structure inspirée du skill `qa-test-planner` (softaworks/agent-toolkit, skills.sh) : plan, critères d'entrée et de sortie, suite fumée, suite complète, fiche d'anomalie.

Chaque résultat attendu a été relu dans le code de la branche `feat/plateforme-multi-secteurs`. Quand une fonction n'existe pas, le cas décrit le comportement actuel et renvoie à la liste des anomalies et limites connues (section 10) : un cas ne doit pas « échouer » parce qu'une fonction absente est absente. Les points juridiques sont marqués **à faire valider** : ils s'appuient sur `docs/legal`, `research_notes` et `reports`, rien de plus.

## 1. Objectifs et périmètre

**Objectifs**

- Prouver qu'un vendeur peut tenir une journée complète, de l'ouverture au Z, sans perdre une vente ni un euro.
- Vérifier sur papier chaque mention du ticket, et que la chaîne fiscale reste intacte (vente hors ligne, duplicata, formation, clôtures).
- Valider le matériel réellement visé : imprimante ESC/POS 80 mm réseau, tiroir sur l'imprimante, TPE Caisse-AP de la banque, TPE en ligne (SumUp, Stripe), douchette, balance étiqueteuse, iPad.
- Mesurer ce qui se passe quand tout va mal : réseau coupé, pont arrêté, imprimante sans papier, TPE qui ne répond plus, courant coupé.

**Dans le périmètre** : caisse web (`apps/web`, espace caisse et back-office utile au commerçant), FLŌW-Bridge (`apps/bridge`), API (`apps/api`) pour la synchronisation, les clôtures, les paiements en ligne et le support.

**Hors périmètre** : approvisionnement labo, atelier de production, B2B, API publique et webhooks, abonnement Stripe Billing, site vitrine, facturation électronique 2027. Fonctions absentes du produit, donc non testées : plan de salle et tables, TVA sur place / à emporter, monnayeur automatique, balance connectée (poids lu en direct), Tap to Pay, impression USB brute, paiement carte hors ligne en mode différé.

## 2. Comment utiliser ce document

- **Prio** : P0 bloquant (argent, légal, vente impossible), P1 indispensable au quotidien, P2 confort ou cas rare.
- **Banc** : le cas peut-il être répété sans matériel sur le banc d'essai (section 6) ? « Oui » : entièrement ; « Partiel » : seulement ce que FLŌW envoie ; « Non » : vrai matériel obligatoire. Les cas purement logiciels sont « Oui ».
- **Libellés** : les textes entre « » sont ceux de l'écran ou du papier, mot pour mot. Un écart de libellé est une anomalie mineure (P2), sauf s'il trompe le vendeur.
- Le menu « ⋮ » de la caisse s'appelle « Plus d'actions ». Les réglages du matériel de l'appareil sont dans ⋮ > « Imprimante, tiroir et TPE ».
- Remplir « Résultat / Remarques » avec OK, KO (et le n° de fiche d'anomalie) ou Bloqué. Photographier chaque ticket papier vérifié.

## 3. Matériel à réunir

### Postes de caisse

| Matériel | Usage | Prise en charge |
| --- | --- | --- |
| PC Windows 10 ou 11 x64, Chrome ou Edge | Caisse principale, pont `flow-bridge-windows-x64.exe` | Pris en charge |
| Mac Apple Silicon ou Intel, Safari ou Chrome | Caisse, pont `flow-bridge-macos-universal.zip` | Pris en charge (binaire non notarisé : avertissement Gatekeeper) |
| PC Linux x64 | Pont seul | Pris en charge (P2) |
| iPad récent, Safari, application installée | Caisse mobile | Caisse oui ; pont oui depuis le réseau de la boutique après installation du certificat (BRG-10) ; ePOS, AirPrint et TPE en ligne aussi |
| Tablette Android, Chrome | Caisse ou écran client | Caisse et écran client oui ; pont par le réseau à valider (non essayé) |
| PC Windows arm64, Raspberry Pi | Pont | Non pris en charge en exécutable (paquet Node.js seulement) |
| Second moniteur HDMI ou tablette | Écran client | Pris en charge |

### Impression et tiroir

| Matériel | Mode FLŌW | Prise en charge |
| --- | --- | --- |
| Imprimante ticket ESC/POS 80 mm **réseau** (Ethernet ou Wi-Fi, port RAW 9100) : Epson TM-m30III ou TM-T20III, Bixolon SRP-350, Sunmi | « Imprimante réseau » par le pont | Pris en charge, recommandé |
| Star (TSP143, mC-Print) réglée en **émulation ESC/POS** | « Imprimante réseau » | À valider (page de code, coupe) |
| Epson avec ePOS-Print (TM-m30, TM-T88VI) | « Epson ePOS en direct », sans pont, utilisable sur iPad | Pris en charge |
| Imprimante ticket 58 mm réseau | « Imprimante réseau », 32 caractères | Pris en charge (anomalie mineure IMP-04) |
| Imprimante ticket **USB** | « Imprimante de l’appareil » (pilote du système, fenêtre d'impression à chaque ticket) | Partiel : pas d'ESC/POS brut, pas de tiroir |
| Imprimante ticket série ou Bluetooth | | Non pris en charge |
| Tiroir-caisse 24 V sur la prise **RJ11/RJ12 de l'imprimante** (broche 2 ou 5) | Impulsion ESC/POS `ESC p` ou ePOS | Pris en charge en « Imprimante réseau » et « Epson ePOS en direct » |
| Tiroir USB ou à ouverture autonome | | Non pris en charge |
| Imprimante de bureau A4 Wi-Fi ou Ethernet (IPP, AirPrint) | Factures A4 : « Imprimante de bureau en direct » par le pont, ou « Fenêtre d’impression » | Pris en charge, IPP jamais essayé sur vrai matériel |
| Rouleaux 80 mm et 58 mm, un rouleau presque vide | Cas IMP-10 | |

### Paiement

| Matériel | Mode FLŌW | Prise en charge |
| --- | --- | --- |
| TPE de la banque Ingenico ou Verifone, **mode caisse IP Caisse-AP activé** par la banque ou l'installateur, IP fixe, port 8888 | « TPE Caisse-AP (réseau) » par le pont | Implémenté d'après une source publique, **jamais essayé sur un vrai TPE** : cœur de la recette |
| TPE Caisse-AP en USB ou série | | Non pris en charge |
| SumUp Solo (Wi-Fi ou 4G), compte SumUp avec clé API | « SumUp Solo », piloté en ligne | Pris en charge |
| Stripe Terminal S700 ou S710, compte Stripe | « Stripe Terminal », piloté en ligne | Pris en charge |
| Téléphone | « TPE virtuel », et paiement par QR (Stripe Checkout) | Pris en charge (essai et formation) |
| Cartes de paiement réelles du commerçant et petite somme (quelques euros), plan de remboursement | TPE-02 et suivants | |
| Chèques, titres-restaurant papier, carte titre-restaurant, chèques-vacances de test | PAI | Enregistrés en caisse ; la carte titre-restaurant se tape sur le TPE à la main |

### Articles et périphériques

| Matériel | Prise en charge |
| --- | --- |
| Douchette USB ou Bluetooth en émulation clavier, suffixe Entrée, **disposition AZERTY** | Pris en charge (le curseur doit être dans « Rechercher ou scanner ») |
| Balance étiqueteuse qui imprime des EAN-13 à prix (préfixe 20) ou poids (23) intégré | Pris en charge par lecture de l'étiquette |
| Balance reliée à la caisse (poids lu en direct) | Non pris en charge (saisie du poids à la main) |
| Produits réels avec codes-barres, dont un produit alimentaire absent du catalogue (Open Food Facts) | |
| Lecteur de badge NFC ou carte QR vendeur | Pris en charge (hors périmètre prioritaire) |
| Monnayeur automatique (Glory, Cashlogy) | Non pris en charge |

### Réseau

- Box internet dont on peut débrancher la prise WAN sans couper le réseau local, un switch, un point d'accès Wi-Fi.
- Partage de connexion 4G de secours.
- Feuille d'état réseau de l'imprimante et du TPE (adresses IP), multiprise pour couper le courant du poste.

## 4. Environnements

| Élément | Valeur à noter avant de commencer |
| --- | --- |
| Adresse de la caisse | production ou préproduction, en https |
| Version | « Version » affichée dans « Aide et support », version du pont (`flow-bridge --version`), commit déployé |
| Navigateurs | Chrome et Edge à jour (Windows), Safari et Chrome (macOS), Safari (iPadOS), Chrome (Android) |
| Comptes | un gérant (OWNER ou MANAGER), deux vendeurs avec code à 4 chiffres, une adresse e-mail de test |
| Organisation | Paramètres > Organisation complet (raison sociale, forme, SIRET, TVA, RCS, adresse du siège) |
| Fuseau | fuseau de la boutique réglé (les clôtures en dépendent) |

## 5. Critères d'entrée et de sortie

**Entrée** (tout doit être coché avant d'aller en boutique)

- [ ] Suite fumée passée sur le banc d'essai (section 6), sans anomalie P0.
- [ ] `pnpm --filter api test`, `pnpm --filter web test` et `pnpm --filter @erp/bridge test` verts sur le commit déployé.
- [ ] Exécutables du pont construits avec `FLOW_APP_URL` égal à l'adresse de la caisse, `NEXT_PUBLIC_BRIDGE_DOWNLOAD_BASE` réglée (sinon la caisse propose le paquet Node.js).
- [ ] Identité de l'éditeur configurée : la carte « Attestation de conformité » ne doit pas afficher « Bientôt disponible ».
- [ ] Support configuré (SUPPORT_AGENT_EMAILS, heures, délais), e-mails sortants fonctionnels.
- [ ] TPE Caisse-AP : mode caisse IP confirmé par écrit par la banque ou l'installateur, IP fixe. Comptes SumUp ou Stripe reliés.
- [ ] Balance réglée, préfixes notés et reportés dans « Options et balance ».
- [ ] Numéro de téléphone du support imprimé et posé près de la caisse (voir SUP-04).

**Sortie**

- Tous les P0 exécutés et OK, ou KO avec contournement accepté par écrit par le responsable produit.
- Au moins 90 % des P1 OK ; chaque KO P1 a une fiche et un contournement connu des vendeurs.
- Aucune anomalie bloquante ouverte.
- « Vérifier le grand livre » répond « Tout est intact » à la fin de la journée type.
- Chaque point « à faire valider » a un responsable et une date.

**Anomalie bloquante** (P0, arrête la mise en production) :

- argent sans vente (paiement accepté par le TPE sans vente enregistrée) ou vente sans argent ;
- double débit d'une carte ;
- vente perdue, en double, ou chaîne fiscale en anomalie ;
- ticket faux (montant, TVA, numéro) ou mention obligatoire manquante validée comme telle ;
- impossible d'encaisser plus de 5 minutes sans contournement ;
- tiroir qui ne s'ouvre ni par FLŌW ni par un contournement simple ;
- données d'une autre boutique ou d'un autre commerçant visibles.

## 6. Répétition sur banc d'essai

Avant de partir en boutique, dérouler la suite fumée sur le banc d'essai livré avec le pont (commit `341622e`, `apps/bridge/src/bench/`, section « Banc d'essai sans matériel » de `apps/bridge/README.md`). Il remplace le TPE et l'imprimante par deux logiciels sur un ordinateur du réseau :

```sh
pnpm --filter @erp/bridge build
pnpm --filter @erp/bridge banc               # faux TPE Caisse-AP (port 8888) et fausse imprimante ESC/POS (port 9100)
pnpm --filter @erp/bridge banc -- --manuel   # accepter, refuser ou abandonner chaque paiement au clavier
```

Options utiles : `tpe` ou `imprimante` pour n'en lancer qu'un, `--delai 3000` (durée d'une transaction), `--port-tpe`, `--port-imprimante`, `--dossier ./tickets` (copie brute de chaque travail). Le script affiche l'adresse à saisir dans FLŌW.

Réglages dans FLŌW : ⋮ > « Imprimante, tiroir et TPE », « Imprimante réseau » avec l'adresse et le port affichés ; « Envoyer les paiements par carte au TPE de la banque », « TPE Caisse-AP (réseau) », même adresse, port 8888, n° de caisse 01. Le pont reste le vrai pont, appairé normalement.

Ce que le banc montre :

- **Fausse imprimante** : chaque ticket reçu en texte, l'impulsion du tiroir (broche et durée), la coupe, le QR code, et les caractères hors PC858 signalés. On y vérifie le contenu de FIS-01, IMP-03, IMP-08, les marques DUPLICATA et MODE FORMATION, l'impulsion de TIR-02 à TIR-05.
- **Faux TPE** : le même protocole Caisse-AP qu'un vrai TPE. Il accepte tout et refuse les montants en ,13 ; en `--manuel` il accepte, refuse ou abandonne à la demande. On y répète TPE-02 à TPE-10 ; on arrête le banc pour simuler un TPE absent (TPE-07) ou coupé en plein paiement (TPE-08).

**Ce que le banc ne prouve pas.** Il vérifie ce que FLŌW envoie, pas ce que le matériel en fait : rendu réel des accents et de la page de code, qualité de la coupe et du QR imprimé, broche réelle du tiroir, papier absent ou capot ouvert, comportement d'un vrai TPE Ingenico ou Verifone (délais, messages, champs renvoyés, refus bancaires réels), douchette en AZERTY, étiquettes de balance réelles, iPad. Un cas « Partiel » passé sur le banc **doit être refait** sur le vrai matériel ; un cas « Non » ne peut se faire qu'en boutique. Le faux TPE est écrit d'après la même source publique que l'adaptateur Caisse-AP : il ne peut pas révéler une erreur d'interprétation du protocole.

## 7. Suite fumée (30 minutes)

À passer en premier, sur le banc puis en boutique. Au premier KO, s'arrêter et ouvrir une fiche : la suite complète n'a pas de sens si la fumée échoue. PAI-06 ne vaut que pour un métier alimentaire.

| Ordre | Cas | Ce qu'on vérifie | Banc | Résultat |
| --- | --- | --- | --- | --- |
| 1 | BRG-04 | Appairer la caisse avec le code | Oui | |
| 2 | IMP-03 | Ticket d'essai 80 mm : contenu et accents | Oui | |
| 3 | TIR-02 | Tiroir à l'encaissement en espèces | Partiel | |
| 4 | TPE-02 | Paiement carte accepté sur TPE Caisse-AP | Partiel | |
| 5 | TPE-03 | Paiement refusé sur TPE Caisse-AP | Oui | |
| 6 | PAI-02 | Espèces avec monnaie à rendre | Oui | |
| 7 | PAI-04 | Plafond espèces 1 000 € et non-résident 15 000 € | Oui | |
| 8 | PAI-06 | Titre-restaurant papier au-delà du plafond | Oui | |
| 9 | PAI-10 | Payer avec plusieurs moyens | Oui | |
| 10 | FIS-01 | Mentions du ticket de vente imprimé | Oui | |
| 11 | FIS-03 | Vente hors ligne signée puis envoyée | Oui | |
| 12 | FIS-06 | Duplicata numéroté | Oui | |
| 13 | RET-01 | Retour avec ticket, remboursement en espèces | Oui | |
| 14 | CAI-01 | Ouverture de caisse le matin | Partiel | |
| 15 | CAI-02 | Fermeture et comptage juste | Oui | |
| 16 | FIS-09 | Clôture journalière manuelle (Z) | Oui | |
| 17 | FIS-11 | Vérifier le grand livre | Oui | |
| 18 | SUP-01 | Demande urgente « La caisse ne peut plus encaisser » | Oui | |

## 8. Suite complète par domaine

Durée indicative : une journée et demie à deux, plus FIS-13 le premier jour du mois suivant. Ordre conseillé : BRG, IMP, TIR, TPE, puis la journée type (section 9), puis les autres domaines, RES en dernier.

| Domaine | Cas | P0 | P1 | P2 | Banc : oui / partiel / non |
| --- | --- | --- | --- | --- | --- |
| BRG FLŌW-Bridge : installation et appairage | 11 | 4 | 5 | 2 | 8 / 1 / 2 |
| IMP Impression des tickets | 16 | 7 | 8 | 1 | 8 / 3 / 5 |
| TIR Tiroir-caisse | 8 | 3 | 4 | 1 | 1 / 7 / 0 |
| TPE Terminal de paiement bancaire | 19 | 11 | 8 | 0 | 11 / 5 / 3 |
| QR Paiement par QR code | 3 | 0 | 2 | 1 | 3 / 0 / 0 |
| ECR Écran client | 3 | 0 | 2 | 1 | 2 / 1 / 0 |
| FIS Ticket légal et chaîne fiscale | 15 | 10 | 5 | 0 | 15 / 0 / 0 |
| PAI Moyens de paiement français | 13 | 9 | 4 | 0 | 13 / 0 / 0 |
| RET Retours, remboursements, échanges | 7 | 3 | 4 | 0 | 7 / 0 / 0 |
| ART Articles : douchette, balance, création, variantes, formules | 12 | 5 | 7 | 0 | 4 / 7 / 1 |
| FID Fidélité, cartes cadeaux, ticket dématérialisé, facture | 9 | 2 | 7 | 0 | 9 / 0 / 0 |
| CAI Espèces du tiroir, ouverture, fermeture, routines | 9 | 4 | 5 | 0 | 8 / 1 / 0 |
| ONB Inscription, mode découverte, import | 8 | 3 | 5 | 0 | 7 / 0 / 1 |
| SUP Aide et support dans l'application | 4 | 2 | 2 | 0 | 4 / 0 / 0 |
| RES Résilience : réseau, courant, plusieurs caisses, iPad | 10 | 5 | 4 | 1 | 8 / 1 / 1 |
| **Total** | **147** | **68** | **72** | **7** | 108 / 26 / 13 |

### BRG : FLŌW-Bridge : installation et appairage

Le pont tourne sur l'ordinateur de la caisse et pilote imprimante réseau, tiroir et TPE Caisse-AP. Sources : `docs/flow-bridge-executables.md`, `apps/bridge/README.md`, `apps/web/src/components/settings/BridgePairing.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BRG-01 | P0 | Oui | Télécharger et lancer le pont sous Windows | PC Windows 10 ou 11 (x64) de la caisse, caisse ouverte dans Chrome ou Edge sur ce PC, connecté en gérant, pont jamais installé. | 1. Ouvrir menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE ».<br>2. Choisir « Imprimante réseau ». Le bloc FLŌW-Bridge affiche « Introuvable ».<br>3. Cliquer « Télécharger pour Windows », ouvrir le fichier.<br>4. Si Windows affiche « Windows a protégé votre ordinateur » : « Informations complémentaires », puis « Exécuter quand même ». | Une fenêtre noire s'ouvre et affiche « Code d'appairage : XXX XXX », valable 10 minutes, et rappelle de laisser la fenêtre ouverte. Si la caisse propose au lieu du bouton « Installez Node.js 22 », la variable NEXT_PUBLIC_BRIDGE_DOWNLOAD_BASE n'est pas réglée : anomalie de déploiement, à remonter. | |
| BRG-02 | P1 | Oui | Télécharger et lancer le pont sous macOS | Mac (Apple Silicon ou Intel), caisse ouverte dans Safari ou Chrome. | 1. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », « Imprimante réseau », « Télécharger pour macOS ».<br>2. Ouvrir le .zip, puis FLOW-Bridge.<br>3. Au blocage : clic droit, Ouvrir. Sur macOS 15 : Réglages Système, Confidentialité et sécurité, « Ouvrir quand même ». | Le code d'appairage s'affiche. L'avertissement de Gatekeeper est attendu (binaire non notarisé, voir `docs/flow-bridge-executables.md`). | |
| BRG-03 | P2 | Oui | Lancer le pont sous Linux | PC Linux x64. | 1. Télécharger « Linux ».<br>2. Rendre le fichier exécutable (chmod +x) et le lancer. | Le code d'appairage s'affiche. | |
| BRG-04 | P0 | Oui | Appairer la caisse avec le code | BRG-01 ou BRG-02 fait, code affiché depuis moins de 10 minutes. | 1. Dans le bloc FLŌW-Bridge, saisir le code dans « Code d’appairage ».<br>2. Cliquer « Appairer ».<br>3. Recharger la page de la caisse. | La pastille passe à « Connecté ». Après rechargement, elle repasse seule à « Connecté », sans nouveau code. | |
| BRG-05 | P1 | Oui | Code d'appairage faux, puis trop d'essais | Pont lancé, caisse non appairée. | 1. Saisir un code faux, « Appairer ».<br>2. Recommencer jusqu'à cinq codes faux.<br>3. Saisir aussitôt le nouveau code affiché par le pont. | 1er essai : « Code incorrect (4 essais restants). » 5e essai : « Code incorrect. Trop d'essais : un nouveau code est affiché sur l'ordinateur du pont. » Pendant 30 s : « Trop d'essais. Réessayez dans N secondes avec le nouveau code. » Ensuite le nouveau code fonctionne. | |
| BRG-06 | P1 | Oui | Code expiré | Pont lancé depuis plus de 10 minutes, caisse non appairée. | 1. Saisir le code affiché au lancement, « Appairer ». | « Aucun code d'appairage actif. Lancez « flow-bridge pair » sur l'ordinateur du pont. » Relancer l'exécutable affiche un nouveau code qui fonctionne. | |
| BRG-07 | P0 | Oui | Pont fermé puis relancé | Caisse appairée, imprimante réseau réglée. | 1. Fermer la fenêtre du pont.<br>2. Regarder menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE ».<br>3. Faire une vente en espèces et imprimer le ticket.<br>4. Relancer le pont (double-clic), sans saisir de code. | Pont fermé : pastille « Introuvable » ; l'impression échoue avec « FLŌW-Bridge injoignable sur cet appareil », la vente est quand même enregistrée. Pont relancé : pastille « Connecté » en quelques secondes, sans nouvel appairage (le code affiché peut être ignoré). « Réessayer l’impression » imprime. | |
| BRG-08 | P1 | Partiel | Redémarrage de l'ordinateur | Pont lancé et appairé. | 1. Redémarrer le PC.<br>2. Ouvrir la caisse sans relancer le pont.<br>3. Relancer le pont. | Limite connue : le pont ne démarre pas seul (voir « Faire tourner le pont en service » dans `apps/bridge/README.md`). Pastille « Introuvable » jusqu'au lancement, puis « Connecté » sans nouvel appairage. Noter le temps perdu et si un service (NSSM, launchd) a été installé. | |
| BRG-09 | P2 | Oui | Deuxième lancement du pont sur le même PC | Un pont déjà lancé. | 1. Lancer l'exécutable une seconde fois. | Sous Windows, la seconde fenêtre affiche une erreur (port déjà utilisé) et attend la touche Entrée avant de se fermer. Le premier pont continue de fonctionner. | |
| BRG-10 | P0 | Non | iPad : pont sur le réseau de la boutique | Pont lancé sur le PC de la boutique, iPad sur le même réseau Wi-Fi, caisse ouverte dans Safari sur l'iPad. | 1. Sur le PC, dans la caisse : menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », activer « Accès des iPad du magasin ». Noter l'adresse et l'empreinte affichées.<br>2. Sur l'iPad : ouvrir http://<adresse du PC>:51717/certificat, « Autoriser ». Réglages, « Profil téléchargé », « Installer ».<br>3. Réglages, Général, Informations, « Réglages des certificats » : activer la confiance totale pour « FLŌW-Bridge ».<br>4. Dans la caisse sur l'iPad : saisir l'« Adresse du pont », « Tester la connexion sécurisée », puis saisir le code d'appairage.<br>5. Faire une vente « Carte » et imprimer. | Le test affiche « Connexion sécurisée établie : le certificat est approuvé… ». Après appairage, le ticket sort sur l'imprimante du pont et le montant part au TPE Caisse-AP. Sans l'étape 3 : « Connexion sécurisée impossible : le certificat n’est pas encore approuvé sur cet appareil, ou le pont est injoignable. » À noter : libellé exact du bouton de téléchargement du profil sur iPadOS (non documenté par Apple), et toute demande d'accès au réseau local. | |
| BRG-11 | P1 | Non | Safari sur Mac : certificat du pont | Pont lancé sur le Mac, caisse ouverte dans Safari sur ce Mac. | 1. Menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », télécharger le certificat du pont, l'ouvrir depuis Téléchargements.<br>2. Dans Trousseaux d'accès, double-cliquer « FLŌW-Bridge », « Se fier », « Toujours approuver », confirmer avec le mot de passe du Mac.<br>3. « Tester la connexion sécurisée », puis appairer et imprimer un ticket d'essai. | Le test affiche « Connexion sécurisée établie… », le ticket d'essai sort. Chrome et Edge sur le même Mac n'ont besoin d'aucune étape. | |

### IMP : Impression des tickets

Trois modes par appareil : « Imprimante réseau » (ESC/POS par le pont, port 9100), « Epson ePOS en direct », « Imprimante de l’appareil » (fenêtre d'impression). Sources : `apps/web/src/lib/printing/`, `PrinterDevice.tsx`, `receipt-ticket.ts`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IMP-01 | P0 | Partiel | Détecter l'imprimante ticket réseau | Imprimante ESC/POS réseau allumée sur le même réseau que le PC du pont, pont « Connecté ». | 1. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », « Imprimante réseau ».<br>2. Cliquer « Détecter les imprimantes ».<br>3. Choisir l'imprimante dans la liste.<br>4. Cliquer « Enregistrer ». | La liste montre le modèle (ou le nom) et l'adresse IP. Le choix remplit « Adresse de l’imprimante » et « Port » (9100). « Réglage enregistré sur cet appareil ». Remarque : la détection mDNS n'a jamais été essayée sur un vrai réseau de magasin (`apps/bridge/README.md`), noter le résultat. | |
| IMP-02 | P1 | Oui | Imprimante non détectée, adresse saisie à la main | Imprimante sur un autre sous-réseau, ou annonce mDNS coupée. | 1. « Détecter les imprimantes ».<br>2. Saisir l'adresse IP imprimée sur la feuille d'état de l'imprimante, « Enregistrer », « Ticket d’essai ». | « Aucune imprimante trouvée. Vérifiez qu’elle est allumée et sur le même réseau que l’ordinateur du pont, ou saisissez son adresse. » Avec l'adresse saisie, le ticket d'essai sort. | |
| IMP-03 | P0 | Oui | Ticket d'essai 80 mm : contenu et accents | IMP-01 fait, largeur « 80 mm (48 caractères) ». | 1. Cliquer « Ticket d’essai ».<br>2. Lire le papier ligne à ligne. | Message « Ticket d’essai envoyé ». Sur le papier : « *** MODE FORMATION *** » et « *** TICKET FICTIF SANS VALEUR *** » en haut et en bas, « Ticket d’essai », mentions légales de l'organisation, « TICKET », Date, « Ticket fictif n° ESSAI », « Caisse Cette caisse », « Opérateur Essai d’impression », « 1 x Article d’essai éèàç € » à 1,00 avec la lettre A, « TOTAL TTC 1,00 EUR », tableau TVA « A 20 % 0,83 0,17 1,00 », « Essai 1,00 », « Merci de votre visite », « FLOW 1.0.0 » (le Ō est imprimé O). Accents et € lisibles (page de code PC858). Pas de signature ni de QR code. Coupe partielle du papier. | |
| IMP-04 | P1 | Partiel | Papier 58 mm | Imprimante 58 mm ESC/POS réseau. | 1. Choisir « 58 mm (32 caractères) », « Enregistrer ».<br>2. Imprimer une vente avec deux taux de TVA (5,5 % et 20 %). | Aucune ligne ne déborde ni ne passe à la ligne de travers. Anomalie connue : sur le tableau TVA, le signe % est coupé (« A 5,5 » au lieu de « A 5,5 % »), voir anomalies connues. | |
| IMP-05 | P0 | Oui | Politique « Sur demande » (loi AGEC) | Paramètres > Impression : « Sur demande ». Vente sans produit pesé, sans n° de série, note de service désactivée. | 1. Vendre un article en carte ou en espèces.<br>2. Sur « Vente enregistrée », ne rien toucher, puis cliquer « Imprimer le ticket ». | Rien ne s'imprime d'office. Le bouton imprime le ticket, puis affiche « Ticket imprimé » et se grise. Même comportement avec « Jamais d’office ». | |
| IMP-06 | P0 | Oui | Politique « Toujours » | Paramètres > Impression : « Toujours ». | 1. Faire trois ventes de suite, « Vente suivante » entre chaque. | Chaque vente imprime son ticket d'office, une seule fois. Aucun ticket en double. | |
| IMP-07 | P0 | Oui | Impression forcée : produit pesé et pièce numérotée | Politique « Sur demande ». Un produit au poids et un produit suivi par n° de série au catalogue. | 1. Vendre un produit pesé (poids saisi ou étiquette de balance).<br>2. Vendre une pièce avec n° de série. | Les deux tickets s'impriment d'office malgré « Sur demande » (règle de `receipt-ticket.ts`, tirée de `reports/`). À faire valider : liste exacte des exceptions de l'art. D541-371 C. env., notamment la mention de garantie légale de conformité qui n'est pas imprimée sur le ticket. | |
| IMP-08 | P1 | Oui | Note de service à partir de 25 € TTC | Paramètres > Impression : cocher « Note de service à partir de 25 € TTC », « Enregistrer ». | 1. Vendre pour 24,99 €.<br>2. Vendre pour 25,00 €. | 24,99 € : comportement normal (ticket selon la politique). 25,00 € : deux impressions d'office. La première a pour titre « NOTE », « Note n° N » et le QR code ; la seconde porte « *** DOUBLE CONSERVÉ PAR LE COMMERÇANT *** », sans QR code. À faire valider : mentions de l'arrêté 83-50/A (nom du client, date et lieu de la prestation, total HT) non imprimées en tant que telles. | |
| IMP-09 | P0 | Oui | Imprimante éteinte au moment du ticket | Imprimante réseau réglée, politique « Toujours ». | 1. Éteindre l'imprimante.<br>2. Faire une vente en espèces.<br>3. Rallumer l'imprimante, cliquer « Réessayer l’impression ». | « Vente enregistrée » s'affiche quand même. Message d'erreur du type « Imprimante injoignable à 192.168.x.x:9100 (connexion refusée). », « (appareil absent du réseau) » ou « Délai dépassé : l'imprimante … ne répond pas. » (8 s). Le bouton devient « Réessayer l’impression » et imprime une fois l'imprimante rallumée. Une seule vente dans Commandes. | |
| IMP-10 | P0 | Non | Fin de rouleau de papier | Rouleau presque vide ou retiré, imprimante réseau. | 1. Faire une vente et lancer l'impression.<br>2. Observer la caisse et l'imprimante (voyant).<br>3. Remettre un rouleau.<br>4. Si rien n'est sorti : Commandes > la vente > « Réimprimer (duplicata) ». | Comportement actuel : FLŌW ne lit pas l'état de l'imprimante, il peut afficher « Ticket imprimé » alors que rien n'est sorti (limite connue). Noter si l'imprimante sort le ticket en attente après le changement de rouleau. Le duplicata sort avec « *** DUPLICATA N° 1 *** ». | |
| IMP-11 | P1 | Non | Capot ouvert pendant l'impression | Imprimante réseau. | 1. Ouvrir le capot.<br>2. Faire une vente avec impression.<br>3. Refermer le capot. | Même limite qu'IMP-10 : pas d'alerte dans FLŌW. Noter ce que fait l'imprimante (ticket gardé en mémoire ou perdu) et le message éventuel. | |
| IMP-12 | P1 | Oui | Deux tickets envoyés en même temps | Deux caisses (deux onglets ou deux postes) réglées sur la même imprimante. | 1. Valider une vente sur chaque caisse à la même seconde. | Deux tickets complets, jamais mélangés ligne à ligne. Remarque : la file d'attente n'existe qu'à l'intérieur d'un même pont (`printer.ts`) ; avec deux PC et deux ponts, noter le comportement de l'imprimante. | |
| IMP-13 | P1 | Non | Epson ePOS en direct (sans pont) | Epson compatible ePOS-Print (TM-m30, TM-T88VI...), ePOS-Print activé dans la configuration web de l'imprimante. | 1. Ouvrir une fois https://<adresse de l'imprimante> dans le navigateur de la caisse et accepter le certificat.<br>2. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », « Epson ePOS en direct », saisir l'adresse, « Enregistrer ».<br>3. « Ticket d’essai », puis « Ouvrir le tiroir ». | Le ticket sort, le tiroir s'ouvre. Sans l'étape 1 : « Imprimante Epson injoignable à X. Ouvrez https://X une fois pour accepter son certificat. » Mode utilisable sur iPad. | |
| IMP-14 | P1 | Non | Imprimante de l'appareil (USB ou AirPrint) | Imprimante ticket USB installée avec son pilote sur le PC, ou imprimante AirPrint pour iPad et Mac. | 1. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », « Imprimante de l’appareil », « Enregistrer ».<br>2. Faire une vente et imprimer. | La fenêtre d'impression du navigateur s'ouvre à chaque ticket ; choisir l'imprimante ; ticket mis en page à 80 mm avec QR code. Les réglages du tiroir ne s'affichent pas : pas d'ouverture du tiroir dans ce mode (non pris en charge). | |
| IMP-15 | P2 | Non | Facture A4 sur imprimante de bureau en direct (IPP) | Imprimante de bureau Wi-Fi ou Ethernet (HP, Brother, Epson, Canon), pont « Connecté ». | 1. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », bloc « Factures A4 », « Imprimante de bureau en direct ».<br>2. « Détecter les imprimantes », choisir, « Enregistrer ».<br>3. Émettre une facture entreprise (FID-09) et l'imprimer. | La facture sort en A4 sans fenêtre d'impression. Si l'imprimante n'accepte pas le PDF, message d'erreur clair : repasser sur « Fenêtre d’impression ». Remarque : IPP jamais essayé sur une vraie imprimante (`apps/bridge/README.md`). | |
| IMP-16 | P1 | Partiel | Caractères spéciaux des désignations | Produits nommés avec œ, apostrophe typographique ’, guillemets « », °, et un nom de plus de 40 caractères. | 1. Vendre ces produits, imprimer. | œ imprimé « oe », ’ imprimé ', « » et ° lisibles, aucun « ? » à la place d'un accent courant. Le nom long est coupé proprement, le montant reste aligné à droite. Sur Star en émulation ESC/POS et sur les imprimantes génériques, vérifier la page de code (accents). | |

### TIR : Tiroir-caisse

Le tiroir est branché sur la prise RJ11/RJ12 de l'imprimante ticket. Il s'ouvre seulement en mode « Imprimante réseau » ou « Epson ePOS en direct ». Source : `apps/web/src/lib/printing/printer.ts`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TIR-01 | P0 | Partiel | Ouvrir le tiroir depuis les réglages | Tiroir branché en RJ11/RJ12 sur l'imprimante ticket, mode « Imprimante réseau » ou « Epson ePOS en direct ». | 1. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », « Tiroir-caisse » : « Branché sur l’imprimante (broche 2) ».<br>2. Cliquer « Ouvrir le tiroir ». | Le tiroir s'ouvre. Message « Tiroir ouvert ». | |
| TIR-02 | P0 | Partiel | Tiroir à l'encaissement en espèces | Case « Ouvrir le tiroir à chaque paiement en espèces » cochée (valeur par défaut). | 1. Politique « Sur demande » : vendre en espèces.<br>2. Politique « Toujours » : vendre en espèces. | Dans les deux cas le tiroir s'ouvre une fois à la validation. Avec « Toujours », il s'ouvre au début de l'impression du ticket. | |
| TIR-03 | P0 | Partiel | Pas de tiroir pour carte et chèque | TIR-02 réglé. | 1. Vendre en carte.<br>2. Vendre en chèque. | Le tiroir ne s'ouvre pas (seul un paiement de type espèces l'ouvre). Le chèque se range à la clé ou via « Ouvrir le tiroir ». | |
| TIR-04 | P1 | Partiel | Paiement mixte espèces et carte | TIR-02 réglé. | 1. « Payer avec plusieurs moyens » : une part en espèces, le reste en carte. | Le tiroir s'ouvre une fois. | |
| TIR-05 | P1 | Partiel | Ouverture automatique désactivée | Décocher « Ouvrir le tiroir à chaque paiement en espèces », « Enregistrer ». | 1. Vendre en espèces. | Le tiroir ne s'ouvre pas. « Ouvrir le tiroir » dans la feuille de réglages fonctionne toujours. | |
| TIR-06 | P1 | Partiel | Mauvaise broche | Tiroir qui ne répond pas sur la broche 2. | 1. Choisir « Second tiroir (broche 5) », « Enregistrer », « Ouvrir le tiroir ». | Le tiroir s'ouvre sur la broche qui lui correspond. Noter la broche qui marche pour ce modèle. | |
| TIR-07 | P1 | Partiel | Imprimante éteinte lors d'un paiement en espèces | TIR-02 réglé. | 1. Éteindre l'imprimante, vendre en espèces.<br>2. Rallumer, cliquer « Réessayer l’impression ».<br>3. Ouvrir le tiroir par menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE » > « Ouvrir le tiroir ». | La vente est enregistrée, le tiroir ne s'ouvre pas, message d'erreur de l'imprimante. Anomalie connue : « Réessayer l’impression » imprime sans ouvrir le tiroir ; l'ouverture se fait par la feuille de réglages ou à la clé. | |
| TIR-08 | P2 | Oui | Tiroir avec « Imprimante de l’appareil » | Mode « Imprimante de l’appareil ». | 1. Ouvrir menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE ». | Ni « Tiroir-caisse », ni « Ouvrir le tiroir » : non pris en charge dans ce mode (seul le pilote de l'imprimante pourrait le faire, hors FLŌW). | |

### TPE : Terminal de paiement bancaire

Deux familles : TPE de la banque en Caisse-AP sur IP par le pont (`apps/bridge/src/payment/caisse-ap.ts`, jamais essayé sur un vrai TPE) et TPE connectés en ligne : SumUp Solo, Stripe Terminal, TPE virtuel (`apps/api/src/payments/connectors`).

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TPE-01 | P0 | Oui | Régler un TPE de la banque en Caisse-AP | TPE Ingenico ou Verifone avec le mode « caisse IP » (Caisse-AP) activé par la banque ou l'installateur, adresse IP fixe connue, sur le réseau de la boutique. Pont « Connecté ». | 1. menu ⋮ (Plus d'actions) > « Imprimante, tiroir et TPE », partie « TPE bancaire ».<br>2. Cocher « Envoyer les paiements par carte au TPE de la banque ».<br>3. Terminal : « TPE Caisse-AP (réseau) ». Saisir « Adresse du TPE », « Port » (8888 par défaut), « N° de caisse » sur deux chiffres (01).<br>4. « Enregistrer ». | « Réglage enregistré sur cet appareil ». Attention : un n° de caisse d'un seul chiffre est accepté ici mais refusé au paiement (« Numéro de caisse invalide (2 chiffres). »). | |
| TPE-02 | P0 | Partiel | Paiement carte accepté sur TPE Caisse-AP | TPE-01 fait. Petite somme réelle (1,00 €), carte de test du commerçant. | 1. Ajouter un article à 1,00 €, « Encaisser », « Carte ».<br>2. Payer sur le TPE (sans contact puis avec code).<br>3. Comparer le ticket du TPE et le ticket FLŌW. | Titre « Paiement sur le TPE », montant 1,00 €, message « Montant envoyé au terminal. Suivez les instructions du TPE. » Le TPE affiche 1,00 €. À l'acceptation, la caisse passe seule à « Vente enregistrée ». Ticket FLŌW : « Carte 1,00 » et une ligne « Réf. » avec les identifiants renvoyés par le TPE s'il y en a. Point critique : Caisse-AP n'a jamais été essayé sur un vrai TPE, garder les deux tickets et le journal du pont. | |
| TPE-03 | P0 | Oui | Paiement refusé sur TPE Caisse-AP | TPE-01 fait. | 1. « Encaisser », « Carte ».<br>2. Provoquer un refus (code faux trois fois, carte opposée de test). | Message « Paiement non abouti : <motif>. » (ou « Paiement non abouti. »), boutons « Renvoyer au TPE » et « Autre moyen de paiement ». Aucune vente enregistrée, le panier est intact. | |
| TPE-04 | P0 | Oui | Abandon sur le TPE (touche rouge) | TPE-01 fait. | 1. « Encaisser », « Carte ».<br>2. Appuyer sur la touche rouge du TPE. | La caisse affiche l'échec (« Paiement non abouti : … ») avec « Renvoyer au TPE » et « Autre moyen de paiement ». Aucune vente enregistrée. | |
| TPE-05 | P0 | Oui | « Annuler » sur la caisse pendant l'attente du TPE | TPE-01 fait. | 1. « Encaisser », « Carte ».<br>2. Cliquer « Annuler » sur la caisse sans toucher le TPE.<br>3. Regarder le TPE, puis appuyer sur sa touche rouge.<br>4. Retoucher « Carte ». | La caisse affiche « Annulez sur le TPE (touche rouge). La caisse attend sa réponse. » et reste sur l'attente (Caisse-AP ne s'annule pas à distance). Après la touche rouge, le TPE répond « abandon » et la caisse affiche l'échec avec « Renvoyer au TPE » et « Autre moyen de paiement ». Si le client paie malgré tout, la vente s'enregistre normalement. | |
| TPE-06 | P0 | Partiel | Client qui ne fait rien : délai | TPE-01 fait. | 1. « Encaisser », « Carte ».<br>2. Ne rien faire sur le TPE pendant 3 minutes. | Le TPE abandonne de lui-même (refus « abandon ») ou, à 180 s, la caisse affiche « Aucune réponse du terminal dans le délai. Vérifiez sur le TPE si le paiement est passé avant d'encaisser à nouveau. » Noter lequel arrive en premier. | |
| TPE-07 | P0 | Oui | TPE éteint ou absent du réseau avant le paiement | TPE-01 fait. | 1. Débrancher le TPE du réseau (ou l'éteindre).<br>2. « Encaisser », « Carte ». | « Terminal de paiement injoignable à … (connexion refusée). Vérifiez que le mode caisse IP est activé sur le TPE. » ou « … (absent du réseau). », sans « Vérifiez le ticket du TPE » puisque rien n'est parti. Aucune vente. | |
| TPE-08 | P0 | Partiel | Coupure du TPE en plein paiement | TPE-01 fait. | 1. « Encaisser », « Carte ».<br>2. Le client présente sa carte ; débrancher le câble réseau du TPE avant la réponse.<br>3. Lire le ticket du TPE. | Message d'erreur terminé par « Vérifiez le ticket du TPE. », ou bien « Issue du paiement inconnue. Regardez l’écran ou le ticket du TPE avant de renvoyer le montant. » Si le TPE a accepté : NE PAS renvoyer au TPE, toucher « Le TPE a accepté : enregistrer la vente ». Aucune vente en double. | |
| TPE-09 | P0 | Oui | Pont arrêté en plein paiement | TPE-01 fait. | 1. « Encaisser », « Carte ».<br>2. Fermer la fenêtre du pont pendant que le client paie.<br>3. Relancer le pont. | La caisse affiche « Liaison avec FLŌW-Bridge perdue, nouvelle tentative... » puis, une fois le pont relancé, interroge le pont sur l'issue du paiement. Un pont relancé ne connaît plus le paiement : la caisse affiche « Issue du paiement inconnue… » avec « Le TPE a accepté : enregistrer la vente ». Vérifier le ticket du TPE avant de choisir. | |
| TPE-10 | P1 | Oui | Page de la caisse rechargée en plein paiement | TPE-01 fait. | 1. XX<br>2. Appuyer sur F5 (ou fermer l'onglet) pendant que le client paie. | Le panier est perdu au rechargement (gardé en mémoire seulement). Au nouvel « Encaisser », « Carte » du même montant, la caisse affiche « Reprise du paiement en cours... » et retrouve l'issue auprès du pont sans renvoyer le montant au TPE : le TPE n'affiche pas de seconde demande, la vente s'enregistre une seule fois. | |
| TPE-11 | P1 | Oui | TPE simulé par le pont | Pont « Connecté ». | 1. TPE bancaire : Terminal « TPE simulé par le pont (essai) », « Enregistrer ».<br>2. Encaisser 10,00 € en « Carte ».<br>3. Encaisser 10,13 € en « Carte ». | 10,00 € : étapes « Présentez la carte », « Carte lue », « Code saisi », « Autorisation en cours », puis « Vente enregistrée » (environ 2 s). 10,13 € : « Paiement refusé (simulation). » Aucun débit réel. | |
| TPE-12 | P0 | Non | SumUp Solo relié en ligne | Compte SumUp relié dans Paramètres > Paiement (« Relier le compte »), lecteur Solo en Wi-Fi ou 4G, appairé par « Relier ce TPE » avec le code du Solo (Connexions, API, Connecter). | 1. Vendre 1,00 €, « Encaisser », « Carte ».<br>2. Payer sur le Solo.<br>3. Refaire avec un refus. | « Envoi à « <nom du TPE> »... », puis « Le client paie sur « <nom> ». » ; à l'acceptation, « Vente enregistrée » sans rien toucher. Refus : « Paiement refusé. » ou le motif, avec « Renvoyer au TPE ». | |
| TPE-13 | P0 | Non | Stripe Terminal S700 ou S710 relié en ligne | Compte Stripe relié (clé secrète sk_), lecteur appairé avec son code d'appairage. | 1. Vendre 1,00 € en « Carte », payer sur le lecteur. | Même parcours que TPE-12. La vente se ferme seule à l'acceptation. | |
| TPE-14 | P1 | Non | TPE en ligne occupé | TPE-12 ou TPE-13 fait. | 1. Lancer un paiement, ne pas payer.<br>2. Depuis une autre caisse (ou après « Annuler »), relancer un paiement sur le même TPE. | Message d'échec indiquant que le TPE attend déjà un paiement ; le bouton devient « Libérer le TPE et renvoyer » et relance proprement. | |
| TPE-15 | P1 | Oui | « Le client a payé sur un autre TPE » | TPE relié (Caisse-AP ou en ligne). | 1. « Encaisser », « Carte ».<br>2. Pendant l'attente, cliquer « Le client a payé sur un autre TPE ». | La demande au TPE est annulée côté caisse et la vente est enregistrée en carte, sans référence TPE. À réserver au vendeur qui a vu le ticket accepté. | |
| TPE-16 | P1 | Oui | TPE virtuel (téléphone) | Paramètres > Paiement > « TPE virtuel » ajouté (« TPE virtuel ajouté »). | 1. « Encaisser », « Carte ».<br>2. Répondre sur la caisse ou ouvrir le lien sur un téléphone : « Carte acceptée », puis refaire avec « Carte refusée ». | Accepté : la vente se ferme seule. Refusé : message d'échec, aucune vente. Aucun débit réel. | |
| TPE-17 | P1 | Partiel | Caisse hors ligne avec un TPE en ligne | TPE-12 ou TPE-13 fait, pas de TPE Caisse-AP activé. Couper internet (prise WAN de la box). | 1. « Encaisser », « Carte ». | Comportement actuel : la vente est enregistrée aussitôt en carte, sans envoi au TPE (TPE autonome). Le vendeur doit encaisser sur le TPE à la main, s'il fonctionne sans la caisse. Consigne à vérifier avec le commerçant. | |
| TPE-18 | P1 | Oui | Note divisée et plusieurs moyens avec le TPE Caisse-AP | TPE-01 fait. | 1. « Diviser la note » en 2 parts, payer une part en « Carte ».<br>2. Sur une autre vente, « Payer avec plusieurs moyens » avec une part carte. | Comportement actuel : la part carte est enregistrée sans envoi au TPE Caisse-AP ; il faut taper le montant sur le TPE. (Avec un TPE en ligne, « Diviser la note » envoie bien chaque part au TPE.) Voir anomalies connues. | |
| TPE-19 | P1 | Partiel | Deux caisses et un seul TPE Caisse-AP | Deux postes, chacun avec son pont, réglés sur le même TPE. | 1. Lancer un paiement carte sur la caisse 1.<br>2. Pendant ce temps, lancer un paiement carte sur la caisse 2. | Le TPE ne doit traiter qu'un montant. Noter le message affiché par la caisse 2 (le verrou « Un paiement est déjà en cours sur ce terminal. » n'existe qu'à l'intérieur d'un même pont). | |

### QR : Paiement par QR code

Stripe Checkout (ou TPE virtuel pour essayer), en ligne uniquement. Source : `QrPayWait.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QR-01 | P1 | Oui | Paiement par QR code sur le téléphone du client | Caisse en ligne, hors mode formation, compte Stripe relié (ou TPE virtuel), total d'au moins 1 €. Écran client relié (ECR-01 ou ECR-02). | 1. « Encaisser », « QR code, paiement sur le téléphone du client ».<br>2. Scanner le QR (caisse ou écran client) avec un téléphone, payer. | « Préparation du QR code… », puis le QR s'affiche sur la caisse et l'écran client avec « Le client scanne le code sur l’écran client ou ici, puis paie sur son téléphone. » Après paiement, la caisse passe seule à « Vente enregistrée ». | |
| QR-02 | P1 | Oui | QR code abandonné | QR-01 en cours. | 1. Cliquer « Annuler le QR code ». | Retour aux moyens de paiement, le QR disparaît de l'écran client, aucune vente. Le lien ne doit plus permettre de payer. | |
| QR-03 | P2 | Oui | QR code indisponible hors ligne ou en formation | Caisse hors ligne, ou mode formation actif. | 1. « Encaisser ». | Le bouton « QR code, paiement sur le téléphone du client » n'apparaît pas. | |

### ECR : Écran client

Second écran du même appareil, ou tablette reliée par un code. Sources : `DisplaySheet.tsx`, `CustomerDisplay.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ECR-01 | P1 | Oui | Écran client sur un second écran du même PC | Second moniteur branché. | 1. menu ⋮ (Plus d'actions) > « Écran client » > « Ouvrir sur un second écran ».<br>2. Glisser la fenêtre sur le second écran, plein écran.<br>3. Faire une vente en espèces avec rendu. | Accueil au nom de la boutique, articles qui s'ajoutent en direct (dernière ligne mise en avant), total, puis remerciement avec la monnaie rendue et le QR du ticket dématérialisé. Fonctionne aussi sans internet. | |
| ECR-02 | P1 | Partiel | Tablette reliée par code | Tablette en ligne sur le réseau de la boutique. | 1. Sur la tablette, ouvrir l'adresse de la caisse suivie de /display : un code à 6 chiffres s'affiche.<br>2. Sur la caisse, menu ⋮ (Plus d'actions) > « Écran client », saisir « Code affiché sur la tablette », « Relier ».<br>3. Faire une vente. | « Tablette reliée à cette caisse ». La tablette suit la vente en direct. Code valable 10 minutes. | |
| ECR-03 | P2 | Oui | Écran client en mode formation et hors ligne | ECR-01 et ECR-02 faits. | 1. Activer le mode formation, faire une vente.<br>2. Couper internet, faire une vente. | Formation : l'écran client signale le mode formation et ne propose pas de QR de ticket. Hors ligne : le second écran du même PC continue ; la tablette (relais par le serveur) se fige jusqu'au retour du réseau, puis reprend le dernier état. | |

### FIS : Ticket légal et chaîne fiscale

Ticket signé par la caisse (ECDSA, chaîné), même hors ligne ; clôtures jour, mois, année ; journal des événements ; archives ; attestation. Sources : `packages/utils/src/ticket.ts`, `apps/web/src/lib/terminal/terminal.ts`, `apps/api/src/compliance/`, `ComplianceClient.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FIS-01 | P0 | Oui | Mentions du ticket de vente imprimé | Paramètres > Organisation rempli (raison sociale, forme juridique, SIRET, N° TVA intracommunautaire, RCS, adresse du siège). Paramètres > Impression : pied de ticket saisi. Vendeur connecté. | 1. Vendre 2 articles identiques à 5,5 % et 1 article à 20 %, avec une remise, payer en espèces avec rendu.<br>2. Imprimer et vérifier chaque mention. | Dans l'ordre : nom de la boutique ; raison sociale et forme ; adresse du siège ; « SIRET … » ; « TVA … » ; RCS ; « TICKET » ; « Date jj/mm/aaaa hh:mm » ; « Ticket n° N » ; « Caisse Caisse N » ; « Vendeur Prénom Nom » ; « 2 x … » avec montant TTC et lettre de taux, « … l'unité » ; « Remise -x,xx » ; « TOTAL TTC x,xx EUR » ; tableau TVA par taux (HT, TVA, TTC) ; « Espèces x,xx » ; « Rendu x,xx » ; pied de ticket ; « Merci de votre visite » ; « Signature » suivie de 16 caractères ; « FLOW 1.0.0 » ; QR « Votre ticket et votre facture en ligne ». Totaux justes au centime. À faire valider : liste des mentions obligatoires (non sourcée dans `research_notes`), absence de l'adresse de la boutique quand elle diffère du siège. | |
| FIS-02 | P0 | Oui | Numérotation des tickets par caisse | Deux caisses du même site. | 1. Faire 3 ventes sur la caisse 1, 2 sur la caisse 2, en alternant.<br>2. Comparer les numéros imprimés et Commandes. | Chaque caisse numérote ses tickets à la suite (1, 2, 3 et 1, 2), sans trou ni doublon dans une même caisse ; le nom de la caisse est imprimé. À faire valider : numérotation par caisse plutôt que par site. | |
| FIS-03 | P0 | Oui | Vente hors ligne signée puis envoyée | Caisse ouverte en ligne une première fois. Couper la prise WAN de la box (le réseau local reste). | 1. Attendre l'indication « Hors ligne » en haut de la caisse.<br>2. Vendre en espèces, imprimer.<br>3. Rebrancher internet. | Ticket imprimé avec numéro et « Signature ». Écran : « Gardée sur la caisse, envoi dès que le réseau revient. » En-tête : « Hors ligne, 1 à envoyer ». Au retour : « En ligne », l'écran de la vente (s'il est encore ouvert) passe à « Envoyée au serveur. », la vente apparaît dans Commandes avec le même numéro. | |
| FIS-04 | P0 | Oui | Vingt ventes hors ligne | Comme FIS-03. | 1. Couper internet une heure, faire 20 ventes variées (espèces, carte TPE autonome, chèque).<br>2. Rebrancher, attendre la fin de l'envoi.<br>3. Conformité : « Vérifier le grand livre ». | Les 20 ventes arrivent dans l'ordre, aucune en double, aucune « vente refusée ». Le compteur « à envoyer » revient à zéro. « Tout est intact : … ». | |
| FIS-05 | P1 | Oui | Vente hors ligne de la veille envoyée le lendemain | Caisse hors ligne le soir. | 1. Vendre hors ligne vers 19 h.<br>2. Laisser la caisse hors ligne jusqu'au lendemain, rebrancher après minuit.<br>3. Ouvrir Conformité > Clôtures. | Comportement prévu (`closures.service.ts`) : la vente arrivée après la clôture de son jour entre dans le Z du jour où elle est reçue. Le ticket garde sa date d'origine. À faire valider avec l'expert-comptable ou l'organisme de certification. | |
| FIS-06 | P0 | Oui | Duplicata numéroté | Une vente synchronisée. | 1. Commandes > la vente > « Réimprimer (duplicata) ».<br>2. Recommencer.<br>3. Conformité > « Journal des événements ». | « Duplicata n° 1 imprimé », puis « Duplicata n° 2 imprimé ». Papier : « *** DUPLICATA N° 1 *** » en haut et en bas, même numéro de ticket, même date et même début de signature que l'original. Deux événements « Duplicata de ticket ». Remarque : la ligne « Vendeur » montre l'utilisateur qui réimprime, pas le vendeur d'origine. | |
| FIS-07 | P0 | Oui | Mode formation | Caisse en ligne, connecté en gérant (ou responsable). Un TPE réel peut rester branché : il ne doit recevoir aucune demande. | 1. menu ⋮ (Plus d'actions) > « Mode formation ».<br>2. Vendre en espèces, imprimer.<br>3. « Quitter » dans le bandeau.<br>4. Conformité : regarder « Dernier ticket » et « Journal des événements ». Stock : regarder le produit vendu.<br>5. Avec un compte vendeur, ouvrir le menu. | Bandeau « Mode formation : ventes fictives, ni comptées, ni déstockées. Tickets marqués « fictif ». » Ticket : « *** MODE FORMATION *** », « *** TICKET FICTIF SANS VALEUR *** », « Ticket fictif n° F-N », « Opérateur … », sans signature ni QR. Écran : « Mode formation : ticket fictif n° F-N, … ». « Dernier ticket » inchangé, stock inchangé. Événements « Mode formation activé », « Ticket fictif (mode formation) », « Mode formation désactivé ». Le vendeur ne voit pas l'entrée « Mode formation ». Une vente « Carte » en mode formation n'envoie rien au TPE (aucun montant affiché sur le TPE). | |
| FIS-08 | P1 | Oui | Mode formation sans réseau | Caisse hors ligne, gérant connecté. | 1. menu ⋮ (Plus d'actions) > « Mode formation ». | Message « Mode formation : … Une connexion est nécessaire pour le tracer. » Le mode n'est pas activé. | |
| FIS-09 | P0 | Oui | Clôture journalière manuelle (Z) | Ventes, remboursement et duplicata faits dans la journée, toutes envoyées. | 1. Back-office > Conformité > « Clôturer la journée ».<br>2. Onglet « Clôtures », ouvrir la clôture du jour.<br>3. Comparer avec les tickets du jour et le comptage de caisse.<br>4. Télécharger « Tableur ». | « Journée clôturée : N tickets, X € ». Détail : « Tickets » (plage de numéros), « Grand total de la période », « Total perpétuel », « Cumul en valeur absolue », « TVA par taux », « Encaissements » par moyen. Chiffres égaux à la somme des tickets. Le fichier s'ouvre dans un tableur. Limite connue : pas de ticket Z imprimé. | |
| FIS-10 | P0 | Oui | Clôture journalière automatique | Une journée avec ventes, non clôturée à la main. | 1. Le lendemain matin, ouvrir Conformité > Clôtures. | La journée de la veille est clôturée automatiquement (vérification toutes les 10 minutes après minuit, fuseau de la boutique). Message d'accueil de l'onglet si vide : « Aucune clôture pour l’instant. Chaque journée terminée est clôturée automatiquement la nuit si personne ne l’a fait. » | |
| FIS-11 | P0 | Oui | Vérifier le grand livre | Après une journée de test complète. | 1. Conformité > « Vérifier le grand livre ». | « Tout est intact : N tickets, M clôtures et K événements vérifiés. » Toute « Anomalie : … » est un défaut bloquant. | |
| FIS-12 | P1 | Oui | Totaux perpétuels et remboursement | Noter « Total perpétuel » et « Cumul en valeur absolue » dans Conformité. | 1. Faire une vente de 10,00 € puis la rembourser.<br>2. Relire les deux totaux. | Total perpétuel : +10 puis -10 (inchangé au final). Cumul en valeur absolue : +20. Aucun des deux ne revient à zéro. | |
| FIS-13 | P1 | Oui | Clôture mensuelle et archive fiscale | À faire le 1er jour du mois suivant le début des tests (ou sur un environnement qui a déjà un mois terminé). | 1. Conformité > Clôtures, période mois.<br>2. Section « Archives fiscales » : « Télécharger ».<br>3. Ouvrir le fichier JSON dans un éditeur de texte.<br>4. Journal des événements. | Le mois terminé est clôturé seul, avec son archive. Le fichier est lisible sans FLŌW, daté et signé. Événements « Clôture mensuelle », « Archive fiscale créée », « Archive fiscale téléchargée ». Même contrôle au 1er janvier pour l'année (P2). | |
| FIS-14 | P0 | Oui | Attestation individuelle de conformité | Connecté en gérant. | 1. Conformité, carte « Attestation de conformité » > « Télécharger mon attestation ».<br>2. Lire le PDF. | PDF au modèle BOI-LETTRE-000242 (25/03/2026) : volet 1 signé par l'éditeur, volet 2 pré-rempli au nom du commerçant, logiciel FLŌW version 1.0.0. Si la carte affiche « Bientôt disponible : l’éditeur finalise ses informations légales. », le critère d'entrée n'est pas rempli. À faire valider : contenu juridique du volet 1 par l'éditeur. | |
| FIS-15 | P1 | Oui | Journal des événements | Après la journée type. | 1. Conformité > « Journal des événements ». | On y trouve au moins : « Caisse enregistrée », « Clôture journalière », « Duplicata de ticket », événements du mode formation, « Vérification du grand livre ». Aucun trou ni « Anomalie du grand livre ». | |

### PAI : Moyens de paiement français

Espèces (1 000 € / 15 000 € non-résident), chèque, titres-restaurant, avoir, carte cadeau, plusieurs moyens, note divisée. Sources : `packages/utils/src/payment-rules.ts`, `PaymentSheet.tsx`, `packages/types/src/sectors.ts`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PAI-01 | P0 | Oui | Espèces, compte exact | Caisse ouverte. | 1. Vendre 7,50 €, « Encaisser », « Espèces ».<br>2. « Compte exact », « Valider 7,50 € ». | Titre « Espèces : 7,50 € ». Vente enregistrée sans ligne « Rendu ». | |
| PAI-02 | P0 | Oui | Espèces avec monnaie à rendre | Caisse ouverte. | 1. Vendre 12,50 €, « Espèces ».<br>2. Toucher le billet rapide « 20,00 € » (ou saisir « Montant remis par le client » 20).<br>3. « Valider 12,50 € ». | « À rendre 7,50 € » avant validation. Écran et ticket : « Rendu 7,50 ». Écran client : monnaie rendue. | |
| PAI-03 | P1 | Oui | Espèces insuffisantes | Caisse ouverte. | 1. Vendre 12,50 €, « Espèces », saisir 10. | « Il manque 2,50 € », « Valider » grisé. | |
| PAI-04 | P0 | Oui | Plafond espèces 1 000 € et non-résident 15 000 € | Article libre de 1 000,01 €. | 1. « Espèces » sur 1 000,00 € exactement.<br>2. « Espèces » sur 1 000,01 €.<br>3. Cocher « Client non résident, justificatif de domicile à l’étranger vérifié. ».<br>4. Recommencer avec 15 000,01 €, case cochée. | 1 000,00 € : accepté. 1 000,01 € : « Espèces limitées à 1 000 € pour un client résidant en France », « Valider » grisé ; la case non-résident apparaît. Case cochée : accepté. 15 000,01 € : « Espèces limitées à 15 000 € pour un client non résident ». Le même contrôle s'applique dans « Payer avec plusieurs moyens » sur la part espèces. | |
| PAI-05 | P0 | Oui | Chèque et chèque-vacances | Moyen « Chèque » actif (et « Chèque-Vacances » en alimentaire). | 1. « Encaisser », « Chèque ».<br>2. Essayer « Valider » sans numéro, puis saisir le numéro du chèque.<br>3. Même chose avec « Chèque-Vacances » s'il est actif. | « Valider » reste grisé tant que le numéro est vide. Vente enregistrée, numéro gardé avec la vente. Le numéro de chèque n'est pas imprimé sur le ticket (seule la référence carte l'est). | |
| PAI-06 | P0 | Oui | Titre-restaurant papier au-delà du plafond | Métier alimentaire (boulangerie, épicerie, restauration). Articles « Payable en titre-restaurant » pour 30,00 €. Plafond par ticket 25 € (Paramètres > Paiement). | 1. « Encaisser », « Titre-restaurant papier ».<br>2. Compléter avec « Espèces », « Le reste ».<br>3. « Valider 30,00 € ». | Message « Titre-restaurant papier : 25,00 € au plus (plafond de 25,00 € par ticket). Le reste avec un autre moyen. », écran « Paiement en plusieurs fois » pré-rempli à 25,00. Vente enregistrée avec deux paiements. | |
| PAI-07 | P0 | Oui | Titre-restaurant sans article éligible | Panier sans article éligible (par exemple un article à 20 % non coché). | 1. « Encaisser », « Titre-restaurant papier ». | « Aucun article de cette vente n’est payable en titre-restaurant. » Rien n'est encaissé. | |
| PAI-08 | P1 | Oui | Titre-restaurant limité aux articles éligibles | Panier : 8,00 € éligibles et 12,00 € non éligibles. | 1. « Titre-restaurant papier ».<br>2. Dans l'écran pré-rempli, forcer 10,00 en titre-restaurant. | Pré-rempli à 8,00 (« articles éligibles »). Forcé à 10,00 : « Titre-restaurant limité aux articles éligibles : 8,00 € », « Valider » grisé. Un montant supérieur au total donne « Trop perçu » et reste bloqué (pas de rendu de monnaie). | |
| PAI-09 | P1 | Oui | Carte titre-restaurant | Moyen « Carte titre-restaurant » actif. | 1. Vendre 9,00 € éligibles, « Carte titre-restaurant ». | Comportement actuel : la vente est enregistrée sans envoi au TPE ; le vendeur tape le montant sur le TPE. Le plafond et l'éligibilité s'appliquent comme pour le papier. | |
| PAI-10 | P0 | Oui | Payer avec plusieurs moyens | Au moins deux moyens actifs. | 1. Vendre 50,00 €, « Payer avec plusieurs moyens ».<br>2. Saisir 20 en espèces, « Le reste » sur Carte.<br>3. « Valider 50,00 € ». | « Reste à payer » passe à 0,00 €, « Valider » s'active. Un seul ticket listant les deux paiements. « Un seul moyen de paiement » ramène à la liste. | |
| PAI-11 | P0 | Oui | Diviser la note en parts égales | Vente de 100,00 €. | 1. « Diviser la note », régler 3 parts (« Une part de plus »).<br>2. Payer la part 1 en espèces, la 2 en carte, la 3 en chèque.<br>3. Essayer de fermer la fenêtre après la première part. | Parts au centime (33,34 / 33,33 / 33,33). Chaque part payée affiche « Payée, … ». Après la première part, la fenêtre ne se ferme plus jusqu'à la fin. Une seule vente, un seul ticket avec trois paiements. | |
| PAI-12 | P0 | Oui | Payer avec un avoir | Un avoir AV-XXXX-XXXX de 30,00 € (RET-02). Caisse en ligne. | 1. Vendre 20,00 €, « Encaisser », « Avoir ».<br>2. Saisir le code, « Vérifier le solde », payer.<br>3. Revendre 15,00 € avec le même avoir (solde 10,00 €), compléter le reste. | Le solde s'affiche, la vente passe. Deuxième vente : 10,00 € pris sur l'avoir, le reste avec un autre moyen. Hors ligne : « Un avoir se vérifie en ligne : reconnectez la caisse ou payez autrement. » | |
| PAI-13 | P1 | Oui | Article libre puis ajout au catalogue | Caisse ouverte. | 1. Tuile « Article libre » : prix, nom facultatif, taux de TVA.<br>2. Encaisser.<br>3. Sur « Vente enregistrée » : « Garder « … » à … dans le catalogue ? », « Ajouter ». | Le nom saisi est imprimé sur le ticket. « « … » ajouté au catalogue. » Hors ligne : « Impossible pour le moment (réseau). » | |

### RET : Retours, remboursements, échanges

Remboursement = ticket négatif signé, en ligne uniquement. Sources : `ReturnFinder.tsx`, `apps/web/src/components/orders/OrderDetailSheet.tsx`, `apps/api/src/orders/refunds.service.ts`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RET-01 | P0 | Oui | Retour avec ticket, remboursement en espèces | Une vente payée en espèces, synchronisée. Caisse en ligne. | 1. Bouton « Retour » de la caisse, saisir le n° du ticket dans « N° du ticket, produit ou e-mail du client ».<br>2. Ouvrir la vente, « Retour ou échange ».<br>3. Choisir l'article (« Un de plus »), motif « Ne convient pas », laisser « Remettre en stock ».<br>4. « Rembourser en » : Espèces, « Rembourser X ». | « Remboursement enregistré », « X en espèces ». Stock recrédité. Limites connues : le tiroir ne s'ouvre pas tout seul (« Ouvrir le tiroir » dans la feuille de réglages) et le ticket de remboursement ne s'imprime pas d'office ; on l'obtient par Commandes > le remboursement > « Réimprimer (duplicata) » (titre « REMBOURSEMENT », marqué « DUPLICATA N° 1 »). | |
| RET-02 | P0 | Oui | Remboursement en avoir | Une vente synchronisée. | 1. Retour, choisir l'article, « Rembourser en » : Avoir, valider. | Code « AV-XXXX-XXXX » affiché avec « Code de l'avoir, à donner au client » et « Copier le code ». Aide : « Utilisable en une ou plusieurs fois pendant 12 mois. Pour un échange, il paie le nouvel article. » | |
| RET-03 | P0 | Oui | Échange taille ou couleur | Une vente d'un article en variantes. | 1. Retour, motif « Taille ou couleur », remboursement en avoir.<br>2. Utiliser l'avoir pour l'échange (retour en caisse avec le code).<br>3. Ajouter la nouvelle variante, « Encaisser », « Avoir », compléter si besoin. | Message « Avoir AV-… prêt : ajoutez les articles, puis Encaisser et Avoir. » Le code est pré-rempli à l'encaissement. Différence payée avec un autre moyen, ou solde restant sur l'avoir. | |
| RET-04 | P1 | Oui | Remboursement d'une vente payée par carte | Une vente carte via TPE en ligne, une autre via Caisse-AP ou TPE autonome. | 1. Retour de chaque vente, « Rembourser en » : Carte. | TPE en ligne : « Le remboursement part sur la carte du client, via le TPE relié. » Caisse-AP ou autonome : « Remboursez la carte sur votre TPE, puis validez ici. » (remboursement à faire à la main sur le TPE). | |
| RET-05 | P1 | Oui | Remboursement d'une vente payée en plusieurs fois | Vente payée espèces + carte. | 1. Retour, regarder les choix de « Rembourser en ». | Seuls Espèces et Avoir sont proposés (le serveur refuse le moyen d'origine : « Vente payée en plusieurs fois : remboursez en espèces ou en avoir »). | |
| RET-06 | P1 | Oui | Deux retours partiels successifs | Vente de 3 articles identiques avec remise globale. | 1. Rendre 1 article.<br>2. Rendre les 2 autres. | Chaque remboursement est au prorata de ce qui a été payé ; le dernier solde la vente au centime. Total remboursé = total payé. | |
| RET-07 | P1 | Oui | Retour sans réseau | Caisse hors ligne. | 1. Bouton « Retour ». | « Les retours se font en ligne, pour vérifier la vente d'origine. Les ventes, elles, continuent hors ligne. » | |

### ART : Articles : douchette, balance, création, variantes, formules

Sources : `Catalog.tsx`, `packages/utils/src/scale-barcode.ts`, `QuickSheets.tsx`, `VariantPicker.tsx`, `Composition.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ART-01 | P0 | Partiel | Douchette en émulation clavier | Douchette USB ou Bluetooth en mode clavier (HID), suffixe Entrée, réglée en disposition AZERTY française. Produits avec code-barres au catalogue. | 1. Cliquer dans « Rechercher ou scanner ».<br>2. Scanner 5 produits différents, puis 2 fois le même. | Chaque scan ajoute le produit, vide le champ et y remet le curseur ; le même produit scanné deux fois passe en quantité 2. Une douchette restée en QWERTY tape des caractères faux (&é"'(...) : la régler en AZERTY avec le guide du fabricant. | |
| ART-02 | P0 | Non | Scan sans cliquer dans le champ | ART-01 fait. | 1. Après « Vente suivante », scanner sans toucher l'écran.<br>2. Après avoir fermé une fenêtre (variante, client), scanner.<br>3. Après avoir touché une tuile produit, scanner. | Le scan n'est pris que si le curseur est dans « Rechercher ou scanner ». Noter chaque situation où le scan est perdu : c'est un point d'ergonomie à remonter (pas de capture globale de la douchette). | |
| ART-03 | P0 | Partiel | Scan hors ligne | Caisse ouverte une fois en ligne, puis internet coupé. | 1. Scanner 3 produits, encaisser en espèces. | Les produits sont trouvés (catalogue gardé sur la caisse), la vente passe. | |
| ART-04 | P1 | Partiel | Code-barres inconnu, fiche Open Food Facts | Caisse en ligne, gérant. Un produit alimentaire du commerce absent du catalogue. | 1. Scanner son code.<br>2. « Créer ce produit ».<br>3. Vérifier la fiche, saisir « Prix de vente », TVA, catégorie, « Créer et ajouter à la vente ».<br>4. Rescanner le code. | « Aucun produit pour « <code> ». » puis feuille « Nouveau produit » avec « fiche trouvée dans Open Food Facts : vérifiez-la. » (ou Open Beauty Facts, Open Products Facts). « <nom> ajouté au catalogue ». Le second scan trouve le produit. Hors ligne : « Hors ligne : saisissez la fiche à la main. » | |
| ART-05 | P1 | Partiel | Code-barres de variante | Produit en tailles et couleurs, chaque variante avec son EAN. | 1. Scanner l'EAN d'une variante.<br>2. Toucher la tuile du produit. | Le scan ajoute directement la bonne variante. La tuile ouvre la grille taille × couleur ; un toucher ajoute la variante. | |
| ART-06 | P0 | Partiel | Étiquette de balance à prix intégré (préfixe 20) | Paramètres > Options et balance > « Étiquettes de balance » aligné sur la balance (par défaut 20 = prix, 23 = poids, code article 5 chiffres). Produit « au poids » avec son code balance. Balance étiqueteuse qui imprime des EAN-13. | 1. Peser et étiqueter sur la balance.<br>2. Scanner l'étiquette en caisse.<br>3. Encaisser. | Une ligne au prix exact de l'étiquette, jamais fusionnée avec une autre. Le ticket s'imprime d'office (produit pesé). | |
| ART-07 | P0 | Partiel | Étiquette de balance à poids intégré (préfixe 23) | Comme ART-06, balance réglée en poids. | 1. Scanner une étiquette poids.<br>2. Comparer le prix calculé à celui de la balance. | Ligne avec le détail « 0,452 kg à 24,90 €/kg » (exemple), prix = poids × prix au kilo arrondi au centime, identique à la balance. | |
| ART-08 | P1 | Partiel | Étiquette illisible ou code article inconnu | Une étiquette dont le code article n'existe pas au catalogue, et un EAN-13 à clé fausse. | 1. Scanner chacun. | « Aucun produit pour « <code> ». » sans ajout. Rien n'est vendu à un prix inventé. | |
| ART-09 | P1 | Oui | Pesée saisie à la main | Produit au poids. | 1. Toucher la tuile, « Saisissez le poids », valider « Ajouter · X ». | Ligne au bon prix avec le poids en détail ; ticket imprimé d'office. | |
| ART-10 | P1 | Oui | Pièce numérotée (n° de série) | Produit suivi par n° de série (bijouterie), pièces en stock. | 1. Toucher la tuile, choisir la pièce ou saisir son numéro.<br>2. Encaisser. | Ticket imprimé d'office avec « N° de série … ». La pièce sort du stock. Une pièce absente du stock est signalée, pas refusée, si la vente arrive du hors ligne. | |
| ART-11 | P1 | Oui | Formule (restauration) | Métier restauration, formule au catalogue (exemple). | 1. Toucher la formule, choisir chaque étape.<br>2. « Ajouter la formule · X », encaisser, imprimer. | Sans tous les choix : « Choisissez : <étape> ». Ticket : la formule sous son nom, chaque composant en dessous avec son montant et sa lettre de TVA. | |
| ART-12 | P1 | Oui | Options et suppléments | Produit avec groupe d'options obligatoire (cuisson) et supplément payant. | 1. Ajouter le produit sans choisir la cuisson.<br>2. Choisir cuisson et supplément, « Ajouter · X ». | Ajout bloqué tant que l'option obligatoire manque. Prix = prix + supplément ; options imprimées en détail de ligne. | |

### FID : Fidélité, cartes cadeaux, ticket dématérialisé, facture

Sources : `LoyaltySheets.tsx`, `Ticket.tsx`, `CreditPayment.tsx`, `DigitalReceipt.tsx`, `BusinessInvoice.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FID-01 | P1 | Oui | Créer et rattacher un client fidélité | Paramètres > Fidélité et cartes cadeaux : programme actif. | 1. Panneau de vente : « Ajouter un client fidélité ».<br>2. Taper un numéro inconnu dans « Téléphone, e-mail ou nom », créer le client.<br>3. « Enregistrer et rattacher ». | La case « Le client accepte de recevoir les offres de la boutique » n'est pas cochée d'office. Le client est rattaché à la vente. Création impossible hors ligne. | |
| FID-02 | P1 | Oui | Points gagnés et récompense | Client avec assez de points pour une récompense. | 1. Rattacher le client, « Utiliser X offerts ».<br>2. Encaisser, imprimer.<br>3. Refaire une vente avec « Garder les points pour plus tard ». | La récompense devient des remises sur les lignes (jamais sur une carte cadeau), imprimées et signées. Les points gagnés ne comptent pas le montant des cartes cadeaux achetées. | |
| FID-03 | P0 | Oui | Vendre une carte cadeau | Programme actif. | 1. Tuile « Carte cadeau », choisir le montant, « Ajouter une carte de X ».<br>2. Encaisser, imprimer.<br>3. Recommencer hors ligne.<br>4. Essayer 1 600 €. | Ligne avec le code CC-XXXX-XXXX-XXXX, à 0 % de TVA sur le ticket. Fonctionne hors ligne (code tiré par la caisse). Au-delà de 1 500 € : refusé (« 1 500 € au plus par carte. »). À faire valider : TVA à 0 % (bon à usages multiples) et plafond de 1 500 €, non sourcés dans `docs/legal`. | |
| FID-04 | P0 | Oui | Payer avec une carte cadeau | Une carte cadeau vendue et synchronisée. Caisse en ligne. | 1. « Encaisser », « Carte cadeau », « Code de la carte cadeau », « Vérifier le solde ».<br>2. Payer une partie, compléter avec un autre moyen.<br>3. Recommencer hors ligne. | Solde affiché, débité de ce qui est payé. Hors ligne : « Une carte cadeau se vérifie en ligne : reconnectez la caisse ou payez autrement. » | |
| FID-05 | P1 | Oui | Rembourser une carte cadeau | Une carte vendue intacte, une autre entamée. | 1. Retour de la vente de chaque carte. | Carte intacte : remboursée et annulée. Carte entamée : « Carte cadeau CC-… déjà utilisée : remboursement impossible ». | |
| FID-06 | P1 | Oui | Points repris au remboursement | Vente à un client fidélité, points notés. | 1. Rembourser la moitié de la vente. | Les points gagnés sur la vente sont repris au prorata de ce qui est rendu. Les points utilisés pour une récompense ne sont pas rendus (choix produit). | |
| FID-07 | P1 | Oui | Ticket par e-mail à l'encaissement | Caisse en ligne, boîte mail de test. | 1. « Encaisser », « Ticket par e-mail », saisir « E-mail du client ».<br>2. Payer. | Le ticket part tout seul ; e-mail reçu avec le lien du reçu en ligne. Aucun abonnement marketing n'est créé par ce seul e-mail. | |
| FID-08 | P1 | Oui | QR code du ticket et reçu en ligne | Ticket imprimé avec QR, vente synchronisée. | 1. Scanner le QR du ticket avec un téléphone.<br>2. Télécharger le PDF.<br>3. Après une vente hors ligne non envoyée : « Envoyer le ticket par e-mail ». | Le reçu en ligne s'ouvre (« Total TTC », mêmes lignes que le papier, adresse de la boutique). Hors ligne : « La vente n’est pas encore arrivée au serveur. Réessayez quand la caisse est en ligne. » | |
| FID-09 | P1 | Oui | Facture entreprise depuis la vente | Vente synchronisée, client professionnel avec SIREN. | 1. Sur « Vente enregistrée », bloc facture : chercher l'entreprise (annuaire SIRENE).<br>2. « Émettre la facture », puis « Envoyer la facture ».<br>3. Imprimer en A4. | « Facture N » émise avec SIREN/SIRET du client, envoyée par e-mail, PDF A4 imprimable. À faire valider : mentions B2B (SIREN client, nature des opérations, adresse de livraison) au regard de la réforme 2026/2027. | |

### CAI : Espèces du tiroir, ouverture, fermeture, routines

Sources : `CashSheets.tsx`, `Routine.tsx`, `apps/api/src/cash/cash.service.ts`, `apps/api/src/routines/`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAI-01 | P0 | Partiel | Ouverture de caisse le matin | Caisse fermée la veille avec un fond annoncé. | 1. Ouvrir la caisse le matin.<br>2. La fenêtre « Ouverture de la caisse » s'affiche : « Ouvrir ».<br>3. Autre jour : saisir un autre « Montant réellement dans le tiroir », « Ouvrir avec X ». | Fond proposé : « Fond laissé dans le tiroir à la dernière fermeture » (ou « Fond de caisse habituel »). « Caisse ouverte avec X ». L'en-tête propose ensuite « Fermer la caisse ». Remarque : le tiroir ne s'ouvre pas tout seul pour compter (« Ouvrir le tiroir » dans la feuille de réglages). | |
| CAI-02 | P0 | Oui | Fermeture et comptage juste | Journée avec ventes espèces, rendus et un remboursement en espèces ; toutes les ventes envoyées. | 1. « Fermer la caisse ».<br>2. Compter par coupures (« Billets », « Pièces »), lire « Total compté ».<br>3. « Valider le comptage ». | L'écart n'apparaît qu'après validation. « Caisse fermée », « Le compte est juste. », puis la consigne coupure par coupure « Laissez dans le tiroir pour demain » et ce qu'il faut déposer. Attendu = fond + espèces encaissées - rendus - remboursements espèces : vérifier à la main. | |
| CAI-03 | P0 | Oui | Fermeture avec écart | Retirer 10 € du tiroir avant de compter. | 1. Compter, « Valider le comptage ».<br>2. Choisir un motif (ou « Je ne sais pas »), « Fermer avec ce motif ». | « Il manque 10,00 € » avec les motifs ; après choix, « 10,00 € de moins que prévu, motif : … ». Un petit écart sous la tolérance ne bloque pas la fermeture. | |
| CAI-04 | P1 | Oui | Fermeture avec ventes non envoyées | Caisse hors ligne avec des ventes en attente. | 1. « Fermer la caisse ». | Avertissement « N ventes pas encore envoyées : reconnectez la caisse avant de compter, sinon elles manqueront au total attendu. » | |
| CAI-05 | P1 | Oui | Caisse oubliée ouverte la veille | Ne pas fermer la caisse le soir. | 1. Le lendemain, ouvrir la caisse.<br>2. « Clôturer cette journée », compter, valider. | Fenêtre « La caisse du <jour> n’a pas été clôturée ». Après comptage, l'ouverture du jour est proposée. La clôture est notée au nom du vendeur avec l'heure. | |
| CAI-06 | P1 | Oui | Fond de caisse réglé automatiquement | Paramètres > Fond de caisse. | 1. Lire le réglage et les raisons affichées.<br>2. Passer en réglage manuel puis revenir. | « Réglage automatique activé » par défaut, montant et tolérance expliqués. Le réglage manuel est pris en compte à la fermeture suivante. | |
| CAI-07 | P1 | Oui | Routine de fin de journée | Paramètres > Routines et rappels : heure de fermeture dans 15 minutes, clôture de caisse cochée. | 1. Attendre l'approche de l'heure : bandeau en haut de la caisse.<br>2. Laisser la caisse inactive 2 minutes après l'échéance.<br>3. « Plus tard », attendre 10 minutes.<br>4. « Lancer la clôture de caisse ». | Bandeau discret avant l'échéance ; liste « Fin de journée » quand la caisse est inactive (jamais en pleine vente) ; elle revient 10 minutes après « Plus tard » ; le bouton lance la fermeture. | |
| CAI-08 | P1 | Oui | Caisse laissée ouverte après la fermeture | Routine avec verrouillage activé, caisse laissée ouverte bien après l'heure. | 1. Attendre le verrouillage automatique.<br>2. Saisir le code d'un membre de l'équipe. | Écran « La journée n’a pas été clôturée après la fermeture. Le gérant a été prévenu. Entrez votre code pour clôturer la caisse. » ; e-mail reçu par le gérant (une fois par soir). Après le code, la liste de fin de journée s'ouvre. | |
| CAI-09 | P0 | Oui | Verrouiller et changer de vendeur | Deux vendeurs avec code à 4 chiffres. Caisse en ligne. | 1. menu ⋮ (Plus d'actions) > « Verrouiller la caisse ».<br>2. Saisir le code du vendeur B.<br>3. menu ⋮ (Plus d'actions) > « Changer de vendeur », code du vendeur A.<br>4. Vendre et imprimer. | « Entrez votre code pour reprendre. » ; déverrouillé avec le code. « Bonjour <prénom> » au changement. Le ticket porte « Vendeur » au nom du vendeur A. | |

### ONB : Inscription, mode découverte, import

Sources : `SignupFlow.tsx`, `Discovery.tsx`, `DataSettings.tsx`, `packages/types/src/metiers.ts`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ONB-01 | P0 | Oui | Inscription et choix du métier | Adresse e-mail jamais utilisée. Chronomètre. | 1. Ouvrir /inscription : « Essayez FLŌW gratuitement ».<br>2. Saisir « Nom de la boutique », e-mail, « Mot de passe » (10 caractères au moins).<br>3. « Quel est votre commerce ? » : choisir « Boulangerie et pâtisserie ».<br>4. Attendre « Votre caisse se prépare ». | Aucune carte bancaire demandée. La caisse s'ouvre en mode découverte : bandeau du mode formation et liste « Bienvenue dans votre caisse ». Catalogue d'exemple, TVA et moyens de paiement du métier. Moins de 3 minutes. | |
| ONB-02 | P1 | Oui | Réglages par métier | Trois inscriptions de test : « Restauration et vente à emporter », « Épicerie fine », « Mode et textile ». | 1. Comparer catalogue d'exemple, taux de TVA et moyens de paiement. | Restauration : formule, cuissons et suppléments. Épicerie : titre-restaurant, produits au poids. Mode : tailles et couleurs. Métiers proposés : boulangerie, restauration, épicerie fine, mode, coiffure et beauté, commerce de détail, bijouterie, maison et décoration, cave à vins, et « Autre ». | |
| ONB-03 | P0 | Oui | Liste du mode découverte | ONB-01 fait. | 1. « Vendre un article ».<br>2. « Diviser une note ».<br>3. « Encaisser par carte » (TPE virtuel). | Chaque étape se coche. Les ventes d'essai sont fictives (« ni comptées, ni déstockées, hors du journal fiscal »). Le titre devient « Prêt à vendre ». | |
| ONB-04 | P0 | Oui | Passer en vente réelle | ONB-03 fait, gérant. | 1. « Retirer les N articles d’exemple ».<br>2. « Passer en vente réelle ».<br>3. Conformité : « Dernier ticket ». | « N articles d’exemple retirés ». « Caisse en vente réelle : chaque vente compte désormais », le bandeau formation disparaît, l'ouverture de caisse est proposée. « Dernier ticket : Aucun » (les ventes d'essai ne sont pas au grand livre). | |
| ONB-05 | P1 | Oui | Import d'un catalogue Excel | Fichier .xlsx exporté d'un ancien logiciel (désignation, PV TTC, TVA, EAN13, famille, taille, couleur). | 1. Paramètres > Données > « Importer un catalogue », déposer le fichier.<br>2. Vérifier la correspondance « Colonne « … » » et l'aperçu.<br>3. « Importer N produits ».<br>4. Essayer un ancien .xls. | Colonnes reconnues, prix HT et prix d'achat jamais pris pour un prix de vente, TVA « 0,2 » ou « 20 % » comprise. Produits présents en caisse. .xls : « Ancien format Excel (.xls) : enregistrez le fichier en .xlsx ou en CSV ». | |
| ONB-06 | P1 | Oui | Import d'un CSV enregistré par Excel français | Fichier enregistré par Excel en « CSV (séparateur : point-virgule) » avec des accents (é, è, à). | 1. Importer ce fichier.<br>2. Réenregistrer en « CSV UTF-8 » et réimporter. | Le point-virgule est reconnu. Anomalie connue : le fichier est lu en UTF-8 seulement, les accents d'un CSV Windows-1252 deviennent illisibles ; en « CSV UTF-8 » tout est correct. | |
| ONB-07 | P1 | Oui | Première ouverture de la caisse sur un nouvel appareil | Nouvel appareil, jamais utilisé comme caisse. | 1. Ouvrir la caisse hors ligne.<br>2. Ouvrir la caisse en ligne avec un compte vendeur, puis gérant. | Hors ligne : « Cette caisse doit être connectée à internet lors de sa première utilisation ». En ligne, gérant : la caisse est enregistrée sous le nom « Caisse N » (événement « Caisse enregistrée »). Noter le comportement avec un compte vendeur (installation réservée au gérant). | |
| ONB-08 | P1 | Non | Installer l'application | iPad (Safari) et PC (Chrome ou Edge). | 1. Liste d'accueil ou menu : « Installer l’application ». | Chrome/Edge : invite d'installation du navigateur. iPad : « Installer FLŌW sur cet appareil », « Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ». » L'icône lance la caisse en plein écran. | |

### SUP : Aide et support dans l'application

Source : `apps/web/src/components/support/SupportSheet.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SUP-01 | P0 | Oui | Demande urgente « La caisse ne peut plus encaisser » | Caisse en ligne, adresse de l'équipe support configurée. | 1. menu ⋮ (Plus d'actions) > « Aide et support ».<br>2. « La caisse ne peut plus encaisser ».<br>3. Décrire (exemple : « le TPE affiche « transaction refusée » pour toutes les cartes »), « Envoyer en urgence ». | « Demande urgente envoyée », « Réponse attendue avant <heure> ». Contexte joint visible : Boutique, Caisse, Version, Réseau, Écran. L'équipe reçoit un e-mail et voit la demande en tête de /support-team. | |
| SUP-02 | P1 | Oui | Demande normale et réponse | Caisse en ligne. | 1. « Nouvelle demande », sujet et message, « Envoyer la demande ».<br>2. Faire répondre l'équipe depuis /support-team. | « Demande envoyée ». À la réponse : notification « Nouvelle réponse de l’équipe FLŌW » et e-mail au commerçant. | |
| SUP-03 | P1 | Oui | Support hors des heures d'ouverture | Faire le test en dehors des heures de SUPPORT_HOURS. | 1. Ouvrir « Aide et support ». | « L’équipe est absente en ce moment », « L’équipe revient <jour heure> ». L'échéance est calculée en heures ouvrées. | |
| SUP-04 | P0 | Oui | Support quand la caisse est hors ligne | Internet coupé. | 1. « Aide et support », « La caisse ne peut plus encaisser ». | Le bouton d'envoi affiche « Hors ligne » et n'envoie rien. Pendant l'essai seulement, le contact est affiché : « Pendant votre essai, votre contact est … au … ». Après l'essai, aucun numéro : voir anomalies connues. Consigne : avoir le numéro du support sur papier près de la caisse. | |

### RES : Résilience : réseau, courant, plusieurs caisses, iPad

Sources : `apps/web/public/sw.js`, `apps/web/src/lib/terminal/terminal.ts`, `POSHeader.tsx`.

| ID | Prio | Banc | Titre | Préconditions | Étapes | Résultat attendu | Résultat / Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RES-01 | P0 | Oui | Coupure internet en pleine journée | Imprimante réseau par le pont, TPE Caisse-AP et TPE en ligne réglés. Couper la prise WAN de la box (Wi-Fi et réseau local restent). | 1. Vendre en espèces, en carte Caisse-AP, en carte (TPE en ligne), en chèque.<br>2. Imprimer chaque ticket. | En-tête « Hors ligne, N à envoyer ». Espèces, chèque : normal. Caisse-AP : fonctionne (tout est sur place). TPE en ligne : voir TPE-17. Tickets imprimés et signés. Retours, avoirs, cartes cadeaux en paiement et QR : indisponibles avec leur message. | |
| RES-02 | P0 | Oui | Retour du réseau | RES-01 fait. | 1. Rebrancher internet.<br>2. Attendre une minute. | « En ligne », plus rien « à envoyer ». Toutes les ventes dans Commandes. Aucune « vente refusée, à vérifier ». | |
| RES-03 | P0 | Oui | Coupure de courant du poste caisse | Ventes faites hors ligne et non envoyées, un panier en cours. | 1. Débrancher le PC (ou fermer brutalement le navigateur).<br>2. Rallumer, relancer le pont, rouvrir la caisse (hors ligne). | La caisse se rouvre sans réseau (copie locale) en quelques secondes avec le catalogue. Les ventes non envoyées sont toujours là et partent au retour du réseau. Le panier en cours est perdu (gardé en mémoire seulement). | |
| RES-04 | P0 | Oui | Rechargement de la caisse sans réseau | Caisse déjà ouverte une fois en ligne sur ce navigateur. | 1. Couper internet, appuyer sur F5. | La caisse se réaffiche en moins de 5 secondes environ (la page attend 4 s le réseau avant la copie locale), catalogue et prix présents, vente possible. | |
| RES-05 | P0 | Oui | Deux caisses en même temps | Deux appareils enregistrés comme caisses du même site. | 1. Pendant 15 minutes, vendre sur les deux en même temps, dont 5 ventes hors ligne chacune.<br>2. Rebrancher, « Vérifier le grand livre », « Clôturer la journée ». | Aucune vente perdue ni en double ; chaque caisse garde sa numérotation ; la clôture compte les deux caisses ; « Tout est intact ». | |
| RES-06 | P1 | Oui | Deux onglets de caisse sur le même appareil | Caisse ouverte dans deux onglets. | 1. Valider une vente dans chaque onglet au même moment. | Deux numéros de ticket différents et consécutifs, aucune vente refusée. | |
| RES-07 | P1 | Oui | Wi-Fi instable | Caisse en Wi-Fi. | 1. Pendant 10 minutes, couper et rallumer le Wi-Fi toutes les 30 secondes en vendant. | Aucune vente perdue ni en double ; l'en-tête suit l'état sans alarmer ; tout est envoyé à la fin. | |
| RES-08 | P1 | Non | iPad en application installée | ONB-08 fait sur iPad. Imprimante Epson ePOS ou AirPrint, TPE en ligne (SumUp ou Stripe). | 1. Ouvrir FLŌW depuis l'icône.<br>2. Vendre en carte (TPE en ligne), imprimer (ePOS ou AirPrint), ouvrir le tiroir (ePOS).<br>3. Mode avion, vendre en espèces, rouvrir l'application. | Plein écran, parcours complet. Hors ligne : vente signée, envoyée au retour du réseau. Pour l'imprimante ESC/POS par le pont et le TPE Caisse-AP depuis l'iPad, voir BRG-10. | |
| RES-09 | P1 | Partiel | Coup de feu : 30 ventes en 15 minutes | Matériel complet branché, écran client relié. | 1. Enchaîner 30 ventes réalistes (scan, espèces avec rendu, carte, tiroir, ticket).<br>2. Chronométrer une vente simple. | Pas de ralentissement visible, aucun ticket mélangé, tiroir à chaque vente espèces. Vente simple scan, espèces compte exact, ticket : moins de 15 secondes. | |
| RES-10 | P2 | Oui | Caisse ouverte toute la nuit | Caisse laissée ouverte le soir, en ligne. | 1. Le matin, faire une vente sans se reconnecter. | La vente est possible. Noter si une reconnexion est demandée et si la vente part bien au serveur ensuite. | |


## 9. Journée type (ouverture au Z)

Scénario continu à jouer par un vendeur qui ne connaît pas le code, avec le gérant à côté. Il enchaîne les cas déjà décrits ; chaque étape se note dans la ligne du cas correspondant.

| Heure | Ce qui se passe | Cas |
| --- | --- | --- |
| 8 h 45 | Allumer le PC, lancer le pont, ouvrir la caisse, connexion du vendeur A par son code. | BRG-07, CAI-09 |
| 8 h 50 | Ouverture de caisse avec le fond de la veille, puis comptage du fond réel (tiroir ouvert par « Ouvrir le tiroir »). | CAI-01, TIR-01 |
| 9 h 00 | Premières ventes : scan douchette, espèces avec rendu, ticket sur demande, tiroir. | ART-01, PAI-02, IMP-05, TIR-02 |
| 9 h 30 | Carte sur le TPE de la banque, puis un refus, puis un client qui abandonne. | TPE-02, TPE-03, TPE-04 |
| 10 h 00 | Produit pesé avec étiquette de balance, ticket imprimé d'office. | ART-06, IMP-07 |
| 10 h 30 | Client fidélité, récompense, vente d'une carte cadeau. | FID-01, FID-02, FID-03 |
| 11 h 00 | **Coupure internet** de 30 minutes : ventes espèces, chèque, carte Caisse-AP. | RES-01, PAI-05, FIS-03 |
| 11 h 30 | Retour du réseau, envoi des ventes. | RES-02 |
| 12 h 00 | Coup de feu : 30 ventes en 15 minutes, dont un repas payé en titre-restaurant et une note divisée. | RES-09, PAI-06, PAI-11 |
| 13 h 00 | Changement de vendeur (B). Imprimante éteinte pendant une vente espèces. | CAI-09, IMP-09, TIR-07 |
| 14 h 00 | Retour avec remboursement en espèces, échange contre un avoir. | RET-01, RET-03 |
| 15 h 00 | Duplicata d'un ticket du matin, facture entreprise. | FIS-06, FID-09 |
| 16 h 00 | Fin de rouleau de papier, changement de rouleau. | IMP-10 |
| 17 h 00 | Pont fermé par erreur pendant un paiement carte. | TPE-09 |
| 18 h 30 | Rappel de fin de journée, liste « Fin de journée ». | CAI-07 |
| 19 h 00 | Fermeture : comptage, écart éventuel, consigne de fond pour demain. | CAI-02, CAI-03 |
| 19 h 15 | Back-office : « Clôturer la journée », détail du Z, comparaison avec le comptage et les tickets du TPE, « Vérifier le grand livre ». | FIS-09, FIS-11, FIS-15 |
| Lendemain | Clôture automatique d'une seconde caisse laissée sans Z, caisse oubliée ouverte. | FIS-10, CAI-05 |

Contrôle final de la journée : somme des tickets FLŌW en carte = somme des tickets du TPE ; espèces comptées = attendu ; nombre de tickets = plage du Z ; aucune vente « à envoyer » ni « refusée ».

## 10. Anomalies et limites connues avant la recette

Relevées en lisant le code ; non corrigées ici. Les cas concernés décrivent le comportement actuel.

| # | Gravité | Constat | Où | Cas |
| --- | --- | --- | --- | --- |
| 1 | Corrigé | En mode formation, « Carte » envoyait le montant au vrai TPE. Corrigé : en formation et en découverte, aucun montant ne part à un TPE. | `apps/web/src/components/pos/PaymentSheet.tsx` | FIS-07 |
| 2 | Corrigé | « Annuler » pendant un paiement Caisse-AP revenait à la liste alors que le TPE attendait toujours la carte. Corrigé : la caisse demande d'annuler sur le TPE et attend sa réponse. | `apps/web/src/components/pos/BridgeTerminalWait.tsx` | TPE-05 |
| 3 | Corrigé | Après une coupure (pont, rechargement), la caisse ne retrouvait pas l'issue du paiement. Corrigé : paiement en cours gardé sur l'appareil, issue demandée au pont, bouton « Le TPE a accepté : enregistrer la vente » si elle reste inconnue. Le premier paiement attend aussi la connexion au pont au lieu d'échouer. | `apps/web/src/components/pos/BridgeTerminalWait.tsx`, `apps/web/src/lib/bridge/client.ts` | TPE-08, TPE-09, TPE-10 |
| 4 | P0 | Une vente refusée par le serveur (400, 404, 422) est marquée « refusée » et la caisse passe à la suivante, mais le serveur attend toujours ce numéro de ticket (409) : toutes les ventes suivantes de la caisse restent « à envoyer ». | `apps/web/src/lib/terminal/terminal.ts:184-187`, `apps/api/src/orders/orders.service.ts:125-131` | FIS-04, RES-02 |
| 5 | Corrigé | Le pont n'était joignable que depuis l'ordinateur où il tourne. Corrigé : accès des iPad sur le réseau de la boutique, en wss avec certificat local (voir docs/flow-bridge-securite.md). À valider sur un vrai iPad et un vrai Mac. | `apps/bridge/src/cert.ts`, `apps/web/src/components/settings/BridgePairing.tsx` | BRG-10, BRG-11 |
| 6 | P1 | Caisse verrouillée (à la main ou après la fermeture) sans réseau : le déverrouillage par code passe par le serveur, la caisse reste bloquée. Idem « Changer de vendeur ». | `apps/web/src/components/pos/POSClient.tsx:651`, `apps/web/src/stores/auth.store.ts:86-96` | CAI-08, CAI-09 |
| 7 | P1 | Le pont ne lit pas l'état de l'imprimante (papier, capot) : « Ticket imprimé » peut s'afficher sans ticket. | `apps/bridge/src/printer.ts:63` | IMP-10, IMP-11 |
| 8 | P1 | Remboursement : pas de ticket « REMBOURSEMENT » imprimé d'office (seulement en duplicata) et pas d'ouverture du tiroir pour un remboursement en espèces. | `apps/web/src/components/orders/OrderDetailSheet.tsx:478` | RET-01 |
| 9 | P1 | « Réessayer l’impression » après une erreur n'ouvre pas le tiroir d'un paiement en espèces. | `PaymentSheet.tsx:715` | TIR-07 |
| 10 | P1 | Parts carte de « Diviser la note », « Payer avec plusieurs moyens » et du complément d'un avoir : jamais envoyées au TPE Caisse-AP (et jamais au TPE en ligne pour les plusieurs moyens). | `PartsPayment.tsx:52`, `CreditPayment.tsx:186` | TPE-18 |
| 11 | P1 | Le ticket imprimé par la caisse ne porte pas l'adresse de la boutique (seulement celle du siège), alors que le reçu en ligne l'a. | `apps/web/src/components/pos/receipt-ticket.ts:16-18` | FIS-01 |
| 12 | P1 | Une vente hors ligne reçue après la clôture de son jour entre dans le Z du jour de réception (horodatage serveur à la réception). | `apps/api/src/compliance/compliance.service.ts:63` | FIS-05 |
| 13 | P1 | Aide hors ligne : impossible d'envoyer, et aucun numéro de téléphone après l'essai. | `apps/web/src/components/support/SupportSheet.tsx:135` | SUP-04 |
| 14 | P1 | Import CSV lu en UTF-8 seulement : accents perdus pour un CSV « point-virgule » d'Excel français (Windows-1252). | `apps/web/src/components/settings/DataSettings.tsx:133` | ONB-06 |
| 15 | P1 | Le panier en cours n'est gardé qu'en mémoire : perdu au rechargement, au redémarrage ou à une coupure de courant. | `apps/web/src/stores/cart.store.ts` | TPE-10, RES-03 |
| 16 | P1 | Pas de capture globale de la douchette : un scan hors du champ « Rechercher ou scanner » est perdu. | `apps/web/src/components/pos/Catalog.tsx:52` | ART-02 |
| 17 | P2 | Ticket 58 mm : le signe % des taux de TVA est coupé. | `packages/utils/src/ticket.ts:230` | IMP-04 |
| 18 | P2 | Duplicata : « Vendeur » = utilisateur qui réimprime (prénom seul), pas le vendeur d'origine. | `OrderDetailSheet.tsx:204` | FIS-06 |
| 19 | P2 | « N° de caisse » Caisse-AP accepte un chiffre, refusé ensuite au paiement. | `apps/web/src/components/settings/BridgeTpeSettings.tsx:51` | TPE-01 |
| 20 | P2 | Pas de ticket Z imprimé (le modèle prévoit « CLÔTURE », jamais utilisé). | `packages/utils/src/ticket.ts:117` | FIS-09 |
| 21 | P2 | Ouverture et fermeture de caisse : le tiroir ne s'ouvre pas pour compter. | `apps/web/src/components/pos/CashSheets.tsx:29`, `:109` | CAI-01 |
| 22 | Info | Caisse-AP : jamais essayé sur un vrai TPE ; pas d'annulation à distance ; code d'autorisation, carte masquée et ticket du TPE non remontés ; référence de vente non transmise ; remboursement Caisse-AP et lecture de chèque non utilisés par la caisse. | `apps/bridge/README.md` | TPE |
| 23 | Info | Le pont ne démarre pas seul avec l'ordinateur et ne se met pas à jour seul. | `docs/flow-bridge-executables.md` | BRG-08 |

## 11. Points juridiques à faire valider

Rien ici n'est un avis juridique : ce sont les règles appliquées par le code et leur source dans le dépôt.

| Sujet | Ce que fait FLŌW | Source dans le dépôt | À faire valider |
| --- | --- | --- | --- |
| Mentions du ticket | Voir FIS-01 | `research_notes/.../conformite_france.md` § 3 : liste « connaissance générale, non sourcée » | Liste officielle des mentions, adresse de la boutique, mention de garantie légale de conformité |
| Ticket sur demande et exceptions | Impression forcée : produits pesés, pièces numérotées, note de service | `reports/Benchmark caisses et manques FLŌW.md`, DGCCRF citée | Liste exacte de l'art. D541-371 C. env. ; ticket des opérations CB annulées ou non abouties (rien n'est imprimé par la caisse) |
| Note de service dès 25 € TTC | Deux exemplaires, double marqué | Arrêté 83-50/A cité dans `conformite_france.md` | Nom du client, date et lieu de la prestation, total HT sur la note ; conservation 2 ans du double |
| Espèces | 1 000 € résident, 15 000 € non-résident sur déclaration | Art. L112-6 et D112-3 CMF, Service-public F10999 | Justificatif à conserver pour le non-résident |
| Titre-restaurant | Plafond **par ticket** (25 € par défaut), articles éligibles, pas de rendu | `conformite_france.md` § 5 : plafond **journalier** 25 € en 2026 ; « pas de rendu » non sourcé | Plafond par ticket au lieu de par jour ; règle de rendu ; évolution 2027 |
| Carte cadeau | Vendue à 0 % de TVA, plafond 1 500 € par carte | Commit `204acd3` : « bon à usages multiples, à faire valider » ; plafond sans source | TVA des bons à usages multiples, plafond |
| Chaîne fiscale | Signature par caisse, numérotation par caisse, Z jour/mois/an, archives JSON signées, journal des événements, duplicatas numérotés | `docs/legal/BOI-LETTRE-000242-20260325.md`, `conformite_france.md` § 1 | Numérotation par caisse ; vente hors ligne dans le Z du jour de réception ; format d'archive ; conformité au référentiel retenu |
| Attestation individuelle | PDF au modèle BOI-LETTRE-000242 | `docs/legal/BOI-LETTRE-000242-20260325.md` | Contenu du volet 1 et périmètre couvert, par l'éditeur |
| Facture entreprise | SIREN/SIRET client, A4 | `conformite_france.md` § 2 | Nouvelles mentions (SIREN client, nature des opérations, adresse de livraison) |
| RGPD fidélité | Consentement non pré-coché, effacement à la demande | Référentiel CNIL cité | Durée de conservation et purge à 3 ans |

## 12. Risques

| Risque | Probabilité | Impact | Mesure |
| --- | --- | --- | --- |
| Caisse-AP mal interprété (jamais essayé sur un vrai TPE) | Élevée | Élevé | Banc puis TPE réel avec petites sommes, journal du pont en `FLOW_BRIDGE_LOG=debug`, installateur présent |
| Paiement accepté sans vente (anomalies 1 à 3) | Moyenne | Élevé | Consignes aux vendeurs, rapprochement quotidien tickets TPE / Z, corrections avant production |
| Données du navigateur effacées sur une caisse : clé de signature et ventes non envoyées perdues | Faible | Élevé | Ne jamais vider les données du site ni utiliser la navigation privée ; vérifier « à envoyer » à zéro avant toute manipulation |
| Pont non relancé après un redémarrage | Élevée | Moyen | Installer le pont en service (README du pont) ou raccourci au démarrage |
| Douchette en QWERTY | Moyenne | Moyen | Code de réglage AZERTY du fabricant imprimé dans le kit |
| Imprimante non ESC/POS ou page de code différente | Moyenne | Moyen | Ticket d'essai à chaque nouveau modèle |
| Réseau de la boutique instable, IP qui changent | Moyenne | Moyen | Baux DHCP fixes pour imprimante et TPE |
| Point juridique invalidé après la recette | Moyenne | Élevé | Section 11 portée par un responsable avant la mise en production |
| Testeur qui confond comportement actuel et attendu | Moyenne | Faible | Section 10 lue avant de commencer |

## 13. Fiche d'anomalie

```
ANO-<n° > : [Domaine] <ce qui ne va pas> quand <action>

Cas de recette : <ID>          Gravité : Bloquante / Majeure / Mineure          Priorité : P0 / P1 / P2
Date et heure :                Testeur :                 Boutique :

Environnement
- Appareil et système :         (ex. PC Windows 11, iPad iPadOS 18)
- Navigateur et version :
- Version FLŌW (Aide et support) :      Version du pont :
- Matériel :                    (modèle d'imprimante, de TPE, de douchette, adresses IP)
- Réseau :                      en ligne / hors ligne / instable

Étapes pour reproduire
1.
2.
3.

Résultat attendu :
Résultat obtenu :              (libellé exact affiché, entre « »)

Preuves : photo du ticket FLŌW, photo du ticket TPE, capture d'écran, fenêtre du pont, fichier du banc
Argent en jeu : oui / non (montant, carte débitée ou non)
Contournement : 
Fréquence : toujours / parfois / une fois
```

Gravité : **Bloquante** = un critère de la section 5 ; **Majeure** = fonction indispensable cassée mais contournable ; **Mineure** = libellé, présentation, confort.

## 14. Validation

| Rôle | Nom | Date | Décision | Signature |
| --- | --- | --- | --- | --- |
| Testeur terrain | | | | |
| Responsable produit | | | | |
| Commerçant pilote | | | | |
| Responsable des points juridiques (section 11) | | | | |

Décision possible : **Go** (critères de sortie remplis), **Go sous réserve** (liste des réserves et date de levée), **No go** (anomalies bloquantes listées).

Synthèse à remplir : cas exécutés / 147, OK, KO, bloqués ; anomalies ouvertes par gravité ; réserves.
