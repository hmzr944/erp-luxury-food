import QRCode from 'qrcode'
import { layoutTicket, type TicketModel } from './ticket'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Impression par le système (imprimante USB ou installée sur l'ordinateur) :
// le ticket est mis en page à 80 mm dans un cadre invisible puis imprimé
export async function printWithSystem(t: TicketModel, width = 48): Promise<void> {
  const qr = t.qr ? await QRCode.toString(t.qr.url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : ''
  return new Promise((resolve) => {
    const lines =
      layoutTicket(t, width)
        .map((l) => `<div class="${[l.align === 'center' ? 'c' : '', l.bold ? 'b' : '', l.big ? 'g' : ''].join(' ')}">${esc(l.text) || '&nbsp;'}</div>`)
        .join('') + (t.qr ? `<div class="q">${qr}</div><div class="c">${esc(t.qr.caption)}</div>` : '')
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    const doc = frame.contentDocument!
    doc.open()
    doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: 80mm auto; margin: 3mm }
      body { margin: 0; font: 11px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #000; white-space: pre }
      .c { text-align: center } .b { font-weight: 700 } .g { font-size: 14px }
      .q { width: 30mm; margin: 3mm auto 1mm } .q svg { display: block; width: 100%; height: auto }
    </style></head><body>${lines}</body></html>`)
    doc.close()
    const done = () => {
      setTimeout(() => frame.remove(), 1000)
      resolve()
    }
    frame.contentWindow!.addEventListener('afterprint', done, { once: true })
    setTimeout(() => {
      frame.contentWindow!.focus()
      frame.contentWindow!.print()
      // Certains navigateurs n'émettent pas afterprint : on rend la main quand même
      setTimeout(done, 3000)
    }, 50)
  })
}
