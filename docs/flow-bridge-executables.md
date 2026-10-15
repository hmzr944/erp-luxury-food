# FLŌW-Bridge : exécutables autonomes

Objectif : installer le pont en trente secondes, sans rien d'autre. Le commerçant télécharge un fichier, l'ouvre, saisit le code à six chiffres sur la caisse. Node.js n'est pas nécessaire : il est embarqué dans l'exécutable.

| Fichier | Système | Remarque |
| --- | --- | --- |
| `flow-bridge-windows-x64.exe` | Windows 10 et 11 (x64) | double-clic |
| `flow-bridge-macos-universal.zip` | macOS Apple Silicon et Intel | binaire universel, construit seulement sur un Mac |
| `flow-bridge-macos-arm64.zip`, `flow-bridge-macos-x64.zip` | macOS, une seule architecture | |
| `flow-bridge-linux-x64` | Linux x64 (glibc) | `chmod +x` après téléchargement |

Les binaires macOS sont livrés dans un `.zip` : un navigateur retire le droit d'exécution d'un fichier téléchargé seul, l'archive le conserve. Les binaires bruts `flow-bridge-macos-arm64` et `flow-bridge-macos-x64` sont aussi publiés.

## Fonctionnement

Les exécutables utilisent les « Single Executable Applications » de Node.js (encore expérimentales dans Node.js 22) :

1. `apps/bridge/scripts/bundle.mjs` construit le pont en un seul script **CommonJS** avec esbuild (Node.js n'accepte que CommonJS comme script principal d'un exécutable). `import.meta.url` est remplacé par l'adresse de l'exécutable, la ligne `#!` est retirée.
2. `node --experimental-sea-config` en tire un « blob ». Réglages : `disableExperimentalSEAWarning: true` (pas d'avertissement dans la fenêtre du commerçant), `useCodeCache: false` et `useSnapshot: false` (le cache de code dépend de la plateforme qui construit ; désactivé, un seul système produit les quatre cibles).
3. Le binaire officiel de Node.js est téléchargé sur nodejs.org, son empreinte vérifiée avec `SHASUMS256.txt`, puis le blob y est injecté par `postject` (version 1.0.0-alpha.6, lancée par `npx`), avec la sentinelle `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2` et le segment Mach-O `NODE_SEA` pour macOS.
4. Windows : la signature Authenticode de `node.exe` est retirée avant injection (elle deviendrait invalide). macOS : `codesign --remove-signature`, injection, puis nouvelle signature. Sur Mac, un binaire universel est assemblé avec `lipo`.

Le blob est produit par exactement la même version de Node.js que celle embarquée : si la version locale diffère, le script télécharge celle de la plateforme qui construit.

Comportement de l'exécutable lancé d'un double-clic (`FLOW_BRIDGE_BUILD_STANDALONE`, inscrit à la construction) :

- il affiche toujours un code d'appairage, comme `flow-bridge --pair` ;
- il rappelle de laisser la fenêtre ouverte ;
- sous Windows, en cas d'erreur fatale (port déjà utilisé, réglage invalide), la console attend la touche Entrée avant de se fermer.

Les commandes `pair`, `clients`, `--version` et les variables `FLOW_BRIDGE_*` restent valables (voir `apps/bridge/README.md`).

## Construire

Depuis `apps/bridge`, après `pnpm install` :

```bash
FLOW_APP_URL=https://caisse.exemple.fr node scripts/build-binaries.mjs --targets linux-x64,windows-x64
node scripts/smoke-test.mjs dist/bin/flow-bridge-linux-x64
```

- Sortie : `apps/bridge/dist/bin/` (exécutables, `SHASUMS256-<cibles>.txt`, `flow-bridge-binaries.json`).
- Cache des téléchargements : `apps/bridge/node_modules/.cache/flow-bridge-sea/<version>/`.
- Cibles : `windows-x64`, `macos-arm64`, `macos-x64`, `linux-x64` (toutes par défaut). Les binaires macOS construits ailleurs que sur un Mac ne sont **pas signés** : un Mac Apple Silicon refuse de les lancer. Ils ne doivent pas être distribués ainsi.
- Derrière un proxy : `NODE_USE_ENV_PROXY=1` avec `HTTPS_PROXY`.
- Taille : environ 85 Mo pour Windows, 120 Mo pour Linux, 107 Mo par architecture macOS (35 Mo compressé).

L'essai de fumée lance l'exécutable dans un dossier temporaire sur un port libre, attend le code d'appairage, interroge `/health`, appaire une caisse par WebSocket (`bridge.pair`), vérifie `bridge.hello`, puis arrête le pont.

## Variables

| Variable | Où | Rôle |
| --- | --- | --- |
| `FLOW_APP_URL` (ou `NEXT_PUBLIC_APP_URL`) | construction | adresse de la caisse acceptée d'office par le pont. En CI : variable de dépôt `FLOW_APP_URL` (Settings, Secrets and variables, Actions, Variables). |
| `FLOW_BRIDGE_NODE_VERSION` | construction | version de Node.js embarquée (défaut : `v22.23.3`, LTS 22) |
| `FLOW_BRIDGE_SEA_CACHE` | construction | dossier de cache des binaires Node.js |
| `FLOW_BRIDGE_CODESIGN_IDENTITY` | construction sur Mac | identité de signature ; défaut `-` (ad hoc) |
| `NEXT_PUBLIC_BRIDGE_DOWNLOAD_BASE` | application web | adresse où sont publiés les exécutables, par exemple `https://github.com/<organisation>/<dépôt>/releases/latest/download`. Sans elle, la caisse propose l'ancien paquet `/downloads/flow-bridge.zip`, qui demande Node.js. |

Chaque exécutable n'accepte d'office qu'une seule adresse de caisse, celle de la construction. Une autre adresse se règle avec `FLOW_BRIDGE_ORIGINS`.

## Publier une version

1. Mettre à jour `version` dans `apps/bridge/package.json`.
2. Pousser une étiquette du même numéro : `git tag bridge-v0.1.0 && git push origin bridge-v0.1.0`.
3. Le workflow `.github/workflows/bridge-binaries.yml` construit sur Linux, Windows et macOS, lance l'essai de fumée sur chaque système, puis crée la Release GitHub avec les fichiers et un `SHASUMS256.txt` commun. Il échoue si l'étiquette ne correspond pas à la version.

Le workflow tourne aussi sur les pull requests qui touchent `apps/bridge` et à la demande (`workflow_dispatch`) ; les fichiers sont alors disponibles comme artefacts de l'exécution.

## Signature et avertissements

Sans certificat, les systèmes avertissent au premier lancement. La caisse le dit au commerçant :

- **Windows** : SmartScreen affiche « Windows a protégé votre ordinateur ». Il faut cliquer sur « Informations complémentaires », puis « Exécuter quand même ». L'avertissement disparaît avec un certificat de signature de code (idéalement EV, ou un certificat OV qui acquiert de la réputation avec le temps) et `signtool sign` après l'injection.
- **macOS** : les binaires sont signés ad hoc (`codesign --sign -`), ce qui suffit pour qu'ils tournent, mais Gatekeeper bloque un fichier téléchargé non notarisé. Il faut faire clic droit, Ouvrir ; sur macOS 15, Réglages Système, Confidentialité et sécurité, Ouvrir quand même.

### Notariser pour macOS (à faire)

Il faut un compte Apple Developer Program (payant) et :

| Secret GitHub | Contenu |
| --- | --- |
| `APPLE_CERTIFICATE_P12` | certificat « Developer ID Application » et sa clé, exportés en `.p12` puis encodés en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | mot de passe du `.p12` |
| `APPLE_CODESIGN_IDENTITY` | nom de l'identité, par exemple `Developer ID Application: Société (TEAMID)` |
| `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD` | compte Apple, équipe et mot de passe d'application pour `notarytool` |

Quand ces secrets existent, le workflow importe le certificat dans un trousseau temporaire, signe avec le runtime renforcé (`--options runtime`, droits dans `apps/bridge/scripts/entitlements.mac.plist` : compilation à la volée de V8) et soumet les `.zip` à `xcrun notarytool submit --wait`. Un exécutable nu ne peut pas recevoir le ticket de notarisation agrafé (`stapler`) : Gatekeeper le vérifie en ligne au premier lancement. Ces étapes n'ont pas encore été exécutées faute de compte : à valider lors de la première notarisation. Un paquet `.pkg` signé « Developer ID Installer » permettrait l'agrafage et un lancement au démarrage de la session ; ce n'est pas fait.

### Signer pour Windows (à faire)

Il faut un certificat de signature de code (fourni par une autorité reconnue, souvent sur jeton matériel ou service de signature dans le nuage). Ajouter alors, après la construction sur le runner Windows, un `signtool sign /fd sha256 /tr <horodatage> /td sha256 flow-bridge-windows-x64.exe`. Aucun secret n'est prévu dans le workflow pour l'instant.

## Limites

- Pas de binaire Linux arm64 ni Windows arm64 (Raspberry Pi, PC Snapdragon) : le paquet Node.js `/downloads/flow-bridge.zip` reste possible.
- Le pont ne se lance pas tout seul au démarrage de l'ordinateur : voir « Faire tourner le pont en service » dans `apps/bridge/README.md`.
- Pas de mise à jour automatique : une nouvelle version se télécharge depuis la caisse.
- Les exécutables Node.js sont encore expérimentaux dans Node.js 22 ; chaque montée de version de Node.js doit repasser l'essai de fumée sur les trois systèmes.
