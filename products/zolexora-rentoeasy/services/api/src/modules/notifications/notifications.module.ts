import { Module }          from '@nestjs/common'
import { BullModule }      from '@nestjs/bull'
import { Process, Processor } from '@nestjs/bull'
import { Job }             from 'bull'
import { NotificationsService, NotificationsController } from './notifications.service'
import { MSG91Service }    from '../../config/msg91.service'

// BullMQ processor — picks jobs off the queue and calls processNotification
@Processor('notifications')
export class NotificationsProcessor {
  constructor(private svc: NotificationsService) {}

  @Process('send')
  async handleSend(job: Job<{ userId: string; type: any; payload: Record<string, string> }>) {
    const { userId, type, payload } = job.data
    await this.svc.processNotification(userId, type, payload)
  }
}

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [NotificationsController],
  providers:   [NotificationsService, NotificationsProcessor, MSG91Service],
  exports:     [NotificationsService],
})
export class NotificationsModule {}
