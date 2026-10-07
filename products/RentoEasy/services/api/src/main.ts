import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Global prefix + versioning
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // CORS — allow all 5 apps + mobile
  const allowedOrigins = [
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3003',
  
    process.env.TENANT_WEB_URL,
    process.env.OWNER_WEB_URL,
    process.env.ADMIN_WEB_URL,
  ].filter((origin): origin is string => !!origin)

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  })

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  )

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('Rent & Stay API')
    .setDescription('API powering all 5 apps — Tenant Web, Owner Web, Admin, Tenant Mobile, Owner Mobile')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'OTP login, token refresh, logout')
    .addTag('users', 'User profiles')
    .addTag('properties', 'Listings, search, filters')
    .addTag('bookings', 'Booking lifecycle')
    .addTag('payments', 'Rent payments, receipts, payouts')
    .addTag('kyc', 'Aadhaar, PAN, bank verification via Digio')
    .addTag('chat', 'In-app messaging')
    .addTag('maintenance', 'Tenant maintenance requests')
    .addTag('notifications', 'Push, SMS, email')
    .addTag('admin', 'Admin-only operations')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = process.env.PORT ?? 8000
  await app.listen(port)
  console.log(`🚀 Rent & Stay API running on http://localhost:${port}`)
  console.log(`📖 Swagger docs at http://localhost:${port}/docs`)
}

bootstrap()
