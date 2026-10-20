# Positionnement de FLŌW

Document de travail, octobre 2026. Chaque phrase de ce document doit pouvoir être démontrée en démonstration ou par un document public. Ce qui n'est pas encore vrai est dans la section « À prouver ».

## La phrase

**Pour les commerçants indépendants qui veulent encaisser sans dépendre d'un matériel imposé ni d'internet, FLŌW est la caisse ouverte : elle marche sur l'appareil qu'ils ont, continue de vendre quand le réseau tombe, et son prix est public, sans engagement.**

Version courte : *La caisse qui s'adapte à vous, pas l'inverse.*

## Le terrain libre

Le marché se partage en quatre familles qui se recouvrent peu :

| Famille | Exemples | Ce qu'elle vend | Ce qu'elle laisse ouvert |
|---|---|---|---|
| Paiement d'abord | SumUp, Square, Zettle | Caisse gratuite ou presque, commission sur les paiements | Terminal de paiement imposé, fonds parfois retenus |
| Restauration et réseaux | Zelty, Lightspeed, L'Addition, Innovorder | Plan de salle, cuisine, bornes, livraison, multi-sites | Prix sur devis, engagements, iPad |
| Agences et revendeurs | JDC, Cashmag, Clyo, EBP | Installation, matériel, formation | Aucun prix public |
| SaaS de détail | Tactill (29 € HT, iPad), Hiboutik (gratuit, options 12,90 à 16,90 €) | Caisse simple pour boutiques | iPad obligatoire ou ergonomie datée selon les comparatifs, hors ligne limité |

Aucun acteur relevé ne combine : prix public bas, fonctionnement sur tout appareil, hors ligne avec ventes signées, terminal de paiement au choix, et fidélité et cartes cadeaux incluses. C'est la place de FLŌW. Elle n'est pas protégée : un concurrent peut s'y mettre.

## Pour qui

Le commerçant indépendant de 1 à 3 boutiques, sans service informatique, qui possède déjà des appareils (PC, tablette, parfois iPad) et veut :
- arrêter de payer un matériel ou un contrat qu'il ne contrôle pas ;
- ne jamais être bloqué à la caisse un samedi parce que le réseau est tombé ;
- savoir ce qu'il paie et pouvoir partir.

Cible de départ à trancher (voir `docs/audit-flow-2026-10.md`) : épicerie fine et cave, où le stock, les lots et les attributs comptent, ou une cible plus simple en stock.

## Les quatre piliers

1. **Ouverte.** Tout appareil, terminal de paiement au choix, aucun fonds retenu, aucune commission sur les paiements. *Preuve :* application web, pont local, SumUp, Stripe Terminal et terminaux bancaires par Caisse-AP. *À prouver :* essais sur du vrai matériel (jamais faits).
2. **Fiable hors ligne.** La vente continue, signée sur l'appareil, rapprochée au retour du réseau. *Preuve :* signature par caisse, chaîne, synchronisation idempotente, déverrouillage vendeur sans réseau. *À prouver :* démonstration « on coupe le Wi-Fi » sur du vrai matériel ; correction de la vente refusée.
3. **Transparente.** Prix public, sans engagement, export des données, conformité documentée avec ses sources et ses limites visibles. *Preuve :* 29 et 59 € HT affichés, pages légales et FAQ de conformité sourcées. *À prouver :* validation par l'expert-comptable, accord de sous-traitance, bouton de résiliation.
4. **Simple.** Trois gestes pour vendre, un compte en deux écrans, neuf métiers préréglés, matériel qui se configure seul. *À prouver :* temps d'inscription mesuré, premiers retours de commerçants.

## Ce que FLŌW refuse de faire

Ce sont des choix, pas des retards :
- pas de plan de salle, d'écran cuisine, de bornes ni de livraison intégrée (c'est le terrain des suites restauration) ;
- pas de boutique en ligne intégrée : des connecteurs, quand des commerçants le demandent ;
- pas d'envoi de SMS ni d'e-mails marketing facturés au contact : un export vers l'outil du commerçant, avec preuve du consentement ;
- pas de fonctions de base derrière un palier payant (stock, fidélité, cartes cadeaux restent dans Pulse) ;
- pas de matériel vendu ou verrouillé, pas de commission sur les paiements ;
- pas de pourboire automatique ni de limite à un seul appareil.

## Ce qu'on peut dire, ce qu'on ne dit pas encore

| Message | Statut |
|---|---|
| Prix public, sans engagement, essai 30 jours sans carte | Vrai |
| Fonctionne sur tablette, téléphone et ordinateur | Vrai |
| Les ventes continuent hors ligne et sont signées | Vrai ; à démontrer sur matériel réel |
| Terminal de paiement au choix, aucun fonds retenu | Vrai |
| L'attestation de l'éditeur est reconnue depuis le 21/02/2026 (BOFiP ACTU-2026-00073) | Vrai, avec la référence |
| Fidélité et cartes cadeaux inclus | Vrai |
| « Conformité blindée », « irréprochable » | Interdit |
| « API sans surcoût » | Interdit tant que l'API n'est pas branchée |
| « Support ultra-réactif » | Seulement avec un délai affiché et tenu |
| « Onboarding en moins de 3 minutes » | Après mesure |
| « Meilleur que Hiboutik ou Tactill » | Interdit sans preuve objective ; comparaisons factuelles seulement |
| « Prêt pour la facture électronique » | Interdit ; « nous préparons le raccordement avant septembre 2027 » |
| « Zéro engagement » en promettant 3 mois offerts | Seulement quand le mécanisme existe |

## Face à chacun

- **Tactill** (même prix) : même simplicité, sans iPad obligatoire, avec hors ligne signé et fidélité incluse. Ne pas promettre « la puissance de Tactill ».
- **Hiboutik** (gratuit) : ne pas rivaliser sur le prix. Argument : fonctionne hors ligne, conformité documentée, support humain joignable. À démontrer ; la qualité de leur support n'est pas vérifiée.
- **SumUp, Square** : leur caisse est gratuite parce que le paiement est captif. FLŌW laisse choisir son terminal et sa banque.
- **Zelty, Lightspeed** : pas le même marché. Ne pas les attaquer ; ils servent la restauration en réseau.
- **Agences** : pour qui veut quelqu'un sur place, FLŌW est un choix par défaut moins adapté ; assumé.

## À prouver avant de le dire

Dans l'ordre : correction de la vente refusée ; essai sur un vrai TPE et une vraie imprimante ; démonstration hors ligne ; premiers retours de cinq pilotes ; validation par l'expert-comptable ; un support dont le délai est tenu ; écrans de stock, remises et lots pour la cible choisie.

## Noms et ton

Ton sobre, factuel, en français. Pas de superlatif non mesuré. Le nom est écrit en texte « FLŌW », le logo est le signe abstrait sans lettres (`docs/identite.md`). Un seul message par page : ce que ça fait, ce que ça coûte, ce qui reste à faire.
