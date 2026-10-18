# Identité FLŌW

## Le signe

Deux demi-disques décalés : l'encre à gauche, le violet à droite. L'argent qui entre et celui qui sort, la vente et le stock. Un flux, pas une lettre.

- Grille de 48 : rayon 17, écart de 3 entre les moitiés, décalage vertical de 4 (la gauche monte, la droite descend).
- Tracés de référence : `packages/utils/src/brand-mark.ts` (`MARK_LEFT`, `MARK_RIGHT`), partagés par l'application et les PDF.
- Lisible dès 16 px, sans détail qui disparaît.
- Le nom FLŌW est dessiné en tracés (Bricolage Grotesque ExtraBold), avec un macron violet. Il ne dépend d'aucune police chargée.

Fichiers prêts à l'emploi dans `apps/web/public/brand/` :

| Fichier | Usage |
| --- | --- |
| `flow-logo.svg` | Logo complet sur fond clair |
| `flow-logo-sombre.svg` | Logo complet sur l'encre |
| `flow-logo-une-couleur.svg` | Gravure, fax, tampon, impression une couleur |
| `flow-symbole.svg` | Signe seul |
| `flow-symbole-sombre.svg` | Signe seul sur l'encre |
| `flow-icone.svg` | Icône d'application (carré violet) |

Interdits : déformer, faire pivoter, ajouter une ombre ou un dégradé, recolorer hors des trois couleurs, rapprocher les moitiés.

## Trois couleurs, pas une de plus

| Rôle | Couleur | Part | Usage |
| --- | --- | --- | --- |
| Papier | `#F4EFE6` | 60 % | Le fond, le calme |
| Encre | `#1C1726` | 30 % | Lire : textes, moitié gauche du signe |
| Violet | `#4B2BD6` | 10 % | Agir : encaisser, valider, élément actif |

En sombre, le papier et l'encre s'échangent et le violet s'éclaircit en `#A9A6FF` (même teinte). Tout le reste (surfaces, bordures, textes secondaires) est un mélange de ces trois couleurs. Pas de rouge ni de vert : un état se dit par un libellé et une icône.

Contrastes mesurés : encre sur papier 15,3:1, papier sur violet 7,0:1, encre sur violet clair 8,0:1. Jetons dans `apps/web/src/app/globals.css`.

## Trois voix

| Police | Rôle | Pourquoi |
| --- | --- | --- |
| Bricolage Grotesque (Mathieu Triay) | Marque, titres, montants clés | Pièges à encre et taille optique : de la personnalité sans fantaisie |
| Hanken Grotesk | Interface, lecture, saisie | Lisible en petit, chiffres alignés |
| Courier Prime | Ticket, codes, signatures | La machine à écrire du commerce, distincte du reste |

Toutes en licence OFL, auto-hébergées (`apps/web/public/fonts`, `apps/api/assets/fonts`) pour fonctionner hors ligne. Licences jointes.

## Méthode

- Polices choisies avec la skill `web-typography` (skills.sh, wondelai), hors de la liste des polices trop vues de `impeccable`.
- Signe dessiné avec la méthode de `svg-logo-designer` (skills.sh, rknall) : plusieurs pistes (pièce, cachet, flux, ticket), test de 16 à 120 px, version une couleur.
- Couleurs mesurées avec `better-colors`. Brief structuré selon `brand-identity` (skills.sh).
