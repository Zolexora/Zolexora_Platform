import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core'
import { BullModule } from '@nestjs/bull'
import { PrismaModule }        from './prisma/prisma.module'
import { AuthModule }          from './modules/auth/auth.module'
import { UsersModule }         from './modules/users/users.module'
import { KYCModule }           from './modules/kyc/kyc.module'
import { PropertiesModule }    from './modules/properties/properties.module'
import { BookingsModule }      from './modules/bookings/bookings.module'
import { PaymentsModule }      from './modules/payments/payments.module'
import { ChatModule }          from './modules/chat/chat.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { MaintenanceModule }   from './modules/maintenance/maintenance.module'
import { AdminModule }         from './modules/admin/admin.module'
import { JwtAuthGuard, RolesGuard } from './modules/auth/guards/index'
import { ResponseInterceptor, AllExceptionsFilter } from './common/interceptors/index'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: () => {
        if (process.env.REDIS_URL) {
          const redisUrl = new URL(process.env.REDIS_URL)
          return {
            redis: {
              host: redisUrl.hostname,
              port: Number(redisUrl.port || 6379),
              username: redisUrl.username || undefined,
              password: redisUrl.password || undefined,
              tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
            },
          }
        }

        return {
          redis: {
            host: process.env.REDIS_HOST ?? 'localhost',
            port: Number(process.env.REDIS_PORT ?? 6379),
            password: process.env.REDIS_PASSWORD || undefined,
          },
        }
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    KYCModule,
    PropertiesModule,
    BookingsModule,
    PaymentsModule,
    ChatModule,
    NotificationsModule,
    MaintenanceModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD,       useClass: JwtAuthGuard },
    { provide: APP_GUARD,       useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER,      useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
