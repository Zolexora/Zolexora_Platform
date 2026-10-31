import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { KYCController } from './kyc.controller'
import { KYCService } from './kyc.service'
import { UploadService } from '../../config/upload.service'

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [KYCController],
  providers:   [KYCService, UploadService],
  exports:     [KYCService],
})
export class KYCModule {}
