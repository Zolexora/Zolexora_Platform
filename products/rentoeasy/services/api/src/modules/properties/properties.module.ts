import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { PropertiesController } from './properties.controller'
import { PropertiesService }    from './properties.service'
import { UploadService }        from '../../config/upload.service'

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB per photo
    }),
  ],
  controllers: [PropertiesController],
  providers:   [PropertiesService, UploadService],
  exports:     [PropertiesService],
})
export class PropertiesModule {}
