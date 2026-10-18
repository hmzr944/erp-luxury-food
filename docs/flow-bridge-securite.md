# FLŌW-Bridge : connexion sécurisée (Safari, iPad) et accès réseau

La caisse FLŌW est servie en `https`. Safari (Mac, iPad, iPhone) refuse alors un WebSocket `ws://` (contenu mixte) et refuse un `wss://` dont le certificat n'est pas approuvé. Chrome, Edge et Firefox acceptent `ws://127.0.0.1` depuis une page `https`, Safari non. Un iPad, lui, ne peut pas joindre `127.0.0.1` de l'ordinateur de la boutique : le pont doit être joignable sur le réseau local.

Décision produit : aucune bibliothèque externe. Le pont fabrique lui-même son certificat (Node.js seul) et la caisse explique, appareil par appareil, comment l'approuver une fois.

## Fonctionnement

### Certificats fabriqués par le pont (`apps/bridge/src/cert.ts`, `der.ts`)

Au premier démarrage, dans `~/.flow-bridge/tls/` (ou `FLOW_BRIDGE_HOME/tls/`) :

| Fichier | Contenu | Droits |
| --- | --- | --- |
| `autorite.pem` | autorité racine « FLŌW-Bridge (nom de l'ordinateur) », à installer sur les appareils | 0644 |
| `autorite-cle.pem` | sa clé privée, qui ne quitte jamais l'ordinateur | 0600 |
| `serveur.pem`, `serveur-cle.pem` | certificat du pont, signé par l'autorité | 0644 / 0600 |

Le dossier `tls` est en 0700. Sous Windows, les droits POSIX n'existent pas : la protection est celle du profil de l'utilisateur.

- **Clés** : courbe elliptique P-256, signatures ECDSA SHA-256 (`crypto.generateKeyPairSync`, `crypto.sign`). Le certificat X.509 v3 est écrit en DER par un petit encodeur ASN.1 maison.
- **Autorité** : dix ans, `basicConstraints` critique (CA, aucune autorité intermédiaire), `keyUsage` critique (signature de certificats et de listes de révocation), `extKeyUsage` serverAuth, et une extension critique **Name Constraints** qui ne permet que :
  - les noms `localhost` et `*.local` (Bonjour) ;
  - les adresses `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (lien local, iPad relié en direct) ;
  - en IPv6, `::1`, `fe80::/10` et `fc00::/7`. Sans contrainte IPv6, toute adresse IPv6 serait permise (RFC 5280).
- **Certificat du pont** : 397 jours (Apple exige 825 jours au plus pour un certificat TLS), `extKeyUsage` serverAuth, `keyUsage` digitalSignature, noms : `localhost`, `<nom-de-l-ordinateur>.local`, `127.0.0.1`, `::1` et les adresses IPv4 privées actuelles de l'ordinateur. Une adresse hors des contraintes (adresse publique) n'est jamais ajoutée : elle ferait refuser tout le certificat.
- **Renouvellement automatique** : toutes les 5 minutes, le pont vérifie que son certificat couvre les adresses actuelles, qu'il est signé par l'autorité et qu'il reste plus de 30 jours. Sinon il en refait un, chargé à chaud (`setSecureContext`), sans redémarrer. L'autorité, elle, est conservée : rien à réapprouver.

### Un seul port, chiffré ou non

Le port 51717 parle les deux : le premier octet de chaque connexion dit s'il s'agit de TLS (`0x16`). Ce choix garde :

- **Chrome, Edge, Firefox** sur `ws://127.0.0.1:51717`, sans rien installer (vérifié dans Chromium : même avec `upgrade-insecure-requests`, `ws://127.0.0.1` n'est pas transformé en `wss://`) ;
- **Safari** sur `wss://127.0.0.1:51717` une fois l'autorité approuvée ;
- un seul port à ouvrir dans le pare-feu, et une page de certificat joignable en `http://` comme en `https://`.

La caisse essaie `wss://` d'abord, puis `ws://` pour cet ordinateur, et garde celle qui répond (`apps/web/src/lib/bridge/client.ts`). Vers un autre ordinateur (iPad), `wss://` seulement.

`FLOW_BRIDGE_TLS=0` revient à l'ancien fonctionnement (`ws://` local seulement). `FLOW_BRIDGE_CERT` / `FLOW_BRIDGE_KEY` remplacent le certificat fabriqué par un certificat fourni.

### Accès réseau pour les iPad

Fermé par défaut : le pont n'écoute que sur `127.0.0.1`. On l'ouvre :

- depuis la caisse de l'ordinateur du pont : Réglages, FLŌW-Bridge, « Accès des iPad du magasin », Ouvrir l'accès (méthode `bridge.setLan`, acceptée seulement depuis cet ordinateur, réglage mémorisé) ;
- ou `flow-bridge reseau oui` (au prochain démarrage), `flow-bridge --reseau` (pour ce lancement), `FLOW_BRIDGE_LAN=1` (l'emporte sur le réglage).

Le pont écoute alors sur `0.0.0.0:51717` et affiche au démarrage l'adresse à saisir sur l'iPad et l'adresse du certificat. Le Mac ou Windows peut demander d'autoriser les connexions entrantes pour FLŌW-Bridge (pare-feu) : il faut accepter, sur les réseaux privés seulement.

## Approuver le certificat, appareil par appareil

La caisse affiche la procédure adaptée (`apps/web/src/components/settings/BridgePairing.tsx`) et un bouton « Tester la connexion sécurisée ». Libellés relevés sur les pages d'assistance d'Apple en français (octobre 2026).

### iPad et iPhone (Safari, et tout navigateur iOS, qui repose sur WebKit)

1. Sur l'iPad, dans Safari, ouvrir `http://<adresse-du-pont>:51717/certificat` et toucher « Autoriser » pour télécharger le profil.
2. Dans les 8 minutes : ouvrir Réglages, toucher « Profil téléchargé », puis « Installer » en haut à droite, et suivre les instructions.
3. Réglages, Général, Informations, Réglages des certificats : sous « Activer la confiance totale pour les certificats racine », activer « FLŌW-Bridge (…) ».
4. Revenir sur la caisse et toucher « Tester la connexion sécurisée ».

Sources : [Installer un profil de configuration sur votre iPhone, iPad ou Apple Vision Pro](https://support.apple.com/fr-fr/102400) (étapes 2, délai de 8 minutes, un seul profil en attente à la fois ; la même page signale qu'il peut falloir désactiver la Protection en cas de vol de l'appareil hors d'un lieu familier) et [Approuver les profils de certificat installés manuellement sous iOS, iPadOS et visionOS](https://support.apple.com/fr-fr/102390) (étape 3). Le libellé « Autoriser » de l'alerte de téléchargement n'est pas décrit par Apple : à confirmer sur un iPad.

Le profil (`application/x-apple-aspen-config`) est non signé et ne contient que le certificat racine (charge utile `com.apple.security.root`). Son identifiant est dérivé de l'empreinte de l'autorité : le réinstaller remplace l'ancien.

### Safari sur Mac

1. Télécharger le certificat du pont (`http://127.0.0.1:51717/certificat/flow-bridge.cer`, format DER `application/x-x509-ca-cert`) et l'ouvrir depuis Téléchargements : l'app Trousseaux d'accès l'ajoute.
2. Dans Trousseaux d'accès, double-cliquer sur « FLŌW-Bridge (…) », déplier « Se fier » et choisir « Toujours approuver ». Fermer la fenêtre et confirmer avec le mot de passe du Mac.
3. Revenir sur la caisse et cliquer sur « Tester la connexion sécurisée ».

Sources : [Modifier les réglages de confiance d'un certificat dans Trousseaux d'accès sur Mac](https://support.apple.com/fr-fr/guide/keychain-access/kyca11871/mac) (nom de l'app, section « Se fier ») et [Modifier des politiques de confiance concernant les certificats sur Mac](https://support.apple.com/fr-fr/guide/keychain-access/mchlp2824/mac) (« Toujours approuver »). Le titre exact du premier menu local n'est pas cité par Apple, d'où « choisir Toujours approuver » sans le nommer.

Pourquoi pas le profil sur Mac : depuis macOS 13, une racine installée par profil n'est pas approuvée pour TLS, il faut de toute façon passer par Trousseaux d'accès ([Introduction à la gestion des certificats pour les appareils Apple](https://support.apple.com/fr-fr/guide/deployment/depb5eff8914/web)). Et l'emplacement des profils a changé selon les versions (macOS actuel : Réglages Système, Général, Gestion de l'appareil, section Téléchargé, d'après [cette page](https://support.apple.com/fr-fr/guide/mac-help/mh35561/mac)). Le `.cer` est plus direct.

Raccourci sur le Mac du pont, pour un technicien : `flow-bridge cert --approuver` lance `security add-trusted-cert -r trustRoot -p ssl` sur le trousseau de session ; macOS demande le mot de passe. Non testé sur un Mac.

### Chrome, Edge, Firefox

Rien à faire sur l'ordinateur du pont (`ws://127.0.0.1`). Pour joindre un pont situé sur un autre ordinateur depuis ces navigateurs, la connexion est en `wss://` : il faut installer le certificat dans le magasin de certificats du système (ou de Firefox).

### Le test de connexion

« Tester la connexion sécurisée » ouvre un `wss://` à part et envoie `bridge.hello` :

- réponse : certificat approuvé et appareil appairé, ou certificat approuvé et appairage à faire ;
- fermeture `4003` : certificat approuvé, mais le site n'est pas dans `FLOW_BRIDGE_ORIGINS` ;
- échec sans réponse : le navigateur ne dit jamais pourquoi. La caisse propose alors d'ouvrir `https://<adresse>:51717/` : un avertissement de connexion non privée veut dire certificat non approuvé ; une page introuvable veut dire pont éteint, autre réseau ou accès réseau fermé.

## Modèle de sécurité

- **Clé de l'autorité** : créée sur place, jamais transmise (ni à FLŌW ni aux appareils), lisible par le seul utilisateur. `flow-bridge cert --renouveler` en crée une nouvelle si elle a pu fuiter ; il faut alors réapprouver chaque appareil.
- **Contraintes de noms** : même volée, la clé ne permet de signer que pour `localhost`, `*.local` et des adresses privées. Vérifié ici avec OpenSSL 3.0 (un certificat signé par l'autorité pour `banque.example.com` / `8.8.8.8` est refusé : « permitted subtree violation », test `cert.test.ts`). Pour Apple : le code publié de `trustd` (dépôt `apple-oss-distributions/Security`, `trust/trustd/SecPolicyServer.c` et `nameconstraints.c`) initialise les sous-arbres permis à partir de ceux de l'ancre de confiance quand elle est approuvée, y compris par l'utilisateur, et compare les noms DNS par suffixe d'étiquettes et les adresses IP par masque. **Non vérifié sur un appareil** : à confirmer sur un vrai iPad et un vrai Mac (voir plus bas). Les contraintes ne disent rien des adresses privées des autres réseaux : une clé volée permettrait d'usurper un appareil d'un réseau local, pas un site public.
- **Le pont refuse le clair depuis le réseau** : depuis une autre machine, seuls la page d'accueil et le certificat de l'autorité (publics par nature) sont servis en `http://` ; un WebSocket en clair est fermé (`4004`) ; `/health` n'est pas servi.
- **Appairage obligatoire** et limité : depuis le réseau, 10 essais par appareil par quart d'heure (`rate_limited`) ; partout, 5 codes faux annulent le code et bloquent l'appairage, la pause doublant à chaque blocage (30 s, 1 min, 2 min… jusqu'à 1 h). L'en-tête `Origin` ne protège pas contre un programme du réseau (il peut le falsifier) : c'est le code et le jeton qui protègent.
- **En-tête Host** : seulement les noms de cet ordinateur (`localhost`, `127.0.0.1`, `<nom>.local`, ses adresses privées) : contre le « DNS rebinding ».
- **Téléchargement du certificat en `http://`** : un attaquant présent sur le réseau du magasin pourrait substituer sa propre autorité. Parade : l'empreinte SHA-256 est affichée dans la fenêtre du pont, sur la page du pont et dans les réglages de la caisse de l'ordinateur du pont, et elle figure dans la description du profil iOS. À comparer en cas de doute (l'affichage des détails du certificat par iOS avant installation reste à vérifier sur un iPad).
- **Limites** : 64 connexions WebSocket simultanées, 10 s pour envoyer le premier octet d'une connexion.

## Ce qui reste à valider sur du vrai matériel

Ce bac à sable n'a ni Mac ni iPad. Vérifié ici : certificats (OpenSSL `x509 -text`, `verify -CAfile`, `s_client -verify_return_error`, `X509Certificate` de Node.js), client `ws` avec l'autorité en `wss://localhost` et `wss://127.0.0.1`, écoute réseau sur une autre adresse de la machine, exécutable Linux autonome (essai de fumée en `wss://`), interface dans Chromium. À faire :

1. **Safari sur Mac** (macOS 15 et 26) : procédure `.cer`, puis connexion `wss://127.0.0.1:51717` depuis la caisse en `https` ; vérifier que Trousseaux d'accès accepte une racine EC P-256 avec contraintes de noms critiques.
2. **iPad réel** (iPadOS 18 et 26) : téléchargement du profil depuis `http://<ip>:51717/certificat`, libellés exacts (« Autoriser », « Profil téléchargé »), activation de la confiance totale, connexion `wss://<ip>:51717`. Vérifier aussi l'autorisation « Réseau local » d'iOS pour Safari.
3. **Contraintes de noms chez Apple** : signer avec l'autorité un certificat pour un nom public et vérifier que Safari le refuse.
4. **Pare-feu** : alerte macOS et Windows lors de l'ouverture de l'accès réseau.
5. **Chrome sur tablette Android** vers un pont du réseau : Chrome demande une autorisation d'accès au réseau local ; le certificat doit être installé dans Android.
6. Exécutables macOS et Windows : relancer l'essai de fumée (qui vérifie maintenant le `wss://`) dans le workflow.
