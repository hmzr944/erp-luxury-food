# Benchmark des caisses restauration, café, boulangerie-pâtisserie et épicerie fine (2025-2026) : fonctions et manques de FLŌW

Périmètre : Toast, Square for Restaurants, Lightspeed Restaurant (K-Series), SumUp POS Pro (ex-Tiller), Zelty, L'Addition, Innovorder, Gourmets (GL Info), Cashmag, Popina, Hiboutik, Odoo POS Restaurant, et des logiciels spécialisés boulangerie (Crisalid/Aliris, Toporder, Bimedia, Tactill, Clyo).
Méthode : pages éditeurs (FR quand c'était possible), centres d'aide, comparatifs français (tool-advisor, independant.io, appvizer, fooderise) et presse fiscale. Plusieurs pages éditeurs ont renvoyé une erreur 403/404/429 (grilles de prix Toast, Square FR et Lightspeed FR ; site Innovorder). Les prix viennent donc souvent d'agrégateurs, et je le signale à chaque fois.
**Rappel de ce que FLŌW a déjà** (d'après le brief) : caisse catalogue avec variantes, articles libres, division de note, paiements carte/espèces/bon/avoir, ventes hors ligne, remboursements, hub de commandes en ligne avec page de retrait, écran atelier/KDS de production consolidée par produit et par boutique, commandes d'approvisionnement internes avec heures limites, allergènes, TVA, rôles.

---

## 1. Service en salle : plan de salle, tables, couverts, transferts, fusions, envoi par suites, commande par place, terminaux portables

### Takeaway
Le plan de salle, les tables, les couverts, le transfert et la fusion de tables, ainsi que la prise de commande mobile sont standard chez tous les acteurs restauration (Square Plus/Premium, Odoo, Hiboutik, Popina, L'Addition, Lightspeed). Même un logiciel de boulangerie comme Crisalid/Aliris propose la « gestion de tables » pour la petite restauration. FLŌW n'a rien de tout cela : c'est le manque n°1 pour un salon de thé ou un café de boutique.

### Cited Findings
- Square : les plans de salle sont réservés aux abonnés « Square pour restaurants Plus ou Premium ». On peut avoir plusieurs plans (déjeuner et dîner), organisés en sections (salle, bar, terrasse). Une table passe en occupée dès que le nombre de couverts est saisi, et on peut fusionner des tables pour les grands groupes. Les fusions se font sur Square Register et s'affichent sur Square Terminal et Square Handheld. Le centre d'aide renvoie aussi à « Configurer la gestion des services pour les additions » (envoi par suites) et « Diriger les commandes vers la cuisine avec Square KDS » — [Square aide FR 6427](https://squareup.com/help/fr/fr/article/6427-building-your-floor-plan)
- Un site tiers affirme que Square ne propose pas de gestion de salle, ce que contredit la documentation officielle ci-dessus — [logiciels.pro](https://www.logiciels.pro/square-for-restaurants/)
- Odoo POS Restaurant : étages et tables configurables, vue « Floor plan » montrant en temps réel l'occupation, les réservations et l'état des commandes en cuisine. On y trouve aussi « Table Booking », « Transfer/Merge » des commandes entre tables, la vente directe sans table, « Allow Bill Splitting » (division par produit) et « Early Receipt Printing » — [Odoo 18 doc Restaurant](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/restaurant.html)
- Hiboutik : « plan de salle », réservations avec disponibilité des tables dans l'agenda — [Hiboutik restaurant](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)
- Popina : prise de commande, encaissement multimode, plan de salle, stocks, reporting — [Fooderise Popina](https://www.fooderise.com/en/caisse/popina)
- L'Addition : selon Fooderise, la solution est « top pour la restauration traditionnelle (plan de salle) ». La prise de commande mobile se fait sur iPad Mini ou iPhone — [Fooderise comparatif 2026](https://www.fooderise.com/fr/blog/logiciel-caisse-restaurant-comparatif-2026); [L'Addition prix](https://www.laddition.com/fr/prix)
- Lightspeed Restaurant : modules « Tableside » et « Order Anywhere ». La gamme vise le full-service, le fine dining, l'hôtel, le quick-service, le café et le bar — [Lightspeed KDS (CH-FR)](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/)
- Lightspeed (blog) : la caisse prévient la cuisine quand une table est prête pour la suite et répartit les commandes nourriture et boissons entre les postes — [Lightspeed via recherche, page KDS CH](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/)
- Toast : le terminal portable Toast Go 3 a été lancé en avril 2026 au Royaume-Uni, en Irlande, au Canada et en Australie — [FinTech Futures](https://www.fintechfutures.com/press-releases/toast-launches-toast-go-3-handheld-point-of-sale-device-globally)
- Crisalid/Aliris (boulangerie) : rubrique « ADAPTÉ POUR LA PETITE RESTAURATION » avec gestion de tables, impression de bons de préparation, « niveaux de tarifs (emporté, sur-place, etc.) » et traduction multilingue des libellés — [Brochure Crisalid V3/Aliris (PDF hellopro)](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)

### Inferences
- Pour la cible pâtisserie de luxe avec salon de thé, le minimum à couvrir est un plan de salle simple, des couverts, le transfert et la fusion de tables, et une prise de commande sur tablette ou smartphone. L'envoi par suites et la commande par place relèvent surtout de la restauration traditionnelle et gastronomique.
- La division de note existe déjà dans FLŌW. Il reste à la rattacher à une table ou à une place.

### Gaps
- Je n'ai pas trouvé de documentation publique détaillée sur la commande par place ni sur l'envoi par suites pour Zelty, SumUp POS Pro, Popina et Cashmag.
- Je n'ai pas pu récupérer la page Toast (403). Je n'ai donc aucune source directe sur sa gestion des suites ou des places.

---

## 2. Modificateurs, menus/formules, tarifs horaires, sur place/à emporter, service et pourboires

### Takeaway
Tous les acteurs restauration proposent les options et compléments (modificateurs), les menus à étapes et la double tarification sur place/à emporter, c'est-à-dire une position fiscale ou un niveau de prix. En France, l'exonération des pourboires est **prolongée jusqu'au 31/12/2028** par la loi de finances 2026, donc un pourboire tracé distinctement dans la caisse reste un besoin réel.

### Cited Findings
- Hiboutik : « Options et compléments » et « Menus à étapes » — [Hiboutik restaurant](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)
- Odoo : l'option « Eat in / Take out » applique une position fiscale alternative, donc des taux de TVA différents selon le mode de consommation. Le paramètre « Tips » ajoute un produit pourboire, et « Add tip after payment » n'existe que pour les points de vente US avec terminaux compatibles. Les combos sont documentés sur une page séparée — [Odoo 18 doc Restaurant](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/restaurant.html)
- Crisalid/Aliris : « Gestion des niveaux de tarifs (emporté, sur-place, etc.) », « FORMULES AUTOMATIQUES », gestion des conditionnements (« baguette et ½ baguette, gâteaux pour 4,8,12 pers ») et « GESTION DES PARTS » — [Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)
- L'Addition (boulangerie) : prise de commande, « détection automatique des menus », « prix au poids », vente à emporter, fidélité — [Tool-advisor boulangerie 2026](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Bimedia (boulangerie) : formules déjeuner, allergènes, vente au poids ou à l'unité — [Tool-advisor boulangerie 2026](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Toast/xtraCHEF : les modificateurs du menu Toast sont mappés aux recettes xtraCHEF pour le calcul du coût — [Toast recipe costing](https://pos.toasttab.com/th-us/products/recipe-costing)
- **Pourboires** : depuis le 1/1/2022, les pourboires des salariés en contact avec la clientèle sont exonérés d'IR et de cotisations s'ils gagnent moins de 1,6 SMIC. La loi de finances 2025 avait prolongé le dispositif jusqu'au 31/12/2025 — [Legifiscal actualité](https://www.legifiscal.fr/actualites-fiscales/4292-plf-2026-amendement-proroge-exoneration-pourboires-2028.html)
- La loi n° 2026-103 du 19 février 2026 (JO du 20/02/2026) le proroge jusqu'au **31 décembre 2028** (article 5). Le seuil de 1,6 SMIC vaut 2 916,85 €/mois depuis le 1/1/2026 — [BOFiP](https://bofip.impots.gouv.fr/node/377304); [Legisocial](https://www.legisocial.fr/actualites-sociales/7795-loi-finances-2026-publication-journal-officiel.html); [Legifiscal fiche](https://www.legifiscal.fr/impots-personnels/impot-revenu/pourboires-exoneration-ir-cotisations-sociales.html)
- Une instruction BOFiP du 29/12/2025 avait maintenu l'exonération pendant la période transitoire. L'exonération sociale avait été votée dans la LFSS 2026 (16/12/2025) — [Legifiscal actualité](https://www.legifiscal.fr/actualites-fiscales/4292-plf-2026-amendement-proroge-exoneration-pourboires-2028.html)
- Titres-restaurant : Aliris lit le code-barres des titres, édite un bordereau de type CRT et émet un avoir sur le trop-perçu. Popina accepte les tickets-restaurant — [Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf); [Blog du Modérateur Popina](https://www.blogdumoderateur.com/tools/popina/)

### Inferences
- Un basculement sur place/à emporter au niveau de la commande, qui recalcule la TVA par ligne, est attendu même en boulangerie (voir Aliris). C'est un manque critique de FLŌW pour toute boutique avec salon.
- Le titre-restaurant (paiement, plafond, rendu sous forme d'avoir) est absent de la liste de paiements FLŌW. C'est un standard en boulangerie et en snacking.
- Les tarifs horaires (happy hour) ne sont documentés explicitement chez aucun acteur trouvé. C'est un sujet secondaire pour la cible luxe.

### Gaps
- Je n'ai pas trouvé de source sur les happy hours ou la tarification horaire pour les acteurs cités.
- Je n'ai pas trouvé de documentation FR sur le « service charge » automatique. Le pourboire sur terminal de paiement est documenté seulement pour Odoo, et seulement aux US.

---

## 3. Cuisine : KDS par poste, temps de préparation, bump/recall, imprimantes, régulation du débit

### Takeaway
L'écran cuisine routé par poste est courant (Lightspeed, Hiboutik, Zelty, Square KDS, Odoo « Preparation Display »), tout comme les imprimantes de préparation. FLŌW a un KDS de laboratoire, c'est-à-dire une agrégation de production, mais pas de routage ticket par ticket vers des postes ou imprimantes pour un service en temps réel.

### Cited Findings
- Lightspeed KDS : routage (nourriture vers la cuisine, boissons vers le bar), chronométrage du temps de préparation de chaque commande avec statistiques, alerte sonore, statut par commande, envoi immédiat dès la saisie. La page ne mentionne ni le bump, ni le recall, ni l'expo — [Lightspeed KDS CH-FR](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/)
- Hiboutik : écran cuisine en temps réel « par poste de préparation », tickets et imprimante cuisine — [Hiboutik restaurant](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)
- Odoo : « Preparation Printers » (cuisine ou bar via IoT ou Epson) et lien vers un « Preparation display » — [Odoo 18 doc](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/restaurant.html)
- Zelty : KDS proposé avec les bornes et l'API — [Zelty](https://www.zelty.fr/)
- Popina : écran cuisine en supplément mensuel — [Fooderise Popina](https://www.fooderise.com/en/caisse/popina)
- Square : article « Diriger les commandes vers la cuisine avec Square KDS » — [Square aide FR](https://squareup.com/help/fr/fr/article/6427-building-your-floor-plan)
- Aliris : « Impression de bons de préparation » — [Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)

### Inferences
- FLŌW peut réutiliser son écran atelier existant (sombre, XL) en lui ajoutant un mode « service » : tickets par poste (cuisine, bar, chaud/froid), minuteur, bump et recall. C'est un gain rapide.

### Gaps
- Je n'ai trouvé aucune source sur la régulation du débit des commandes (throttling) pour les acteurs français. La page KDS de Toast n'a pas pu être récupérée.

---

## 4. Vente en ligne : site de commande, QR à table, Uber Eats/Deliveroo/Just Eat, créneaux click & collect, précommandes avec acompte, SMS

### Takeaway
Le click & collect, le QR à table et l'intégration des plateformes de livraison sont standard chez Zelty, L'Addition, Lightspeed, Hiboutik, Innovorder et Cashmag. En boulangerie, la **commande client avec calendrier de retrait** existe chez Crisalid/Aliris et Toporder. En revanche, je n'ai trouvé **aucune source publique** décrivant explicitement des acomptes sur précommande. C'est un différenciateur possible pour FLŌW (bûches, galettes, Pâques).

### Cited Findings
- Zelty : commandes à emporter et en livraison, commande par QR code, centralisation sur la caisse des commandes et catalogues des plateformes de livraison, bornes — [Zelty](https://www.zelty.fr/). Uber Eats et Deliveroo sont centralisés dans la caisse, et la synchronisation de menu Uber Eats est décrite comme bidirectionnelle — [dixmilleheures](https://www.dixmilleheures.fr/avis/zelty); [Fooderise intégrations livraison 2026](https://www.fooderise.com/en/blog/meilleures-integrations-pos-livraison-2026)
- L'Addition : Click & Collect (un témoignage cite Uber Eats et Deliveroo), réservation en ligne, menu digital, paiement à table (icône QR), Tap to Pay sur iPhone. Partenariat Deliverect pour regrouper sur place et livraison — [L'Addition](https://www.laddition.com/fr/); [recherche L'Addition / tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/laddition/)
- Lightspeed : « Lightspeed Delivery » connecte la caisse à Deliveroo, Just Eat et Uber Eats — [Fooderise intégrations](https://www.fooderise.com/en/blog/meilleures-integrations-pos-livraison-2026)
- Innovorder : intégration native Deliveroo, plus Uber Eats et Just Eat, selon Fooderise (éditeur concurrent, à prendre avec prudence) — [Fooderise](https://www.fooderise.com/en/blog/meilleures-integrations-pos-livraison-2026). Innovorder cite La Mie Câline, IL Ristorante, Pizza Paï et 3 Brasseurs comme utilisateurs de son guide click & collect — [Innovorder ebook](https://www.innovorder.com/en/ebook/click-collect-le-guide-pratique-pour-devenir-un-expert)
- Hiboutik : click & collect, livraison, QR code à table — [Hiboutik restaurant](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)
- Cashmag : bornes de commande, « Proposez la commande en ligne sans projet web complexe » — [Cashmag](https://www.cashmag.fr/)
- SumUp POS (ex-Tiller) : suivi des commandes en cours (livraison, click & collect, sur place). À l'acquisition de 2021, le périmètre couvrait commande, paiement, livraison, stocks, fidélité, réservations et analyses — [tool-advisor SumUp](https://tool-advisor.fr/logiciel-de-caisse/comparatif/tiller/); [SumUp presse](https://www.sumup.com/fr-fr/press/sumup-acquiert-le-francais-tiller/)
- Crisalid/Aliris : « Saisie des commandes clients avec calendrier de retrait », rapports de commande pour les postes de fabrication, comptes clients, extensions e-boutique/click & collect et borne de commande — [Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)
- Toporder : « gérez vos commandes et suivez la production jour par jour ». Une pâtisserie témoigne d'une prise de commande centralisée entre ses points de vente et de l'usage de « SmartCollect » pour la production — [Toporder](https://www.toporder.fr/)
- Lightspeed propose un module de réservations, L'Addition « L'Addition Réservation », Odoo « Table Booking » — [Lightspeed](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/); [L'Addition prix](https://www.laddition.com/fr/prix); [Odoo](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/restaurant.html)
- Les comparatifs recommandent de vérifier les connexions API (livraison, click & collect, comptabilité, planning) et le mode hors ligne avant de choisir — [Fooderise comparatif 2026](https://www.fooderise.com/fr/blog/logiciel-caisse-restaurant-comparatif-2026)

### Inferences
- FLŌW a déjà le hub de commandes et la page de retrait avec code. Il lui manque les créneaux de retrait avec capacité par créneau, le paiement d'acompte en ligne ou en caisse avec solde au retrait, les rappels SMS et e-mail, le QR à table et un connecteur de livraison. Pour ce dernier, passer par un agrégateur (Deliverect ou HubRise) est plus réaliste que des intégrations directes.
- Les précommandes saisonnières avec acompte et capacité de production (bûches, galettes) ne sont documentées publiquement chez aucun concurrent trouvé. Il faut les vérifier en démo, mais c'est un angle différenciant cohérent avec le laboratoire central.

### Gaps
- La page HubRise récupérée (/fr/apps) ne listait que des apps internes. Je n'ai pas pu confirmer quelles caisses sont connectées à HubRise ou Deliverect.
- Je n'ai trouvé aucune source sur les acomptes de précommande ni sur les notifications SMS pour l'ensemble des acteurs.

---

## 5. Back-office : fiches techniques, déstockage des ingrédients, coût matière, achats, production, invendus, lots/DLC, étiquettes INCO, ventes au poids

### Takeaway
Le coût matière par recette avec déstockage existe chez Toast (xtraCHEF). Les ERP métier (Gourmets ERP : production, recettes, traçabilité, achats ; Crisalid : événements « invendus, ruptures, fabriqués, réintégrables », étiquettes allergènes et nutrition, balance) couvrent le versant pâtisserie et boulangerie. Les caisses restauration françaises (Zelty, L'Addition, Popina) annoncent surtout « stocks », sans recettes documentées publiquement.

### Cited Findings
- **Gourmets ERP (GL Info, Rosières-près-Troyes)** : ERP cloud pour chocolatiers, pâtissiers et glaciers. Modules point de vente, production, gestion commerciale, achats, stocks et inventaires, recettes, transferts comptables, fournisseurs, connecteurs e-commerce, traçabilité, connecteurs transporteurs, statistiques. « Un logiciel de caisse certifié », lié en direct à l'ERP. Les logos clients, identifiés par nom de fichier image, incluent **Chocolat Alain Ducasse, Ducasse Glace**, Pierre Hermé, La Maison du Chocolat, Jean-Paul Hévin, Christophe Michalak, Bernachon et le Ritz. Prix uniquement sur devis — [gourmets-erp.fr](https://gourmets-erp.fr/)
- Aucune source ne confirme quels modules la Manufacture Ducasse utilise — [recherche Ducasse/Gourmets](https://gourmets-erp.fr/)
- Crisalid/Aliris : saisie des événements magasin (« invendus, commandes, ruptures, fabriqués, réintégrables, inventaires »), stocks, éditeur d'étiquettes « allergènes, valeurs nutritives, code à barres, tarif, référence fournisseur », intégration d'une balance de pesée, caisse automatique (monnayeur), gestion des tournées — [Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)
- Bimedia : « Pilotage de la production » pour suivre les pics journaliers et « limiter le gaspillage », allergènes, vente au poids — [Tool-advisor boulangerie](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Clyo Systems : « balance connectée », monnayeur — [Tool-advisor boulangerie](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Toast xtraCHEF : coût de plat en temps réel à partir des prix des factures scannées, constructeur de recettes, conversion d'unités, coûts main-d'œuvre, emballage et livraison, écart réel/théorique, déstockage, commande par niveau minimum (par level), inventaires sur mobile, détection des pertes. Les inventaires et l'analytique avancée demandent le niveau Pro — [Toast recipe costing](https://pos.toasttab.com/th-us/products/recipe-costing); [Toast inventory](https://pos.toasttab.com/products/inventory-management); [Toast support xtraCHEF 101](https://support.toasttab.com/en/article/xtraCHEF-101); [xtraCHEF](https://xtrachef.com/?p=7400)
- Un avis tiers juge la gestion des recettes de xtraCHEF plus limitée que son traitement des factures — [FitGap](https://us.fitgap.com/products/xtrachef)
- L'Addition : « L'Addition achats » et « Gestion de votre restaurant: Stock & Carte » — [L'Addition](https://www.laddition.com/fr/); [L'Addition prix](https://www.laddition.com/fr/prix)
- Hiboutik : « Gestion du stock et des fournisseurs », sans recettes mentionnées — [Hiboutik restaurant](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)
- Zelty : stocks mentionnés, mais ni fiches techniques ni food cost sur la page d'accueil — [Zelty](https://www.zelty.fr/)
- Logiciels pour épiceries fines et cavistes : XLSoft propose une offre caisse « gourmet & terroirs, cavistes, chocolatiers, épiceries » — [XLSoft](https://www.xlsoft.fr/metiers-logiciel-commerce/logiciel-retail-gourmet-terroirs-cavistes-chocolatiers-epiceries/)
- **Allergènes et INCO** : l'article 44 du règlement INCO étend l'obligation d'information sur les allergènes aux denrées non préemballées. En boulangerie, l'information va sur l'étiquette (préemballé) ou sur un affichage (vrac) — [Assemblée nationale QE](https://questions.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE94883.pdf); [MAPA obligations boulangerie](https://www.mapa-assurances.fr/boulangerie/obligations-reglementaires)

### Inferences
- FLŌW connaît les allergènes par produit mais n'a ni recettes avec quantités d'ingrédients, ni déstockage matière, ni food cost. Pour un réseau avec laboratoire central, la chaîne recette → besoin matière → achat fournisseur est exactement ce que vend Gourmets ERP, le titulaire chez Ducasse. C'est le manque le plus stratégique face à lui.
- L'étiquetage (allergènes, ingrédients, DLC, lot, code-barres) et la saisie des invendus et pertes par boutique sont des standards boulangerie (Aliris) et rejoignent l'écran atelier existant.
- Les ventes au poids avec balance sont standard en boulangerie et en épicerie fine (L'Addition, Bimedia, Clyo, Aliris).

### Gaps
- Je n'ai pas trouvé de source détaillée sur la traçabilité lot/DLC de Gourmets ERP : le module « traçabilité » est nommé sans détail.
- Je n'ai trouvé aucune source sur la prévision de production assistée (forecast) chez les acteurs français, à part le « pilotage de la production » de Bimedia.
- Je n'ai pas couvert Merim, BakerSoft, Pygmalion, Easy-caisse, Logicaisse et Atys : les recherches n'ont rien remonté d'exploitable dans le budget imparti.

---

## 6. Analytique : ventes horaires, mix produit, coût de main-d'œuvre, prévisions

### Takeaway
Le reporting multi-sites et en temps réel est universel. L'analytique avancée (benchmarks, prévisions, IA) est l'apanage de Lightspeed et Toast. Le coût de main-d'œuvre passe en général par une intégration planning, type Skello ou Combo.

### Cited Findings
- Lightspeed : « Advanced Insights », « Benchmarks & Trends », « AI », « Tempo », « Pulse », gestion multi-sites — [Lightspeed CH-FR](https://www.lightspeedhq.com/ch/caisse/restaurant/ecran-affichage-cuisine/)
- Zelty : suivi temps réel, CA, ratios, back-office central multi-établissements (cartes, équipes, moyens de paiement) — [Zelty](https://www.zelty.fr/)
- SumUp : tableau de bord avec « Top/flop des ventes (baguettes, viennoiseries, menus) » — [Tool-advisor boulangerie](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Aliris : états financiers, statistiques, comparatifs, synthèses produits — [Brochure Crisalid](https://www.hellopro.fr//documentation/pdf_prod/1/1/6/167832_d155ef8c28240e22bed30be93e61a203_6667611.pdf)
- Toast : la formule « Build Your Own » inclut planning, gestion de livraison, inventaire et paie — [Capterra Toast pricing](https://www.capterra.com/p/136301/Toast-POS/pricing/)

### Inferences
- Pour FLŌW, des heatmaps horaires par boutique, le mix produit et un export vers les outils de planning suffisent au départ. Les prévisions de production à partir de l'historique sont un atout naturel avec le laboratoire central.

### Gaps
- Je n'ai trouvé aucune source sur le calcul du % de coût de main-d'œuvre dans les caisses françaises.

---

## 7. Prix (€) et matériel

### Takeaway
Les acteurs français (Zelty, L'Addition, Innovorder, Cashmag, Gourmets) ne publient pas leurs prix. Les fourchettes publiques vont de 39 à 120 € HT/mois par caisse, et l'iPad domine le matériel. Toast n'est pas présent en France.

### Cited Findings
- Toporder (boulangerie) : à partir de 39 € HT/mois, caisse iPad à partir de 59 € HT/mois, Android à partir de 39 € HT/mois — [Toporder](https://www.toporder.fr/). Tool-advisor indique « À partir de 59€HT/mois » et une note Google de 4,9/5 sur plus de 180 avis — [Tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Lightspeed : à partir de 89 € HT/mois selon Tool-advisor ; 119 € HT/mois selon Fooderise ; Essentiel 69 €/mois/utilisateur, Pro 119 €/mois, Premium 349 € selon Appvizer. Les sources se contredisent — [Tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/); [Fooderise Lightspeed](https://www.fooderise.com/en/caisse/lightspeed); [Appvizer](https://www.appvizer.fr/finance-comptabilite/gestion-de-caisse/lightspeed-restaurant)
- SumUp POS : à partir de 49 € HT/mois — [Tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Tactill : 39, 59 et 79 € HT/mois. Tactill Box (iPad, mPOP, support, licence 1 an) à 1 249 €, mPOP 499 €, imprimante 299-399 €, lecteur code-barres 149-299 €, tiroir 99 €, afficheur client 239 €. Le tableau indique « En attente de NF525 » — [Tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/)
- Popina : à partir de 52 € HT/mois ; une autre page Fooderise de 2026 donne Standard ~70 €, Pro ~120 € et Enterprise sur devis. Les sources divergent — [Fooderise Popina](https://www.fooderise.com/en/caisse/popina); [Fooderise comparatif](https://www.fooderise.com/fr/blog/logiciel-caisse-restaurant-comparatif-2026)
- L'Addition : sur devis, même si un titre d'article Fooderise cite 69 €/mois. iPad ou iPad Pro, imprimante Epson filaire ou sans fil, terminal L'Addition Pay+, uniquement sur Apple — [L'Addition prix](https://www.laddition.com/fr/prix); [Fooderise](https://www.fooderise.com/fr/blog/logiciel-caisse-restaurant-comparatif-2026); [independant.io](https://independant.io/avis/l-addition/)
- Square pour restaurants : « à partir de 60,00 € par mois » selon un comparateur, non vérifié auprès de Square — [logiciels.pro](https://www.logiciels.pro/square-for-restaurants/)
- Hiboutik : logiciel gratuit, Option Premium à 16,90 €/mois — [Hiboutik restaurant](https://www.hiboutik.com/fr/logiciel-de-caisse/restaurant/)
- Zelty, Cashmag, Gourmets ERP, Bimedia, Clyo : sur devis — [dixmilleheures](https://www.dixmilleheures.fr/avis/zelty); [Cashmag](https://www.cashmag.fr/); [Gourmets ERP](https://gourmets-erp.fr/)
- Moyennes du marché : 40 à 100 €/mois par iPad selon Fooderise ; « aux alentours de 150€HT/mois minimum » pour une boulangerie selon Tool-advisor ; 19 à 59 €/mois pour les caisses certifiées selon Skello — [Fooderise](https://www.fooderise.com/fr/blog/logiciel-caisse-restaurant-comparatif-2026); [Tool-advisor](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-boulangerie/); [Skello](https://www.skello.io/blog/meilleurs-logiciels-boulangerie)
- Toast (USD, hors France) : Starter Kit à 0 $, Point of Sale à 69 $/mois, Build Your Own sur devis. Paiements à 2,49 % + 15¢ (ou 2,99-3,09 % + 15¢ sans engagement). Matériel de base d'environ 2 645 $. Toast est présent en Irlande, au Royaume-Uni et au Canada (2023), et a commencé par les pays anglophones. Je n'ai trouvé aucune trace d'un lancement en France — [NerdWallet](https://www.nerdwallet.com/business/software/reviews/toast-pos); [Chowly](https://chowly.com/resources/blogs/toast-vs-square-for-restaurants/); [Owner.com](https://www.owner.com/blog/toast-pricing); [Toast UK news](https://pos.toasttab.com/news/toast-brings-digital-restaurant-technology-platform-to-uk); [Payments Dive](https://www.paymentsdive.com/news/lightspeed-ceo-jp-chauvet-toast-restaurant-pos-payments-european-market/699708/)
- NF525 : les logiciels de caisse doivent être certifiés depuis 2018 pour les assujettis à la TVA, avec une exception pour la franchise en base — [MAPA](https://www.mapa-assurances.fr/boulangerie/logiciel-caisse-boulangerie)

### Inferences
- Une offre FLŌW navigateur, sans iPad imposé, avec prix publics, se démarque de concurrents opaques sur leurs tarifs. L'absence de transparence tarifaire est la critique récurrente contre Zelty et L'Addition.

### Gaps
- Je n'ai pas pu récupérer les grilles officielles Lightspeed FR, Square FR et SumUp POS Pro (404/429).

---

## 8. Plaintes récurrentes dans les avis

### Takeaway
Les critiques publiques trouvées portent surtout sur l'opacité tarifaire, la dépendance à l'iPad et l'inadéquation aux petites structures. J'ai trouvé peu d'avis négatifs détaillés et vérifiables dans le temps imparti.

### Cited Findings
- Zelty : tarification opaque, aucun prix publié (la page tarifs renvoie vers une démo). Peu adapté à la restauration traditionnelle à faible volume. Support noté 8/10, illimité et sans frais — [independant.io Zelty](https://independant.io/avis/zelty/); [dixmilleheures](https://www.dixmilleheures.fr/avis/zelty); [tool-advisor Zelty](https://tool-advisor.fr/logiciel-de-caisse/comparatif/zelty/); [La Fabrique du Net](https://www.lafabriquedunet.fr/logiciel/zelty)
- L'Addition : le principal point faible est le manque de transparence de la grille tarifaire et de la durée d'engagement. Uniquement sur Apple. Note Capterra 3,0/5 sur 1 avis, La Fabrique du Net 7,6/10 — [independant.io](https://independant.io/avis/l-addition/); [Capterra](https://www.capterra.fr/software/181975/l-addition); [La Fabrique du Net](https://www.lafabriquedunet.fr/logiciel/laddition)
- Popina : prix du matériel uniquement sur demande, uniquement sur iPad, écran cuisine et commande en ligne en supplément — [independant.io Popina](https://independant.io/avis/popina/); [Fooderise](https://www.fooderise.com/en/caisse/popina)
- Toast : contrat de paiement de 2 ans lié aux starter kits — [NerdWallet](https://www.nerdwallet.com/business/software/reviews/toast-pos)

### Inferences
- Les arguments FLŌW à tester : navigateur et multi-appareils (pas de verrou Apple), prix publics, modules inclus plutôt qu'en supplément.

### Gaps
- Je n'ai pas extrait d'avis Capterra, G2 ou Trustpilot détaillés pour Lightspeed, SumUp, Innovorder et Cashmag. Les avis Trustpilot remontés concernaient d'autres sociétés homonymes.
- Je n'ai pas trouvé de preuve d'un rachat de L'Addition par Lightspeed, une hypothèse du brief : la page L'Addition ne mentionne pas Lightspeed.

---

## Synthèse : matrice des indispensables par segment et manques de FLŌW

Légende : ✔ = documenté dans les sources ci-dessus ; « ? » = non trouvé (pas forcément absent) ; FLŌW d'après le brief.

| Fonction | Resto/café | Boul.-pât.-choc. | Épicerie fine/traiteur | Exemples sourcés | FLŌW |
|---|---|---|---|---|---|
| Plan de salle, couverts, transfert/fusion | Indispensable | Utile (salon) | Rare | Square Plus/Premium, Odoo, Hiboutik, Popina, Aliris « gestion de tables » | ✗ |
| Envoi par suites / commande par place | Indispensable (trad.) | Non | Non | Square (gestion des services), Lightspeed | ✗ |
| Prise de commande mobile | Indispensable | Utile | Non | L'Addition iPhone/iPad Mini, Square Handheld, Toast Go 3 | ✗ |
| Modificateurs/options | Indispensable | Utile (messages gâteau, parts) | Utile | Hiboutik, Toast→xtraCHEF | Variantes seulement |
| Menus/formules auto | Indispensable | Indispensable (formule midi) | Utile | Hiboutik, Aliris, L'Addition, Bimedia | ✗ |
| Sur place/à emporter (TVA par commande) | Indispensable | Indispensable | Utile | Odoo, Aliris | ✗ |
| Titres-restaurant | Indispensable | Indispensable | Utile | Aliris (CRT + avoir), Popina | ✗ (à vérifier) |
| Pourboire tracé (exonéré jusqu'en 2028) | Indispensable | Utile | Rare | Odoo Tips | ✗ |
| KDS par poste + imprimantes de préparation | Indispensable | Utile (snacking) | Rare | Lightspeed, Hiboutik, Odoo, Zelty, Square KDS | KDS labo uniquement |
| Click & collect + créneaux | Indispensable | Indispensable | Indispensable | Zelty, L'Addition, Hiboutik, Aliris, Toporder | Partiel (hub + page de retrait) |
| Commandes clients à date de retrait + acompte | Utile | **Indispensable** (fêtes) | Indispensable (traiteur) | Aliris (calendrier), Toporder ; acompte ? | Partiel |
| QR à table | Utile | Rare | Non | Zelty, Hiboutik, L'Addition | ✗ |
| Livraison Uber/Deliveroo/Just Eat | Indispensable (QSR) | Utile | Utile | Zelty, Lightspeed Delivery, L'Addition (Deliverect), Innovorder | ✗ |
| Réservations | Indispensable (trad.) | Rare | Non | Lightspeed, L'Addition, Odoo, Hiboutik | ✗ |
| Recettes, déstockage, food cost | Indispensable | **Indispensable (labo)** | Utile | Toast xtraCHEF, Gourmets ERP | ✗ |
| Achats fournisseurs | Indispensable | Indispensable | Indispensable | L'Addition achats, Gourmets, Hiboutik | Interne seulement |
| Invendus/pertes/fabriqués | Utile | **Indispensable** | Indispensable | Aliris, Bimedia | ✗ |
| Lots/DLC traçabilité | Utile | Indispensable (labo) | **Indispensable** | Gourmets « Traçabilité » | ✗ |
| Étiquettes allergènes/nutrition/code-barres | Rare | Indispensable | **Indispensable** | Aliris | Allergènes en base, pas d'étiquettes |
| Vente au poids/balance | Rare | Indispensable | **Indispensable** | L'Addition, Bimedia, Clyo, Aliris | ✗ |
| Conditionnements/parts (4/8/12 pers.) | Non | Indispensable | Utile | Aliris | Variantes (partiel) |
| Monnayeur automatique | Rare | Utile | Utile | Aliris, Clyo | ✗ |
| Multi-sites + labo central | Utile | Indispensable | Utile | Zelty, Gourmets, Toporder | ✔ (force) |
| Production consolidée par boutique | Non | Indispensable | Utile (traiteur) | Gourmets, Bimedia, Toporder « SmartCollect » | ✔ (force) |
