import { Module }      from '@nestjs/common'
import { JwtModule }   from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ChatGateway }    from './chat.gateway'
import { ChatService, ChatController } from './chat.service'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret:       c.get('JWT_ACCESS_SECRET'),
        signOptions:  { expiresIn: c.get('JWT_ACCESS_EXPIRES') ?? '15m' },
      }),
    }),
  ],
  controllers: [ChatController],
  providers:   [ChatGateway, ChatService],
  exports:     [ChatGateway],
})
export class ChatModule {}
