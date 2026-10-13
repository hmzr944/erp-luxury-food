import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { json } from 'express'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'

// Refuse de démarrer en production avec des secrets absents, courts ou d'exemple
function checkSecrets() {
  if (process.env.NODE_ENV !== 'production') return
  const weak = (v: string | undefined) => !v || v.length < 32 || /change|example|secret|dev/i.test(v)
  const problems = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'PIN_SECRET', 'SECRETS_KEY'].filter((k) => weak(process.env[k]))
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) problems.push('JWT_REFRESH_SECRET identique à JWT_SECRET')
  if (problems.length) {
    console.error(`Secrets à définir (32 caractères aléatoires minimum) : ${problems.join(', ')}`)
    process.exit(1)
  }
}

async function bootstrap() {
  checkSecrets()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Corps brut conservé pour vérifier la signature des webhooks Stripe
    rawBody: true,
  })
  // Derrière un répartiteur de charge : l'IP réelle du client (limitation
  // des requêtes, journal d'audit). Nombre de relais à déclarer.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)
  app.disable('x-powered-by')
  // Import de catalogue : un fichier CSV de quelques milliers de lignes.
  // Ailleurs, 256 Ko suffisent largement.
  app.use(/^\/api\/sites\/[^/]+\/data\/import/, json({ limit: '3mb' }))
  app.useBodyParser('json', { limit: '256kb' })

  app.use(
    helmet({
      // API JSON : aucune page à afficher, tout est refusé par défaut
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  )

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  })

  app.useGlobalFilters(new GlobalExceptionFilter())
  app.setGlobalPrefix('api')

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`API running on http://localhost:${port}/api`)
}

bootstrap()
