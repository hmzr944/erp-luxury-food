import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { encryptSecret, readSecret } from '../common/crypto/secrets'

interface LoadedKey {
  keyId: string
  privateKey: KeyObject
  publicKeyPem: string
}

// Clé de signature de l'éditeur (ECDSA P-256) : scelle les archives fiscales
// et les attestations. En production, FISCAL_SIGNING_KEY (PEM PKCS8) fixe la
// clé ; à défaut, une clé est générée une fois et gardée chiffrée en base.
@Injectable()
export class SigningKeyService {
  private readonly logger = new Logger(SigningKeyService.name)
  private loaded: Promise<LoadedKey> | null = null

  constructor(private prisma: PrismaService) {}

  key(): Promise<LoadedKey> {
    this.loaded ??= this.load()
    return this.loaded
  }

  async sign(data: Buffer | string): Promise<{ signature: string; keyId: string }> {
    const k = await this.key()
    const signature = sign('sha256', typeof data === 'string' ? Buffer.from(data) : data, { key: k.privateKey, dsaEncoding: 'der' })
    return { signature: signature.toString('base64'), keyId: k.keyId }
  }

  async verify(data: Buffer | string, signature: string): Promise<boolean> {
    const k = await this.key()
    return verify('sha256', typeof data === 'string' ? Buffer.from(data) : data, { key: createPublicKey(k.publicKeyPem), dsaEncoding: 'der' }, Buffer.from(signature, 'base64'))
  }

  async publicKey(): Promise<{ keyId: string; publicKeyPem: string; algorithm: string }> {
    const k = await this.key()
    return { keyId: k.keyId, publicKeyPem: k.publicKeyPem, algorithm: 'ECDSA P-256, SHA-256, signature DER en base64' }
  }

  private async load(): Promise<LoadedKey> {
    const env = process.env.FISCAL_SIGNING_KEY
    if (env) {
      const privateKey = createPrivateKey(env.replace(/\\n/g, '\n'))
      const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString()
      return { keyId: keyIdOf(publicKeyPem), privateKey, publicKeyPem }
    }
    const stored = await this.prisma.signingKey.findFirst({ orderBy: { createdAt: 'asc' } })
    if (stored) return { keyId: stored.keyId, privateKey: createPrivateKey(readSecret(stored.privateKey)), publicKeyPem: stored.publicKey }

    if (process.env.NODE_ENV === 'production') this.logger.warn('FISCAL_SIGNING_KEY absente : clé de l’éditeur générée et gardée chiffrée en base')
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const keyId = keyIdOf(publicKeyPem)
    await this.prisma.signingKey.upsert({
      where: { keyId },
      create: { keyId, publicKey: publicKeyPem, privateKey: encryptSecret(privatePem) },
      update: {},
    })
    // Deux instances démarrées ensemble : on garde la première clé enregistrée
    const first = await this.prisma.signingKey.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })
    return { keyId: first.keyId, privateKey: createPrivateKey(readSecret(first.privateKey)), publicKeyPem: first.publicKey }
  }
}

const keyIdOf = (pem: string) => createHash('sha256').update(pem).digest('hex').slice(0, 16)
