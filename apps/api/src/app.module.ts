import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
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
import { TerminalsModule } from './terminals/terminals.module'
import { DataModule } from './data/data.module'
import { PaymentsModule } from './payments/payments.module'
import { HealthController } from './health/health.controller'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 20,
      },
    ]),

    EventEmitterModule.forRoot(),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get('REDIS_URL') ?? 'redis://localhost:6379',
      }),
    }),

    PrismaModule,
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
    PlatformModule,
    TerminalsModule,
    DataModule,
    PaymentsModule,
  ],
})
export class AppModule {}
