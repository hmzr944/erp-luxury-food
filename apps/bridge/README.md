# FLŌW-Bridge

Petit agent local qui relie la caisse FLŌW (application web dans le navigateur) au matériel du magasin.

Un navigateur ne sait pas ouvrir de connexion TCP brute : il ne peut donc ni envoyer un ticket à une imprimante réseau sur le port 9100, ni parler à un terminal de paiement. FLŌW-Bridge tourne sur l'ordinateur de la caisse (Windows, macOS, Linux ; Android plus tard), ouvre un WebSocket **sur la boucle locale uniquement** (`127.0.0.1`) et pilote le matériel à la place du navigateur.

```
Navigateur (caisse FLŌW)  --ws://127.0.0.1:51717-->  FLŌW-Bridge  --TCP-->  imprimante, tiroir, TPE
```

## Installation et lancement

Pour un commerçant : exécutables autonomes, sans Node.js (Windows, macOS, Linux), voir [docs/flow-bridge-executables.md](../../docs/flow-bridge-executables.md).

En développement, prérequis : Node.js 22 ou plus récent.

```bash
pnpm install --filter @erp/bridge
pnpm --filter @erp/bridge build
node apps/bridge/dist/index.js
```

Au premier lancement, le pont affiche un code d'appairage :

```
==========================================================
  Code d'appairage : 230 631
  Saisissez-le sur la caisse FLŌW (valable 10 minutes).
==========================================================
```

Commandes :

| Commande | Effet |
| --- | --- |
| `flow-bridge` | démarre le pont |
| `flow-bridge --pair` | démarre le pont et affiche un code même si des caisses sont déjà appairées |
| `flow-bridge pair` | affiche un nouveau code pour le pont **déjà lancé** (en service) |
| `flow-bridge clients` | liste les caisses appairées |

(`flow-bridge` = `node apps/bridge/dist/index.js`.)

### Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `FLOW_BRIDGE_PORT` | `51717` | port local d'écoute |
| `FLOW_BRIDGE_ORIGINS` | `http://localhost:3000` | origines de la caisse autorisées, séparées par des virgules (ex. `https://caisse.maison.fr,http://localhost:3000`). `*` est refusé. |
| `FLOW_BRIDGE_HOME` | `~/.flow-bridge` | dossier de configuration (caisses appairées) |
| `FLOW_BRIDGE_CERT` / `FLOW_BRIDGE_KEY` | aucun | certificat et clé PEM : le pont passe en `wss://` |
| `FLOW_BRIDGE_LOG` | `info` | `debug`, `info`, `warn`, `error`, `silent` |

## Appairer une caisse

1. Lancer le pont : le code s'affiche dans la console (ou `flow-bridge pair` si le pont tourne en service). Un code ne sert qu'une fois.
2. Dans la caisse, menu ⋮ > « Imprimante, tiroir et TPE » (ou Paramètres > Paiement > Mon TPE bancaire) : saisir le code.
3. La caisse reçoit un jeton long qu'elle garde dans `localStorage` (`flow-bridge-token`). Aux connexions suivantes, elle s'authentifie seule.

Côté code de la caisse (`apps/web/src/lib/bridge`) :

```ts
import { getBridge, useBridge, bytesToBase64 } from '@/lib/bridge'

const { status, bridge } = useBridge() // 'off' | 'connecting' | 'unpaired' | 'ready'
await getBridge().pair('230631', 'Caisse 1')
await getBridge().call('printer.print', { host: '192.168.1.50', data: bytesToBase64(ticket) })
const off = getBridge().on('payment.progress', (p) => afficher(p.message))
```

Réglages de chaque appareil, gardés dans son `localStorage` :

- `flow-printer` : imprimante (mode « Imprimante réseau » = ESC/POS par le pont, port 9100), tiroir sur l'imprimante ;
- `flow-bridge-tpe` : TPE bancaire Caisse-AP (adresse, port 8888, n° de caisse) ou TPE simulé. Une fois activé, la touche « Carte » de la caisse envoie le montant au TPE ; le n° d'autorisation est gardé sur le paiement.

Le site doit pouvoir joindre le pont : `connect-src` de la politique de contenu inclut `NEXT_PUBLIC_BRIDGE_URL` (par défaut `ws://127.0.0.1:51717`), et le pont doit autoriser l'adresse du site dans `FLOW_BRIDGE_ORIGINS`.

Pour retirer un poste : `bridge.unpair` depuis la caisse, ou supprimer l'entrée dans `~/.flow-bridge/config.json`.

## Faire tourner le pont en service

Le pont doit démarrer avec l'ordinateur. Adapter les chemins et l'origine de la caisse.

### Linux (systemd)

`/etc/systemd/system/flow-bridge.service` :

```ini
[Unit]
Description=FLŌW-Bridge
After=network-online.target
Wants=network-online.target

[Service]
User=caisse
Environment=FLOW_BRIDGE_ORIGINS=https://caisse.maison.fr
ExecStart=/usr/bin/node /opt/flow/apps/bridge/dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now flow-bridge
journalctl -u flow-bridge -f          # journal, et le code d'appairage
sudo -u caisse node /opt/flow/apps/bridge/dist/index.js pair   # nouveau code
```

Lancer `pair` avec le **même utilisateur** que le service : le code passe par son dossier `~/.flow-bridge`.

### macOS (launchd)

`~/Library/LaunchAgents/fr.flow.bridge.plist` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>fr.flow.bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Applications/FLOW/apps/bridge/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FLOW_BRIDGE_ORIGINS</key><string>https://caisse.maison.fr</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/flow-bridge.log</string>
  <key>StandardErrorPath</key><string>/tmp/flow-bridge.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/fr.flow.bridge.plist
```

### Windows

Avec [NSSM](https://nssm.cc/) :

```bat
nssm install FlowBridge "C:\Program Files\nodejs\node.exe" "C:\FLOW\apps\bridge\dist\index.js"
nssm set FlowBridge AppEnvironmentExtra FLOW_BRIDGE_ORIGINS=https://caisse.maison.fr FLOW_BRIDGE_HOME=C:\ProgramData\FlowBridge
nssm set FlowBridge AppStdout C:\ProgramData\FlowBridge\bridge.log
nssm set FlowBridge AppStderr C:\ProgramData\FlowBridge\bridge.log
nssm start FlowBridge
```

Pour un nouveau code : `set FLOW_BRIDGE_HOME=C:\ProgramData\FlowBridge` puis `node C:\FLOW\apps\bridge\dist\index.js pair` dans une invite administrateur (même dossier de configuration que le service).

Sans NSSM, le Planificateur de tâches convient aussi : tâche « Au démarrage », action `node.exe` avec l'argument `C:\FLOW\apps\bridge\dist\index.js`, option « Exécuter même si l'utilisateur n'est pas connecté », variables définies au niveau système.

## Sécurité

N'importe quel site ouvert dans le navigateur du magasin peut essayer de joindre `127.0.0.1`. Le pont oppose plusieurs barrières :

- **Écoute sur `127.0.0.1` seulement**, jamais `0.0.0.0` : invisible depuis le réseau.
- **En-tête `Host`** limité à `127.0.0.1` / `localhost` : bloque le « DNS rebinding ».
- **Liste d'origines** (`FLOW_BRIDGE_ORIGINS`) : un WebSocket venant d'une autre origine, ou sans origine, est fermé avec le code `4003`. `/health` n'envoie les en-têtes CORS qu'aux origines autorisées (y compris l'accord « Private Network Access » de Chrome).
- **Appairage** : code à 6 chiffres, valable 10 minutes, à usage unique, affiché seulement sur l'ordinateur du pont. 5 codes faux : le code est annulé, un nouveau est affiché et l'appairage est bloqué 30 secondes. Le jeton remis (32 octets aléatoires) n'est stocké que **haché en SHA-256**, dans un fichier lisible par le seul utilisateur (`0600`).
- **Authentification obligatoire** : en dehors de `bridge.pair` et `bridge.hello`, toute méthode exige une connexion authentifiée.
- **Pas de relais vers Internet** : imprimantes et TPE doivent être sur le réseau local (10.x, 172.16-31.x, 192.168.x, 169.254.x, 127.x) ou nommés `localhost` / `*.local`. Le nom est résolu puis l'adresse obtenue revérifiée. IPv6 n'est pas accepté pour l'instant.
- **Pas de balayage hors du magasin** : `printer.discover` ne sonde que le /24 privé (RFC 1918) de chaque carte réseau de l'ordinateur du pont, jamais une plage publique ni le lien local.
- **Messages limités à 20 Mo** (pour un PDF A4 de 14 Mo encodé en base64), JSON invalide et méthodes inconnues renvoient une erreur sans arrêter le pont.

## Matériel pris en charge

- **Imprimantes ticket réseau ESC/POS** (port RAW 9100) : Epson TM-m30 / TM-T20, Star en émulation ESC/POS, Bixolon, Sunmi... Le ticket est mis en forme par la caisse, le pont transmet les octets tels quels. Les travaux sont mis en file par imprimante : deux tickets ne s'entremêlent jamais.
- **Imprimantes de bureau et AirPrint en IPP** (`printer.printDocument`, port 631, sans pilote) : factures et documents A4 en PDF. Le pont interroge d'abord l'imprimante (Get-Printer-Attributes) et refuse proprement (`format_unsupported`) si elle n'accepte pas le PDF : il faut alors passer par la fenêtre d'impression du navigateur. IPPS (`tls: true`) accepte le certificat auto-signé de l'imprimante.
- **Détection automatique** (`printer.discover`) : annonces mDNS / Bonjour (`_pdl-datastream._tcp`, `_ipp._tcp`, `_ipps._tcp`, `_printer._tcp`) et, en complément, balayage du port 9100 sur le /24 du magasin (300 ms par adresse, 64 à la fois).
- **Tiroir-caisse** branché sur la prise RJ11/RJ12 de l'imprimante : commande `ESC p m t1 t2` (`1B 70 m 19 FA`), broche 2 (`pin: 0`) ou 5 (`pin: 1`).
- **Terminal de paiement simulé** (`simulator`) : accepte après environ 2 s, refuse les montants en ,13 (ex. 10,13 €), émet les étapes « Présentez la carte », « Carte lue », « Code saisi », « Autorisation en cours ».
- **TPE Caisse-AP sur IP** (`caisse-ap`), voir ci-dessous.

## Caisse-AP : état

Le protocole Caisse-AP (Association du Paiement) est implémenté d'après le module Odoo OCA `l10n_fr_pos_caisse_ap_ip` d'Akretion (Alexis de Lattre), seule source publique lue :

- https://raw.githubusercontent.com/OCA/l10n-france/19.0/l10n_fr_pos_caisse_ap_ip/models/pos_payment_method.py
- https://pypi.org/project/odoo-addon-l10n-fr-pos-caisse-ap-ip/
- https://associationdupaiement.fr/protocoles/protocole-caisse/

Ce qui est fait : connexion TCP au TPE (port 8888 par défaut), message ASCII `TAG + longueur sur 3 chiffres + valeur` avec `CZ=0300`, `CJ`, `CA` (numéro de caisse), `CE` (devise numérique, EUR/XPF/USD), `CD` (débit / remboursement), `CB` (montant en centimes), `CC=00C` pour le chèque ; lecture de la réponse (`AE=10` accepté, `AE=01` refusé avec le motif `AF`), contrôle que le TPE renvoie bien les mêmes `CA`/`CD`/`CE`/`CB`, type de carte (`CC`) et mode de lecture (`CI`), identifiant de transaction (`AA`, `AB`, `AC`, `AI`).

Ce qui manque :

- **Jamais testé sur un vrai TPE.** À valider sur un Ingenico/Verifone avec le mode « caisse IP » activé par la banque ou l'installateur avant toute mise en production.
- **Pas d'annulation à distance** : le protocole (d'après la source) n'en prévoit pas. `payment.cancel` répond « appuyez sur la touche rouge du TPE ».
- Le code d'autorisation, le numéro de carte masqué et le ticket client du TPE ne sont pas remontés : la source ne dit pas quels champs les portent. Ils sont disponibles bruts dans `raw`.
- Pas d'étapes intermédiaires (le TPE ne répond qu'à la fin).
- La référence de vente n'est pas transmise au TPE (aucun champ vérifié).

Après une coupure en plein paiement, la caisse peut retrouver l'issue avec `payment.status` (résultats gardés 30 minutes) au lieu de réencaisser à l'aveugle.

## Pas encore fait

- Monnayeurs automatiques (Glory CI-10, Cashlogy...).
- Balances (poids des produits au détail).
- Paiement sans contact sur téléphone (Tap to Pay) : demande une application Android native, hors de portée d'un agent Node.
- Version Android du pont.
- Imprimantes USB ou série (seul le réseau est géré).
- Impression IPP **jamais testée sur une vraie imprimante** (seulement contre un faux serveur IPP) : à valider sur une HP, Brother, Epson ou Canon de bureau. Pas d'IPP avec authentification, pas de suivi du travail après l'envoi (Get-Job-Attributes).
- Découverte mDNS **jamais testée sur un vrai réseau de magasin** ; IPv6 ignoré.

## Protocole

WebSocket, messages texte JSON.

```jsonc
// requête
{ "id": 1, "method": "printer.print", "params": { "host": "192.168.1.50", "data": "G0A..." } }
// réponse
{ "id": 1, "result": { "ok": true, "bytes": 128 } }
// erreur (message en français, affichable au vendeur)
{ "id": 1, "error": { "code": "printer_unreachable", "message": "Imprimante injoignable à 192.168.1.50:9100 (connexion refusée)." } }
// événement poussé par le pont
{ "event": "payment.progress", "data": { "paymentId": "...", "step": "card_wait", "message": "Présentez la carte" } }
```

| Méthode | Paramètres | Résultat |
| --- | --- | --- |
| `bridge.pair` | `code`, `name` | `{ token, clientId, name }` |
| `bridge.hello` | `token` | `{ clientId, name, version, capabilities }` |
| `bridge.unpair` | | `{ ok }` |
| `bridge.info` | | `{ name, version, capabilities, platform, arch, node }` |
| `printer.print` | `host`, `port=9100`, `data` (base64), `timeoutMs=8000` | `{ ok, bytes }` |
| `printer.probe` | `host`, `port=9100`, `timeoutMs=2000` | `{ reachable, latencyMs }` |
| `printer.discover` | `timeoutMs=2500` (10000 max), `scan=true` | `{ printers: [{ name, host, port, protocols: (escpos\|ipp\|ipps)[], ippPort?, model?, airprint?, rp?, source: mdns\|scan }] }` |
| `printer.printDocument` | `host`, `port=631`, `path=/ipp/print` (ou `rp` de la découverte), `tls=false`, `data` (PDF base64, 14 Mo max), `jobName=FLOW`, `copies=1` (1 à 20), `timeoutMs=30000` | `{ ok, jobId?, printer? }` |
| `drawer.open` | `host`, `port=9100`, `pin=0` | `{ ok }` |
| `payment.start` | `adapter`, `amountCents`, `currency=EUR`, `reference`, `paymentId?` ; Caisse-AP : `host`, `port=8888`, `posNumber=01`, `mode=card\|check`, `refund`, `timeoutMs=180000` | `{ paymentId, status, message?, authorizationCode?, maskedPan?, cardType?, transactionId?, receiptText?, raw? }` |
| `payment.cancel` | `paymentId` | `{ accepted, message }` |
| `payment.status` | `paymentId` | `{ state: pending\|done\|unknown, result? }` |

`printer.discover` répond après `timeoutMs` : fusion par adresse IP, mDNS prioritaire (nom, modèle `ty`/`product`, `airprint` si la clé TXT `URF` est présente, chemin IPP `rp`). Un appareil seulement trouvé par le balayage a `source: "scan"` et son adresse pour nom. Pour imprimer un A4 sur une imprimante trouvée : `printer.printDocument` avec `host`, `port: ippPort`, `path: rp` et `tls` si seul `ipps` est annoncé. Côté caisse, prévoir un délai d'appel plus long que les 15 s par défaut pour `printer.printDocument`.

`payment.start` ne répond qu'à la fin du paiement ; un seul paiement à la fois par terminal (`payment_busy` sinon). Fournir son propre `paymentId` permet d'annuler sans attendre.

Codes d'erreur courants : `parse_error`, `invalid_request`, `invalid_params`, `unknown_method`, `unauthorized`, `invalid_token`, `pairing_closed`, `pairing_code_invalid`, `pairing_code_invalidated`, `pairing_locked`, `host_not_allowed`, `host_unresolved`, `printer_unreachable`, `printer_timeout`, `printer_reset`, `printer_error`, `printer_busy`, `format_unsupported`, `ipp_error`, `document_too_large`, `payment_busy`, `unknown_adapter`, `payment_currency`, `internal_error`.

`GET /health` (sans authentification) : `{ name: "FLŌW-Bridge", version, capabilities }`.

## Développement

```bash
pnpm --filter @erp/bridge test    # vitest : fausses imprimantes et faux TPE en TCP local
pnpm --filter @erp/bridge build   # tsc vers dist/
pnpm --filter @erp/bridge lint
```

## Banc d'essai sans matériel

Pour répéter la recette avant d'avoir le matériel, ou pour isoler une panne :

```sh
pnpm --filter @erp/bridge build
pnpm --filter @erp/bridge banc            # faux TPE Caisse-AP (8888) et fausse imprimante ESC/POS (9100)
pnpm --filter @erp/bridge banc -- --manuel   # accepter, refuser ou abandonner chaque paiement au clavier
```

Le faux TPE parle le même protocole que les TPE Caisse-AP (montants en ,13 refusés par défaut). La fausse imprimante affiche chaque ticket reçu en texte, avec l'impulsion du tiroir, la coupe, le QR code et les caractères hors PC858. Ce banc ne remplace pas l'essai sur le vrai matériel : il vérifie ce que la caisse envoie, pas ce que le matériel en fait.
