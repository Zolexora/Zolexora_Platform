import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class MSG91Service {
  private readonly logger = new Logger(MSG91Service.name)
  private readonly baseUrl = 'https://control.msg91.com/api/v5'

  constructor(private config: ConfigService) {}

  async sendOTP(phone: string, otp: string): Promise<void> {
    const authKey    = this.config.get('MSG91_AUTH_KEY')
    const templateId = this.config.get('MSG91_OTP_TEMPLATE_ID')
    const senderId   = this.config.get('MSG91_SENDER_ID') ?? 'RSTAAY'

    try {
      await axios.post(
        `${this.baseUrl}/otp`,
        {
          template_id: templateId,
          mobile: `91${phone}`,
          authkey: authKey,
          otp,
          sender: senderId,
        },
        { timeout: 10000 },
      )
      this.logger.log(`OTP sent to 91${phone}`)
    } catch (err: any) {
      this.logger.error(`MSG91 OTP send failed: ${err?.message}`)
      // Don't throw — log and continue (don't leak infra errors to client)
    }
  }

  async sendSMS(phone: string, message: string): Promise<void> {
    const authKey  = this.config.get('MSG91_AUTH_KEY')
    const senderId = this.config.get('MSG91_SENDER_ID') ?? 'RSTAAY'

    try {
      await axios.post(
        `${this.baseUrl}/flow/`,
        {
          authkey: authKey,
          sender: senderId,
          mobiles: `91${phone}`,
          message,
        },
        { timeout: 10000 },
      )
    } catch (err: any) {
      this.logger.error(`MSG91 SMS send failed: ${err?.message}`)
    }
  }

  async sendWhatsApp(phone: string, templateId: string, params: Record<string, string>): Promise<void> {
    const authKey = this.config.get('MSG91_AUTH_KEY')

    try {
      await axios.post(
        `${this.baseUrl}/whatsapp/whatsapp-outbound-message/bulk/`,
        {
          integrated_number: this.config.get('MSG91_WHATSAPP_NUMBER'),
          content_type: 'template',
          payload: {
            to: `91${phone}`,
            type: 'template',
            template: { name: templateId, language: { code: 'en' }, components: [
              { type: 'body', parameters: Object.values(params).map(v => ({ type: 'text', text: v })) },
            ]},
          },
        },
        { headers: { authkey: authKey }, timeout: 10000 },
      )
    } catch (err: any) {
      this.logger.error(`MSG91 WhatsApp send failed: ${err?.message}`)
    }
  }
}
