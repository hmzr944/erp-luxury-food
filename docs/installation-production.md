# Installer FLŌW sur un serveur

Ce guide installe FLŌW sur **un seul serveur** loué en France : la base de données, l'API, la caisse web, le HTTPS et les sauvegardes chiffrées tournent ensemble, avec Docker Compose. Aucune connaissance de Kubernetes n'est nécessaire.

Durée : une demi-journée la première fois, en comptant l'attente du DNS.

Fichiers utilisés :

| Fichier | Rôle |
| --- | --- |
| `deploy/docker-compose.prod.yml` | les services : PostgreSQL 16, Redis, migrations, API, caisse web, Caddy (HTTPS), sauvegardes |
| `deploy/Caddyfile` | frontal HTTPS, certificats Let's Encrypt automatiques |
| `deploy/.env.prod` | variables du serveur (domaines, mot de passe de la base, stockage des sauvegardes), copié depuis `deploy/.env.prod.example` |
| `apps/api/.env.production`, `apps/web/.env.production` | secrets et identité de l'éditeur, écrits par `./deploy/flow configurer` |
| `deploy/flow` | raccourcis : configurer, démarrer, sauvegarder, restaurer, mettre à jour |
| `deploy/backup/` | scripts de sauvegarde, de contrôle et de restauration ([sauvegardes.md](sauvegardes.md)) |

## 1. Ce que vous devez créer vous-même

Personne ne peut le faire à votre place, et le serveur ne démarre pas sans.

1. **Un nom de domaine** (par exemple `maboutique.fr`) chez un bureau d'enregistrement. FLŌW utilise deux sous-domaines : un pour la caisse (`caisse.maboutique.fr`), un pour l'API (`api.maboutique.fr`).
2. **Un serveur virtuel (VPS)** en France (étape 2).
3. **Un stockage objet compatible S3**, de préférence chez un autre prestataire que le serveur, ou au moins dans une autre région : c'est là que partent les sauvegardes. Un seau (« bucket ») privé et une clé d'accès limitée à ce seau.
4. **Une paire de clés age** pour chiffrer les sauvegardes (étape 5). La clé privée reste chez vous, jamais sur le serveur.
5. **Un compte Resend** (e-mails : tickets, factures, alertes) avec votre domaine vérifié, et sa clé d'API. Sans elle, FLŌW fonctionne mais n'envoie aucun e-mail.
6. **Un compte Stripe** si vous facturez des abonnements : clé secrète et secret du webhook (étape 10).
7. **Un service de surveillance par ping** (healthchecks.io ou équivalent), facultatif mais conseillé : il vous prévient si les sauvegardes s'arrêtent, même quand le serveur entier est en panne.
8. **Un coffre de mots de passe** (Bitwarden, 1Password, KeePassXC…) pour garder hors du serveur la clé privée age et une copie des fichiers de configuration.

## 2. Choisir le serveur

Un VPS chez un hébergeur qui propose des centres de données en France, par exemple OVHcloud ou Scaleway. Comparez les offres sur leurs sites : les prix changent souvent et ne sont pas repris ici.

À choisir :

- **Localisation** : France.
- **Système** : Ubuntu 24.04 LTS ou Debian 12.
- **Mémoire** : 4 Go au moins. La construction de la caisse web (Next.js) est gourmande ; avec 2 Go elle peut échouer faute de mémoire.
- **Processeur** : 2 cœurs virtuels au moins.
- **Disque** : 40 Go au moins (images Docker, base, journaux).
- **Accès** : par clé SSH.

Notez l'adresse IPv4 du serveur (et IPv6 s'il en a une).

## 3. Préparer le serveur

Connectez-vous en SSH, puis :

```bash
# Mises à jour, y compris automatiques pour les correctifs de sécurité
sudo apt update && sudo apt upgrade -y
sudo apt install -y git unattended-upgrades ufw
sudo dpkg-reconfigure -plow unattended-upgrades

# Pare-feu : SSH, HTTP (certificats), HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Installez Docker Engine et le greffon Compose en suivant la documentation officielle : <https://docs.docker.com/engine/install/ubuntu/> (ou `/debian/`), section « Install using the apt repository ». Puis autorisez votre utilisateur :

```bash
sudo usermod -aG docker "$USER"
# se déconnecter puis se reconnecter, et vérifier :
docker compose version
```

À savoir : un port publié par Docker passe outre `ufw`. Ici seul Caddy publie des ports (80 et 443) ; la base et Redis ne sont joignables que depuis les conteneurs.

## 4. Pointer le DNS

Chez votre bureau d'enregistrement, créez deux enregistrements :

| Nom | Type | Valeur |
| --- | --- | --- |
| `caisse` | A | adresse IPv4 du serveur |
| `api` | A | adresse IPv4 du serveur |

Et deux enregistrements AAAA avec l'adresse IPv6, si le serveur en a une. Sinon, n'en créez pas : un AAAA erroné empêche l'obtention des certificats.

Vérifiez depuis le serveur (la réponse doit être l'adresse du serveur ; la propagation peut prendre de quelques minutes à quelques heures) :

```bash
getent hosts caisse.maboutique.fr
getent hosts api.maboutique.fr
```

## 5. Créer la clé de chiffrement des sauvegardes

**Sur votre ordinateur**, pas sur le serveur. Installez age (<https://github.com/FiloSottile/age>, paquet `age` sous Debian, Ubuntu et Homebrew), puis :

```bash
age-keygen -o flow-sauvegardes.key
```

La commande affiche `Public key: age1…` : c'est la **clé publique**, à mettre dans `BACKUP_AGE_RECIPIENT`. Le fichier `flow-sauvegardes.key` contient la **clé privée** (`AGE-SECRET-KEY-1…`) :

- rangez-le dans votre coffre de mots de passe, et gardez-en une copie imprimée dans un lieu sûr ;
- ne le copiez jamais sur le serveur, sauf le temps d'une restauration ;
- sans lui, **aucune sauvegarde ne peut être relue**.

Le serveur sait chiffrer, pas déchiffrer : un pirate qui prendrait le serveur ne lirait pas les sauvegardes.

## 6. Récupérer FLŌW sur le serveur

```bash
sudo mkdir -p /opt/flow && sudo chown "$USER": /opt/flow
git clone <adresse-du-dépôt> /opt/flow
cd /opt/flow
```

Dépôt privé sur GitHub : créez une clé SSH sur le serveur (`ssh-keygen -t ed25519`) et ajoutez la clé publique comme « Deploy key » en lecture seule (Settings, Deploy keys), puis clonez avec l'adresse `git@github.com:…`.

## 7. Remplir `deploy/.env.prod`

```bash
cp deploy/.env.prod.example deploy/.env.prod
chmod 600 deploy/.env.prod
nano deploy/.env.prod
```

À remplir : `APP_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL`, `BACKUP_AGE_RECIPIENT` (clé publique), les `BACKUP_S3_*` (adresse, région, seau, clés d'accès du stockage) et au moins une alerte (`BACKUP_PING_URL`, ou les trois `BACKUP_ALERT_*`). Laissez `POSTGRES_PASSWORD` vide : il est généré à l'étape suivante.

## 8. Configurer l'application

```bash
./deploy/flow configurer
```

Le script (`scripts/setup-production.mjs --docker`, lancé dans un conteneur Node : rien à installer) :

- génère le mot de passe de la base dans `deploy/.env.prod` ;
- lit les adresses de la caisse et de l'API dans `deploy/.env.prod` ;
- demande l'identité de l'éditeur portée sur l'attestation (article 286 du CGI) : raison sociale, SIREN, adresse, représentant légal, ville ;
- demande la clé Resend et l'expéditeur, la clé Stripe (facultatives) ;
- génère les secrets (JWT, chiffrement, code vendeur, clé de signature fiscale) et écrit `apps/api/.env.production` (droits 600) et `apps/web/.env.production`.

Puis contrôlez :

```bash
./deploy/flow verifier-config
```

Les lignes marquées ✗ sont à corriger. Deux sont de simples avertissements : clé Resend absente, aucune alerte de sauvegarde.

**Copiez maintenant `deploy/.env.prod` et `apps/api/.env.production` dans votre coffre de mots de passe.** La sauvegarde de la base ne contient pas ces fichiers. Sans `SECRETS_KEY`, les identifiants chiffrés en base (moyens de paiement, plateforme de facturation) sont perdus ; sans `FISCAL_SIGNING_KEY`, les nouvelles archives seraient signées avec une autre clé.

## 9. Démarrer

```bash
./deploy/flow up -d --build
```

La première construction prend plusieurs minutes. Dans l'ordre : la base et Redis démarrent, les migrations Prisma s'appliquent (`prisma migrate deploy`), puis l'API (seulement si les migrations ont réussi), la caisse, Caddy et le service de sauvegarde. Caddy obtient les certificats HTTPS dans la minute qui suit, si le DNS est en place.

Ne lancez pas le jeu de démonstration (`db:seed`) en production.

## 10. Vérifier

```bash
./deploy/flow etat                                # postgres, redis, api, web : « healthy » ; migrate : « exited (0) »
curl https://api.maboutique.fr/api/health         # {"status":"ok","db":"connected",…}
./deploy/flow logs --tail 50 api                  # journal de l'API
./deploy/flow logs --tail 50 caddy                # certificats obtenus ?
./deploy/flow logs backup                         # « Sauvegarde programmée … »
```

Ouvrez `https://caisse.maboutique.fr` et créez votre compte.

Puis :

- **Stripe** (si vous l'utilisez) : dans le tableau de bord Stripe, créez un point de terminaison de webhook vers `https://api.maboutique.fr/api/billing/webhook`, ajoutez son secret dans `apps/api/.env.production` (`STRIPE_BILLING_WEBHOOK_SECRET=…`), puis `./deploy/flow up -d`.
- **Resend** : vérifiez votre domaine d'envoi dans Resend, sinon les e-mails sont refusés.
- **Ordinateurs de boutique** : installez FLŌW-Bridge (imprimante, tiroir, TPE), voir [flow-bridge-executables.md](flow-bridge-executables.md) et, pour les iPad et Safari, [flow-bridge-securite.md](flow-bridge-securite.md) (certificat du pont, `flow-bridge cert`).

## 11. Première sauvegarde et premier essai de restauration

Ne considérez pas l'installation terminée avant d'avoir relu une sauvegarde.

```bash
./deploy/flow sauvegarder               # sauvegarde immédiate, envoyée sur le stockage
./deploy/flow controler-sauvegarde      # « Dernière sauvegarde : … il y a 0 h »
```

Essai de restauration : copiez la clé privée sur le serveur **le temps de l'essai** (depuis votre ordinateur : `scp flow-sauvegardes.key serveur:/tmp/`), puis sur le serveur :

```bash
./deploy/flow tester-restauration /tmp/flow-sauvegardes.key
shred -u /tmp/flow-sauvegardes.key
```

La sauvegarde est téléchargée, déchiffrée, restaurée dans une base d'essai `flow_restore_test`, comptée, puis cette base est supprimée. La base de production n'est pas touchée. À refaire chaque mois : [sauvegardes.md](sauvegardes.md).

## 12. Mettre à jour

```bash
cd /opt/flow
./deploy/flow mettre-a-jour
```

Dans l'ordre : sauvegarde immédiate, `git pull`, reconstruction des images, migrations, redémarrage. Si une migration échoue, la commande s'arrête en erreur et la nouvelle version de l'API ne démarre pas (son image relance d'ailleurs `prisma migrate deploy` avant de démarrer, et s'arrête au moindre échec). Consultez `./deploy/flow logs migrate`, corrigez, relancez ; au besoin, restaurez la sauvegarde faite juste avant (étape 13).

### Mise à jour automatique depuis GitHub (facultatif)

Le workflow `.github/workflows/deploy.yml` peut déployer chaque commit de `main` qui a passé le CI. Dans GitHub, Settings, Secrets and variables, Actions :

| Type | Nom | Valeur |
| --- | --- | --- |
| Variable | `DEPLOY_TARGET` | `serveur` |
| Variable | `DEPLOY_HOST` | adresse du serveur |
| Variable | `DEPLOY_USER` | utilisateur SSH (membre du groupe `docker`) |
| Variable | `DEPLOY_PATH` | `/opt/flow` |
| Variable | `APP_DOMAIN`, `API_DOMAIN` | les deux domaines |
| Secret | `DEPLOY_SSH_KEY` | clé privée SSH dédiée au déploiement (sa clé publique dans `~/.ssh/authorized_keys` du serveur) |
| Secret | `DEPLOY_SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan <adresse-du-serveur>`, vérifiée |

Le workflow lance `./deploy/flow mettre-a-jour <commit>` par SSH, puis vérifie `https://<API_DOMAIN>/api/health` et la caisse. En cas d'échec, il ouvre un ticket GitHub (notification par e-mail). Sans `DEPLOY_TARGET`, il ne fait rien.

## 13. Restaurer après un incident

Procédure complète, choix de la sauvegarde et précautions : [sauvegardes.md](sauvegardes.md#restaurer-la-production). En bref :

```bash
./deploy/flow restaurer /tmp/flow-sauvegardes.key                    # dernière sauvegarde
./deploy/flow restaurer /tmp/flow-sauvegardes.key --from monthly/flow-202609.dump.age
shred -u /tmp/flow-sauvegardes.key
```

La caisse est arrêtée pendant l'opération ; la base actuelle est conservée sous un autre nom, rien n'est détruit.

**Serveur perdu** : louez-en un autre, refaites les étapes 3, 4 et 6, remettez `deploy/.env.prod` et `apps/api/.env.production` depuis votre coffre (ne relancez pas `configurer` : il générerait d'autres secrets), `./deploy/flow up -d --build`, puis `./deploy/flow restaurer …`.

## Dépannage

| Symptôme | Piste |
| --- | --- |
| `up` s'arrête sur « POSTGRES_PASSWORD manquante » ou une autre variable | `deploy/.env.prod` incomplet : `./deploy/flow verifier-config` |
| `service "migrate" didn't complete successfully` | `./deploy/flow logs migrate` : la migration a échoué, l'API reste arrêtée |
| Pas de certificat HTTPS | `./deploy/flow logs caddy` : DNS qui ne pointe pas encore vers le serveur, port 80 fermé, enregistrement AAAA erroné |
| `api` reste « unhealthy » | `./deploy/flow logs api` : secret manquant ou trop court (l'API refuse de démarrer en production avec des secrets faibles) |
| Le service `backup` redémarre en boucle | `./deploy/flow logs backup` : clé publique age ou stockage S3 manquant |
| La construction de `web` est tuée | mémoire insuffisante : serveur de 4 Go ou plus, ou fichier d'échange (swap) |

## Plus tard : Kubernetes

Le dossier `k8s/` décrit un déploiement sur OVHcloud Managed Kubernetes (plusieurs répliques, registre privé). C'est l'option « plus tard », quand le volume le justifiera et qu'une personne pourra l'exploiter. Il reste en l'état et n'est pas maintenu par ce guide :

- `k8s/ingress.yaml` porte encore des domaines d'exemple (`app.yourdomain.fr`, `api.yourdomain.fr`) à remplacer ;
- il ne prévoit ni base de données ni sauvegarde : il faudrait une base PostgreSQL gérée, avec ses propres sauvegardes, ou adapter `deploy/backup/` ;
- le workflow `deploy.yml` le déploie si `DEPLOY_TARGET` vaut `kubernetes` (variables `API_DOMAIN`, secrets `OVH_REGISTRY_USER`, `OVH_REGISTRY_PASSWORD`, `OVH_KUBECONFIG`).

## Sans Docker

`pnpm setup:production` (sans `--docker`) prépare les mêmes fichiers pour une installation à la main (Node.js 22, PostgreSQL 16 et Redis installés sur la machine, API et caisse lancées par un gestionnaire de services). Ce mode n'est pas décrit plus avant : préférez Docker Compose, qui inclut les sauvegardes.
