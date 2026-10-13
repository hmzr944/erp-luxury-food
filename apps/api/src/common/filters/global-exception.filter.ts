import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message ?? exception.message
        : 'Erreur interne du serveur'

    // Log les 5xx uniquement (les 4xx sont normaux)
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} ${status} — ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      )

      // En production, on pourrait envoyer à Sentry ici
      // SentrySDK.captureException(exception)
    }

    // Champs utiles à l'écran (ex. écart de caisse, numéro attendu) conservés
    const body = exception instanceof HttpException ? exception.getResponse() : null
    const extra =
      body && typeof body === 'object'
        ? Object.fromEntries(Object.entries(body).filter(([k]) => !['statusCode', 'message', 'error'].includes(k)))
        : {}

    res.status(status).json({
      ...extra,
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      path: req.url,
      timestamp: new Date().toISOString(),
    })
  }
}
