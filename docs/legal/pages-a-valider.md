# Pages légales publiques : points à valider ou compléter

Brouillons publiés sous `/legal/mentions-legales`, `/legal/cgu`, `/legal/cgv`, `/legal/confidentialite`, `/legal/conformite` (version `2026-10`, constante `LEGAL_VERSION` de `apps/web/src/lib/legal.ts`, la même que celle enregistrée à l'inscription dans `User.termsVersion`). Tant que `LEGAL_DRAFT` vaut `true`, chaque page affiche un bandeau « Projet en cours de relecture » et un repère « À valider » sur les clauses listées ci-dessous.

Rien de juridique n'a été inventé : ce qui n'est pas sourcé ou pas vérifié dans le code est marqué « [à compléter] » ou « À valider ».

## Sources consultées (18 octobre 2026)

- Légifrance renvoie une erreur 403 à l'outil de vérification : **aucun article n'a pu être lu directement sur legifrance.gouv.fr**. Les textes ont été vérifiés sur les fiches officielles suivantes, qui citent les articles :
- Mentions obligatoires d'un site professionnel, Service Public Entreprendre (vérifiée le 13 octobre 2026) : https://entreprendre.service-public.gouv.fr/vosdroits/F37351. Références citées : loi 2004-575 art. 1-1 (informations sur l'éditeur), 1-2 (sanctions), 6, 19 ; code de commerce L441-1 (CGV) ; mentions d'information RGPD.
- Délais de paiement entre professionnels et pénalités de retard (vérifiée le 7 août 2026) : https://entreprendre.service-public.gouv.fr/vosdroits/F23211. Références : code de commerce L441-1, L441-9, L441-10, D441-5.
- Franchise en base de TVA (vérifiée le 1er janvier 2026) : https://entreprendre.service-public.gouv.fr/vosdroits/F21746. Mention « TVA non applicable - article 293 B du CGI ».
- Délais de conservation des documents (vérifiée le 1er juillet 2024) : https://entreprendre.service-public.gouv.fr/vosdroits/F10029. Documents fiscaux : 6 ans, livre des procédures fiscales art. L102 B.
- CNIL, adresser une plainte : https://www.cnil.fr/fr/adresser-une-plainte (service en ligne et courrier : CNIL, Service des plaintes, 3 place de Fontenoy, 75007 Paris).
- Modèle d'attestation individuelle : `docs/legal/BOI-LETTRE-000242-20260325.md` (volet 2 à compléter et signer par l'entreprise utilisatrice).

**Point important** : la mission parlait de l'article 6 III de la LCEN. D'après la fiche F37351 et la fiche Légifrance de l'article 1-1 (vue dans les résultats de recherche, en vigueur depuis le 23 mai 2024, créé par la loi n° 2024-449 dite SREN), ces mentions relèvent désormais de **l'article 1-1 de la loi 2004-575**. Les pages ne citent que « la loi n° 2004-575 du 21 juin 2004 » sans numéro d'article. À confirmer sur Légifrance.

## Variables à renseigner (`apps/web/.env.local.example`)

Sans elles, les pages affichent « [à compléter] ». Les noms reprennent ceux de l'API (`EDITOR_COMPANY`, `EDITOR_SIREN`, `EDITOR_ADDRESS`, `EDITOR_REPRESENTATIVE`) : mettre les mêmes valeurs des deux côtés, l'attestation fiscale et les pages doivent concorder.

| Variable | Contenu | Source de l'obligation |
| --- | --- | --- |
| `NEXT_PUBLIC_EDITOR_COMPANY` | raison sociale, ou nom et prénom de l'EI | F37351 |
| `NEXT_PUBLIC_EDITOR_STATUS` | forme juridique, ou « entrepreneur individuel » (bascule l'affichage EI : pas de capital, mention « entrepreneur individuel (EI) ») | F37351 |
| `NEXT_PUBLIC_EDITOR_CAPITAL` | capital social (société) | F37351 |
| `NEXT_PUBLIC_EDITOR_SIREN`, `NEXT_PUBLIC_EDITOR_REGISTRY` | SIREN et registre (RCS de la ville, ou RNE) | F37351 |
| `NEXT_PUBLIC_EDITOR_VAT_NUMBER` | numéro de TVA intracommunautaire, s'il existe | F37351 |
| `NEXT_PUBLIC_EDITOR_VAT_FRANCHISE` | « oui » seulement en franchise en base : affiche « TVA non applicable, article 293 B du code général des impôts » dans les mentions et les CGV | F21746 |
| `NEXT_PUBLIC_EDITOR_ADDRESS` | siège social, ou adresse de domiciliation de l'EI | F37351 |
| `NEXT_PUBLIC_EDITOR_EMAIL`, `NEXT_PUBLIC_EDITOR_PHONE` | contact de l'entreprise | F37351 |
| `NEXT_PUBLIC_EDITOR_REPRESENTATIVE` | représentant légal | attestation BOI-LETTRE-000242 |
| `NEXT_PUBLIC_EDITOR_DIRECTOR` | directeur de la publication (non déduit du représentant légal : à choisir) | F37351 |
| `NEXT_PUBLIC_EDITOR_PRIVACY_EMAIL`, `NEXT_PUBLIC_EDITOR_DPO` | contact données personnelles, DPO s'il est désigné | F37351 (mentions RGPD) |
| `NEXT_PUBLIC_HOST_NAME`, `_ADDRESS`, `_PHONE` | hébergeur : nom, adresse, téléphone | F37351 |
| `NEXT_PUBLIC_LEGAL_COURT` | juridiction compétente des CGV | à fixer avec le juriste |

Les `NEXT_PUBLIC_*` sont figées à la compilation : rebâtir l'image web après les avoir changées.

## Mentions légales

1. Activité réglementée ou profession réglementée : non applicable a priori à un éditeur de logiciel ; à confirmer.
2. Hébergeur : seul le registre d'images `registry.gra.cloud.ovh.net` (k8s/) atteste d'OVHcloud à Gravelines. L'hébergeur réel du cluster et de la base, sa région et ses coordonnées sont à confirmer avant de remplir `NEXT_PUBLIC_HOST_*`.
3. Mention « TVA non applicable, art. 293 B » : vérifier que l'éditeur est bien en franchise avant d'activer la variable.

## CGU

1. **Conformité fiscale** (À valider) : formulation de l'engagement d'inaltérabilité, renvoi au volet 2 signé par le commerçant, phrase « non certifié par un organisme accrédité » (reprise de la FAQ du site). Durée de six ans (L102 B LPF, fiche F10029) présentée comme une obligation du commerçant : à confirmer.
2. **Fonctionnement hors ligne** (À valider) : avertissement sur les ventes non encore envoyées qui n'existent que sur l'appareil.
3. **Disponibilité et support** (À valider) : « meilleurs efforts », aucun taux de disponibilité promis ; délais de support renvoyés à l'application (le délai annoncé est une décision commerciale, voir `SUPPORT_SLA_MINUTES`).
4. **Responsabilité** (À valider) : exclusions (mauvaise utilisation, matériel, réseau, prestataire de paiement).
5. **Suspension** (À valider) : conditions et préavis.
6. **Modification des conditions** (À valider) : information préalable et faculté de résilier ; délai de prévenance non chiffré.
7. **Droit applicable** (À valider).
8. « La date et la version acceptées sont enregistrées » : champs `termsAcceptedAt` et `termsVersion` du modèle `User` (travail en cours sur l'inscription) ; à vérifier une fois livré.

## CGV (B2B)

Sourcé : prix HT par boutique et par mois (`packages/types/src/billing.ts`, lus directement par la page), essai de `TRIAL_DAYS` jours sans carte, rien prélevé sans souscription et données exportables (FAQ du site), quantité facturée = nombre de boutiques, minimum une (`billing.service.ts`), paiement par Stripe Checkout et gestion par le portail Stripe, souscription réservée au titulaire (`canManage: role === 'OWNER'`), pénalités au taux BCE de refinancement majoré de 10 points et indemnité de 40 € (L441-10, D441-5, fiche F23211).

À valider ou compléter :

1. **Champ d'application** : réservé aux professionnels ; acceptation à la souscription (aucune case d'acceptation des CGV n'existe aujourd'hui dans le parcours Stripe).
2. **« Aucune remise, ristourne ni escompte »** : décision commerciale à confirmer (L441-1 et L441-9 imposent d'indiquer les conditions d'escompte).
3. **Essai** : ce qui se passe à la fin de l'essai sans souscription (accès limité, lecture seule, durée de conservation) n'est pas défini dans le code.
4. **Facturation** : « une facture est émise à chaque échéance » suppose que les factures Stripe portent les mentions françaises obligatoires (numérotation, SIREN, TVA, mentions de retard et d'indemnité de 40 €) ; à vérifier dans le paramétrage Stripe.
5. **Ajout d'une boutique en cours d'abonnement** : la quantité n'est fixée qu'au moment du Checkout ; règle de mise à jour et de prorata à définir.
6. **Retard** : limitation de l'accès après impayé, et promesse que l'encaissement et les exports restent possibles : non implémenté dans le code (statut `PAST_DUE` sans effet), à décider.
7. **Résiliation** : prise d'effet en fin de mois payé et absence de remboursement du mois commencé : dépend du réglage du portail Stripe, à vérifier ; résiliation par l'éditeur après mise en demeure : délai [à compléter].
8. **Données après résiliation** : durée d'accès en lecture et export [à compléter], puis suppression ; aucun mécanisme de suppression n'existe dans le code. Articulation avec l'obligation de conservation fiscale (l'éditeur doit-il conserver les archives pour le compte du commerçant ?) à trancher.
9. **Évolution des prix** : délai de prévenance [à compléter].
10. **Limitation de responsabilité** : plafond aux sommes payées sur douze mois, exclusion faute lourde ou dolosive. Clause à risque, rédaction à faire valider.
11. **Juridiction** : `NEXT_PUBLIC_LEGAL_COURT` [à compléter] ; médiation éventuelle.
12. Taux chiffré des pénalités : volontairement non écrit (il change chaque semestre : 12,40 % au 2e semestre 2026 selon F23211) ; la formule suffit, à confirmer.

## Politique de confidentialité

Sourcé dans le code : modèles `User` (empreintes du code vendeur et du badge, `tokenVersion`), `Customer` (prénom, nom, téléphone, e-mail, points, total, visites, dernière visite, `marketingOptIn`), `Order.customerEmail`, factures (dénomination, SIRET, TVA, adresse, e-mail), `AuditLog` (avec adresse IP), `SupportThread` / `SupportMessage`, lien de réinitialisation valable 1 heure (`RESET_TTL_MS`), effacement d'un client (`customers.service.ts`, ventes conservées sans lien), jetons de session en `localStorage`, ventes hors ligne en IndexedDB, aucun outil de mesure d'audience ni traceur publicitaire trouvé.

Sous-traitants trouvés dans le code : Stripe (abonnement, `apps/api/src/billing`), Resend (tous les e-mails, `apps/api/src/common/mail/mail.service.ts`), hébergeur (OVHcloud supposé, voir plus haut). **Sentry n'est pas actif** : `@sentry/nextjs` n'est pas installé et `instrumentation.ts` est vide, mais `sentry.client.config.ts` prévoit des enregistrements de session (replays) ; s'il est activé, l'ajouter à la liste et revoir la question du consentement.

À valider ou compléter :

1. **Bases légales** de chaque traitement (tableau « Données des commerçants ») : qualification proposée, à valider.
2. **Accord de sous-traitance (article 28)** avec les commerçants pour les données de leurs clients : à rédiger [à compléter dans la page].
3. **Lieu de traitement et transferts hors UE** de Stripe, Resend et de l'hébergeur, et garanties (clauses contractuelles types, cadre de protection des données UE-États-Unis) : [à compléter].
4. **Durées de conservation** : seules celles appliquées par le code sont écrites ; à définir : compte après résiliation, journal de sécurité (contient l'adresse IP), messages de support, fiches clients après la fin du contrat, données fiscales après la fin du contrat.
5. `Order.customerEmail` et `invoiceSentTo` restent sur la vente après effacement d'un client : à examiner (tension entre inaltérabilité et effacement).
6. **Absence de bandeau cookies** : justifiée par l'absence de traceur non nécessaire (fiche F37351, règles CNIL) ; à revérifier à chaque ajout d'outil.
7. **Délai de réponse d'un mois** aux demandes d'exercice des droits (RGPD art. 12) : non vérifié sur le texte officiel, à confirmer.
8. Faut-il désigner un DPO : à décider (`NEXT_PUBLIC_EDITOR_DPO`).

## Conformité de la caisse (`/legal/conformite`)

Page FAQ « Conformité de la caisse : attestation de l'éditeur et NF525 ». Sourcé : BOFiP ACTU-2026-00073 (lu le 20 octobre 2026 : attestation rétablie à compter du 21/02/2026, loi 2026-103 art. 125, modèle BOI-LETTRE-000242, aucune sanction chiffrée dans la page), modèle `docs/legal/BOI-LETTRE-000242-20260325.md` (délit de fausse attestation, art. 441-1 du code pénal, trois ans et 45 000 €), périmètre COVERED / NOT_COVERED de `apps/api/src/compliance/attestation.service.ts` (recopié dans la page : à resynchroniser si l'API change).

À valider ou compléter :

1. **Date du 31 août 2026** : la page ne dit que « prorogation du délai laissé aux éditeurs pour obtenir le certificat » (publication BOFiP 14826-PGP du 01/10/2025). Cette publication n'a pas été relue directement : relire avant de citer plus.
2. **Amende en cas de défaut de justificatif** : montant laissé « à compléter à partir d'une source officielle ». Les 7 500 € par logiciel (art. 1770 duodecies du CGI) ne viennent que de sources secondaires (`research_notes`), non revérifiés sur Légifrance.
3. **Éditeur entrepreneur individuel** : le modèle du volet 1 vise le « représentant légal de la société » ; la formulation adaptée à un EI est à faire valider (l'attestation générée l'adapte déjà dans le code).
4. **« Non certifié par un organisme accrédité »** : phrase reprise de la FAQ du site, à confirmer.
5. **Qui est concerné** : la page ne détaille pas le champ (assujettis à la TVA, B2C, exclusions de la franchise en base, BOI-TVA-DECLA-30-10-30 §10 à 25) ; à décider avec le juriste.
6. **Durée de six ans** (L102 B LPF) : à confirmer, comme pour les CGU.
7. **Procédure de contrôle** : la page se limite à la présentation des deux volets ; aucune description de la procédure n'est sourcée.
8. Pas de mention « validé par un expert-comptable » : bandeau « Projet en cours de relecture » tant que `LEGAL_DRAFT` est actif.

## Facturation par boutique

- Ajout ou retrait d'une boutique en cours de mois : proratisation retenue (Stripe create_prorations) à valider avec les CGV (« le mois commencé n'est pas remboursé »). La règle est isolée dans la constante `SITE_QUANTITY_PRORATION` (`apps/api/src/billing/stripe-billing.ts`).

## Avant la mise en ligne

- Renseigner toutes les variables, rebâtir l'image web, vérifier qu'aucun « [à compléter] » ne reste.
- Faire relire par un juriste, puis passer `LEGAL_DRAFT` à `false` et mettre à jour `LEGAL_VERSION_DATE` (et `LEGAL_VERSION` si le texte change après des acceptations).
- Afficher les CGV et la politique de confidentialité au moment de l'inscription et de la souscription (liens vers `/legal/cgv`, `/legal/cgu`, `/legal/confidentialite`).
