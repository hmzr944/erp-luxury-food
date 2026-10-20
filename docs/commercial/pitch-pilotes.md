# Démarchage des 5 premiers commerçants pilotes

Cible : épiceries fines et caves. Document de travail du fondateur. Chaque affirmation vient d'un fait vrai aujourd'hui, avec sa source dans le dépôt. Ce qui n'est pas prouvé n'est pas écrit. Ce document respecte à la lettre le tableau « Ce qu'on peut dire, et ce qu'on ne dit pas encore » de `docs/veille-concurrence-2026-10.md`.

Avant la première visite, lire `conditions-demarrage-pilote.md` : tant que la liste Go / No-Go n'est pas cochée, on peut présenter, on n'installe pas.

## 1. La phrase clé

> FLŌW : une caisse à prix public (29 € HT par mois), sans engagement, qui marche sur n'importe quel appareil, continue de vendre quand internet tombe, et qui ne retient jamais votre argent.

Variante plus courte pour un e-mail ou un SMS :

> Caisse à 29 € HT par mois, sans engagement, sans iPad obligatoire, qui continue de vendre sans internet. 3 mois offerts pour les premiers commerçants pilotes.

Faits derrière chaque mot, tous à jour au 20/10/2026 :

| Mot de la phrase | Fait | Source |
| --- | --- | --- |
| 29 € HT par mois, par boutique | Offre Pulse | `packages/types/src/billing.ts` |
| Sans engagement | Abonnement mensuel, résiliable à tout moment | CGV, « Durée et résiliation » |
| Sortie sans pénalité, export | Export des ventes, paiements, catalogue, stock, clients, clôtures et archives fiscales signées | CGU « Données du commerçant et export », CGV « Données après la résiliation » |
| Tout appareil | Navigateur sur tablette, téléphone ou ordinateur, application installable | `apps/web/PRODUCT.md`, CGU « Le service » |
| Vente hors ligne signée | Chaque vente est signée sur l'appareil, envoyée au retour du réseau | CGU « Fonctionnement hors ligne », recette RES-01 à RES-07 |
| Terminal de paiement au choix | SumUp, Stripe, ou votre terminal habituel en autonome | CGU « Paiements par carte » |
| Aucun fonds retenu | Les paiements vont au prestataire choisi par le commerçant, aucune commission FLŌW | CGV « Offres et prix » |
| Attestation de l'éditeur | Reconnue depuis le 21/02/2026, BOFiP ACTU-2026-00073 | `docs/veille-concurrence-2026-10.md` |

Réserve à garder en tête : « vente hors ligne » est vrai dans le code et sur le banc d'essai, mais la recette sur du vrai matériel n'est pas faite (voir `docs/recette-terrain.md`). On le dit, et on le montre en démonstration, jamais en garantie.

## 2. Pitch oral de 60 secondes

À dire debout, au comptoir, sans écran. Environ 150 mots.

> Bonjour, je m'appelle [prénom], je développe une caisse enregistreuse en ligne, FLŌW, pour les commerces comme le vôtre : épicerie fine, cave.
>
> Trois choses la distinguent. Un prix affiché : 29 euros hors taxes par mois, sans engagement, et vous pouvez partir quand vous voulez avec toutes vos données. Elle marche sur ce que vous avez déjà, tablette, téléphone ou ordinateur, pas besoin d'iPad. Et si internet tombe, vous continuez à encaisser : les ventes sont signées sur l'appareil et partent toutes seules au retour du réseau.
>
> Votre terminal de paiement reste le vôtre, FLŌW ne touche ni à votre argent ni à vos commissions.
>
> Je cherche cinq commerçants pour l'essayer pendant trois mois, gratuitement. En échange, je vous demande un retour par semaine, quelques minutes. Le produit est jeune, je vous dirai exactement ce qui marche et ce qui reste à finir. Est-ce que je peux vous montrer cinq minutes, sans engagement ?

Ne pas ajouter : de chiffre de clients (il n'y en a aucun), de comparaison avec un concurrent, de mot comme « sécurisé à 100 % » ou « conforme à toutes les obligations ».

## 3. Premier message de prise de contact

### 3.1 Visite en boutique (à dire en 20 secondes, aux heures calmes)

> Bonjour, je ne vais pas vous retenir. Je suis [prénom], je construis une caisse pour les épiceries fines et les caves, et je cherche cinq boutiques pour la tester gratuitement trois mois. Je ne vends rien aujourd'hui. Puis-je vous laisser ma carte et revenir mardi ou jeudi matin pour vous la montrer cinq minutes ?

À laisser : une carte avec nom, téléphone, e-mail, et l'adresse du site. Ne rien laisser qui ne soit validé (pas de CGV imprimées tant qu'elles portent leur bandeau « Projet en cours de relecture »).

### 3.2 Version courte, e-mail ou SMS

SMS :

> Bonjour [prénom du commerçant], je suis [prénom] de FLŌW, une caisse à 29 € HT/mois sans engagement qui continue de vendre sans internet. Je cherche 5 boutiques pilotes (3 mois offerts, en échange d'un retour par semaine). Puis-je vous la montrer 5 minutes en boutique cette semaine ?

E-mail :

> Objet : Caisse à l'essai, 3 mois offerts pour 5 boutiques pilotes
>
> Bonjour [prénom],
>
> Je suis [prénom], entrepreneur individuel, et je développe FLŌW, une caisse enregistreuse en ligne pour les épiceries fines et les caves. Prix public : 29 € HT par mois, sans engagement, export de vos données à tout moment. Elle fonctionne sur tablette, téléphone ou ordinateur et continue de vendre quand internet est coupé.
>
> Je cherche cinq boutiques pour l'utiliser gratuitement pendant trois mois, en échange d'un court retour chaque semaine. Le produit est jeune : je vous indiquerai par écrit ce qui est fini et ce qui ne l'est pas.
>
> Auriez-vous cinq minutes cette semaine pour que je vous la montre en boutique ?
>
> [Prénom Nom], [téléphone], [adresse du site]

Les mentions d'identité de l'éditeur (nom, SIREN, adresse) doivent figurer dans la signature dès qu'elles sont renseignées (voir Go / No-Go).

## 4. Les cinq questions du commerçant

Principe : réponse courte, vraie, avec ce qui reste ouvert. Dire « je ne sais pas encore » est autorisé et préférable à une promesse.

### 4.1 « Vous êtes certifié NF525 ? »

> Non, je n'ai pas de certificat d'un organisme accrédité. Depuis le 21 février 2026, la loi permet aussi de justifier la conformité d'une caisse par une attestation individuelle de l'éditeur : c'est ce que je fournis, sur le modèle de l'administration fiscale. Vous la signez de votre côté pour la compléter. Les textes sont cités dans le BOFiP ACTU-2026-00073. Je vous conseille d'en parler à votre expert-comptable, et je lui donne volontiers tous les éléments.

Garde-fous : ne jamais dire « conforme NF525 », « certifié » ni « conformité garantie ». Plusieurs comparatifs récents annoncent encore que l'attestation n'existe plus : donner la référence du BOFiP, qui est la source officielle. À valider par l'expert-comptable : la formulation de l'attestation pour un entrepreneur individuel et cette réponse type (point déjà noté dans `docs/veille-concurrence-2026-10.md`). Source de l'attestation : `docs/legal/BOI-LETTRE-000242-20260325.md`.

### 4.2 « Et si mon internet tombe ? »

> Vous continuez à encaisser. Chaque vente est signée sur l'appareil, le ticket est remis, et la vente part au serveur au retour du réseau. Je vous le montre en coupant le Wi-Fi. Deux limites : une vente non encore envoyée n'existe que sur l'appareil, donc il ne faut pas effacer les données du navigateur avant que la caisse indique que tout est envoyé. Et certaines choses demandent internet : le paiement par QR, et selon le terminal, le paiement par carte.

Sources : CGU « Fonctionnement hors ligne », recette RES-01 (le TPE en ligne hors ligne relève de TPE-17) et PRODUCT.md. À vérifier avant de promettre quoi que ce soit sur le terminal de paiement du commerçant : le comportement dépend de son modèle.

### 4.3 « Que se passe-t-il si le produit s'arrête ? »

> Vos données vous appartiennent et vous pouvez les exporter à tout moment : ventes, paiements, catalogue, stock, clients, clôtures et archives fiscales signées, lisibles sans FLŌW. Je vous recommande d'en faire une copie régulière sur un support à vous. Je suis seul sur le projet, je vous le dis franchement : c'est aussi pour cela que l'export est possible dès le premier jour et que rien n'est prélevé sans votre accord. Si j'arrêtais, je vous préviendrais [délai à décider] à l'avance.

Garde-fous : ne promettre aucun délai de préavis tant que le fondateur ne l'a pas décidé (point à valider avec un juriste, voir `contrat-pilote.md`). Ne pas dire « vos données sont à l'abri ». Source : CGU « Archives », `docs/sauvegardes.md` (à ne citer que lorsque le serveur est en ligne et la restauration essayée).

### 4.4 « Quel support ? »

> Je suis seul, à temps partiel. Vous écrivez depuis le menu Aide de la caisse, et le délai de réponse affiché dans l'application est celui que je tiens. [Indiquer ici le délai réellement retenu, par exemple « sous un jour ouvré ».] Pendant le pilote, je vous donne aussi mon numéro, pour les cas où vous ne pouvez pas vendre. Je ne promets pas de permanence le soir ni le dimanche.

Garde-fous : « support ultra-réactif » est interdit. Le délai annoncé est un réglage (`SUPPORT_SLA_MINUTES`, `SUPPORT_HOURS`, voir `apps/api/src/support/support.config.ts`) : n'afficher que ce que le fondateur tient seul, y compris en congés. Limite connue : hors ligne, le formulaire d'aide ne peut pas partir et l'application ne donne pas de numéro après l'essai (`docs/recette-terrain.md`, anomalie 13) : donner le numéro à l'oral et par écrit à chaque pilote, et le coller près de la caisse.

### 4.5 « Pourquoi pas Hiboutik (gratuit) ou Tactill ? »

> Ce sont deux solutions sérieuses, et Hiboutik est moins cher que moi : gratuit au départ, avec une option à 16,90 € par mois pour l'épicerie et la cave, d'après leur site. Je ne vais pas vous dire que je suis meilleur. Ce que je propose de différent : une vente signée qui continue hors ligne, démontrable devant vous ; aucune obligation d'iPad, ce qui n'est pas le cas de Tactill, uniquement sur iPad ; un terminal de paiement libre. Regardez les trois points, comparez avec ce que vous avez, et choisissez ce qui convient à votre boutique.

Garde-fous : s'en tenir aux prix publics relevés (Hiboutik gratuit, options dont 16,90 € épicerie et cave ; Tactill 29, 49 ou 69 € HT par mois et iPad uniquement, `docs/veille-concurrence-2026-10.md`). Ne pas écrire que Hiboutik est « vieillissant » ni que son support est « opaque » : non vérifié. Les comparatifs lus disent que Hiboutik fonctionne en ligne uniquement, mais ce sont des sources de seconde main : ne pas l'affirmer à un commerçant sans l'avoir vérifié sur leur site ou en essayant. Les prix des concurrents changent : revérifier avant chaque rendez-vous. Hiboutik annonce aussi une fidélité multi-boutiques que FLŌW n'a pas encore en programme complet : le reconnaître si on le demande.

## 5. Script de démonstration, 5 minutes

Matériel : un ordinateur ou une tablette, la box ou un téléphone en partage de connexion pour couper le réseau, un fichier de catalogue (Excel ou CSV) du commerçant ou d'exemple. Tout se fait en mode formation : aucune vente fictive n'entre dans le grand livre (recette ONB-03).

Préparation : compte d'essai avec le métier « Épicerie fine » ou « Cave à vins » (recette ONB-02), caisse ouverte sur l'appareil au moins une fois en ligne (sinon elle refuse de s'ouvrir hors ligne, ONB-07).

| Minute | Action | Ce qu'on dit | Contrôle |
| --- | --- | --- | --- |
| 0:00 à 1:00 | Ouvrir la caisse, bandeau « mode formation » visible. Vendre deux articles dont un au poids, encaisser en espèces. | « Ici je suis en mode formation : rien de ce que je fais n'est compté ni déclaré. » | Le ticket affiche « MODE FORMATION, ticket fictif sans valeur ». |
| 1:00 à 2:30 | Couper le Wi-Fi. Vendre à nouveau. Montrer l'en-tête « Hors ligne, N à envoyer ». | « Je coupe internet. Je continue à vendre. Le ticket est signé sur l'appareil. » | Rappeler la limite : une vente non envoyée n'existe que sur l'appareil. |
| 2:30 à 3:00 | Remettre le Wi-Fi, montrer « En ligne », plus rien à envoyer. | « Au retour du réseau, tout part tout seul, sans doublon. » | Ne pas chiffrer de délai. |
| 3:00 à 4:00 | Paramètres, Données, « Importer un catalogue », déposer le fichier, montrer la correspondance des colonnes et l'aperçu. | « Votre catalogue existant peut être repris depuis Excel. » | À ne dire qu'après avoir essayé avec le fichier du commerçant. Ne pas annoncer de durée. |
| 4:00 à 5:00 | Montrer la clôture, puis l'attestation de conformité à télécharger et ses deux volets. | « Voilà l'attestation. Le volet 1 est de mon côté, le volet 2 est à compléter et signer par vous. Montrez-la à votre comptable. » | En mode formation, la clôture et le grand livre ne comptent pas les ventes fictives : préciser que l'on montre le parcours, pas des chiffres réels. |

Après la démonstration : demander ce qu'il utilise aujourd'hui, noter les trois irritants cités, ne pas conclure. Proposer la convention de pilote (`contrat-pilote.md`) seulement si la liste Go / No-Go est cochée.

Si la démonstration échoue (réseau, matériel) : le dire, ne pas improviser, proposer un second rendez-vous. Ne pas montrer de paiement par carte tant que le test sur un vrai terminal n'est pas fait (la recette indique que le terminal Caisse-AP n'a jamais été essayé sur du vrai matériel).

## 6. Ce qu'on dit et ce qu'on ne dit pas

Repris de `docs/veille-concurrence-2026-10.md`.

| On dit | On ne dit pas |
| --- | --- |
| Prix public, sans engagement, sortie sans pénalité, export de vos données | « Conformité blindée », « irréprochable », « 100 % conforme » |
| Fonctionne sur tout appareil, vente hors ligne signée (à montrer) | « Ultra-réactif », « support 24 h sur 24 » : seulement le délai affiché et tenu |
| Aucun fonds retenu, terminal de paiement au choix | « Prise en main en moins de 3 minutes » : à ne dire qu'après mesure |
| L'attestation de l'éditeur est reconnue depuis le 21/02/2026 (BOFiP ACTU-2026-00073) | « Hiboutik vieillissant, support opaque » ou tout propos sur un concurrent non vérifié |
| Le produit est jeune, voici ce qui reste à finir | « Trois ans d'avance sur la facture électronique » (faux : environ un an) |
| Je suis seul, voici mon délai de réponse | Aucun nom de client, aucun chiffre d'usage, aucun témoignage : il n'en existe pas encore |
| La facture électronique et le titre-restaurant dématérialisé arrivent, le périmètre exact pour une caisse reste à valider | Une promesse de conformité à la facture électronique de 2027 |

Comparaisons nommées : uniquement des faits objectifs et vérifiables (prix publics, iPad obligatoire ou non), à faire relire avant tout support écrit.

## 7. À faire valider avant usage

- Réponse type à « NF525 » et formulation de l'attestation pour un entrepreneur individuel : expert-comptable.
- Délai de réponse du support à afficher : décision du fondateur.
- Préavis en cas d'arrêt du produit : décision du fondateur, avec relecture juridique.
- Chiffres et prix des concurrents : revérifier sur leurs sites le jour du rendez-vous.
