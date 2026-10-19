// Page d'accueil du pont (https://<adresse>:51717/ ou http://<adresse>:51717/) :
// télécharger le certificat de l'autorité et vérifier la connexion sécurisée.
// Ouverte sur l'ordinateur du pont lui-même (boucle locale), elle montre
// aussi le code d'appairage et l'état du matériel : lire ce code prouve
// l'accès physique à l'ordinateur, il n'est jamais montré au réseau local.
// Aucune ressource externe, aucun script.

import { formatCode } from './pairing.js'
import { NAME, VERSION } from './version.js'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Chemin du formulaire « Nouveau code » (POST, boucle locale seulement)
export const NEW_CODE_PATH = '/appairage/nouveau-code'

export interface LocalStatus {
  // Code d'appairage courant et sa fin de validité (ms depuis 1970)
  code: string | null
  expiresAt: number | null
  clients: Array<{ name: string; lastSeenAt?: string }>
  printer: { host: string; port: number; ok: boolean; at: string } | null
  tpe: { label: string; at?: string } | null
  // « Ouvrir la caisse » : avec le code dans le fragment s'il y en a un
  openUrl?: string
  // Jeton du formulaire, contre les requêtes intersites
  formToken: string
}

export interface HomePageInput {
  secure: boolean
  ca?: { fingerprint: string; label: string }
  port: number
  lan: boolean
  addresses: string[]
  // Présent seulement pour une requête venue de la boucle locale
  local?: LocalStatus
}

function time(iso: string | number): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function day(iso: string): string {
  const d = new Date(iso)
  return new Date().toDateString() === d.toDateString() ? `aujourd’hui à ${time(iso)}` : `le ${d.toLocaleDateString('fr-FR')}`
}

function renderLocal(s: LocalStatus, port: number): string {
  const code = s.code
    ? `<p class="code" aria-label="Code d’appairage">${esc(formatCode(s.code))}</p>
<p class="small">Valable jusqu’à ${esc(time(s.expiresAt ?? Date.now()))}, une seule fois. Saisissez-le sur la caisse, ou cliquez sur « Ouvrir la caisse » : elle le reprend seule.</p>`
    : `<p class="small">Aucun code en cours. Demandez-en un pour appairer une nouvelle caisse ou un iPad.</p>`
  const form = `<form method="post" action="${NEW_CODE_PATH}">
<input type="hidden" name="jeton" value="${esc(s.formToken)}">
<button class="btn alt" type="submit">${s.code ? 'Nouveau code' : 'Afficher un code'}</button>
</form>`
  const open = s.openUrl ? `<p><a class="btn" href="${esc(s.openUrl)}" rel="noreferrer">Ouvrir la caisse</a></p>` : ''
  const clients = s.clients.length
    ? `<ul>${s.clients.map((c) => `<li>${esc(c.name)}${c.lastSeenAt ? ` <span class="small">vue ${esc(day(c.lastSeenAt))}</span>` : ''}</li>`).join('')}</ul>`
    : `<p class="small">Aucune caisse appairée pour l’instant.</p>`
  const printer = s.printer
    ? `${s.printer.ok ? 'Dernier ticket imprimé' : 'Dernier ticket en échec'} sur <b>${esc(s.printer.host)}:${s.printer.port}</b> à ${esc(time(s.printer.at))}`
    : 'Aucun ticket imprimé depuis le démarrage du pont.'
  const tpe = s.tpe ? `<b>${esc(s.tpe.label)}</b>` : 'Aucun TPE enregistré. Choisissez-le dans les réglages de la caisse (Matériel).'
  return `<h2>Appairer une caisse</h2>
${code}
${open}
${form}
<h2>État</h2>
<dl>
<dt>Caisses appairées</dt><dd>${clients}</dd>
<dt>Imprimante</dt><dd>${printer}</dd>
<dt>Terminal de paiement</dt><dd>${tpe}</dd>
</dl>
<p class="small">Cette page n’est complète que sur cet ordinateur (http://127.0.0.1:${port}/). Depuis un iPad, le code n’est jamais affiché.</p>`
}

export function renderHomePage({ secure, ca, port, lan, addresses, local }: HomePageInput): string {
  const status = secure
    ? `<p class="ok">Connexion chiffrée établie. Si le navigateur n’a affiché aucun avertissement, le certificat du pont est approuvé sur cet appareil : la caisse peut s’y connecter.</p>`
    : `<p class="warn">Connexion non chiffrée. Pour que Safari (Mac, iPad, iPhone) accepte le pont, installez puis approuvez son certificat.</p>`
  const pairing = local
    ? renderLocal(local, port)
    : `<h2>Appairer cet appareil</h2>
<p class="small">Le code d’appairage s’affiche uniquement sur l’ordinateur où tourne le pont : ouvrez-y la page http://127.0.0.1:${port}/ (ou regardez sa fenêtre), puis saisissez le code sur cet appareil.</p>`
  const cert = ca
    ? `<h2>Certificat du pont</h2>
<p><a class="btn" href="/certificat">Installer sur iPad ou iPhone</a></p>
<p><a class="btn alt" href="/certificat/flow-bridge.cer">Certificat pour Mac (.cer)</a></p>
<p class="small">Autorité « ${esc(ca.label)} », valable uniquement pour les adresses du réseau local.
Empreinte SHA-256, à comparer avec celle affichée dans la fenêtre du pont :</p>
<p class="fp">${esc(ca.fingerprint)}</p>
<p class="small"><a href="/certificat/flow-bridge.pem">Format PEM</a></p>`
    : `<p class="small">Ce pont utilise un certificat fourni par l’administrateur : rien à installer ici.</p>`
  const network = lan
    ? `<p class="small">Accès réseau ouvert. Adresse${addresses.length > 1 ? 's' : ''} du pont pour les iPad : ${addresses.map((a) => `<b>${esc(a)}</b>`).join(', ') || 'aucune adresse locale détectée'} (port ${port}).</p>`
    : `<p class="small">Accès réseau fermé : seul cet ordinateur peut joindre le pont.</p>`
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${local ? '<meta http-equiv="refresh" content="60">\n' : ''}<title>${esc(NAME)}</title>
<style>
:root{color-scheme:light dark;--bg:#F4EFE6;--fg:#1C1726;--muted:#5a5466;--accent:#4B2BD6;--on:#fff;--line:#d8d0c2;--ok:#2f6b4f;--warn:#8a4b00}
@media (prefers-color-scheme:dark){:root{--bg:#1C1726;--fg:#F4EFE6;--muted:#b9b2c4;--accent:#a99bff;--on:#1C1726;--line:#3d3550;--ok:#8fd1ae;--warn:#f0b46b}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:34rem;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:24px 0 8px}
.small{color:var(--muted);font-size:14px}.ok{color:var(--ok);font-weight:600}.warn{color:var(--warn);font-weight:600}
.btn{display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;min-height:44px;border-radius:10px;border:0;background:var(--accent);color:var(--on);font:inherit;font-weight:600;text-decoration:none;padding:0 16px;cursor:pointer}
.btn.alt{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.code{font:600 44px/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;margin:8px 0}
.fp{font:13px/1.4 ui-monospace,Menlo,monospace;word-break:break-all;border:1px solid var(--line);border-radius:8px;padding:8px}
dl{margin:0}dt{font-weight:600;margin-top:12px}dd{margin:2px 0 0}ul{margin:0;padding-left:20px}
a{color:var(--accent)}
</style>
</head>
<body>
<main>
<h1>${esc(NAME)}</h1>
<p class="small">Version ${esc(VERSION)}. Pont entre la caisse FLŌW et le matériel de la boutique.</p>
${pairing}
<h2>Connexion</h2>
${status}
${cert}
${network}
</main>
</body>
</html>
`
}
