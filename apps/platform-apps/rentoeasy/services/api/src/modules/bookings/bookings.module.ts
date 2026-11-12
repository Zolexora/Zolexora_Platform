import { Module }             from '@nestjs/common'
import { BookingsController } from './bookings.controller'
import { BookingsService }    from './bookings.service'
import { AgreementService }   from './agreement.service'

@Module({
  controllers: [BookingsController],
  providers:   [BookingsService, AgreementService],
  exports:     [BookingsService],
})
export class BookingsModule {}
