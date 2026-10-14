import { layoutTicket, type TicketModel } from './ticket'

// Epson ePOS-Print : l'imprimante (TM-m30, TM-T88VI...) reçoit le ticket en
// XML par HTTPS, directement depuis le navigateur, sans pont local.
// Point d'entrée : https://<adresse>/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000
const NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function eposDocument(t: TicketModel | null, o: { width?: number; cut?: boolean; openDrawer?: boolean; drawerPin?: 0 | 1 } = {}): string {
  const parts: string[] = []
  if (o.openDrawer) parts.push(`<pulse drawer="${o.drawerPin === 1 ? 'drawer_2' : 'drawer_1'}" time="pulse_100"/>`)
  if (t) {
    for (const line of layoutTicket(t, o.width ?? 48)) {
      parts.push(
        `<text align="${line.align === 'center' ? 'center' : 'left'}"/><text em="${line.bold ? 'true' : 'false'}"/><text dh="${line.big ? 'true' : 'false'}"/><text lang="fr">${xml(line.text)}&#10;</text>`,
      )
    }
    if (t.qr) {
      parts.push(`<text align="center"/><symbol type="qrcode_model_2" level="level_m" width="${(o.width ?? 48) >= 40 ? 6 : 4}">${xml(t.qr.url)}</symbol><text lang="fr">&#10;${xml(t.qr.caption)}&#10;</text>`)
    }
    parts.push('<feed line="3"/>')
    if (o.cut !== false) parts.push('<cut type="feed"/>')
  }
  return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="${NS}">${parts.join('')}</epos-print></s:Body></s:Envelope>`
}

export async function sendEpos(host: string, body: string, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`https://${host}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=${timeoutMs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body,
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok || !/success="true"/.test(text)) {
      const code = /code="([^"]*)"/.exec(text)?.[1]
      throw new Error(code ? `Imprimante Epson : ${code}` : `Imprimante Epson injoignable (${res.status})`)
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Imprimante Epson : pas de réponse')
    if (e instanceof TypeError) throw new Error(`Imprimante Epson injoignable à ${host}. Ouvrez https://${host} une fois pour accepter son certificat.`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}
