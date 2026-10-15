import { AuditModule } from './audit/audit.module'
import { CashModule } from './cash/cash.module'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { WorkspaceInterceptor } from './common/access/workspace.interceptor'
import { SupplyModule } from './supply/supply.module'
import { BillingModule } from './billing/billing.module'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { BullModule } from '@nestjs/bull'
import { PrismaModule } from './common/prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { SitesModule } from './sites/sites.module'
import { UsersModule } from './users/users.module'
import { ComplianceModule } from './compliance/compliance.module'
import { PrintingModule } from './printing/printing.module'
import { ProductsModule } from './products/products.module'
import { OrdersModule } from './orders/orders.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { StockModule } from './stock/stock.module'
import { AllergensModule } from './allergens/allergens.module'
import { B2BModule } from './b2b/b2b.module'
import { ApiTokensModule } from './api-tokens/api-tokens.module'
import { WebhooksModule } from './webhooks/webhooks.module'
import { InvoicesModule } from './invoices/invoices.module'
import { PlatformModule } from './platform/platform.module'
import { MailModule } from './common/mail/mail.module'
import { ReceiptsModule } from './receipts/receipts.module'
import { CompaniesModule } from './companies/companies.module'
import { RoutinesModule } from './routines/routines.module'
import { TerminalsModule } from './terminals/terminals.module'
import { DataModule } from './data/data.module'
import { PaymentsModule } from './payments/payments.module'
import { DisplaysModule } from './displays/displays.module'
import { CustomersModule } from './customers/customers.module'
import { SupportModule } from './support/support.module'
import { HealthController } from './health/health.controller'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      // Une seule limite générale ; les routes sensibles (connexion, codes)
      // la resserrent avec @Throttle
      { name: 'default', ttl: 60_000, limit: 600 },
    ]),

    EventEmitterModule.forRoot(),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get('REDIS_URL') ?? 'redis://localhost:6379',
      }),
    }),

    PrismaModule,
    DisplaysModule,
    MailModule,
    ReceiptsModule,
    CompaniesModule,
    RoutinesModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    SitesModule,
    UsersModule,
    ComplianceModule,
    PrintingModule,
    ProductsModule,
    OrdersModule,
    DashboardModule,
    StockModule,
    AllergensModule,
    B2BModule,
    ApiTokensModule,
    WebhooksModule,
    InvoicesModule,
    BillingModule,
    SupplyModule,
    PlatformModule,
    TerminalsModule,
    DataModule,
    PaymentsModule,
    CashModule,
    CustomersModule,
    SupportModule,
  ],
  // Espaces par rôle (vendeur, atelier, gérant), vérifiés sur chaque route
  providers: [
    { provide: APP_INTERCEPTOR, useClass: WorkspaceInterceptor },
    // Limite générale par adresse : large pour la synchronisation d'une
    // caisse revenue en ligne, mais bloque les rafales automatisées
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
