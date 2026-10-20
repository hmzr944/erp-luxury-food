# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Commerçants français de tous secteurs, sans priorité entre eux (confirmé) : alimentaire, restauration, mode, beauté, services. Le vendeur encaisse debout au comptoir, sur tablette, ordinateur ou téléphone, souvent avec un client en face et une file derrière. Le gérant règle le catalogue, les moyens de paiement et la conformité depuis le back-office. Le client final voit l'écran client, le ticket et le reçu en ligne.

## Product Purpose

FLŌW est une caisse enregistreuse en ligne (PWA) qui encaisse, signe chaque ticket et tient les obligations françaises de la caisse : chaînage et signature des tickets, clôtures, archives, mode formation, ticket dématérialisé, règles d'encaissement (titre-restaurant, plafond espèces, note de service). Réussir, c'est une vente simple en trois gestes, sans dépendre du réseau, et un commerçant qui peut prouver la conformité de sa caisse.

## Positioning

Ventes hors ligne signées par chaque caisse (ECDSA) et vérifiées par le serveur, incluses dans les deux formules. Webhooks de commandes et imports CSV sans surcoût (l’API publique viendra une fois documentée). Prix publics sans engagement (formules Pulse et Tempo). Agent local FLŌW-Bridge pour l'impression, le tiroir et les TPE.

## Operating Context

- Caisse : `/pos/[siteId]`, ticket à droite sur tablette et ordinateur, barre basse sur téléphone. Douchette code-barres, étiquettes de balance, TPE connectés (Stripe Terminal, SumUp) ou autonomes, imprimantes ESC/POS.
- Écran client : second écran du même appareil ou tablette séparée posée sur le comptoir, reliée par appairage (confirmé : les deux).
- Paiement par QR : Stripe en premier (confirmé), le client paie sur son téléphone.
- Back-office : catalogue, commandes, stock, approvisionnement entre sites, factures, conformité, paramètres.

## Capabilities and Constraints

- Interface en français, sans tiret cadratin.
- Le format des tickets signés ne change jamais ; on ajoute des champs en fin de ligne seulement.
- Rien de juridique n'est inventé : les sources sont `docs/legal`, `research_notes` et `reports` à la racine du dépôt. Le ticket dématérialisé ne peut pas être imposé au client.
- Fonctionne hors ligne pour la vente ; ce qui exige le réseau (TPE connecté, paiement par QR) le dit clairement.

## Brand Commitments

Nom FLŌW (Ō avec trait), logo abstrait sans lettre : deux demi-disques décalés (encre et violet), jamais accompagné du nom dessiné, trois couleurs : papier #F4EFE6, encre #1C1726, violet #4B2BD6. Polices Bricolage Grotesque (marque), Hanken Grotesk (interface), Courier Prime (tickets). Glyphes de rayon par catégorie. Référence : docs/identite.md. Ces éléments existent dans le code (`src/components/brand`, `src/app/globals.css`).

## Evidence on Hand

Benchmark et notes de conformité dans `reports/` et `research_notes/`. Aucun témoignage, client ou chiffre d'usage réel : ne pas en inventer.

## Product Principles

1. La vente d'abord : aucun écran n'interrompt un encaissement en cours.
2. Le ticket fait foi : ce que voit le client est exactement ce qui est signé.
3. Dire la vérité au commerçant : ce qui dépend du réseau, du matériel ou d'une validation juridique est signalé.
4. Inclus, pas en option : pas de fonction de base cachée derrière une formule.

## Accessibility & Inclusion

Directive européenne sur l'accessibilité applicable aux terminaux de paiement et libre-service (sources dans `research_notes`). Contrastes et tailles lisibles à distance pour l'écran client, mouvement réduit respecté.
