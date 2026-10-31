import { Module }             from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService }    from './payments.service'
import { RazorpayService }    from './razorpay.service'
import { ReceiptService }     from './receipt.service'
import { UploadService }      from '../../config/upload.service'
import { MSG91Service }       from '../../config/msg91.service'

@Module({
  controllers: [PaymentsController],
  providers:   [PaymentsService, RazorpayService, ReceiptService, UploadService, MSG91Service],
  exports:     [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
