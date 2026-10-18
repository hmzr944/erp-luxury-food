// Quel navigateur doit approuver le certificat du pont ?
// Safari (et tout navigateur sur iPhone ou iPad, qui reposent sur WebKit)
// exige wss:// avec un certificat approuvé. Chrome, Edge et Firefox joignent
// le pont en ws:// sur cet ordinateur : rien à faire.

export type BridgePlatform = 'ios' | 'ipados' | 'macos-safari' | 'other'

export function detectBridgePlatform(userAgent: string, maxTouchPoints = 0): BridgePlatform {
  if (/iPhone|iPod/.test(userAgent)) return 'ios'
  // iPadOS se présente comme un Mac : seul l'écran tactile le trahit
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ipados'
  if (/Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR/.test(userAgent)) {
    return 'macos-safari'
  }
  return 'other'
}
