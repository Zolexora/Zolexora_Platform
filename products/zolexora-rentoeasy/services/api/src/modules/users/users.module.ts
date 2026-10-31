import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UploadService } from '../../config/upload.service'

@Module({
  imports: [
    // Files processed in memory — passed as Buffer to service
    // Never written to disk on the server
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB hard cap at multer level
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UploadService],
  exports: [UsersService, UploadService],
})
export class UsersModule {}
