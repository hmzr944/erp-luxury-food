# Facturation électronique et e-reporting 2027 : étude d'impact pour FLŌW

Date de l'étude et de toutes les consultations : 20/10/2026.
Périmètre : une caisse (FLŌW) utilisée par des commerçants TPE et PME dont l'échéance est le 01/09/2027.
Ce document n'est pas un avis juridique. Tout ce qui touche à la loi reste à faire valider.

Légende des niveaux de preuve utilisés partout ci-dessous :

- **Officiel** : lu directement sur impots.gouv.fr, bofip.impots.gouv.fr ou dans les spécifications externes de l'AIFE (version 3.2), avec URL.
- **Éditeur** : annonce lue sur le site de l'éditeur concerné (une affirmation commerciale, pas une preuve de fonctionnement).
- **Secondaire** : blog, comparateur ou presse. Utilisable comme piste, jamais comme preuve.
- **Non vérifié** : lu ailleurs que sur une source officielle, ou non trouvé. À ne pas répéter publiquement.

## 1. Résumé en dix lignes

1. Depuis le 01/09/2026, toutes les entreprises assujetties doivent pouvoir recevoir des factures électroniques via une plateforme agréée ; les GE et ETI émettent déjà. Pour les micro-entreprises, petites et moyennes entreprises, l'émission et l'e-reporting sont attendus au plus tard le 01/09/2027 (officiel).
2. Une vente en caisse à un particulier (B2C) n'est pas une facture : elle relève de l'e-reporting de transaction, transmis par la plateforme agréée du commerçant sous forme d'agrégat journalier : base HT et TVA par taux, par catégorie (livraison de biens, prestation de services, etc.), sans donnée personnelle (officiel).
3. Les textes officiels citent le récapitulatif journalier de caisse (« ticket Z ») comme source possible de ces données et les logiciels de caisse comme source possible du fichier. Aucun texte lu n'impose d'obligation propre à l'éditeur de caisse. Le périmètre exact « logiciel de caisse » n'est pas tranché dans ce que nous avons lu.
4. Une caisse qui émet des factures à des entreprises établies en France devra passer par une plateforme agréée au plus tard le 01/09/2027, dans l'un des trois formats du socle (Factur-X, UBL, CII), avec 4 mentions nouvelles dès le 01/09/2026 (officiel).
5. Le portail public de facturation (PPF) n'est plus une plateforme d'émission ou de réception : il tient l'annuaire central et concentre les données ; les plateformes agréées (ex-PDP) font le travail. Un logiciel comme FLŌW est une « solution compatible » : non immatriculée, obligatoirement raccordée à au moins une plateforme agréée (officiel).
6. Le raccordement est faisable sans devenir plateforme : Pennylane annonce 0 € de licence et 2 à 4 semaines d'intégration (éditeur) ; Super PDP publie des tarifs (0,01 € HT par facture en API, une journée d'e-reporting de caisse comptée comme une facture) (éditeur, lu le 20/10/2026) ; JDC et Cashmag annoncent un raccordement à Pennylane sans date ni prix de service précis (éditeur).
7. FLŌW a déjà la bonne matière : clôtures journalières signées avec ventilation HT et TVA par taux, facture entreprise depuis le ticket avec SIRENE, numérotation sans trou. Il lui manque tout le raccordement : modèle de facture dédié, XML conforme, plateforme, flux e-reporting, statuts, avoirs, archivage des preuves.
8. Le code Factur-X actuel est un brouillon non raccordé : il ne sert que la voie des commandes B2B, pas la facture en un geste depuis le ticket, et son profil et sa ventilation de TVA sont à revalider avec un validateur officiel.
9. Concurrence : JDC et Cashmag (via Pennylane), Hiboutik et EBP (annonce générale, plateforme non nommée) se positionnent ; L'Addition, Innovorder, Lightspeed et Tiller sont cités par un article secondaire non vérifié. La fenêtre pour FLŌW est d'environ un an, pas d'avance.
10. Effort total estimé pour un fondateur seul à temps partiel : M à L, tenable d'ici septembre 2027 si la plateforme partenaire est choisie avant fin janvier 2027 et si l'on vise d'abord l'e-reporting B2C (le plus utile aux commerçants) puis la facture entreprise.

## 2. Calendrier en vigueur (à la date du 20/10/2026)

### 2.1 Dates

| Obligation | GE et ETI | Micro-entreprises, petites et moyennes entreprises |
|---|---|---|
| Réception des factures électroniques | 01/09/2026 | 01/09/2026 |
| Émission des factures électroniques | 01/09/2026 | au plus tard 01/09/2027 |
| E-reporting (transactions B2C et B2B international) | 01/09/2026 | au plus tard 01/09/2027 |

Sources (officiel) :

- Fiche 1 DGFiP, mise à jour juin 2026 : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-1_que-va-t-il-se-passer-pour-mon-entreprise.pdf
- Fiche 3 DGFiP, mise à jour octobre 2026 : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-3_tpe_a-partir-de-quand-mon-entreprise-doit-etre-prete.pdf
- FAQ DGFiP, version du 01/09/2026, questions 5.1 et 8.1 : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/faq---fe_je-decouvre-la-facturation-electronique.pdf
- BOFiP ACTU-2026-00145 du 30/09/2026 (mêmes dates, fondées sur l'article 26 de la loi n° 2022-1157 du 16/08/2022) : https://bofip.impots.gouv.fr/bofip/15176-PGP.html/ACTU-2026-00145
- BOI-TVA-DECLA-20-30-50-10 §150 : l'obligation d'e-reporting B2C s'applique aux opérations dont le fait générateur intervient à compter du 01/09/2027 pour les entreprises concernées : https://bofip.impots.gouv.fr/bofip/13898-PGP.html/identifiant=BOI-TVA-DECLA-20-30-50-10-20260930

### 2.2 Précisions utiles

- La taille s'apprécie à l'unité légale (SIREN). Définitions DGFiP (fiche 1, notes de bas de page) : microentreprise = effectif inférieur à 10 et CA inférieur à 2 M€ ou total de bilan inférieur à 2 M€ ; PME = effectif entre 10 et 250 et CA inférieur à 50 M€ ou total de bilan inférieur à 43 M€ (officiel).
- Les franchisés en base de TVA (art. 293 B CGI) doivent aussi recevoir et émettre en électronique (fiche 1, officiel).
- Entrée anticipée possible pour les TPE et PME ; elle vaut pour la facture mais n'a pas d'effet sur le calendrier de l'e-reporting, que l'entreprise peut rejoindre séparément au plus tard le 01/09/2027 (FAQ 1.3, officiel).
- Le choix de la plateforme est libre, on peut en choisir plusieurs, changer à tout moment, et choisir des plateformes différentes pour l'émission, la réception et l'e-reporting (FAQ 2.1 et 2.2, officiel).
- Tolérance de démarrage : le guide pratique de démarrage (DGFiP) précise que pendant la phase de démarrage il n'y aura pas de sanction pour les entreprises qui rencontrent des difficultés mais sont « engagées dans une trajectoire sérieuse de mise en conformité », et que cela « ne constitue ni un report ni une suspension de l'obligation » (officiel) : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf

### 2.3 Historique des textes et dernière version

- Fondement : article 26 de la loi n° 2022-1157 du 16/08/2022 (LFR 2022), décret n° 2022-1299 du 07/10/2022 (cité par la FAQ DGFiP 3.4), articles 289 bis, 289 E, 290 et 290 A du CGI, article 242 nonies M de l'annexe II au CGI (officiel, via FAQ et BOFiP ci-dessus).
- Reports successifs : la date initiale de juillet 2024 a été déplacée. Les sources lues indiquent l'article 91 de la loi n° 2023-1322 du 29/12/2023 (LF 2024) et le décret n° 2024-266 du 25/03/2024 comme fixant 2026 et 2027. Ces deux références viennent d'un résumé de recherche web de sources secondaires et n'ont pas été relues sur Légifrance (non vérifié).
- Réorientation d'octobre 2024 : les spécifications externes v3.2 mentionnent un « communiqué de presse du 15 octobre 2024 » qui a réorienté la réforme (fin du rôle du PPF comme plateforme d'émission et de réception). Source : dossier général v3.2, note 3 (officiel).
- Loi de finances pour 2026 : l'article 123 « aménage » l'obligation et élargit le périmètre de l'e-reporting, selon un commentaire de cabinet (secondaire : https://kpmg.com/av/fr/avocats/eclairages/2026/03/facturation-electronique-amenagement-des-obligations-et-renforcement-des-sanctions.html). Les spécifications v3.2 (§2.3.3) disent que l'accord formel de désignation de la plateforme de réception, le renforcement de l'audit des plateformes et l'encadrement de la portabilité « sont présents dans la loi de finances pour 2026 » (officiel). La référence de la loi (n° 2026-103 du 19/02/2026) figure dans `docs/legal/BOI-LETTRE-000242-20260325.md` du dépôt, issue du BOFiP.
- Loi de finances rectificative 2025 : aucune LFR 2025 modifiant ce calendrier n'a été trouvée. Cela ne prouve pas qu'elle n'existe pas (non vérifié).
- Aucune source officielle lue ne signale de report du 01/09/2027. Des sources secondaires indiquent « pas de report » au 06/10/2026 (secondaire). La faculté légale de décaler par décret de trois mois est évoquée par une source secondaire comme non utilisée (non vérifié).
- Sanctions : des sources secondaires citent 50 € par facture non émise électroniquement (plafond 15 000 € par an) et 500 € par transmission d'e-reporting manquante (plafond 15 000 € par an), contre 15 € et 250 € auparavant. Aucun montant n'est donné sur impots.gouv.fr dans les pages lues (la page https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique ne cite aucun montant). Non vérifié : ne pas utiliser publiquement.

## 3. Ce qui concerne un commerçant au détail vendant à des particuliers

### 3.1 Obligation : e-reporting de transaction, pas facture

- Si le client est un particulier ou une personne morale non assujettie, l'entreprise transmet des données à l'administration au titre de l'e-reporting (I de l'article 290 CGI). Si le client est un professionnel établi en France, il faut émettre une facture électronique (FAQ 1.1, officiel).
- Le redevable de l'obligation est l'assujetti fournisseur du bien ou prestataire du service, donc le commerçant (BOI-TVA-DECLA-20-30-50-10 §80, officiel).
- Aucune donnée personnelle n'est demandée ; seules des données globalisées à la journée sont attendues (fiche 7 DGFiP, mise à jour octobre 2026, officiel) : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-7_tpe_transmission-des-donnees-de-transaction.pdf
- Les opérations hors champ de la TVA et les opérations exonérées au titre des articles 261 à 261 E CGI sont exclues (FAQ 1.2 et 7.2, officiel).

### 3.2 Données à transmettre

D'après le tableau DGFiP « Données de transaction à transmettre, mise à jour août 2026 » (opérations B2C, article 242 nonies M de l'annexe II au CGI), agrégées par jour (officiel) : https://www.impots.gouv.fr/e-reporting-donnees-de-transaction (PDF « Données de transaction à transmettre », mise à jour août 2026).

- Liées à la transmission : SIREN du redevable, période de transmission, mention de l'option pour le paiement de la taxe d'après les débits le cas échéant.
- Par jour et par catégorie de transactions (livraisons de biens soumises à TVA ; prestations de services soumises à TVA ; opérations intracommunautaires ; TVA sur la marge) : base d'imposition totale HT de la journée et montant de TVA correspondant, par taux si plusieurs taux s'appliquent, en euros.
- Le BOFiP (BOI-TVA-DECLA-20-30-50-20, §50 et §60) confirme : données « globalisées par jour », par taux de TVA, avec la date et la devise : https://bofip.impots.gouv.fr/bofip/13899-PGP.html/identifiant=BOI-TVA-DECLA-20-30-50-20-20260930
- Le nombre de transactions : la balise existe dans le schéma (TT-85) mais une simplification validée le 29/08/2025 la rend facultative ; aucune obligation de « e-reporting à blanc » les jours sans opération (dossier de spécifications externes v3.2, §2.3.3, officiel).
- TVA sur la marge en B2C : une méthode simplifiée par taux de marge moyen est tolérée (spécifications v3.2 §2.3.3 et BOFiP §60 remarque, officiel).
- Schéma XML officiel du bloc « Transactions » (TG-31) : date, devise, option paiement TVA, catégorie de transactions, montant total HT, montant total TVA, nombre de transactions (facultatif), répartition par taux (taux, base, montant TVA). Source : fichier `transaction.xsd` du zip v3.2, https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/specification_externes_b2b/specifications-externes-v3.2.zip (officiel).

### 3.3 Périodicité et délai

BOI-TVA-DECLA-20-30-50-30 (en vigueur depuis le 30/09/2026), officiel : https://bofip.impots.gouv.fr/bofip/13900-PGP.html/identifiant=BOI-TVA-DECLA-20-30-50-30-20260930

| Régime de TVA du commerçant | Fréquence | Délai |
|---|---|---|
| Réel normal mensuel | 3 transmissions par mois (1 à 10, 11 à 20, 21 à fin de mois) | 10 jours après la fin de la période |
| Réel normal trimestriel et régime simplifié | mensuelle | réel normal : 10 jours ; régime simplifié : entre le 25 et la fin du mois suivant |
| Franchise en base, forfaits de remboursement | tous les bimestres civils | entre le 25 et la fin du mois suivant la période |

Le fait générateur de la transmission est la date de réalisation de l'opération (spécifications v3.2 §3.7.7, note 125). La transmission se fait par la plateforme agréée vers le PPF, agrégée par déclarant à la maille SIREN (v3.2 §3.7.7, officiel). Aucune transmission n'est attendue si aucune opération n'a eu lieu sur la période (§80).

### 3.4 Le ticket de caisse est-il concerné ?

- Le ticket n'est pas transmis ticket par ticket : on transmet un agrégat journalier (fiche 7, officiel).
- Les spécifications externes v3.2 (§3.7.6, note 121) disent que les données agrégées « peuvent correspondre aux données d'un récapitulatif journalier édité par un système de caisse, dit ticket Z ou Z de caisse » (officiel).
- La fiche 7 dit que les données peuvent être saisies sur la plateforme ou transmises « par le biais d'un fichier informatique issu d'une solution compatible (par exemple les logiciels de caisse, facturation...) » (officiel).
- Données de paiement (e-reporting de paiement) : seulement pour les opérations dont la TVA est exigible à l'encaissement (prestations de services sans option pour les débits, acomptes). Elles sont transmises par un flux XML dédié pour les opérations B2C, au titre d'une journée (FAQ 10.1 et 10.3, spécifications §3.7.6, officiel). Pour un commerce de biens, ce volet ne s'applique a priori pas ; pour la restauration ou les services, à faire valider.
- Le BOFiP « champ d'application » (BOI-TVA-DECLA-20-30-50-10) ne contient pas les mots « caisse » ni « ticket » (vérifié sur la page).
- **Ce qui n'est pas tranché** dans les textes lus : si une obligation, un label ou une certification s'applique à l'éditeur de caisse lui-même au titre de cette réforme (distincte de l'attestation d'inaltérabilité du 3° bis du I de l'article 286 CGI), et si le fichier de caisse doit respecter un format imposé autre que celui de la plateforme choisie. Une source secondaire écrit que cette partie « doit encore être clarifiée par l'administration » (https://www.expert-comptable-tpe.fr/articles/facturation-electronique/, secondaire).

## 4. Une caisse qui émet des factures entreprise (B2B)

### 4.1 Obligations d'émission

- À compter du 01/09/2027 pour les micro-entreprises, petites et moyennes entreprises : émettre les factures par l'intermédiaire d'une plateforme agréée pour les opérations entre assujettis établis en France (FAQ 3.1, 4.1, 5.1 ; fiche 3, officiel). Un PDF simple envoyé par e-mail n'est pas une facture électronique au sens du dispositif (FAQ 3.1).
- Dès aujourd'hui, une entreprise destinataire doit accepter une facture électronique si son fournisseur en émet une (FAQ 5.3).
- Cas du client professionnel sans SIREN ou pas encore dans l'annuaire : tolérance annoncée, le fournisseur fait un e-reporting comme pour un non-assujetti (spécifications v3.2 §2.3.3, officiel). À confirmer au moment de l'application.
- Un refus ou un rejet impose au fournisseur une annulation comptable (avoir interne) sans flux de données au PPF (spécifications v3.2 §3.6.4, officiel).

### 4.2 Mentions obligatoires nouvelles

La FAQ DGFiP 3.4 (décret n° 2022-1299, officiel) fixe 4 mentions nouvelles à compter du 01/09/2026 : le SIREN du client ; la catégorie de l'opération (livraison de biens, prestation de services, ou double) ; l'option de paiement de la TVA sur les débits le cas échéant ; l'adresse de livraison des biens si elle diffère de l'adresse de facturation. Les autres mentions du Code de commerce et du CGI sont inchangées. Les données structurées transmises à l'administration passent de 26 données obligatoires en 2026 à 34 dès 2027 (FAQ 6.3, officiel).

### 4.3 Formats

- Socle minimal des plateformes : UBL, CII et Factur-X, sur le modèle sémantique de la norme européenne EN 16931 (spécifications v3.2 §2.3.10, officiel). Le CII retenu est la version D22B (note 100).
- Les plateformes peuvent convertir d'un format à l'autre pour leur client (§3.2, flux F2 et F3).
- Normes de référence : AFNOR XP Z12-012 (formats et profils des factures et statuts), XP Z12-013 (API entre systèmes d'entreprise et plateformes agréées), XP Z12-014 (cas d'usage B2B), téléchargeables sur le site de l'AFNOR (liens listés sur https://www.impots.gouv.fr/specifications-externes-b2b, officiel). Non lues pour cette étude : le profil Factur-X exact attendu (MINIMUM, BASIC, EN 16931, EXTENDED) est à vérifier dans XP Z12-012.

### 4.4 Annuaire central et « adresse de facturation »

- L'annuaire est géré par le PPF et contient la plateforme de réception de chaque entreprise ; le fournisseur (via son système, une solution compatible ou sa plateforme d'émission) le consulte pour adresser la facture (spécifications v3.2 §3.5.4, officiel).
- Mailles d'adressage : unité légale (SIREN), établissement (SIRET), code routage, suffixe. Par défaut une ligne SIREN pour chaque entreprise privée (§3.5.3, officiel).
- Le terme « adresse de facturation électronique » n'a pas été trouvé comme notion officielle ; l'adressage s'appuie sur ces lignes d'annuaire. Chaque entreprise signe un accord formel avec la plateforme de réception qu'elle désigne dans l'annuaire (FAQ 2.1, officiel).
- Le zip v3.2 contient une description OpenAPI « annuaire public » (fichier `ppf-openapi-annuaire-api-public-1.11.0-openapi.json`). Les conditions d'accès à ce service pour un éditeur n'ont pas été lues (non vérifié).

### 4.5 Cycle de vie (statuts)

Statuts obligatoires transmis à l'administration (format CDAR) : 200 Déposée, 210 Refusée, 212 Encaissée, 213 Rejetée. Les autres (Émise par la plateforme, Reçue, Mise à disposition, Prise en charge, Approuvée, En litige, Suspendue, Complétée, Paiement transmis) sont facultatifs (spécifications v3.2 §3.6.4, tableau 8, officiel). Délai de 24 h pour les flux de données de facture et de statuts obligatoires vers le PPF (§3.6.5 et §3.6.6).

## 5. Architecture et acteurs

### 5.1 Vocabulaire officiel actuel (vérifié)

- **Plateforme agréée (PA)** : anciennement « plateforme de dématérialisation partenaire (PDP) » ; opérateur immatriculé par la DGFiP pour trois ans renouvelables. Elle émet, transmet et reçoit les factures et transmet les données de facture, de transaction et de paiement. Source : présentation des marques de garantie, septembre 2025, https://www.impots.gouv.fr/presentation-des-logos-plateforme-agreee-et-solution-compatible (officiel).
- **Solution compatible (SC)** : anciennement « opérateur de dématérialisation (OD) » ou logiciel de l'entreprise (logiciel comptable, de facturation, caisse enregistreuse...). Elle n'est pas immatriculée, ne transmet ni les factures ni les données à l'administration directement, et doit obligatoirement être raccordée à une plateforme agréée pour utiliser le label « Solution compatible ». Elle peut agir au nom et pour le compte de l'entreprise auprès des plateformes de son choix (spécifications v3.2 §2.3.4, officiel). Condition légale d'une solution compatible : fonctionnalités compatibles avec les attendus de la réforme et connexion à au moins une plateforme agréée (FAQ 2.3, officiel). La procédure pour obtenir le label n'a pas été trouvée (non vérifié).
- **Portail public de facturation (PPF)** : tient l'annuaire central, concentre les données de facturation, de transaction, de paiement et les statuts pour le compte de l'administration (spécifications v3.2 §2.3.4, officiel). L'abandon du PPF comme solution d'émission et de réception gratuite est confirmé par plusieurs sources dont une note officielle des spécifications (note 3) et un commentaire de cabinet (secondaire).
- **Chorus Pro** : plateforme du secteur public ; reste le point d'entrée pour les factures vers l'État et les collectivités (FAQ 11, officiel).
- **Peppol** : réseau d'interopérabilité complémentaire entre plateformes agréées, cité dans les spécifications v3.2 §2.3.10. Une plateforme qui échoue à interopérer avec une autre peut devoir recourir à ce protocole. Pour FLŌW : pas d'accès direct à envisager, c'est l'affaire de la plateforme choisie (déduction, à confirmer).

### 5.2 Liste officielle des plateformes

- Page : https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees (publiée le 30/07/2024, modifiée le 13/10/2026, officiel).
- Deux listes en PDF, ODS, XLSX : opérateurs satisfaisant à l'ensemble des conditions y compris les tests d'interopérabilité (liste dite `liste_pa_attente_rapport_audit`, environ 155 lignes dont 6 avec numéro d'immatriculation « En attente », comptage approximatif par nos soins) ; et opérateurs au dossier complet en attente d'immatriculation définitive, 9 lignes (Basikon, Cense, Eaglessoft, EY Expertises & Transactions, Konica Minolta, Ponsot Conseil Gestion, Sage Holding France, Swile, Taxilla Europe).
- Dans la première liste figurent notamment (date de délivrance du numéro, officiel) : Pennylane (11/12/25), Iopole (11/12/25), Qonto (18/12/25), Sage (22/12/25), Super PDP (22/12/25), Tiime PDP (18/12/25), Cegid (18/12/25), B2Brouter (12/12/25), Axonaut, Sellsy, Odoo (15/04/26), VosFactures (15/04/26) et fiskaltrust (28/08/26), middleware de fiscalisation de caisses. La présence sur la liste ne dit rien de l'offre pour éditeurs de caisse.
- Fichiers de la liste : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/listes_plateformes_agreees/liste_pa_attente_rapport_audit.pdf et `liste_pa_attente_test_interop.pdf` dans le même dossier.

### 5.3 Plateformes qui s'adressent aux éditeurs (relevé du 20/10/2026, à reconfirmer)

| Plateforme | Ce que dit la page de l'éditeur | Niveau |
|---|---|---|
| Pennylane (programme Solutions Compatibles) | « 0 € de coût : aucun frais de licence ou d'usage pour votre solution » ; API REST AFNOR ; bac à sable ; intégration moyenne de 2 à 4 semaines ; marque grise (Pennylane reste identifiée comme plateforme agréée) ; clause de non-sollicitation des clients de l'éditeur ; France uniquement, international via Peppol ; la page ne traite pas de l'e-reporting B2C ni des caisses. Page : https://www.pennylane.com/fr/facture-electronique-scpa | Éditeur |
| Super PDP | Tarifs publics : compte gratuit jusqu'à 1 000 factures par mois ; API 0,01 € HT par facture de 0 à 10 000 par mois, 0,005 € HT de 10 000 à 100 000, 0,0025 € HT au-delà ; vérification KYC/KYB 2,00 € HT ; minimum de facturation de 10,00 € HT par an. FAQ : marque grise possible au tarif de gros, l'éditeur paie et peut refacturer. L'e-reporting de caisse y est cité : « Une journée est comptée comme une facture, quel que soit le nombre d'encaissements ». Fonctionnalités : e-reporting issu des logiciels de caisse pour les ventes B2C, API suivant XP Z12-013, 30 appels par seconde par clé. Pages : https://www.superpdp.tech/tarifs et https://www.superpdp.tech/fonctionnalites | Éditeur |
| JDC (Kezia, Popina) et Cashmag | Tous deux annoncent travailler avec Pennylane. JDC : offre « sans surcoût avec votre abonnement caisse JDC » (04/06/2026). Cashmag : « Les modalités de déploiement seront précisées progressivement », aucune date (20/05/2026). Pages : https://www.jdc.fr/blog/abandon-portail-public-facturation-obligatoire-choisir-pa et https://cashmag.fr/facturation-electronique-caisse-enregistreuse-rfe/ | Éditeur |
| Les autres plateformes (Iopole, B2Brouter, Tiime, Qonto, Sage, Cegid, Docaposte, Storecove...) | Accès éditeur, conditions et tarifs non lus : à demander | Non vérifié |

Calcul illustratif sur tarif public Super PDP, à confirmer par écrit avec eux : un point de vente transmettant une journée par jour, 365 jours, au palier 0,01 € HT, représente environ 3,65 € HT par an et par point de vente. Ce calcul suppose que les paliers s'appliquent comme lu et ne comprend pas le KYC à 2,00 € HT ni d'éventuels frais d'une autre nature.

### 5.4 Spécifications officielles

- Dossier de spécifications externes de la facturation électronique, version 3.2 du 30/04/2026 (AIFE, DGFiP), dossier général, annexes (e-invoicing, cycle de vie, annuaire, e-reporting, règles de gestion), XSD, swaggers. Les versions antérieures (3.1 du 31/10/2025, 3.0 du 18/12/2024, 2.4...) restent disponibles. Page, publiée le 30/09/2021 et modifiée le 02/07/2026 : https://www.impots.gouv.fr/specifications-externes-b2b (officiel).
- Une version 3.1 du 31/10/2025 est parfois citée comme dernière version par des sites tiers : elle est dépassée.
- Annexes v3.2 : Annexe 1 e-invoicing v1.2, Annexe 2 cycle de vie v2.3, Annexe 3 annuaire v1.8, Annexe 6 e-reporting v1.10, Annexe 7 règles de gestion v1.9 (noms des fichiers du zip).

## 6. Ce que fait la concurrence

Sources officielles insuffisantes ; relevé des annonces des éditeurs et de sources secondaires, 20/10/2026. Cette partie n'est pas exhaustive : ne pas trouver d'annonce ne prouve pas qu'elle n'existe pas.

| Éditeur | Ce qui est dit | Niveau |
|---|---|---|
| Hiboutik | Page d'accueil : « Hiboutik gère la facturation électronique et le e-reporting ». Aucune plateforme agréée nommée, aucun détail sur la méthode (https://www.hiboutik.com/fr/) | Éditeur, non prouvé |
| EBP | Glossaire e-reporting : le logiciel de gestion EBP « intègre nativement les fonctionnalités d'e-reporting » ; plateforme agréée non nommée ; rien de précis sur le module caisse (https://www.ebp.com/glossaire/e-reporting/). La brochure Pack Point de Vente 2025 citée dans `reports/Concurrence caisses et axes de victoire.md` évoque Factur-X et Chorus Pro | Éditeur, non prouvé pour la caisse |
| JDC (Kezia, Popina), Cashmag | Raccordement annoncé à Pennylane, sans date (voir 5.3) | Éditeur |
| L'Addition, Innovorder | Un article du 21/04/2026 les décrit comme prenant déjà en charge l'e-reporting B2C via une plateforme partenaire non nommée (https://www.infos-pa.com/articles/logiciels-caisse-restauration-lightspeed-laddition-innovorder-tiller-pa) ; l'article ne cite aucune source primaire | Secondaire, non vérifié |
| Lightspeed, Tiller (SumUp) | Même article : Lightspeed « prévu » via un connecteur, Tiller « annoncé, périmètre incertain » ; même limite | Secondaire, non vérifié |
| fiskaltrust | Immatriculée plateforme agréée le 28/08/2026 (liste officielle). Son offre pour les éditeurs de caisse n'a pas été lue | Officiel pour l'immatriculation |
| SumUp, Square, Zelty, Cashpad, Popina, Sunday, myPOS, Tactill | Aucune annonce trouvée dans cette recherche | Non trouvé |

Conclusion prudente : plusieurs éditeurs de caisse annoncent déjà un chemin, au moins par Pennylane. FLŌW n'est pas seul dans la fenêtre, et rien ici ne prouve qu'un concurrent soit réellement en production.

## 7. Cartographie de FLŌW et écart à combler

Lecture du code le 20/10/2026, sans exécution des tests ni de la génération XML. Fichiers sous `apps/api/src` et `apps/api/prisma/schema.prisma`.

### 7.1 Ce que FLŌW a déjà

- **Facture entreprise en un geste depuis le ticket** (`receipts/invoice.service.ts`) : choix de l'entreprise par recherche SIRENE (API `recherche-entreprises.api.gouv.fr`, `companies/companies.service.ts`), validation SIRET et SIREN, numéro attribué dans une transaction via `InvoiceSequence` (« FA-année-numéro », sans trou), rattachement au ticket signé, client B2B réutilisé par SIRET, PDF A4 avec mentions de pénalité de retard et indemnité de 40 €, envoi par e-mail. Refuse la facturation d'un remboursement (ligne 41). Ne produit pas de XML et n'appelle aucune plateforme.
- **Voie commandes B2B** (`invoices/invoices.service.ts`, `invoices/facturx.service.ts`, `b2b/`) : numérotation, export XML Factur-X, appel d'un endpoint configurable `pdpEndpoint` avec jeton chiffré (`sendToPDP`, ligne 138), réglages `pdpName`, `pdpEndpoint`, `pdpApiKey`, `pdpEnabled` dans `OrganizationSettings` et un écran de paramètres.
- **Clôtures journalières signées** (`compliance/closures.service.ts`, modèle `FiscalClosure`) : par site et par jour d'activité, avec `taxBreakdown` (taux, HT, TVA, TTC), remboursements pris en compte, chaîne de hachage, clôture automatique, cumuls mensuels et annuels, archives JSON scellées et signées (`archives.service.ts`).
- **Client** : `Customer` (fidélité) et `B2BClient` (SIRET, TVA, adresse, délai de paiement).
- **Attestation** NF525/286 I 3° bis (dossier `compliance/`) : sujet distinct, ne couvre pas la facturation électronique.

### 7.2 Constats sur le code existant

- La génération Factur-X annonce le profil « MINIMUM » (ligne 4) mais écrit des lignes de facture ; un profil MINIMUM ne porte en principe pas de lignes (à vérifier avec un validateur officiel). Elle écrit un seul groupe de TVA avec catégorie `S` sans taux (lignes 124 à 129), insuffisant dès qu'une facture mêle plusieurs taux. Le XML n'est pas intégré à un PDF/A-3, ce qui est la définition d'un Factur-X (non vérifié par test).
- Les commentaires du code (« Deadline France: septembre 2026 », ligne 6 ; « Plateforme Agréée (sept. 2026) » dans le schéma) sont périmés pour l'émission des TPE et PME.
- `sendToPDP` envoie du XML en POST brut avec jeton : ce n'est pas l'API normalisée XP Z12-013 ni un protocole d'une plateforme précise. C'est un emplacement, pas un raccordement.
- La facture en un geste depuis le ticket et la voie B2B ne partagent ni modèle ni génération ; la facture depuis le ticket est la plus utile aux commerçants et n'a pas de XML.
- Le statut de facture (`InvoiceStatus`, ligne 7) est un type TypeScript non persisté ; `updateStatus` traduit en statut de commande. Aucun statut de cycle de vie de la réforme n'est mémorisé.
- Les clôtures contiennent toutes les ventes, y compris celles facturées à une entreprise. Pour l'e-reporting B2C, une vente facturée en B2B ne devrait pas être comptée deux fois : à confirmer par la plateforme et la doctrine (déduction, non sourcée).
- Les clôtures sont par site. L'e-reporting est agrégé à la maille du SIREN (v3.2 §3.7.7) : une organisation à plusieurs boutiques demande une consolidation.
- La catégorie « livraison de biens ou prestation de services » n'existe que par organisation (`sector`, utilisée par `invoice.service.ts`) ; l'e-reporting l'attend par catégorie de transactions. Un restaurateur ou un commerce mixte demande une qualification par ligne, à faire valider juridiquement.

### 7.3 Écart, par morceau

Efforts pour un développeur seul à temps partiel : S = quelques jours, M = 2 à 4 semaines, L = plus d'un mois. Estimations de travail, non engageantes.

| Morceau | Écart | Effort | Dépendances |
|---|---|---|---|
| Modèle de données | Entité de facture propre (statut de réforme, identifiants de flux, XML archivé), journal des transmissions d'e-reporting par jour et par SIREN, option TVA débits, SIREN client obligatoire, adresse de livraison, catégorie LB ou PS par produit, avoir lié à la facture d'origine, lien vers la plateforme choisie (aujourd'hui des champs libres sur `OrganizationSettings`) | M | Réponse des plateformes sur les identifiants et les corrections de flux |
| Génération du document de facture | XML UBL ou CII conforme EN 16931 (profil à vérifier dans XP Z12-012), ventilation par taux, PDF/A-3 avec XML si Factur-X, validation avec les schémas du zip v3.2 | M (S si la plateforme accepte un format simple et convertit : Pennylane annonce convertir en Factur-X, UBL, CII) | Plateforme, lecture d'XP Z12-012 |
| Raccordement à une plateforme agréée | Client API (idéalement XP Z12-013), authentification, reprise sur erreur, bac à sable puis production, onboarding des commerçants (accord formel de désignation, KYC) | M pour une plateforme ; L si plusieurs derrière une interface commune | Choix de la plateforme, compte éditeur, coûts à demander (hors Super PDP : tarifs publics ; Pennylane : « 0 € » annoncé) |
| E-reporting B2C quotidien | Extraire des clôtures le HT et la TVA par taux par catégorie, retirer les ventes facturées en B2B (à confirmer), consolider par SIREN, déclencher selon la fréquence du régime de TVA du commerçant, gérer la correction d'une journée déjà transmise, gérer les ventes hors ligne qui arrivent tard (les clôtures sont figées, une rectification exige un mécanisme) | M | Format exact attendu par la plateforme, rectification, qualification LB et PS |
| Statuts de cycle de vie | Recevoir (webhooks ou interrogation) Déposée, Rejetée, Refusée, Encaissée, mettre à jour l'écran des factures, traiter rejet et refus par un avoir interne | M | API de la plateforme |
| Archivage | Conserver une copie du XML, du PDF et des accusés de la plateforme ; durée de six ans citée par un BOFiP de 2018 pour les factures électroniques (art. 289 V CGI), à valider ; le dispositif d'archives signées des clôtures peut servir de modèle | S à M | Validation juridique de la durée ; ce que fait la plateforme (Légifrance cité par une recherche : elle doit garantir authenticité, intégrité et lisibilité, secondaire) |
| Consultation de l'annuaire | Vérifier qu'une entreprise reçoit des factures électroniques avant d'émettre ; la recherche SIRENE existe déjà | S | Accès à l'annuaire par la plateforme ou l'API publique (conditions non lues) |
| Réception de factures fournisseurs | Hors du périmètre d'une caisse ; chaque commerçant doit déjà avoir désigné une plateforme de réception depuis le 01/09/2026 (fiche 3). FLŌW peut seulement l'expliquer | non applicable | |

## 8. Plan réaliste pour un fondateur seul à temps partiel (octobre 2026 à septembre 2027)

Hypothèse : environ 10 mois utiles, quelques jours par semaine. Le plan protège d'abord le plus petit morceau utile : l'e-reporting B2C, puis la facture entreprise.

1. **Novembre 2026 : décider.** Lire XP Z12-012, 013, 014 (téléchargement gratuit sur le site de l'AFNOR) et le dossier v3.2. Contacter 3 à 5 plateformes (Pennylane, Super PDP, Iopole, Tiime, une autre) avec les 5 questions de la section 9. Choisir une plateforme pour le pilote et une de repli. Corriger les commentaires périmés du code.
2. **Décembre 2026 à janvier 2027 : modèle et bac à sable.** Modèle de données (7.3), compte éditeur, premier échange en bac à sable : dépôt d'une facture test, réception d'un statut.
3. **Février à mars 2027 : e-reporting B2C.** Produire le flux journalier depuis les clôtures, le déposer en bac à sable, gérer les rectifications et les journées sans vente. Prévoir une version de repli : un fichier journalier téléchargeable que le commerçant dépose lui-même chez sa plateforme (la fiche 7 prévoit la saisie ou le dépôt d'un fichier), à tester avec au moins une plateforme.
4. **Avril à mai 2027 : facture entreprise.** Générer le document conforme depuis la facture en un geste, envoyer par la plateforme, afficher les statuts, gérer l'avoir.
5. **Juin 2027 : pilote.** 1 à 3 commerçants volontaires en production réelle (entrée anticipée possible en facturation, FAQ 1.3), sans communication publique d'avance.
6. **Juillet à août 2027 : durcir.** Journal d'incidents, documentation commerçant, procédure d'indisponibilité de la plateforme (le guide de démarrage décrit la régularisation différée), mise à jour du registre d'attestation si le périmètre fonctionnel change.

**Ce qui peut attendre un client pilote** : production réelle chez la plateforme (comptes, KYC, accord formel de désignation), tarif définitif de refacturation aux commerçants, deuxième plateforme, e-reporting de paiement pour les prestations de services, TVA sur la marge, cas multi-boutiques complexes, ventes à l'étranger, rectifications historiques volumineuses.

**Ce qui ne peut pas attendre** : le choix de la plateforme (fin janvier 2027) et la lecture de l'e-reporting avec elle (fin février 2027), car tout le reste dépend du format qu'elle attend.

## 9. Les 5 questions à poser aux plateformes candidates

1. **Accès éditeur et contrat** : quelles conditions pour un éditeur de caisse (marque grise ou blanche, contrat, prix de gros ou gratuité, minimum annuel, KYC par commerçant et son coût, accord formel de désignation signé par le commerçant, délai avant la production, bac à sable disponible dès maintenant, clause de non-sollicitation) ?
2. **E-reporting B2C par API** : acceptez-vous le flux de transaction journalier d'un logiciel de caisse via votre API (format et schéma attendus, maille SIREN et jour, catégories de transactions, rectification d'une journée, consolidation de plusieurs boutiques), comment est-il facturé (« une journée = une facture » ?), et l'e-reporting de paiement est-il couvert ?
3. **Prix publics et engagements** : grille complète par commerçant et par volume, coûts cachés (KYC, support, hébergement, archivage), engagement, plafonds, conditions de sortie.
4. **Cycle de vie et fiabilité** : comment recevons-nous les statuts (webhooks ou interrogation), engagement de disponibilité, comportement en cas de rejet, traitement des avoirs, formats acceptés en entrée (nous fournissons un XML conforme, ou vous convertissez à partir de données simples), état de votre immatriculation (définitive ou en attente) ?
5. **Portabilité et conservation** : votre API suit-elle XP Z12-013, comment migrer vers une autre plateforme sans perdre les identifiants ni l'historique, durée et lieu de conservation des factures et des preuves, export complet, que se passe-t-il si votre immatriculation n'est pas renouvelée ?

## 10. Ce que nous ne savons pas encore

- Le périmètre exact « logiciel de caisse » : aucune obligation propre à l'éditeur trouvée dans les textes lus, mais aucune confirmation de leur absence ; la procédure d'obtention du label « Solution compatible » n'a pas été trouvée.
- Le texte de loi : Légifrance et economie.gouv.fr ont répondu 403 à nos outils ; l'article 91 de la LF 2024, le décret n° 2024-266, l'article 123 de la LF 2026 et les montants des sanctions n'ont pas été relus sur le texte officiel.
- Les normes AFNOR XP Z12-012, 013, 014 n'ont pas été lues : profil Factur-X attendu, couverture de l'e-reporting par XP Z12-013, schémas de rectification.
- Le traitement des ventes en caisse ensuite facturées à une entreprise (exclusion de l'e-reporting) et le traitement des remboursements après facturation.
- La qualification « livraison de biens » ou « prestation de services » des ventes de restauration et des commerces mixtes, et l'obligation de paiement e-reporting associée.
- L'accès éditeur et les prix de la plupart des plateformes ; l'exactitude et les dates de mise en production des annonces de Hiboutik, EBP, JDC, Cashmag, L'Addition, Innovorder, Lightspeed, Tiller.
- Les outre-mer (une FAQ dédiée existe, non lue), les franchisés en base, les associations clientes, les ventes à l'étranger.
- La durée et les modalités d'archivage applicables à FLŌW comme solution compatible.
- Un éventuel report du 01/09/2027 : aucun signal officiel lu, mais la loi de finances de l'automne 2026 n'a pas été examinée.
- Si le commerçant doit être inscrit à une plateforme pour l'e-reporting avant que FLŌW soit prêt : le commerçant peut dans tous les cas choisir une plateforme et déposer un fichier ou saisir (fiche 7), ce qui constitue un plan de repli à documenter.

## 11. Ce qu'on peut dire publiquement aujourd'hui

À dire, avec la source officielle citée dans la page :

- « Les TPE et PME doivent émettre leurs factures électroniques et transmettre leurs données de vente aux particuliers au plus tard le 1er septembre 2027 (source DGFiP). »
- « Pour les ventes aux particuliers, l'administration attend un total journalier hors taxe et de TVA par taux de TVA, transmis par une plateforme agréée. Les clôtures journalières de FLŌW sont déjà organisées par taux de TVA. »
- « FLŌW prépare son raccordement à une plateforme agréée. Nous communiquerons le nom de la plateforme et la date de disponibilité quand ils seront confirmés. »
- « Les commerçants doivent dès maintenant avoir choisi une plateforme agréée pour recevoir leurs factures fournisseurs. »
- « Une facture entreprise depuis le ticket, avec recherche SIRENE, existe déjà dans FLŌW. »

À ne pas dire :

- « Avance de plusieurs années » ou « en avance sur la réforme » : la fenêtre est d'environ un an et plusieurs éditeurs (JDC, Cashmag, Hiboutik, EBP, d'autres selon des sources non vérifiées) se positionnent déjà. `docs/veille-concurrence-2026-10.md` le dit déjà.
- « Conforme à la facturation électronique », « certifié », « raccordé à la plateforme X » ou « prêt » : rien de cela n'est vrai aujourd'hui.
- Tout montant de sanction ou date de mise à disposition de FLŌW.
- Toute affirmation sur ce que font les concurrents autre que ce qu'ils annoncent eux-mêmes, avec la formule « annonce » et la date de consultation.

Les textes publics (page web, FAQ, pitch) qui reprendront ces phrases sont à ajouter à `docs/legal/pages-a-valider.md` pour validation avant publication.

## 12. Sources principales (consultées le 20/10/2026)

Officielles :

- DGFiP, fiche 1 (juin 2026) : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-1_que-va-t-il-se-passer-pour-mon-entreprise.pdf
- DGFiP, fiche 3 (octobre 2026) : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-3_tpe_a-partir-de-quand-mon-entreprise-doit-etre-prete.pdf
- DGFiP, fiche 7 e-reporting (octobre 2026) : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiche-7_tpe_transmission-des-donnees-de-transaction.pdf
- DGFiP, FAQ du 01/09/2026 : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/faq---fe_je-decouvre-la-facturation-electronique.pdf
- DGFiP, guide pratique de démarrage : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf
- DGFiP, liste des plateformes agréées (modifiée le 13/10/2026) : https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees
- DGFiP, marques « Plateforme agréée » et « Solution compatible » : https://www.impots.gouv.fr/presentation-des-logos-plateforme-agreee-et-solution-compatible
- DGFiP et AIFE, spécifications externes v3.2 du 30/04/2026 : https://www.impots.gouv.fr/specifications-externes-b2b
- BOFiP ACTU-2026-00145 : https://bofip.impots.gouv.fr/bofip/15176-PGP.html/ACTU-2026-00145
- BOI-TVA-DECLA-20-30-50-10, -20, -30 (version du 30/09/2026) : https://bofip.impots.gouv.fr/bofip/13898-PGP.html/identifiant=BOI-TVA-DECLA-20-30-50-10-20260930 ; https://bofip.impots.gouv.fr/bofip/13899-PGP.html/identifiant=BOI-TVA-DECLA-20-30-50-20-20260930 ; https://bofip.impots.gouv.fr/bofip/13900-PGP.html/identifiant=BOI-TVA-DECLA-20-30-50-30-20260930

Annonces d'éditeurs :

- Pennylane : https://www.pennylane.com/fr/facture-electronique-scpa
- Super PDP : https://www.superpdp.tech/tarifs et https://www.superpdp.tech/fonctionnalites
- JDC : https://www.jdc.fr/blog/abandon-portail-public-facturation-obligatoire-choisir-pa
- Cashmag : https://cashmag.fr/facturation-electronique-caisse-enregistreuse-rfe/
- Hiboutik : https://www.hiboutik.com/fr/
- EBP : https://www.ebp.com/glossaire/e-reporting/

Secondaires (à ne pas citer comme preuve) :

- KPMG Avocats, droit fiscal n° 10 du 06/03/2026 : https://kpmg.com/av/fr/avocats/eclairages/2026/03/facturation-electronique-amenagement-des-obligations-et-renforcement-des-sanctions.html
- Infos PA, 21/04/2026 : https://www.infos-pa.com/articles/logiciels-caisse-restauration-lightspeed-laddition-innovorder-tiller-pa
- Expert-comptable TPE : https://www.expert-comptable-tpe.fr/articles/facturation-electronique/
