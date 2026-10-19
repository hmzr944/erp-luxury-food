# FLŌW-Bridge : exécutables autonomes

Objectif : installer le pont en trente secondes, sans rien d'autre. Le commerçant télécharge un fichier et l'ouvre une fois : le pont s'installe pour sa session, démarrera ensuite tout seul, et la caisse s'ouvre dans le navigateur déjà prête à être appairée. Node.js n'est pas nécessaire : il est embarqué dans l'exécutable.

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

## Démarrage automatique

Au premier lancement d'un double-clic (`FLOW_BRIDGE_BUILD_STANDALONE`, inscrit à la construction, sans argument, dans une fenêtre), l'exécutable :

1. se copie dans un dossier stable de l'utilisateur, **sans droits administrateur** ;
2. s'inscrit au démarrage de la session ;
3. lance cette copie en arrière-plan (`flow-bridge --arriere-plan`), attend qu'elle réponde, puis dit « Vous pouvez fermer cette fenêtre » ;
4. la copie en arrière-plan, si aucune caisse n'est appairée, ouvre le navigateur sur `<adresse de la caisse>/materiel#pont=<code>&port=<port>` : la caisse s'appaire sans rien recopier.

| Système | Copie | Démarrage avec la session |
| --- | --- | --- |
| Windows | `%LOCALAPPDATA%\FLOW-Bridge\flow-bridge.exe` | `FLOW-Bridge.vbs` dans le dossier Démarrage de l'utilisateur (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`) |
| macOS | `~/Library/Application Support/FLOW-Bridge/flow-bridge` | LaunchAgent `~/Library/LaunchAgents/fr.flow.bridge.plist` (`RunAtLoad`, `KeepAlive` après un plantage, session graphique seulement) |
| Linux | `~/.local/share/flow-bridge/flow-bridge` | unité `~/.config/systemd/user/flow-bridge.service` (`systemctl --user enable`) ; sans systemd utilisateur, `~/.config/autostart/flow-bridge.desktop` |

Pourquoi un `.vbs` sous Windows : l'exécutable est une application console, un raccourci `.lnk` ou une clé `Run` du registre ouvrirait une fenêtre noire à chaque session. `wscript.exe`, présent sur toutes les versions de Windows, lance l'exécutable caché (style de fenêtre 0) sans rien installer d'autre. Le fichier est écrit en UTF-16 avec BOM pour qu'un nom d'utilisateur accentué reste lisible. Limite connue : Microsoft a annoncé le retrait progressif de VBScript (fonctionnalité optionnelle, activée par défaut pour l'instant) ; le jour où il est désactivé, le pont ne démarrera plus seul et il faudra passer à une autre méthode (tâche planifiée à l'ouverture de session, par exemple). À surveiller.

Relancer l'exécutable (double-clic) est sans danger : même version et pont déjà en marche, rien n'est recopié ni redémarré ; il ouvre la caisse avec un nouveau code si aucune caisse n'est appairée, sinon la page d'état `http://127.0.0.1:51717/`. Nouvelle version téléchargée : l'ancien pont est arrêté, la copie remplacée puis relancée. Le pont n'arrête qu'un processus inscrit dans `~/.flow-bridge/bridge.pid` **et** qui répond sur son port.

En arrière-plan, le journal va dans `~/.flow-bridge/flow-bridge.log` (Windows : `%USERPROFILE%\.flow-bridge\flow-bridge.log`), recommencé au-delà de 5 Mo ; sous systemd, dans `journalctl --user -u flow-bridge`. Un second pont lancé alors qu'un premier tourne déjà s'arrête sans erreur.

Pour ne pas installer : `flow-bridge --sans-installation` ou `FLOW_BRIDGE_INSTALL=0`. Le pont tourne alors dans sa fenêtre comme avant : il affiche toujours un code d'appairage (comme `flow-bridge --pair`), rappelle de laisser la fenêtre ouverte et, sous Windows, attend la touche Entrée après une erreur fatale.

Les variables `FLOW_BRIDGE_*` définies dans la fenêtre ne sont pas transmises au pont démarré avec la session : il prend les réglages inscrits dans l'exécutable et le dossier `~/.flow-bridge`.

### Désinstaller

```
flow-bridge desinstaller
```

(Windows : `%LOCALAPPDATA%\FLOW-Bridge\flow-bridge.exe desinstaller`.) La commande retire le fichier de démarrage (et décharge le LaunchAgent ou désactive l'unité systemd), arrête le pont installé et supprime sa copie. Sous Windows, si c'est la copie installée qui se désinstalle, son dossier est effacé quelques secondes après la fin du programme. Les caisses appairées et le certificat restent dans `~/.flow-bridge` : supprimer ce dossier pour tout effacer (il faudra alors réapprouver le certificat sur les Mac et iPad). `flow-bridge installer` refait l'installation à la main.

### Page locale du pont

`http://127.0.0.1:51717/`, ouverte sur l'ordinateur du pont : code d'appairage en cours et bouton « Nouveau code », caisses appairées, dernière imprimante utilisée, TPE enregistré, lien « Ouvrir la caisse ». Depuis un iPad du réseau, la page ne montre ni le code ni l'état : elle dit d'aller lire le code sur l'ordinateur du pont. Détails de sécurité : [flow-bridge-securite.md](flow-bridge-securite.md).

### À vérifier sur de vrais postes

Les tests automatiques produisent les fichiers et simulent les commandes système dans un dossier temporaire. Restent à essayer sur un vrai Windows 10/11, un vrai Mac et un bureau Linux :

- Windows : lancement caché par `wscript.exe` à l'ouverture de session, y compris quand Windows Terminal est le terminal par défaut (Windows 11) ; ouverture du navigateur par `start` avec le `&` du fragment ; effacement différé du dossier à la désinstallation ; nom d'utilisateur accentué.
- macOS : `launchctl bootstrap gui/<uid>` depuis le Terminal, comportement de Gatekeeper sur la copie (attribut de quarantaine recopié avec le fichier), `open` depuis le LaunchAgent.
- Linux : `systemctl --user` présent mais sans `DISPLAY` dans l'environnement de l'unité (le navigateur ne s'ouvre alors pas : la page locale reste disponible), repli `.desktop` sur un bureau sans systemd.

Les commandes `pair`, `clients`, `cert`, `reseau`, `installer`, `desinstaller`, `--version` et les variables `FLOW_BRIDGE_*` restent valables (voir `apps/bridge/README.md`). Le certificat TLS est fabriqué par le pont lui-même avec `node:crypto` : aucune dépendance native, l'exécutable n'embarque rien de plus. Connexion sécurisée et iPad : [flow-bridge-securite.md](flow-bridge-securite.md).

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

L'essai de fumée lance l'exécutable (avec `FLOW_BRIDGE_INSTALL=0` et `FLOW_BRIDGE_NAVIGATEUR=0` : ni installation ni navigateur sur la machine de construction) dans un dossier temporaire sur un port libre, attend le code d'appairage, interroge `/health`, appaire une caisse par WebSocket (`bridge.pair`), vérifie `bridge.hello`, ouvre une connexion `wss://localhost` vérifiée avec l'autorité fabriquée par le pont, télécharge le certificat `.cer`, puis arrête le pont.

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

Les exécutables ne sont toujours **pas signés** : le démarrage automatique ne change rien aux avertissements du premier lancement. Une fois l'avertissement passé, c'est la copie installée qui démarre avec la session. Sans certificat, les systèmes avertissent au premier lancement. La caisse le dit au commerçant :

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

Quand ces secrets existent, le workflow importe le certificat dans un trousseau temporaire, signe avec le runtime renforcé (`--options runtime`, droits dans `apps/bridge/scripts/entitlements.mac.plist` : compilation à la volée de V8) et soumet les `.zip` à `xcrun notarytool submit --wait`. Un exécutable nu ne peut pas recevoir le ticket de notarisation agrafé (`stapler`) : Gatekeeper le vérifie en ligne au premier lancement. Ces étapes n'ont pas encore été exécutées faute de compte : à valider lors de la première notarisation. Un paquet `.pkg` signé « Developer ID Installer » permettrait l'agrafage ; ce n'est pas fait (le lancement au démarrage de la session passe désormais par le LaunchAgent que l'exécutable installe lui-même).

### Signer pour Windows (à faire)

Il faut un certificat de signature de code (fourni par une autorité reconnue, souvent sur jeton matériel ou service de signature dans le nuage). Ajouter alors, après la construction sur le runner Windows, un `signtool sign /fd sha256 /tr <horodatage> /td sha256 flow-bridge-windows-x64.exe`. Aucun secret n'est prévu dans le workflow pour l'instant.

## Limites

- Pas de binaire Linux arm64 ni Windows arm64 (Raspberry Pi, PC Snapdragon) : le paquet Node.js `/downloads/flow-bridge.zip` reste possible.
- Le pont démarre avec la **session** de l'utilisateur, pas avec l'ordinateur : tant que personne n'ouvre de session, il ne tourne pas. Pour un service système sans session, voir « Faire tourner le pont en service » dans `apps/bridge/README.md`.
- Pas de mise à jour automatique : une nouvelle version se télécharge depuis la caisse.
- Les exécutables Node.js sont encore expérimentaux dans Node.js 22 ; chaque montée de version de Node.js doit repasser l'essai de fumée sur les trois systèmes.
