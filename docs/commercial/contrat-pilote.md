# Convention de pilote FLŌW (BROUILLON)

> **Avertissement. Ce document n'est pas un document validé.** C'est un brouillon de travail, rédigé sans juriste, à partir des conditions publiées par FLŌW (`apps/web/src/app/legal/cgv/page.tsx` et `cgu/page.tsx`, elles-mêmes en relecture) et de `docs/legal/pages-a-valider.md`. Il ne doit pas être signé en l'état. Chaque clause marquée « À valider par un juriste » doit être relue et réécrite par un professionnel avant tout usage. Aucune règle de droit n'a été inventée ici : ce qui n'est pas sourcé est laissé « [à compléter] ».

Entre les soussignés :

**L'éditeur** : [nom et prénom], entrepreneur individuel, SIREN [à compléter], adresse [à compléter], e-mail [à compléter], téléphone [à compléter], ci-après « l'éditeur ».

**Le commerçant** : [raison sociale ou nom], SIREN ou SIRET [à compléter], adresse de la boutique [à compléter], représenté par [à compléter], ci-après « le commerçant ».

## 1. Objet

La présente convention fixe les conditions dans lesquelles le commerçant utilise gratuitement le logiciel de caisse FLŌW, en phase pilote, pendant trois mois, et en échange de quoi.

Elle s'ajoute aux conditions générales d'utilisation (`/legal/cgu`) et à la politique de confidentialité (`/legal/confidentialite`). En cas de contradiction sur la gratuité et la durée du pilote, la présente convention l'emporte. Les conditions générales de vente (`/legal/cgv`) ne s'appliquent qu'à l'abonnement payant, s'il est souscrit à l'issue du pilote.

*À valider par un juriste* : l'articulation entre cette convention, les CGU et les CGV.

## 2. Durée

Trois mois à compter de la date de mise en service de la caisse, soit du [date] au [date]. La convention ne se renouvelle pas toute seule.

## 3. Gratuité

L'utilisation du logiciel est gratuite pendant les trois mois. Aucune carte bancaire n'est demandée et rien n'est prélevé. Le prix public de l'offre Pulse (29 € HT par boutique et par mois à la date de rédaction, `packages/types/src/billing.ts`) est indiqué à titre d'information.

La gratuité ne couvre pas : le matériel (non fourni par l'éditeur), les frais du prestataire de paiement choisi par le commerçant, les frais de la banque ou du fournisseur d'accès à internet.

Note interne à ne pas laisser dans la version finale : l'essai prévu dans le code dure 30 jours (`TRIAL_DAYS`). Il faut un moyen technique de porter la gratuité à trois mois sans prélèvement : à décider et à vérifier avant le premier pilote.

## 4. Ce que fournit l'éditeur

- l'accès au logiciel pour la ou les boutiques désignées, avec caisses et utilisateurs illimités, mises à jour comprises (offre Pulse) ;
- l'aide à la mise en route : création du compte, import du catalogue, appairage de l'imprimante et du terminal de paiement, dans la mesure du possible [étendue à préciser] ;
- l'attestation individuelle de l'éditeur, selon le modèle de l'administration fiscale (BOI-LETTRE-000242), dont le volet 2 est à compléter et signer par le commerçant ;
- un moyen de contact pour les incidents : menu Aide de l'application, et [numéro de téléphone à compléter] ;
- l'export des données à tout moment.

L'éditeur ne s'engage ni sur un taux de disponibilité, ni sur un délai de rétablissement. Le délai de réponse au support est celui affiché dans l'application, tenu au mieux, sans garantie de permanence le soir, le week-end ni pendant les congés de l'éditeur.

*À valider par un juriste* : formulation d'une obligation de moyens, sans engagement chiffré.

## 5. Périmètre honnête : un produit en phase pilote

Le logiciel est jeune. Il n'a pas encore fait l'objet d'une recette sur du matériel de boutique réel au moment de la rédaction de ce brouillon. Le commerçant sait qu'il peut rencontrer des défauts, dont certains sont déjà connus : ils sont listés en langage clair en annexe 1, que l'éditeur tient à jour et remet au commerçant avant la mise en service.

Pendant le pilote, il est recommandé que le commerçant garde un moyen d'encaisser de secours (ses espèces, son terminal bancaire habituel, son ancienne caisse si elle est conforme) et ne supprime pas ses outils actuels sans y avoir réfléchi.

Le logiciel n'est pas certifié par un organisme accrédité. L'éditeur délivre une attestation individuelle, dont la valeur dépend notamment de sa signature par le commerçant (volet 2). Le commerçant est invité à la faire relire par son expert-comptable. Le commerçant reste responsable de ses obligations fiscales.

*À valider par un juriste* et par un expert-comptable : cette clause et la valeur de l'attestation pour un entrepreneur individuel (point ouvert noté dans `docs/veille-concurrence-2026-10.md`).

## 6. Obligations du commerçant

- utiliser le logiciel pour son activité professionnelle, dans le respect de la loi, et saisir des informations exactes (identité du commerce, taux de TVA, prix, moyens de paiement) ;
- tenir son matériel et sa connexion en état de marche, et ne pas effacer les données du navigateur d'une caisse tant que des ventes restent « à envoyer » ;
- compléter et signer le volet 2 de l'attestation ;
- garder les identifiants, codes et badges personnels ;
- signaler à l'éditeur, dès qu'il les constate, les défauts et incidents, par écrit ;
- donner un retour hebdomadaire : un court échange (d'environ [durée à compléter] minutes, par téléphone, message ou visite) chaque semaine, sur ce qui marche, ce qui gêne, ce qui manque ;
- conserver une copie de ses exports et archives sur un support qui lui appartient.

## 7. Obligations de l'éditeur

- fournir le service décrit à l'article 4 avec ses meilleurs efforts ;
- informer le commerçant de tout défaut grave dont il aurait connaissance et de toute modification importante du service ;
- tenir à jour l'annexe 1 ;
- respecter la confidentialité des informations commerciales du commerçant ;
- ne rien prélever au commerçant sans son acte volontaire (article 12) ;
- lui permettre d'exporter ses données à tout moment.

## 8. Témoignage (facultatif)

Le commerçant est libre d'accepter ou non de donner un témoignage à l'issue du pilote. Son refus n'a aucune conséquence sur la gratuité ni sur la suite.

S'il accepte, la forme, le texte exact, l'usage (site, plaquette, réseaux) et la durée de diffusion sont validés par écrit par le commerçant avant toute publication, et il peut retirer son accord à tout moment pour l'avenir. L'éditeur ne publie ni le nom ni le logo du commerçant sans cet accord écrit.

Case à cocher par le commerçant : ☐ J'accepte de donner un témoignage, sous réserve de validation du texte ☐ Je n'accepte pas.

*À valider par un juriste* : droit à l'image et à la marque, forme de l'accord.

## 9. Données personnelles

Les données du commerçant lui-même (compte, équipe) sont traitées par l'éditeur comme décrit dans la politique de confidentialité (`/legal/confidentialite`).

Pour les données de ses clients finaux (fiche client, programme de fidélité, adresse e-mail pour le reçu), le commerçant est responsable du traitement et FLŌW agit comme sous-traitant. [Clause de sous-traitance au sens de l'article 28 du RGPD : à faire rédiger. Elle doit couvrir l'objet et la durée du traitement, les instructions du commerçant, la sécurité, les sous-traitants ultérieurs (Stripe pour l'abonnement, Resend pour les e-mails, l'hébergeur [à confirmer]), l'assistance pour les demandes de droits des personnes, la suppression ou la restitution des données en fin de contrat.]

Lieu de traitement, éventuels transferts hors Union européenne et garanties : [à compléter, voir `docs/legal/pages-a-valider.md`].

*À valider par un juriste* : toute cette clause, y compris les bases légales proposées dans la politique de confidentialité.

## 10. Conservation des données fiscales

Les ventes sont signées et chaînées, et les clôtures journalières, mensuelles et annuelles produisent des archives scellées, lisibles sans FLŌW. Le commerçant reste tenu de conserver ses documents fiscaux pendant la durée légale, que les sources du dépôt indiquent à six ans (article L102 B du livre des procédures fiscales, fiche Service Public F10029). Il lui est recommandé de télécharger ses archives et d'en garder une copie sur un support externe.

Ce que l'éditeur conserve, pour combien de temps et pour le compte de qui après la fin de la convention : [à compléter]. Ce point n'est pas tranché dans les sources du dépôt (voir `docs/legal/pages-a-valider.md`, CGV point 8).

*À valider par un juriste* et par un expert-comptable : durée de six ans, partage des obligations de conservation entre éditeur et commerçant.

## 11. Responsabilité

L'éditeur répond des manquements à ses obligations au titre de la présente convention, dans les limites suivantes [à rédiger] : dommages directs et prouvés uniquement, plafond [à compléter, les CGV en projet prévoient les sommes payées sur douze mois, ce qui n'a pas de sens pour un pilote gratuit], sauf faute lourde ou dolosive.

L'éditeur n'est pas responsable des conséquences d'une mauvaise utilisation, d'informations inexactes saisies par le commerçant, d'une panne de matériel, de réseau ou d'un prestataire de paiement choisi par le commerçant. Le commerçant reste responsable de ses déclarations fiscales et sociales.

*À valider par un juriste* : toute cette clause. Vérifier aussi l'assurance responsabilité civile professionnelle de l'éditeur (voir `conditions-demarrage-pilote.md`).

## 12. Fin de la convention

**Sortie à tout moment.** Chacune des parties peut mettre fin à la convention à tout moment, sans pénalité, en prévenant l'autre par écrit [préavis à décider]. Le commerçant peut exporter l'ensemble de ses données avant et après la sortie : ventes, paiements, catalogue, stock, clients, clôtures, archives fiscales signées.

**Après les trois mois.** La convention prend fin à son terme. Le passage à l'offre payante ne se fait que par un acte volontaire du commerçant, depuis l'application (Paramètres, Abonnement), avec paiement sur la page sécurisée de Stripe. Aucune carte n'ayant été demandée pendant le pilote, rien ne peut être prélevé sans cet acte. Si le commerçant ne souscrit pas, ses données restent accessibles en lecture et en export pendant [durée à compléter], puis sont supprimées, sous réserve de ses obligations de conservation fiscale.

Ce qui se passe techniquement dans l'application à la fin de la période gratuite sans souscription (accès limité, lecture seule) n'est pas défini dans le code (voir `docs/legal/pages-a-valider.md`, CGV point 3) : à décider avant le premier pilote.

*À valider par un juriste* : préavis, sort des données, suppression.

## 13. Modification, confidentialité, sous-traitance

Toute modification de la convention se fait par écrit. [Autres clauses éventuelles : confidentialité, cession, force majeure, à compléter par le juriste.]

## 14. Droit applicable et litiges

[à compléter]

*À valider par un juriste* : droit applicable, tentative amiable préalable, juridiction compétente (`NEXT_PUBLIC_LEGAL_COURT` non renseignée).

Fait à [lieu], le [date], en deux exemplaires.

| L'éditeur | Le commerçant |
| --- | --- |
| [nom, signature] | [nom, qualité, signature] |

## Annexe 1. Ce qui n'est pas encore au point (langage clair)

Liste à tenir à jour par l'éditeur, tirée de `docs/recette-terrain.md` (section 10). À relire et à compléter après la recette sur du vrai matériel. Elle est remise au commerçant avant la mise en service, en précisant la date de mise à jour.

1. **Matériel non encore éprouvé.** La communication avec un terminal de paiement bancaire raccordé à la caisse (mode « Caisse-AP ») n'a jamais été essayée sur un vrai terminal. L'impression et le tiroir ont été vérifiés sur banc d'essai, pas sur chaque modèle d'imprimante. [À mettre à jour après la recette.]
2. **Vente refusée par le serveur.** Si le serveur refuse une vente envoyée depuis une caisse, les ventes suivantes de cette caisse peuvent rester « à envoyer ». Une correction est en cours. [Mettre à jour l'état de cette ligne avant le premier pilote.]
3. **Remboursement.** Le ticket « REMBOURSEMENT » ne s'imprime pas tout seul (il faut passer par la réimpression du duplicata) et le tiroir ne s'ouvre pas pour un remboursement en espèces.
4. **Paiement partagé par carte.** Les parts par carte d'une note divisée ou d'un paiement en plusieurs moyens ne sont pas envoyées automatiquement au terminal bancaire : le montant se tape sur le terminal.
5. **Vente hors ligne tardive.** Une vente faite hors ligne et reçue après la clôture de sa journée est comptée dans la clôture du jour où elle est reçue.
6. **Aide hors ligne.** Sans internet, on ne peut pas écrire au support depuis l'application, et le numéro de téléphone n'est pas affiché après l'essai : garder le numéro de l'éditeur près de la caisse.
7. **Douchette.** Un scan fait hors du champ « Rechercher ou scanner » est perdu.
8. **Détails d'affichage.** Sur un ticket de 58 mm, le signe % de la TVA est coupé ; sur un duplicata, le « vendeur » est la personne qui réimprime ; pas de ticket de clôture imprimé ; le tiroir ne s'ouvre pas pour compter à l'ouverture et à la fermeture de caisse.
9. **Pont d'impression.** Le programme FLŌW-Bridge ne se lance pas seul avec l'ordinateur et ne se met pas à jour seul.
10. **Ce qui exige internet.** Paiement par QR code, avoirs, retours, selon le terminal le paiement par carte.
11. **Points juridiques en cours de validation.** Les conditions générales publiées sont encore en relecture. Plusieurs règles (mentions du ticket, plafond des titres-restaurant, cartes cadeaux, durée de conservation des fichiers clients) restent à faire valider. L'éditeur n'en donne aucune comme certaine.
12. **Fidélité.** Le programme de fidélité est moins complet que celui de certains concurrents. [À préciser après vérification de ce qui est livré.]

Le commerçant signale à l'éditeur tout autre défaut constaté ; il est ajouté à cette annexe.
