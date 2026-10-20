# Dossier pour l'expert-comptable et l'avocat

Document à imprimer. Éditeur : [nom et prénom à compléter], entrepreneur individuel, logiciel de caisse FLŌW. Préparé le 20 octobre 2026 à partir du code de la branche `feat/plateforme-multi-secteurs`. **Ce n'est pas un avis juridique** : chaque question est posée parce que ni le code ni les sources lues ne permettent de trancher.

Pour ne pas répéter les autres documents, ce dossier renvoie vers eux : `docs/audit/06-conformite.md` (matrice complète du BOFiP, obligations, risques P0 et P1), `docs/legal/pages-a-valider.md` (pages publiques, CGV, confidentialité), `docs/legal/accord-sous-traitance-brouillon.md` (accord article 28), `docs/recette-terrain.md` (anomalies connues), `docs/sauvegardes.md`.

## Comment lire les sources

- **Lue le 20 octobre 2026** : page ouverte et lue par l'outil de lecture de cette séance. Les outils résument parfois : les numéros de paragraphes sont fiables, les citations sont courtes.
- **Lue par l'audit du 20/10/2026** : reprise de `docs/audit/06-conformite.md`, non relue ici.
- **Secondaire** : cabinet, éditeur, presse. **Non vérifié** : aucun texte officiel lu. Légifrance renvoie une erreur 403 : aucun article de loi n'a été lu directement sur Légifrance.

## Récapitulatif : quelle question pour qui

| Question | Sujet | Expert-comptable | Avocat | Autre |
| --- | --- | --- | --- | --- |
| a | Vente refusée par le serveur, file de caisse bloquée | oui (totaux, chiffre d'affaires) | oui (inaltérabilité) | rescrit DGFiP si désaccord |
| b | Numérotation des factures | oui | | |
| c | Attestation signée par une clé machine, formulation EI | | oui | rescrit DGFiP possible |
| d | TVA des cartes cadeaux | oui | | |
| e | Titre-restaurant : plafond par jour, 31/12/2026 | oui | oui | |
| f | TVA sur place ou à emporter | oui | | |
| g | Vente hors ligne et jour de clôture | oui | | |
| h | Plafond d'espèces | | oui | |
| i | Allergènes et information du consommateur | | oui | DGCCRF |
| j | Conservation 6 ans et fin de contrat | oui | oui | |
| k | Régime BIC ou BNC, code APE de l'éditeur | oui | | |
| l | Assurance RC Pro | | oui | assureur ou courtier |

---

## a. La vente refusée qui bloque la file de la caisse

**Contexte.** Chaque caisse numérote et signe ses tickets en chaîne (chaque ticket contient l'empreinte du précédent). Hors ligne, le ticket est remis au client, puis la vente est envoyée au serveur plus tard, dans l'ordre. Une vente que le serveur refuse ne peut plus être « reprise » : le ticket existe déjà chez le client.

**Le défaut, expliqué simplement.**
1. La caisse envoie les ventes en attente dans l'ordre des numéros de ticket (`apps/web/src/lib/terminal/terminal.ts`, fonction `flushSales`, environ lignes 160 à 196).
2. Si le serveur répond « refusé » (codes 400, 404 ou 422 : ticket altéré, produit inconnu, total recalculé différent du total signé), la caisse marque la vente « refusée » et passe à la suivante (lignes 184 à 187).
3. Mais le serveur exige que chaque ticket suive exactement le précédent de la même caisse : numéro attendu = dernier numéro enregistré plus un, et empreinte précédente identique (`apps/api/src/orders/orders.service.ts`, fonction `syncSignedSale`, environ lignes 100 à 135). La vente refusée n'a jamais été enregistrée, donc le serveur attend toujours son numéro.
4. La vente suivante arrive avec le numéro suivant : le serveur répond 409 « Ticket n° N+1 reçu, n° N attendu ». La caisse traite le 409 comme une panne passagère, garde la vente et réessaie plus tard, sans fin.
5. Résultat : **toutes les ventes suivantes de cette caisse restent « à envoyer »**, ne figurent ni dans les clôtures ni dans le chiffre d'affaires du serveur, et rien ne sort de l'impasse sans intervention technique (`docs/recette-terrain.md`, anomalie 4, gravité P0, cas FIS-04 et RES-02). Plus la caisse reste bloquée, plus les ventes manquantes s'accumulent.

**Ce que fait FLŌW aujourd'hui.** Il refuse et bloque, comme ci-dessus. Pour d'autres anomalies sur une vente déjà faite, il enregistre quand même la vente et signale le problème : pièce numérotée absente du stock, moyen de paiement désactivé, règle d'encaissement non respectée (`orders.service.ts`, commentaires « La vente a eu lieu »). Il n'y a donc déjà deux philosophies dans le code.

**Source officielle déjà lue.** BOFiP BOI-TVA-DECLA-30-10-30 (version du 25/03/2026), lue par l'audit : inaltérabilité des données, corrections par opérations « plus » et « moins » plutôt que par suppression (§ 80, 90, 120), suivi des modifications (§ 100, 130). Le BOFiP ne traite pas de ce cas précis (ticket remis mais refusé par le serveur) : **non vérifié**.

**Les deux options à soumettre.**

*Option 1. Inscrire la vente refusée comme incident au journal chaîné et reprendre la numérotation sans la perdre.* Quand le serveur refuse une vente signée, il ne la met pas dans les ventes, mais il inscrit dans le journal chaîné des événements (celui des clôtures et des caisses, `FiscalEvent`) un incident daté contenant : la caisse, le numéro et l'empreinte du ticket, le total signé, le motif du refus, l'auteur (la caisse). Le serveur avance son compteur attendu pour cette caisse (le ticket suivant a pour « empreinte précédente » celle du ticket refusé, que l'incident enregistre), donc la file reprend. Le ticket refusé reste visible dans une liste « ventes à régulariser » pour un responsable. Conséquence à examiner : le client détient un ticket signé qui ne figure dans aucun total ; il faut prévoir une régularisation (saisie manuelle d'une vente de correction ou d'un ticket négatif, par le gérant, avec justification).

*Option 2. Exiger que toute vente signée par une caisse connue soit acceptée, et traiter l'écart comme une erreur de gestion à corriger, jamais comme un refus.* Le serveur ne refuse plus une vente dont la signature est valide et dont le numéro suit la chaîne. Il l'enregistre telle que signée (le contenu signé fait foi) et lui accole un statut « à vérifier » avec le motif (produit inconnu, total recalculé différent, prix différent du catalogue). Le gérant corrige ensuite par les moyens normaux : ticket de retour négatif signé dans la même chaîne, puis nouvelle vente si besoin. Seuls les cas où le ticket n'est pas authentique (signature fausse, caisse inconnue, chaîne rompue) sont mis à l'écart, sans bloquer la chaîne de la caisse authentique : un ticket qui ne vient pas de la caisse n'a pas de numéro dans sa chaîne.

**Ce qui me paraît le plus défendable (avis de l'éditeur, non tranché).** L'option 2. Raison : le ticket a été remis au client, la vente a eu lieu, elle doit donc figurer dans le chiffre d'affaires, les clôtures et l'archive ; elle est ensuite corrigée par une opération inverse tracée, ce qui est exactement le mécanisme que le BOFiP décrit (corrections par opérations « plus » et « moins », § 80 à 120 selon l'audit). L'option 1 laisse une vente réelle hors des totaux et dépend d'une régularisation manuelle, c'est-à-dire d'un trou comptable temporaire, et d'un journal de plus à vérifier. L'option 2 ressemble déjà à ce que le code fait pour les autres écarts (moyen de paiement, stock). Réserves : elle oblige à décider quel prix prévaut (le signé), et le total signé peut différer du total recalculé, donc l'écart de TVA doit être traité.

**Questions exactes à poser.**
- À l'expert-comptable : « Une vente réelle, dont le ticket signé a été remis au client mais que mon logiciel a refusée à la réception, doit-elle figurer dans le chiffre d'affaires et dans la clôture du jour, ou peut-elle rester hors des totaux avec une écriture d'incident ? Quelle écriture de régularisation acceptez-vous ? »
- À l'avocat : « Au regard de l'obligation d'inaltérabilité et de la valeur de l'attestation que je délivre, est-il plus sûr d'accepter toute vente signée valide et de la corriger par une opération inverse (option 2), ou d'inscrire un incident au journal et de reprendre la numérotation (option 1) ? Que risque l'attestation si un ticket remis ne figure pas dans les données ? »
- Aux deux : « Si le total signé et le total recalculé par le serveur diffèrent, lequel fait foi pour la TVA ? »

**Professionnel concerné.** Expert-comptable et avocat ; rescrit à la DGFiP si leurs avis divergent (`docs/audit/06-conformite.md`, section 5). Pas de modification du code tant que le choix n'est pas fait (la règle du projet interdit de changer le format des tickets signés : les deux options n'y touchent pas).

---

## b. Numérotation et continuité des factures

**Contexte.** FLŌW émet des factures pour les ventes B2B et pour les clients professionnels qui demandent une facture en caisse. Jusqu'au 20 octobre 2026, une des trois routes numérotait au hasard (quatre chiffres tirés au sort, `apps/api/src/b2b/b2b-orders.controller.ts`) : corrigé, voir ci-dessous.

**Ce que fait FLŌW aujourd'hui.** Un compteur par organisation et par année civile, format `FA-AAAA-NNNN`, attribué dans la transaction qui enregistre la facture : pas de trou si l'écriture échoue, pas de doublon si deux factures partent en même temps (`apps/api/src/invoices/invoice-number.ts`, tests `invoice-number.spec.ts`). Le compteur repart à `0001` chaque 1er janvier. Le numéro est par organisation (toutes les boutiques d'un commerçant partagent la suite). Les tickets de caisse ont une numérotation à part (compteur par caisse). Un avoir ou remboursement : « un remboursement ne se facture pas, la facture d'origine reste valable » (`receipts/invoice.service.ts`) : pas d'avoir numéroté aujourd'hui.

**Options.** (1) Suite unique par organisation avec remise à zéro annuelle (actuel). (2) Suite continue sans remise à zéro (l'année dans le préfixe resterait informative). (3) Suite par boutique. (4) Séries distinctes pour factures et avoirs.

**Source officielle déjà lue.** Service-public Entreprendre, F31808, lue le 20 octobre 2026 (page vérifiée par le site le 11 août 2026) : numéro unique à chaque facture, « suivant une séquence chronologique continue ». La page ne dit rien de la remise à zéro annuelle ni de plusieurs séries. Mention entrepreneur individuel : nom et prénom avec « EI » ou « Entrepreneur individuel » avant ou après, adresse, SIREN (corrigé sur le PDF le 20 octobre 2026 quand la forme juridique est renseignée).

**Question exacte.** « La remise à zéro du compteur chaque année (préfixe `FA-2026-0001`) respecte-t-elle l'exigence de séquence chronologique continue ? Faut-il une série par boutique, ou des séries séparées pour les avoirs ? Pour un client qui change de logiciel en cours d'année, comment reprendre sa numérotation ? »

**Professionnel concerné.** Expert-comptable. Renvoi : `docs/legal/pages-a-valider.md`, section « Numérotation des factures ».

---

## c. Valeur de l'attestation signée par une clé machine, et formulation pour un entrepreneur individuel

**Contexte.** Depuis le 21/02/2026, l'éditeur peut délivrer une attestation individuelle à ses clients au lieu d'un certificat d'organisme accrédité. FLŌW la génère automatiquement, au modèle BOI-LETTRE-000242 (`docs/legal/BOI-LETTRE-000242-20260325.md`), et la signe avec une clé de l'application, sans signature manuscrite ni qualifiée du représentant légal.

**Ce que fait FLŌW aujourd'hui.** `apps/api/src/compliance/attestation.service.ts` : volet 1 pour l'éditeur, volet 2 pré-rempli pour le commerçant (à compléter et signer par lui) ; exige les variables `EDITOR_*` renseignées ; périmètre « couvert / non couvert » listé dans le service et recopié dans `/legal/conformite`. La formulation EI du volet 1 est adaptée dans le code, non validée.

**Source officielle lue le 20 octobre 2026.** BOFiP BOI-TVA-DECLA-30-10-30, version en vigueur du 25/03/2026 (lu à travers un outil de résumé) : § 360 l'assujetti peut justifier la conformité par une attestation ; § 365 délivrée par l'éditeur, spontanément ou à la demande de l'assujetti ; § 370 nominative, une simple mention dans les conditions générales ne suffit pas, document pré-rempli par l'éditeur puis complété par l'assujetti admis par tempérament, établie par l'éditeur **ou son représentant légal** ; § 375 l'éditeur ne peut pas être l'assujetti lui-même, sauf activité réelle d'édition (les codes NAF ou NACE ne suffisent pas à la prouver), l'attestation indique que le logiciel respecte inaltérabilité, sécurisation, conservation et archivage, et identifie le logiciel (nom, version, licence éventuelle, date d'acquisition). Relecture à l'œil du texte complet sur bofip.impots.gouv.fr recommandée avant tout engagement. Fausse attestation : délit (art. 441-1 du code pénal selon le modèle du dépôt, non relu sur Légifrance).

**Options.** (1) Garder la signature par clé machine, avec mention expresse dans l'attestation de ce que la clé représente. (2) Ajouter une signature manuscrite ou électronique de l'éditeur (lui-même, représentant légal d'une entreprise individuelle) à la remise. (3) Ne délivrer l'attestation qu'après signature du fondateur, document par document.

**Questions exactes.** « Pour un entrepreneur individuel, qui est le "représentant légal" : lui-même ? Comment formuler le volet 1 (nom et prénom, EI, SIREN) ? » « Une signature produite par une clé de mon application vaut-elle l'établissement par l'éditeur au sens du § 370, ou faut-il ma signature personnelle ? » « La phrase "non certifié par un organisme accrédité" est-elle suffisante ? » « Dois-je faire attention au § 375 si j'utilise moi-même FLŌW pour une activité de vente ? »

**Professionnel concerné.** Avocat ; rescrit DGFiP possible. Renvois : `docs/audit/06-conformite.md` (risque 2, ligne 8), `docs/legal/pages-a-valider.md` (« Conformité de la caisse », points 3 et 4).

---

## d. TVA des cartes cadeaux

**Contexte.** La vente d'une carte cadeau est-elle une opération taxable à la vente, ou seulement à l'utilisation ? Cela dépend du type de bon (usage unique ou usages multiples).

**Ce que fait FLŌW.** 0 % de TVA à la vente, systématiquement, la TVA étant due à l'utilisation (« bon polyvalent », `apps/api/src/products/products.service.ts`, fonction `giftCardProduct`, et `order-draft.ts`) ; plafond de 1 500 € par carte sans source citée.

**Source.** Secondaire, lue par l'audit : art. 256 ter CGI, loi de finances 2019 art. 73, directive UE 2016/1065, https://www.legifiscal.fr/tva/tva-francaise/operations-imposables-exonerees/bons-regles-tva.html. Aucun texte officiel lu : **non vérifié**.

**Options.** (1) Garder 0 % pour tous (correct seulement pour les bons à usages multiples). (2) Paramètre « bon à usage unique » : TVA au taux connu dès la vente. (3) Interdire l'usage unique dans le produit.

**Question exacte.** « Mon client vend une carte cadeau utilisable dans un seul commerce à un seul taux de TVA (boulangerie à 5,5 %) : la TVA est-elle due à la vente ? Le 0 % à la vente reste-t-il valable pour un bon utilisable dans plusieurs boutiques ou pour plusieurs produits à taux différents ? D'où vient le plafond de 1 500 € et dois-je le garder ? »

**Professionnel.** Expert-comptable.

---

## e. Titre-restaurant : plafond par jour et fin de la dérogation au 31/12/2026

**Contexte.** Le titre-restaurant est limité par jour et par bénéficiaire et ne vaut que pour certains produits ; une dérogation élargit aux produits alimentaires jusqu'à fin 2026 selon une source secondaire.

**Ce que fait FLŌW.** Plafond de 25 € **par ticket** et pas de rendu de monnaie (`packages/utils/src/payment-rules.ts`) ; éligibilité posée d'office sur tout l'alimentaire à 5,5 ou 10 % (migration `20261014105714_conformite_fiscale`, lignes 204 à 207). La caisse ne peut pas contrôler le plafond par jour (elle ne connaît pas les autres achats du bénéficiaire).

**Source.** Secondaire, lue par l'audit : Pluxee, 08/01/2026, https://www.pluxee.fr/questions-frequemment-posees/legislation-du-titre-restaurant (25 € par jour, dérogation jusqu'au 31/12/2026, proposition de loi non votée à la connaissance de l'audit). Texte du code du travail : **non vérifié**.

**Options.** (1) Statu quo, avec avertissement dans l'aide. (2) Éligibilité par produit configurable dès maintenant, bascule au 01/01/2027 par réglage. (3) Désactiver le titre-restaurant pour les produits non « repas » dès le 01/01/2027.

**Questions exactes.** « Le plafond est-il de 25 € par jour et par bénéficiaire, et le commerçant est-il responsable du contrôle en caisse alors que le logiciel ne peut contrôler que le ticket ? » « Que devient la dérogation au 31/12/2026, et quelles catégories de produits doivent être décochées au 01/01/2027 ? » « Rendu de monnaie : confirmez-vous qu'il est interdit ? »

**Professionnel.** Expert-comptable ; avocat pour le texte. Renvoi : `docs/audit/06-conformite.md` (risque 6, tableau section 3 ligne 5).

---

## f. TVA sur place ou à emporter

**Contexte.** Pour boulangeries, pâtisseries et restauration, un même article peut être à 5,5 % ou 10 % selon qu'il est consommé sur place ou emporté (source secondaire).

**Ce que fait FLŌW.** Un taux fixe par article, sans mode « sur place / à emporter » par vente (`packages/utils/src/tax.ts`). Le commerçant doit créer deux articles.

**Source.** Secondaire, lue par l'audit : 10 % sur place, 5,5 % produit conditionné, alcool 20 %. BOI-TVA-LIQ-30-20-10 **non lu** : **non vérifié**.

**Options.** (1) Deux articles distincts, sans changement du produit. (2) Mode de consommation par vente avec taux alternatif par article. (3) Réservé à un secteur (restauration), pas aux autres.

**Questions exactes.** « Pour mon client pilote [à compléter : activité], quels produits relèvent de quel taux dans chaque mode, et quelle règle appliquer à une vente mixte (une partie sur place, une partie emportée) ? Le ticket doit-il porter le mode de consommation ? Un changement de mode après signature se traite comment ? »

**Professionnel.** Expert-comptable. Renvoi : `docs/audit/06-conformite.md` (risque 4).

---

## g. Rattachement d'une vente hors ligne au bon jour de clôture

**Contexte.** Une vente faite hors ligne le 31 décembre et reçue le 2 janvier doit figurer dans le Z du 31 décembre, surtout si l'année est déjà clôturée.

**Ce que fait FLŌW.** Le ticket porte l'heure de la caisse, non bornée. Le serveur date la vente à son heure signée si le jour de cette vente n'est pas encore clôturé, sinon à l'heure de réception, donc dans le Z du jour de réception (`apps/api/src/orders/orders.service.ts`, fonction `bookingDate`, environ lignes 318 à 325 ; `docs/recette-terrain.md`, anomalie 12). Le Z annuel d'un exercice déjà clôturé ne contient donc pas cette vente.

**Source.** BOFiP § 170 (clôtures journalière, mensuelle, annuelle, cumulatives et impératives), lu par l'audit, non relu ici.

**Options.** (1) Statu quo : vente rattachée au jour de réception, avec mention de la date réelle sur le ticket. (2) Réouvrir une clôture par une opération tracée. (3) Retarder la clôture automatique tant qu'une caisse a des ventes en attente ; (4) Z complémentaire daté.

**Question exacte.** « Une vente dont le ticket est daté du 31 décembre mais reçue en janvier, après la clôture de l'exercice : dans quelle déclaration de TVA et dans quel exercice comptable la placer ? La clôture peut-elle attendre les ventes hors ligne, et dans quel délai maximum ? »

**Professionnel.** Expert-comptable. Renvoi : `docs/audit/06-conformite.md` (risque 5).

---

## h. Plafond d'espèces

**Contexte.** Le paiement en espèces est plafonné, avec un plafond différent pour un non-résident.

**Ce que fait FLŌW.** 1 000 € pour un résident, **15 000 € pour tout non-résident** de tout commerce (`packages/utils/src/payment-rules.ts`, lignes 9 et 10, application côté caisse et côté serveur).

**Source officielle lue le 20 octobre 2026.** Service-public, F10999, vérifiée le 26 juin 2026 : particulier vers professionnel 1 000 € ; non-résident 15 000 € si le professionnel est soumis aux obligations de lutte contre le blanchiment (LCB-FT), 10 000 € dans les autres cas ; pièce d'identité au-delà de 1 000 € ; amende maximale de 5 % des sommes payées, payeur et professionnel à moitié ; exceptions (personne sans compte bancaire, etc.) ; textes cités : code monétaire et financier L112-6 à L112-8, D112-3, R112-5. Le texte lui-même n'a pas été lu sur Légifrance.

**Options.** (1) Passer le plafond non-résident à 10 000 € par défaut, 15 000 € si le commerçant déclare être soumis à la LCB-FT. (2) Garder 15 000 €. (3) Alerte sans blocage.

**Questions exactes.** « Un commerce de bouche relève-t-il des professionnels soumis à la LCB-FT ? » « Le plafond s'applique-t-il par ticket ou par client sur une période, et comment traiter le fractionnement entre plusieurs tickets ? » « Le logiciel doit-il demander et enregistrer la pièce d'identité au-delà de 1 000 € ? »

**Professionnel.** Avocat. Renvoi : `docs/audit/06-conformite.md` (risque 7).

---

## i. Allergènes et information du consommateur

**Contexte.** L'information sur les 14 allergènes pèse sur le commerçant (règlement INCO 1169/2011 art. 44, source secondaire) ; FLŌW vend un module de saisie.

**Ce que fait FLŌW.** Saisie des allergènes et des traces dans le back-office (`apps/web/.../AllergensClient.tsx`), **jamais restituée au client** : ni fiche imprimable, ni QR code, ni étiquette, ni affichage client (`docs/audit/06-conformite.md`, risque 9).

**Source.** Secondaire, lue par l'audit : règlement INCO 1169/2011 art. 44, décret 2015-447, réponse ministérielle https://questions.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE75805.pdf. Articles du code de la consommation à confirmer. **Non vérifié** sur un texte officiel.

**Options.** (1) Ne rien promettre et le dire dans l'aide et les CGV. (2) Fiche allergènes imprimable et QR code pour le client. (3) Étiquette par produit. Aussi : le commerçant porte la responsabilité, mais l'éditeur ne doit pas laisser croire que le module suffit (formulation à valider).

**Questions exactes.** « Si mon module permet de saisir les allergènes sans les afficher au client, quelle est ma responsabilité et que dois-je écrire dans les CGV ? Quelles mentions précises, sous quelle forme (écrit obligatoire pour la vente non préemballée ?) ? » « Les mentions de l'écran client ou du ticket doivent-elles reprendre les allergènes ? »

**Professionnel.** Avocat ; DGCCRF pour une interprétation. Renvoi : `docs/audit/06-conformite.md` (ligne « Allergènes », section 4).

---

## j. Durée de conservation (6 ans, L102 B LPF) et sort des données après résiliation

**Contexte.** Le commerçant doit conserver ses données de caisse. L'éditeur héberge ces données et peut résilier ou être résilié : qui conserve quoi, et jusqu'à quand ?

**Ce que fait FLŌW.** Les archives fiscales signées sont mensuelles et annuelles, téléchargeables, jamais purgées par l'application ; elles sont copiées chaque nuit sur un stockage distant sans suppression ; les sauvegardes complètes sont gardées 30 jours, 12 mois, 7 ans (`docs/sauvegardes.md`). Aucune procédure de suppression d'un compte n'existe. Durée après résiliation : « [à compléter] » dans `docs/commercial/contrat-pilote.md` (article 10) et `pages-a-valider.md` (CGV point 8). Export libre-service : ventes, paiements, produits, stock, clients professionnels (`apps/api/src/data/data.controller.ts`) ; les clients particuliers n'ont pas d'export.

**Source officielle lue le 20 octobre 2026.** Service-public Entreprendre F10029 : documents fiscaux 6 ans (livre des procédures fiscales L102 B), pièces comptables et factures 10 ans à compter de la clôture de l'exercice, contrats et courriers commerciaux 5 ans ; la page note qu'elle ne s'applique pas aux micro-entrepreneurs (page distincte, non lue) et que la conservation peut être plus longue sauf pour les données personnelles. Article L102 B non lu sur Légifrance. Point RGPD : la conservation de données personnelles au-delà de ce qui est nécessaire est un risque (`docs/legal/accord-sous-traitance-brouillon.md`, articles 6 et 8).

**Options.** (1) Le commerçant exporte et conserve ses archives (6 ans, voire 10 ans pour les factures), l'éditeur détruit à une date fixée après résiliation. (2) L'éditeur conserve les archives pour le compte du commerçant pendant 6 ans avec accès en lecture. (3) Remise du support au commerçant ou à son expert-comptable contre attestation de destruction.

**Questions exactes.** « Les données de caisse relèvent-elles des 6 ans (fiscal) ou des 10 ans (comptable) ? » « Après la fin du contrat, mon obligation d'éditeur est-elle seulement de restituer, ou dois-je conserver les archives 6 ans ? » (avocat) « Combien de temps garder les sauvegardes qui contiennent des données personnelles déjà effacées, et peut-on les couper à moins de 7 ans ? » (avocat) « Quel délai donner au commerçant pour exporter avant destruction ? »

**Professionnel.** Expert-comptable pour la durée, avocat pour le contrat et le RGPD.

---

## k. Régime BIC ou BNC et code APE de l'éditeur

**Contexte.** Le fondateur est entrepreneur individuel et édite un logiciel facturé par abonnement. Le régime fiscal de ses revenus et son code d'activité conditionnent aussi la rédaction des mentions légales.

**Ce que fait FLŌW.** Rien : aucune donnée de l'éditeur n'est en dur dans le code ; elles viennent de variables (`EDITOR_*`, `NEXT_PUBLIC_EDITOR_*`, `pages-a-valider.md`). Le code APE n'est demandé nulle part. Le fondateur n'a pas encore indiqué ses valeurs : [régime, SIREN, code APE, option TVA ou franchise en base à compléter].

**Source.** Aucune lue sur ce sujet : **non vérifié**. À noter : le BOFiP § 375 précise que les codes NAF ou NACE ne suffisent pas à prouver une activité d'édition de logiciels de caisse, lu le 20 octobre 2026 (voir question c). Franchise en base de TVA : fiche F21746, citée par `pages-a-valider.md`, non relue ici.

**Questions exactes.** « Mon activité d'éditeur de logiciel en abonnement relève-t-elle des BIC ou des BNC ? Quel code APE est cohérent avec mon activité réelle et quelle conséquence si je le change ? » « Suis-je en franchise en base de TVA ? Je dois, si oui, afficher "TVA non applicable, article 293 B du CGI" sur mes factures d'abonnement et mes CGV » (mention reprise de `pages-a-valider.md`). « Comment facturer mes clients dans l'Union européenne ? »

**Professionnel.** Expert-comptable.

---

## l. Assurance responsabilité civile professionnelle et ce qu'elle doit couvrir

**Contexte.** Un logiciel de caisse touche à l'argent et à la fiscalité du commerçant : une erreur de calcul, une perte de données ou une fuite peuvent causer un préjudice supérieur aux abonnements perçus.

**Ce que fait FLŌW.** Rien dans le dépôt n'atteste une assurance. Le contrat pilote et les CGV prévoient une limitation de responsabilité à clause à valider (`pages-a-valider.md`, CGV point 10 ; `docs/commercial/contrat-pilote.md` article 11).

**Source.** Aucune lue : **non vérifié**. Liste ci-dessous : risques constatés dans le code, à soumettre à l'assureur, sans prétendre à une garantie standard.

**Ce qu'il faudrait faire couvrir (à vérifier avec l'assureur)** : erreur de calcul de TVA, de total ou de numérotation ; perte ou altération de données de vente et d'archives fiscales ; indisponibilité prolongée du service ; violation de données personnelles (frais de notification, de défense, sanctions assurables ou non) ; attestation de conformité délivrée à tort (voir question c) ; dommages causés aux tiers ; frais de défense ; extension cyber ; couverture de l'activité d'éditeur d'un entrepreneur individuel, y compris sur ses biens propres.

**Questions exactes.** « Une RC Pro "éditeur de logiciel" couvre-t-elle les erreurs de calcul fiscal et la délivrance d'une attestation de conformité ? » (avocat) « Quels plafonds par sinistre et par an, quelles exclusions (activité de paiement, cyber), quelle franchise ? » (assureur) « Comment la limitation de responsabilité des CGV s'articule avec le plafond de la garantie ? » (avocat)

**Professionnel.** Avocat ; assureur ou courtier.

---

## Ce que le fondateur doit apporter

- L'attestation générée par FLŌW (page Conformité) et le modèle `docs/legal/BOI-LETTRE-000242-20260325.md`.
- Un extrait des factures et d'un ticket signé (page de reçu), un Z journalier, une archive mensuelle.
- Ses informations d'éditeur : SIREN, régime fiscal, code APE, assurance en cours.
- Les CGU, CGV, politique de confidentialité en version brouillon (`/legal/*`) et `docs/legal/accord-sous-traitance-brouillon.md`.
- Le contrat pilote (`docs/commercial/contrat-pilote.md`).

## Notes pour la prise de décision

Chaque réponse obtenue est à reporter dans `docs/legal/pages-a-valider.md` (une ligne par point résolu) avant de changer le texte public ou le code. Aucune modification du format des tickets signés n'est nécessaire pour les options présentées.
