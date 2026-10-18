# Sauvegardes de FLŌW

Une caisse doit pouvoir restituer ses données des années après. Ce document décrit ce qui est sauvegardé, où, combien de temps, comment le vérifier chaque mois et comment restaurer. Installation du serveur : [installation-production.md](installation-production.md).

## En bref

- Chaque nuit (3 h 15, heure de Paris, réglable), le service `backup` fait un `pg_dump` complet de la base, le contrôle, le **chiffre avec age** et l'envoie **hors du serveur** sur un stockage compatible S3.
- Rétention : **30 sauvegardes quotidiennes, 12 mensuelles, 7 annuelles**.
- Les **archives fiscales signées** sont en plus copiées une à une, sans jamais être supprimées par le script.
- Toutes les 6 heures, un contrôle vérifie que la dernière sauvegarde a **moins de 26 heures** ; sinon, alerte par e-mail et par ping de surveillance.
- La clé qui déchiffre les sauvegardes n'est **pas** sur le serveur.
- Une fois par mois, un **essai de restauration** (15 minutes).

## Ce qui est sauvegardé, et ce qui ne l'est pas

| Élément | Où il vit | Sauvegarde |
| --- | --- | --- |
| Base PostgreSQL : ventes, tickets signés et leur chaînage, clôtures, journal des événements fiscaux, catalogue, clients, réglages | volume `postgres_data` | `pg_dump` quotidien chiffré |
| **Archives fiscales** (périodes closes, JSON compressé, empreinte SHA-256, signature ECDSA de l'éditeur) | **dans la base**, table `FiscalArchive`, colonne `content` | incluses dans le `pg_dump`, **et** copiées à part dans `archives-fiscales/` |
| Secrets de l'application (`SECRETS_KEY`, `FISCAL_SIGNING_KEY`, JWT, clés Stripe et Resend) | `apps/api/.env.production` | **non** : copie manuelle dans votre coffre de mots de passe |
| Variables du serveur (mot de passe de la base, accès au stockage) | `deploy/.env.prod` | **non** : copie manuelle dans votre coffre |
| Files d'attente (Redis) | volume `redis_data` | non : travaux en cours, reconstruits par l'application |
| Certificats HTTPS | volume `caddy_data` | non : Caddy les redemande à Let's Encrypt |

Vérifié dans le code (`apps/api/src`) : l'API n'écrit aucun fichier sur disque. Les archives fiscales sont créées par `compliance/archives.service.ts` et enregistrées en base (`prisma.fiscalArchive.create`, contenu en `Bytes`). Il n'y a donc pas de dossier de fichiers à sauvegarder en plus de la base.

Sans `SECRETS_KEY`, les identifiants chiffrés en base (moyens de paiement, clé de la plateforme de facturation) ne peuvent plus être lus, même avec une sauvegarde parfaite. Gardez une copie de `apps/api/.env.production`.

## Où vont les fichiers

Dans le seau `BACKUP_S3_BUCKET`, sous le dossier `BACKUP_PREFIX` (`flow` par défaut) :

```
flow/
  daily/flow-20261018T011500Z.dump.age      une par nuit (heure UTC dans le nom), 30 gardées
  monthly/flow-202610.dump.age              première sauvegarde du mois, 12 gardées
  yearly/flow-2026.dump.age                 première sauvegarde de l'année, 7 gardées
  archives-fiscales/<site>/<période>-<libellé>-<id>.json.gz.age   jamais supprimées par le script
  archives-fiscales/<site>/<période>-<libellé>-<id>.meta.json     empreinte, signature, clé (en clair)
```

Chaque nuit, avant l'envoi :

1. `pg_dump --format=custom` de toute la base ;
2. `pg_restore --list` sur le fichier : un fichier tronqué ou illisible est refusé tout de suite, pas le jour où on en a besoin ;
3. chiffrement age pour la ou les clés publiques de `BACKUP_AGE_RECIPIENT` ; le fichier en clair est effacé ;
4. pour chaque nouvelle archive fiscale : décompression, recalcul de l'empreinte SHA-256 et comparaison avec celle enregistrée. Une archive qui ne correspond plus déclenche une alerte « archive fiscale altérée ».

Les rétentions se règlent dans `deploy/.env.prod` (`BACKUP_KEEP_DAILY`, `BACKUP_KEEP_MONTHLY`, `BACKUP_KEEP_YEARLY`).

## Les sauvegardes ne remplacent pas les archives fiscales

Les données de caisse se conservent **six ans** (article L. 102 B du livre des procédures fiscales, voir `research_notes/Benchmark caisses et manques FLŌW/conformite_france.md`), au détail, dans un format lisible lors d'un contrôle. Ce sont les **archives fiscales signées**, produites par FLŌW à chaque clôture de mois et d'année, qui répondent à cette obligation : fichier JSON ouvert, scellé, signé par l'éditeur, téléchargeable depuis la page Conformité de la caisse.

Une sauvegarde `pg_dump` est autre chose : un outil de reprise après incident, dans un format technique (PostgreSQL), chiffré, lisible seulement avec la clé privée. Elle ne doit pas être présentée comme l'archive fiscale.

D'où trois niveaux :

1. **Les archives en base**, jamais supprimées par l'application, téléchargeables à tout moment.
2. **Les copies `archives-fiscales/`** sur le stockage distant, une par archive, jamais supprimées par le script : si la base était perdue au-delà des 7 sauvegardes annuelles, les archives resteraient.
3. **Le commerçant télécharge ses archives** et les garde sur un support à lui, comme l'indique la page Conformité (« À conserver six ans, sur un support externe de préférence »).

À faire valider (non tranché ici, pas de base juridique dans `docs/legal`) :

- si la copie `archives-fiscales/` tenue par l'éditeur suffit à la conservation de six ans pour un client qui aurait résilié, ou s'il faut l'export remis au client prévu par la réversibilité (piste notée dans `research_notes`) ;
- la durée de conservation des sauvegardes complètes au regard du RGPD : elles contiennent des données personnelles (clients, équipes) ; 7 sauvegardes annuelles gardent des données supprimées entre-temps jusqu'à 7 ans. Réduire `BACKUP_KEEP_YEARLY` si un conseil le recommande, les copies d'archives fiscales restant à part ;
- l'emplacement du stockage (France, Union européenne) au regard des engagements pris envers les clients.

## La clé de chiffrement

- **Clé publique** (`age1…`) dans `deploy/.env.prod`, variable `BACKUP_AGE_RECIPIENT`. Le serveur ne peut que chiffrer.
- **Clé privée** (`AGE-SECRET-KEY-1…`) dans votre coffre de mots de passe et sur papier, en lieu sûr. Sans elle, les sauvegardes sont illisibles, pour un pirate comme pour vous.
- **Deux personnes** : une deuxième clé publique (associé, expert-comptable, prestataire de confiance) peut être ajoutée, séparée par une virgule. Chacune des deux clés privées déchiffre.
- **Changer de clé** : ajoutez la nouvelle clé publique, retirez l'ancienne, `./deploy/flow up -d`. Les sauvegardes déjà faites restent chiffrées pour l'ancienne : gardez l'ancienne clé privée tant qu'elles existent (7 ans pour les annuelles, sans limite pour les copies d'archives).

## Protéger le stockage

La clé d'accès S3 est sur le serveur : quelqu'un qui prendrait le serveur pourrait effacer les sauvegardes (sans pouvoir les lire). Parades, selon ce que propose votre fournisseur :

- une clé d'accès limitée à ce seul seau ;
- le **versionnage** du seau, ou mieux un **verrouillage d'objets** (« object lock ») en mode conformité, qui interdit l'effacement pendant une durée fixée ;
- un stockage chez un autre prestataire, ou dans une autre région, que le serveur : un incident chez l'hébergeur ne doit pas emporter la base et ses sauvegardes en même temps.

Vérifiez dans la documentation de votre fournisseur ce qui est disponible : ce n'est pas configuré automatiquement.

## Surveillance

- **Contrôle local** (`check-backup.sh`, toutes les 6 heures, `BACKUP_CHECK_CRON`) : lit la date de la dernière sauvegarde quotidienne sur le stockage distant. Plus de `BACKUP_MAX_AGE_HOURS` heures (26 par défaut), ou aucune sauvegarde : e-mail d'alerte (via Resend, variables `BACKUP_ALERT_*`) et ping d'échec.
- **Ping de surveillance** (`BACKUP_PING_URL`, healthchecks.io ou équivalent) : le script appelle `<url>/start` au début, `<url>` en cas de succès, `<url>/fail` en cas d'échec. Réglez le service sur une période d'un jour et une marge de quelques heures : il vous prévient aussi si **le serveur entier** est arrêté, cas où le contrôle local se tait.
- Un échec de la sauvegarde elle-même envoie aussi l'e-mail et le ping d'échec.

Mettez les deux : un e-mail ne part pas d'un serveur éteint.

## Commandes

Depuis `/opt/flow` sur le serveur :

```bash
./deploy/flow sauvegarder                 # sauvegarde immédiate
./deploy/flow controler-sauvegarde        # âge de la dernière sauvegarde
./deploy/flow logs backup                 # journal du service
# Liste des sauvegardes sur le stockage
./deploy/flow exec backup sh -c '. /usr/local/bin/lib.sh && setup_remote && rclone lsl "$REMOTE"'
```

## Test de restauration mensuel

Une sauvegarde jamais relue n'est pas une sauvegarde. Une fois par mois, par exemple le premier lundi :

1. Copier la clé privée sur le serveur, le temps de l'essai : `scp flow-sauvegardes.key serveur:/tmp/`
2. Sur le serveur, essai avec la dernière sauvegarde :
   ```bash
   cd /opt/flow
   ./deploy/flow tester-restauration /tmp/flow-sauvegardes.key
   ```
   Un trimestre sur trois, prendre plutôt une mensuelle ou une annuelle : `--from monthly/flow-AAAAMM.dump.age`.
3. Lire le résultat : la sauvegarde est téléchargée, déchiffrée, restaurée dans une base à part `flow_restore_test` en une seule transaction, puis le script affiche le nombre de migrations, d'organisations, de boutiques, d'utilisateurs, de clôtures, d'événements fiscaux et d'archives, et le nom de la dernière migration. Comparer avec ce que montre la caisse (nombre de boutiques, dernière clôture). La base d'essai est ensuite supprimée ; `--keep` la conserve pour l'examiner.
4. Effacer la clé : `shred -u /tmp/flow-sauvegardes.key`
5. Noter l'essai dans le tableau ci-dessous (ou dans votre propre registre).

La base de production n'est jamais touchée par l'essai : le script refuse de restaurer dans la base de production sans `--production`.

| Date | Sauvegarde relue | Résultat | Durée | Par |
| --- | --- | --- | --- | --- |
| | | | | |

## Restaurer la production

À faire seulement après un incident réel (données effacées par erreur, base corrompue, serveur perdu).

1. Prévenir les boutiques : la caisse sera coupée quelques minutes.
2. Copier la clé privée sur le serveur (`/tmp/flow-sauvegardes.key`).
3. Choisir la sauvegarde : la dernière (par défaut), ou une plus ancienne si l'incident date de plusieurs jours (liste : voir « Commandes »).
4. Lancer :
   ```bash
   ./deploy/flow restaurer /tmp/flow-sauvegardes.key
   # ou : ./deploy/flow restaurer /tmp/flow-sauvegardes.key --from daily/flow-20261016T011500Z.dump.age
   ```
   L'API et la caisse sont arrêtées ; la sauvegarde est restaurée dans une base neuve et contrôlée ; il faut taper `RESTAURER` pour confirmer ; la base actuelle est **renommée** `flow_avant_<date>` (rien n'est effacé), la base restaurée prend sa place ; l'API et la caisse redémarrent.
5. Vérifier la caisse, puis effacer la clé : `shred -u /tmp/flow-sauvegardes.key`.
6. Quelques jours plus tard, quand tout est confirmé, supprimer l'ancienne base :
   ```bash
   ./deploy/flow exec postgres psql -U flow -d postgres -c 'DROP DATABASE "flow_avant_<date>"'
   ```

Revenir en arrière (la restauration ne convient pas) : arrêter `api` et `web`, renommer les bases à l'inverse avec `ALTER DATABASE … RENAME TO …`, redémarrer.

Les ventes enregistrées entre la sauvegarde et l'incident sont perdues côté serveur. La conduite à tenir (ressaisie, justification, trace de l'incident) n'est pas tranchée ici : à faire valider avec un expert-comptable avant d'en avoir besoin.

## Relire une sauvegarde sans le serveur

Sur n'importe quel ordinateur avec age et PostgreSQL 16 :

```bash
# 1. Télécharger le fichier depuis la console du stockage (ou avec rclone)
# 2. Déchiffrer
age -d -i flow-sauvegardes.key -o flow.dump flow-20261018T011500Z.dump.age
# 3. Contrôler, puis restaurer dans une base neuve
pg_restore --list flow.dump | head
createdb flow_relue
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -d flow_relue flow.dump
```

Vérifier une copie d'archive fiscale (`archives-fiscales/…`) :

```bash
age -d -i flow-sauvegardes.key fichier.json.gz.age | gunzip > archive.json
sha256sum archive.json                       # doit égaler "sha256" du .meta.json
# Signature : clé publique de l'éditeur (champ verification.publicKey de toute
# archive téléchargée depuis FLŌW, enregistrée dans editeur.pem)
jq -r .signature fichier.meta.json | base64 -d > signature.der
openssl dgst -sha256 -verify editeur.pem -signature signature.der archive.json   # « Verified OK »
```

## Ce qui a été testé, ce qui reste à tester sur le serveur

Testé en développement (PostgreSQL 16 local, age, rclone vers un dossier local à la place du S3, sans Docker) :

- sauvegarde complète : `pg_dump`, contrôle `pg_restore --list`, chiffrement age, envoi, copies mensuelle et annuelle, rétention (suppression des plus anciennes) ;
- copie des archives fiscales : empreinte recalculée identique, signature vérifiée avec `openssl dgst -verify` et la clé publique de l'éditeur, pas de nouvelle copie au deuxième passage ;
- restauration d'essai dans `flow_restore_test` : comptages identiques à la base d'origine (59 tables), suppression de la base d'essai, refus de viser la base de production, refus d'une mauvaise clé ;
- restauration « production » sur une base jetable : bascule par renommage, ancienne base conservée ;
- contrôle d'ancienneté : sauvegarde de 32 heures et absence de sauvegarde détectées.

À vérifier sur le serveur, à la première installation :

- construction de l'image `backup` (paquets Alpine `age`, `rclone`) et exécution par `crond` à l'heure prévue (`./deploy/flow logs backup` le lendemain) ;
- envoi réel vers votre stockage S3 (adresse, région, droits de la clé) ;
- réception d'un e-mail d'alerte (couper l'accès au stockage, lancer `controler-sauvegarde`, rétablir) et du ping de surveillance ;
- premier essai de restauration complet avec `./deploy/flow tester-restauration`.
