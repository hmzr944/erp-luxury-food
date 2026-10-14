import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { DisplaysController, DisplaysPublicController } from './displays.controller'
import { DisplaysGateway } from './displays.gateway'
import { DisplaysService } from './displays.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [DisplaysPublicController, DisplaysController],
  providers: [DisplaysService, DisplaysGateway],
})
export class DisplaysModule {}
