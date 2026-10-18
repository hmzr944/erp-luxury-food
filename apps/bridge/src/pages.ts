// Page d'accueil du pont (https://<adresse>:51717/ ou http://<adresse>:51717/) :
// télécharger le certificat de l'autorité et vérifier la connexion sécurisée.
// Aucune ressource externe, aucun script.

import { NAME, VERSION } from './version.js'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface HomePageInput {
  secure: boolean
  ca?: { fingerprint: string; label: string }
  port: number
  lan: boolean
  addresses: string[]
}

export function renderHomePage({ secure, ca, port, lan, addresses }: HomePageInput): string {
  const status = secure
    ? `<p class="ok">Connexion chiffrée établie. Si le navigateur n’a affiché aucun avertissement, le certificat du pont est approuvé sur cet appareil : la caisse peut s’y connecter.</p>`
    : `<p class="warn">Connexion non chiffrée. Pour que Safari (Mac, iPad, iPhone) accepte le pont, installez puis approuvez son certificat.</p>`
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
<title>${esc(NAME)}</title>
<style>
:root{color-scheme:light dark;--bg:#faf9f7;--fg:#1c1b19;--muted:#5f5b55;--accent:#1f5f4a;--on:#fff;--line:#d9d5ce;--ok:#1f5f4a;--warn:#8a4b00}
@media (prefers-color-scheme:dark){:root{--bg:#161514;--fg:#f2f0ec;--muted:#b3aea6;--accent:#7fc8ab;--on:#10241d;--line:#3a3733;--ok:#7fc8ab;--warn:#f0b46b}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:34rem;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:24px 0 8px}
.small{color:var(--muted);font-size:14px}.ok{color:var(--ok);font-weight:600}.warn{color:var(--warn);font-weight:600}
.btn{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:10px;background:var(--accent);color:var(--on);font-weight:600;text-decoration:none;padding:0 16px}
.btn.alt{background:transparent;color:var(--fg);border:1px solid var(--line)}
.fp{font:13px/1.4 ui-monospace,Menlo,monospace;word-break:break-all;border:1px solid var(--line);border-radius:8px;padding:8px}
a{color:var(--accent)}
</style>
</head>
<body>
<main>
<h1>${esc(NAME)}</h1>
<p class="small">Version ${esc(VERSION)}. Pont entre la caisse FLŌW et le matériel de la boutique.</p>
${status}
${cert}
${network}
</main>
</body>
</html>
`
}
