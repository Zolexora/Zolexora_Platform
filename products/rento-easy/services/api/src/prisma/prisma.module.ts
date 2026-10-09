import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global() // available in every module without importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
