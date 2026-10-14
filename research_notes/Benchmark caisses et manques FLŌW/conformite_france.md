# Conformité légale France / UE d'un logiciel de caisse SaaS (FLŌW) : état au 14 octobre 2026

Périmètre : ce qu'un logiciel de caisse et de gestion de commandes doit implémenter pour être utilisable légalement par tout commerce français (mode, alimentaire, pâtisserie, cave, fleurs, beauté). Recherche faite le 14/10/2026. Les points non vérifiés sur une source primaire pendant cette session sont signalés comme tels.

---

## 1. Loi anti-fraude TVA (art. 286 I-3° bis CGI) : certification ou attestation

### Takeaway
**CHANGEMENT MAJEUR et récent :** la suppression de l'auto-attestation par la LF 2025, que beaucoup d'articles décrivent encore comme « certification obligatoire au 1er septembre 2026 », **a été annulée**. L'article 125 de la loi de finances pour 2026 (loi n° 2026-103 du 19 février 2026) rétablit l'attestation individuelle de l'éditeur à compter du **21 février 2026**. Aujourd'hui (oct. 2026), un commerçant prouve la conformité de sa caisse **soit** par un certificat d'un organisme accrédité (LNE/NF525 ou Infocert), **soit** par une attestation individuelle de l'éditeur établie selon le modèle BOI-LETTRE-000242. FLŌW peut donc être commercialisé légalement **sans certification**, à condition de remplir réellement les 4 conditions (inaltérabilité, sécurisation, conservation, archivage) et de remettre à chaque client une attestation individuelle conforme au modèle. Un éditeur qui atteste à tort engage sa responsabilité pénale (faux).

### Cited Findings
**Chronologie**
- LF 2025 : l'éditeur ne peut plus prouver la conformité par une attestation individuelle, seul le certificat d'un organisme accrédité vaut ; mesure en vigueur au 16 février 2025, avec transition jusqu'au 31/08/2025 pour l'attestation — [LNE](https://www.lne.fr/fr/actualites/2025/logiciels-caisses-suppression-auto-attestation-conformite-fiscale) ; [SECOFI](https://www.secofi.fr/fin-de-lauto-attestation-des-logiciels-de-caisse-14498/)
- Le délai pour que l'éditeur obtienne le certificat a été reporté du 1er mars 2026 au 31 août 2026 (commentaire BOFiP du 1er octobre 2025) — [BOFiP ACTU-2026-00073 (liens)](https://bofip.impots.gouv.fr/bofip/15035-PGP.html/ACTU-2026-00073) ; [CA Consultants](https://www.caconsultants.fr/actualites/fiscal/actualite/certification-obligatoire-des-logiciels-de-caisse-6-mois-de-plus)
- **LF 2026, art. 125 (loi n° 2026-103 du 19/02/2026)** : « rétablit la possibilité » de justifier du respect du 3° bis du I de l'art. 286 CGI par une attestation individuelle de l'éditeur ; s'applique **à compter du 21 février 2026** ; preuve par « soit le certificat délivré par un organisme accrédité, soit l'attestation individuelle établie par l'éditeur » ; modèle : BOI-LETTRE-000242 ; BOFiP mis à jour le 25/03/2026 — [BOFiP ACTU-2026-00073](https://bofip.impots.gouv.fr/bofip/15035-PGP.html/ACTU-2026-00073)
- Texte de l'art. 125 : ajoute à l'art. 286 I 3° bis « ou par une attestation individuelle de l'éditeur, conforme à un modèle fixé par l'administration » et modifie l'art. 1770 duodecies en insérant « de l'attestation ou » après « production » ; adopté via 49.3 début février 2026 — [LinuxFr / April](https://linuxfr.org/news/retablissement-de-l-auto-attestation-pour-les-logiciels-de-caisse-l-aboutissement-d-une-annee-de-mobilisation) ; [LégiFiscal](https://www.legifiscal.fr/actualites-fiscales/4460-loi-finances-2026-retablissement-auto-certification-logiciels-caisse.html) ; [Audit & Strategy](https://auditstrategy.fr/2026/03/25/logiciels-de-caisse-auto-certifies-le-retour/)
- Attention : de nombreuses pages d'éditeurs/cabinets (Wavesoft, Nautiles, BDO, compta-online) affirment encore une certification obligatoire au 1er/09/2026 ; elles sont **périmées** — ex. [Wavesoft](https://www.wavesoft.fr/Certification-obligatoire-des-logiciels-de-caisse-janvier-2026), [BDO](https://www.bdo.fr/fr-fr/blog/l-entreprise-a-360/certification-des-logiciels-et-systemes-de-caisse-nouvelles-obligations)

**Qui est concerné (BOI-TVA-DECLA-30-10-30)**
- Assujettis TVA qui enregistrent des ventes à des particuliers (B2C) sans facture dans un logiciel/système de caisse ; les entreprises purement B2B sont exclues ; les mixtes sont concernées (§10) — [BOFiP BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- Exclus : franchise en base (art. 293 B), remboursement forfaitaire agricole, opérations exclusivement exonérées (§25) ; entreprises étrangères non établies tolérées hors champ (§20) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- « Système de caisse » = système informatique doté d'une fonctionnalité de caisse qui mémorise et enregistre des règlements hors comptabilité (§30) ; tolérance pour paiements uniquement via intermédiaire bancaire accessible à l'administration (§35) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)

**Les 4 conditions : ce que le logiciel doit implémenter**
- *Inaltérabilité* : toutes les données du périmètre sont inaltérables ; corrections uniquement par opérations « + » et « – », elles-mêmes enregistrées ; toute modification laisse une trace ; deux approches : blocage fonctionnel ou preuve d'intégrité bas niveau (empreinte, chaînage) (§80-120) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- *Sécurisation* : chaînage ou signature électronique acceptés (§140) ; **mode école/test** : opérations fictives clairement identifiées, documents marqués fictifs, opérateur identifié (§150) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- *Clôtures* : clôtures **journalière, mensuelle et annuelle (ou par exercice)** obligatoires et cumulatives ; chaque clôture calcule le cumul du grand total de la période et un **total perpétuel** jamais remis à zéro ; changement de version du logiciel ne remet pas à zéro (seul un changement de matériel), anciens compteurs archivés (§170) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- *Conservation* : données détaillées ligne à ligne (pas seulement le Z) ; durée 6 ans (art. L. 102 B LPF) ; conservation centralisée possible si transfert traçable (§155-210) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- *Archivage* : archive au moins annuelle/par exercice, figeant les données, datée de façon fiable, dans un **format ouvert** lisible après changement de logiciel ; création d'archive tracée ; archive complète sur support externe sécurisé avant toute purge ; l'éditeur doit fournir la fonction d'archivage (§220-260) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)

**Le justificatif**
- Un document par système (§280) ; c'est l'éditeur qui obtient le certificat ou délivre l'attestation (§290) ; le certificat couvre la version utilisée et se renouvelle à chaque version majeure (§330-340) ; l'attestation est **individuelle** (pas une clause de CGV) et mentionne le logiciel, la version, le n° de licence et la date d'acquisition, selon le modèle officiel (§370-390) ; les versions mineures sont couvertes si la racine majeure est identifiée (§380) ; une entreprise qui développe sa propre caisse sans être éditeur doit avoir un certificat (§375) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)
- Faux certificat ou fausse attestation : faux et usage de faux, 3 ans d'emprisonnement et 45 000 € (art. 441-1 Code pénal) (§400) — [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)

**Sanctions et coûts**
- Amende de 7 500 € par logiciel ou système non justifié (art. 1770 duodecies CGI) ; d'après une question écrite à l'AN, sanction alourdie faute de régularisation sous 60 jours — [Assemblée nationale QE 8260](https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE8260.pdf) ; [compta-online](https://www.compta-online.com/logiciel-de-caisse-certifie-ao1760)
- Organismes accrédités cités : LNE (NF525) et INFOCERT — [Assemblée nationale QE 8260](https://questions.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE8260.pdf)
- Coût d'après les débats parlementaires (ordres de grandeur, non tarifaires) : environ 20 000 € pour la certification initiale, puis 3 800 à 6 000 €/an (amendement) ou environ 7 000 €/an (QE) d'audit de suivi — [Amendement CF602](https://www.assemblee-nationale.fr/dyn/17/amendements/1906A/CION_FIN/CF602.pdf) ; [QE 6772](https://questions.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE6772.pdf)

### Inferences
- Le chaînage ECDSA par terminal, les retours et avoirs et le Z de FLŌW couvrent une partie de l'inaltérabilité et de la sécurisation. Il manque probablement : **clôtures mensuelles et annuelles cumulatives** avec grand total de période et **total perpétuel** (il ne faut pas se limiter au Z journalier) ; **archives signées périodiques en format ouvert** exportables (XML/CSV + signature + horodatage fiable), avec trace de leur création ; **mode formation** marquant les tickets « fictif » et identifiant l'opérateur ; **traçabilité de toute modification de paramètres et de données** (le référentiel NF525 l'exige sous la forme d'un journal des événements techniques, JET) ; **marquage des duplicatas** et compteur de réimpressions (exigé par NF525 ; le BOFiP n'en parle pas explicitement) ; garantie que le **total perpétuel ne se remet pas à zéro** lors d'une mise à jour logicielle.
- **Hors ligne** : le BOFiP admet la centralisation si le transfert est traçable (§210). Les signatures par terminal, avec numérotation continue et resynchronisation prouvable, vont dans ce sens.
- Stratégie : (1) produire un **générateur d'attestation individuelle** au modèle BOI-LETTRE-000242, avec nom, version majeure, n° de licence, client et date ; (2) envisager la certification NF525 ou Infocert comme **argument commercial**, car les grands comptes et les experts-comptables la demandent et l'auto-attestation a déjà été supprimée une fois (LF 2025), avec un risque politique de nouvelle suppression. L'éditeur assume la responsabilité pénale d'une attestation inexacte.
- L'écran « NF525 » de FLŌW ne doit pas utiliser la marque NF525 sans certification. NF est une marque collective AFNOR/LNE, et l'utiliser sans certificat serait trompeur. Renommer en « Conformité anti-fraude TVA (art. 286 CGI) ».

### Gaps
- Contenu exact du modèle BOI-LETTRE-000242 non récupéré (à télécharger sur bofip.impots.gouv.fr).
- Grille tarifaire officielle et durée d'audit LNE/Infocert non publiées. Délai NF525 non sourcé, à demander par devis.
- Version 2026 du BOI-TVA-DECLA-30-10-30 non lue en entier : la version consultée est celle de 2018, dont les paragraphes techniques sont a priori inchangés, mais il faut vérifier. Délai de régularisation de 60 jours de l'art. 1770 duodecies non lu sur Légifrance.
- Exigences détaillées du référentiel NF525 (JET, duplicata, journal des événements, format d'archive) non vérifiées dans cette session. Le référentiel LNE est payant ou sur demande.

---

## 2. Facturation électronique B2B et e-reporting

### Takeaway
Depuis le **1er septembre 2026**, toutes les entreprises assujetties doivent **recevoir** les factures électroniques via une plateforme agréée (PA). Les GE et ETI émettent depuis cette date, les PME, TPE et micro-entreprises à partir du **1er septembre 2027**. Les ventes B2C en caisse ne deviennent pas des e-factures. Elles relèvent de l'**e-reporting** : envoi de données agrégées (montants HT et TVA par taux, par période) via une PA, à une fréquence qui dépend du régime TVA, dès le 1er/09/2027 pour les PME. Le POS doit donc produire des agrégats B2C par jour et par taux, les transmettre via une PA connectée, et émettre les factures B2B au format structuré avec les 4 nouvelles mentions.

### Cited Findings
- Calendrier officiel : réception obligatoire pour toutes les tailles au 1er/09/2026 ; émission GE/ETI au 1er/09/2026 ; émission micro-entreprises et PME au 1er/09/2027 — [Entreprendre.service-public F39785](https://entreprendre.service-public.gouv.fr/vosdroits/F39785) ; impots.gouv : réforme « effective depuis le 1er septembre 2026 » — [impots.gouv](https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique)
- La PA est « le seul intermédiaire reconnu par l'administration fiscale pour l'émission, la réception et la transmission des factures électroniques ». Elle transmet les données de transaction et de paiement et contrôle la conformité — [F39785](https://entreprendre.service-public.gouv.fr/vosdroits/F39785) (le terme « PDP » est devenu « plateforme agréée »)
- E-reporting : concerne les assujettis qui vendent à des particuliers et/ou à des clients établis à l'étranger. Les données portent sur des opérations non couvertes par l'e-facture, par exemple le montant de l'opération et la TVA — [F39785](https://entreprendre.service-public.gouv.fr/vosdroits/F39785)
- E-reporting B2C : grandes entreprises au 1er/09/2026, PME et TPE au 1er/09/2027 (sources secondaires) — [Socic](https://www.socic.fr/ressources-comptabilite/articles/facturation-electronique-obligatoire-2026-2027-calendrier-plateformes-agreees-e-reporting-et-checklist-tpe-pme) ; [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/e-reporting)
- Fréquence de l'e-reporting des transactions : régime réel normal mensuel = par **décade** (1-10, 11-20, 21-fin de mois), soit 3 transmissions par mois ; réel normal trimestriel et réel simplifié = mensuelle ; franchise en base = tous les 2 mois (décret n° 2022-1299 du 7/10/2022) — [LégiFiscal](https://www.legifiscal.fr/creation-entreprise/e-reporting-periodicite.html) ; [EBP](https://www.ebp.com/glossaire/e-reporting/). Contredit par [Certyneo](https://certyneo.com/en/blog/e-reporting-b2c-commercants), qui donne une transmission mensuelle pour le réel normal
- Données B2C agrégées : total HT de la période, TVA collectée par taux, période, SIREN, référence. Regroupement par taux et par catégorie d'opération (art. 242 nonies CGI) — [Certyneo](https://certyneo.com/en/blog/e-reporting-b2c-commercants) (source secondaire)
- 4 nouvelles mentions obligatoires : SIREN du client professionnel ; adresse de livraison si elle diffère ; nature des opérations (biens, services ou les deux) ; « Option pour le paiement de la taxe d'après les débits » le cas échéant — [Entreprendre.service-public F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808)
- Sanctions : selon des sources de 2026, la LF 2026 porte l'amende de 15 € à **50 € par facture** non électronique (art. 1737 CGI) et de 250 € à **500 € par transmission** d'e-reporting manquante, chacune plafonnée à 15 000 €/an — [Dougs](https://www.dougs.fr/blog/sanction-facturation-electronique/) ; [Propulse by CA](https://propulsebyca.fr/comptabilite/facture/electronique/sanctions-facturation-electronique) ; [Abby](https://abby.fr/guide/facturation-electronique/sanctions-facturation-electronique). Les sources divergent sur certaines modalités, à vérifier sur Légifrance.

### Inferences
- Pour FLŌW : (a) **raccordement réel à une ou plusieurs PA** (par API) pour émettre les factures B2B, recevoir les factures fournisseurs (achats, stock) et transmettre l'e-reporting ; le « stub PDP » doit devenir une intégration. FLŌW n'a pas besoin d'être lui-même PA : il peut être une « solution compatible ». (b) **Factur-X** (PDF/A-3 + XML CII), UBL et CII sont les formats du socle (connaissance générale, non sourcée ici). (c) Champs obligatoires dans la fiche client et la facture : SIREN, adresse de livraison, catégorie d'opération (biens, services, mixte), option sur les débits. (d) **Moteur d'agrégation e-reporting** : totaux B2C par jour et par taux de TVA, découpés par décade ou par mois selon le régime TVA du marchand (paramètre). Les **données de paiement** concernent surtout les prestations de services (encaissement). Un commerce de biens est moins concerné, à vérifier.
- Une facture demandée par un client professionnel en caisse (achat B2B au comptoir) doit, à partir du 1er/09/2027 pour une PME émettrice, partir en **e-facture via PA**, et non comme un PDF par e-mail.

### Gaps
- PDF officiels du calendrier et de la FAQ DGFiP non lus. Formats exigés et rôle résiduel du PPF (devenu annuaire et concentrateur) non confirmés sur une source primaire.
- Détail exact des données d'e-reporting B2C (agrégation journalière obligatoire ou non) : sources secondaires seulement.

---

## 3. Ticket de caisse, note, mentions, prix, TVA

### Takeaway
Depuis le **1er août 2023**, le ticket papier n'est plus imprimé systématiquement mais **sur demande**. Il existe 4 exceptions, dont les biens soumis à la garantie légale de conformité, les produits pesés et les opérations de carte bancaire annulées. Le ticket dématérialisé est une option et ne peut pas être imposé. Pour les prestations de services, y compris la restauration, une **note est obligatoire dès 25 € TTC**, remise avant paiement, en double exemplaire dont le double est conservé 2 ans. Les annonces de réduction de prix doivent afficher le **prix le plus bas des 30 derniers jours**.

### Cited Findings
- Fin de l'impression systématique au 1er/08/2023 (loi AGEC du 10/02/2020, art. L541-15-10 C. env.) ; concerne tickets de caisse, tickets de CB, certains tickets d'automates et bons d'achat, quel que soit le montant — [DGCCRF](https://www.economie.gouv.fr/dgccrf/fin-de-limpression-systematique-des-tickets-de-caisse-et-autres-tickets) ; [DGCCRF FAQ](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/impression-des-tickets-de-caisse-et-autres-la-demande-des-clients)
- Cadre : décret n° 2023-237 du 31 mars 2023, 4 exceptions à remise automatique, dont les produits soumis à la mention de la garantie légale de conformité (art. D. 211-7 C. conso), les produits pesés, les opérations de CB annulées ou non abouties, et les tickets d'automate nécessaires pour obtenir le bien ou service — [DGCCRF](https://www.economie.gouv.fr/dgccrf/tickets-de-caisse-et-de-carte-bancaire-le-1er-aout-remise-la-demande-du-client-0) ; [Que Choisir](https://www.quechoisir.org/actualite-tickets-de-caisse-leur-delivrance-n-est-plus-automatique-n109486/)
- La dématérialisation est une alternative et n'est jamais obligatoire. Le client peut refuser de donner ses données et obtenir un ticket papier — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/impression-des-tickets-de-caisse-et-autres-la-demande-des-clients)
- Note de prestation de services (arrêté n° 83-50/A du 3/10/1983) : obligatoire dès 25 € TTC, remise avant paiement, et sur demande en dessous. Mentions : date de rédaction, nom et adresse de l'établissement, nom du client (sauf opposition), date et lieu de la prestation, détail (quantité, prix), total HT et TTC. Établie en 2 exemplaires, double conservé 2 ans. Conditions de délivrance affichées en caisse — [Lettre des Réseaux](https://www.lettredesreseaux.com/prestation-de-service-et-obligation-de-delivrance-dune-facture.html) ; [GHR](https://www.ghr.fr/reglementation-fiscalite/notes-et-factures) ; [Le Coin des Entrepreneurs](https://www.lecoindesentrepreneurs.fr/note-de-prestation-de-service-client-particulier/)
- Restauration : « prix net » / « service compris » selon le mode de rémunération du personnel (arrêté du 27/03/1987) ; amende administrative de 14 850 € infligée par la DGCCRF en déc. 2023 pour défaut de note — [GHR](https://www.ghr.fr/reglementation-fiscalite/notes-et-factures) ; [Lettre des Réseaux](https://www.lettredesreseaux.com/prestation-de-service-et-obligation-de-delivrance-dune-facture.html)
- Réductions de prix (Omnibus, ordonnance 2021-1734, art. L. 112-1-1 C. conso, depuis le 28/05/2022) : le prix de référence est le **prix le plus bas pratiqué au cours des 30 jours** précédant la réduction ; en cas de réductions successives, c'est le prix avant la 1re réduction — [DGCCRF](https://www.economie.gouv.fr/dgccrf/des-regles-plus-claires-contre-les-faux-rabais) ; [DGCCRF fiche](https://www.economie.gouv.fr/dgccrf/Publications/Vie-pratique/Fiches-pratiques/Annonce-de-reduction-de-prix)

### Inferences
- FLŌW doit : (a) **ne pas imprimer par défaut** mais proposer « Ticket ? papier / e-mail / SMS / aucun », avec impression automatique forcée pour les catégories marquées « garantie légale » (électronique, électroménager), les articles pesés et les échecs CB ; (b) afficher en caisse l'information sur le ticket sur demande ; (c) générer une **note** pour les services ≥ 25 € (beauté, retouches, livraison, restauration), avec double conservé ; (d) stocker un **historique des prix par article** pour calculer et afficher automatiquement le « prix de référence 30 jours » sur les étiquettes et tickets de promotion et de soldes. C'est une fonctionnalité souvent absente des petites caisses.
- Mentions minimales d'un ticket (connaissance générale, non sourcée ici) : raison sociale, adresse, SIRET, n° TVA, date et heure, n° de ticket chaîné, détail des lignes, TVA par taux, total TTC, mode de paiement, mention de garantie légale le cas échéant.

### Gaps
- Taux de TVA (5,5 / 10 / 20 %, sur place / à emporter, art. 278-0 bis et 279 CGI ; règles de la boulangerie-pâtisserie, alcool toujours à 20 %, etc.) **non vérifiés dans cette session** : à sourcer sur le BOFiP (BOI-TVA-LIQ-30). Règle d'arrondi de la TVA (par ligne ou par taux) non sourcée.
- Liste officielle exacte des 4 exceptions (art. D541-371 C. env.) non lue en entier, page DGCCRF en 403.
- Affichage des prix (arrêté du 3/12/1987 / art. L112-1), prix à l'unité de mesure (€/kg) : non sourcés ici.

---

## 4. Archivage, conservation, FEC

### Takeaway
Les données de caisse se conservent **6 ans** (art. L. 102 B LPF) en ligne ou en archive, au détail ligne par ligne. Les obligations comptables de 10 ans (art. L123-22 C. com.) et le **FEC** (art. L47 A LPF) pèsent sur l'entreprise tenant une comptabilité informatisée. Une caisse n'est pas un logiciel comptable, mais elle doit faciliter l'export vers la comptabilité.

### Cited Findings
- Conservation 6 ans (L. 102 B LPF), données détaillées, archives annuelles en format ouvert, archive complète avant purge — [BOFiP BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20180704)

### Inferences
- FLŌW (SaaS) doit garantir contractuellement la **réversibilité** et la conservation de 6 ans même après résiliation : export d'archive signée et format ouvert remis au client, ou conservation par l'éditeur. Un export comptable (journal des ventes et encaissements par taux et par mode de paiement), mappable vers un FEC ou des imports (Pennylane, Sage, Cegid), est attendu par les experts-comptables.

### Gaps
- FEC : art. L47 A LPF et A47 A-1 (format) non vérifiés dans cette session. Règle des 10 ans (L123-22 C. com.) non sourcée ici.

---

## 5. Paiements (espèces, CB, titres-restaurant)

### Takeaway
Les espèces ne peuvent en principe pas être refusées (amende de 150 €). Un paiement en espèces à un professionnel est plafonné à **1 000 €**, ou 15 000 € pour un non-résident fiscal sous conditions. Titres-restaurant : plafond de **25 €/jour** en 2026 ; dérogation « tous produits alimentaires » jusqu'au 31/12/2026 ; dématérialisation complète annoncée pour 2027, mais la proposition de loi est **encore en discussion** (oct. 2026).

### Cited Findings
- Refus d'espèces : amende de 150 € ; plafond de 1 000 € pour un paiement d'un particulier à un professionnel ou entre professionnels ; 15 000 € pour un domicile fiscal à l'étranger, sous conditions ; refus possible pour billets abîmés ou devises — [Service-public F10999](https://www.service-public.gouv.fr/particuliers/vosdroits/F10999?lang=fr)
- Futur plafond UE de 10 000 € (règlement AML) annoncé pour juillet 2027 (presse, non confirmé sur une source officielle) — [bourseinside](https://bourseinside.fr/economie/paiements-en-especes-le-plafond-de-10-000-e-impose-par-lue-en-2027-cache-un-piege-pour-ceux-qui-paient-en-cash/)
- Titres-restaurant : plafond de 25 €/jour en 2026 ; dérogation pour les produits alimentaires non directement consommables jusqu'au 31/12/2026 ; PPL n° 2892 (Naegelen) visant à pérenniser (hors alcool et confiserie), avec dématérialisation complète annoncée au 1/01/2027 ; amendements proposant 25 € au restaurant et 10 € en supermarché, non confirmés ; examen à l'AN en oct. 2026, **pas de vote définitif connu** — [Previssima](https://www.previssima.fr/actualite/reforme-des-titres-restaurant-vers-une-utilisation-elargie-et-entierement-dematerialisee-dici-2027.html) ; [Journal de l'économie](https://www.journaldeleconomie.fr/?p=49715) ; [OPCO Direct](https://opcodirect.fr/blog/titres-restaurant)

### Inferences
- FLŌW doit : bloquer ou alerter sur un encaissement en espèces > 1 000 € (paramètre résident/non-résident) ; gérer le **titre-restaurant comme mode de paiement** avec plafond journalier, éligibilité par article (flag « éligible TR », alcool exclu), sans rendu de monnaie (règle usuelle, non sourcée ici), et intégration des cartes TR (Swile, Edenred, Pluxee, Bimpli) via le TPE ; suivre l'issue de la PPL 2892 avant le 1/01/2027.
- PCI DSS : si FLŌW ne voit jamais le PAN (TPE semi-intégré ou P2PE, où seul le résultat d'autorisation remonte), le périmètre PCI se réduit fortement pour l'éditeur comme pour le marchand. **Non vérifié sur pcisecuritystandards.org dans cette session.** DSP2/SCA est porté par l'acquéreur et le TPE, pas par la caisse, sauf pour la vente en ligne.

### Gaps
- PCI DSS v4.0.1 (périmètre d'un POS semi-intégré), DSP2/SCA, règles du chèque (pièce d'identité, refus possible si affiché) : non sourcés dans cette session.

---

## 6. Consommateur et RGPD (fidélité, e-mail ticket)

### Takeaway
Les données client collectées en caisse (e-ticket, fidélité) relèvent du RGPD. Selon le référentiel CNIL « gestion commerciale », les données client servant à la prospection se conservent pendant la relation commerciale **+ 3 ans**, et celles des prospects 3 ans après le dernier contact émanant d'eux. Un e-mail fourni pour recevoir un ticket ne vaut pas consentement marketing.

### Cited Findings
- Référentiel CNIL « gestion des activités commerciales » : client = relation + 3 ans ; prospect = 3 ans depuis la collecte ou le dernier contact émanant du prospect (une ouverture d'e-mail ne compte pas) ; archivage intermédiaire probatoire possible avec une politique d'archivage — [CNIL référentiel PDF](https://Cnil.fr/sites/cnil/files/atoms/files/referentiel_traitements-donnees-caractere-personnel_gestion-activites-commerciales.pdf) ; [Kohen Avocats](https://kohenavocats.fr/?p=2134054)
- Sanction CNIL contre AG2R La Mondiale (1,75 M€), notamment pour des prospects conservés en base active plus de 3 ans — [Soulier Avocats](https://soulier-avocats.com/cnil-sanction-de-175-million-deuros-a-lencontre-dag2r-la-mondiale/?pdf=42802)

### Inferences
- FLŌW : case de consentement marketing distincte et non pré-cochée lors de la saisie de l'e-mail pour le ticket ; purge et anonymisation automatiques des clients inactifs depuis 3 ans ; registre et export des droits (accès, suppression) ; la suppression d'un client ne doit pas casser la chaîne fiscale (pseudonymiser le lien client sur les tickets).

### Gaps
- Garanties (légale de conformité 2 ans, vices cachés), droit de retour (aucun droit légal en magasin physique), dates des soldes 2026 : non sourcés dans cette session.

---

## 7. Exigences sectorielles

### Takeaway
Allergènes : information **écrite obligatoire** pour les denrées non préemballées depuis le 1/07/2015 (décret 2015-447), au choix du support, à proximité des produits. Une caisse connectée à une balance pour la vente au poids engage la **métrologie légale** : la balance (IPFNA) doit être approuvée, et si le POS affiche ou calcule le prix, l'ensemble balance + terminal doit être couvert par le certificat, avec séparation des affichages.

### Cited Findings
- Décret n° 2015-447 du 17/04/2015 (en vigueur au 1/07/2015) : indication écrite des 14 allergènes (annexe II du règlement INCO 1169/2011) pour les denrées non préemballées, sans que le consommateur ait à la demander ; support libre ; à proximité immédiate des produits ; l'oral peut compléter l'écrit si le personnel est formé (art. R. 112-11 et suivants C. conso) — [UFC-Que Choisir](https://www.quechoisir.org/action-ufc-que-choisir-enquete-sur-les-allergenes-les-professionnels-allergiques-a-la-bonne-information-des-consommateurs-n21579/) ; [MAPA](https://www.mapa-assurances.fr/boulangerie/allergenes-boulangerie) ; [QE AN 75805](https://questions.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE75805.pdf)
- Métrologie : certification par le LNE d'un TPV intégré à un instrument de pesage à fonctionnement non automatique ; le point clé est la séparation des indications certifiées de la balance et de celles du TPV ; les certificats (directive 90/384/CEE, EN 45501) autorisent la connexion de périphériques si les interfaces sont décrites dans le certificat — [LNE témoignage](https://www.lne.fr/sites/default/files/bloc-telecharger/Temoignage-Computer-associes_LNE.pdf) ; [LNE certificat exemple](https://www.lne.fr/sites/default/files/metrologie_legale/certificats_2005/1920.pdf)
- Les produits pesés font partie des cas où un ticket reste remis automatiquement — [DGCCRF](https://www.economie.gouv.fr/dgccrf/tickets-de-caisse-et-de-carte-bancaire-le-1er-aout-remise-la-demande-du-client-0)

### Inferences
- FLŌW : affichage des allergènes au comptoir ou en vitrine (fiche imprimable, QR code) en plus du back-office ; pour la vente au poids, s'intégrer **uniquement à des balances approuvées** qui transmettent le poids et le prix calculé par la balance (le POS ne recalcule pas, n'affiche pas comme valeur légale et ne permet pas de modifier le poids à la main). Sinon, il faut une certification métrologique de l'ensemble.
- Lots et DLC (règlement CE 178/2002, traçabilité), alcool (licences, interdiction de vente aux mineurs, art. L3342-1 CSP), livre de police pour la bijouterie et l'occasion (art. 321-7 Code pénal), tabac et pharmacie (monopoles) : **non sourcés dans cette session**. Ils restent pertinents : un contrôle d'âge à l'encaissement (popup « vérifier la majorité » sur les articles alcool) et un registre des objets mobiliers pour l'achat d'occasion sont des fonctionnalités attendues dans les secteurs concernés.

### Gaps
- Textes primaires (Légifrance) pour l'alcool, le livre de police et la traçabilité des lots non consultés. Version consolidée actuelle de R. 112-14 C. conso non vérifiée.

---

## 8. Accessibilité (European Accessibility Act) et pointage

### Takeaway
La directive accessibilité (EAA) s'applique en France depuis le **28 juin 2025** (transposée par la loi DDADUE n° 2023-171). Elle couvre les **terminaux de paiement** et les **bornes libre-service**, ainsi que les services de **commerce électronique**. Les microentreprises de services (moins de 10 salariés et moins de 2 M€ de CA) sont exemptées. Une période transitoire va jusqu'au 28/06/2030 pour les produits déjà en service. Contrôle par la DGCCRF.

### Cited Findings
- Application au 28/06/2025 ; produits couverts, dont les terminaux de paiement et les terminaux libre-service ; DGCCRF autorité de contrôle ; exemption des entreprises de moins de 10 salariés et de moins de 2 M€ de CA, et charge disproportionnée ; produits légalement en service avant le 28/06/2025 utilisables jusqu'au 28/06/2030 — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/la-nouvelle-directive-europeenne-accessibilite-pour-des-produits-et-des-services-accessibles-aux-personnes-en-situation) ; [DGCCRF pros](https://www.economie.gouv.fr/dgccrf/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite) ; [Norton Rose Fulbright](https://connections.nortonrosefulbright.com/post/102mmcn/european-accessibility-act-not-a-nice-to-have-anymore)

### Inferences
- Le back-office et la caisse utilisés par le personnel ne sont pas des « services aux consommateurs », a priori hors EAA. En revanche, **une borne de commande ou d'encaissement client, le click & collect ou l'e-shop** de FLŌW, ainsi que l'écran client, entrent dans le champ pour les marchands non exemptés. Viser le RGAA / WCAG 2.1 AA (EN 301 549) sur ces surfaces. L'exemption des microentreprises vise les services, pas les produits (non vérifié).
- Pointage : aucune source consultée. Un module de pointage relève du Code du travail (décompte de la durée du travail) et du RGPD : la CNIL encadre la biométrie, et un badge ou un PIN est préférable. Non vérifié dans cette session.

### Gaps
- Texte du Code de la consommation transposant l'EAA (art. L.412-13 et suivants ?) non lu. Champ exact de l'exemption des microentreprises pour les produits. Règles de pointage non recherchées, faute de budget d'appels.
