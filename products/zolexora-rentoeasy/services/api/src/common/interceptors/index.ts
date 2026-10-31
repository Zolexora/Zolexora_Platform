// ─── RESPONSE TRANSFORM INTERCEPTOR ─────────────────────────────────────────
// Wraps every response in { success: true, data: ... }

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    )
  }
}

// ─── GLOBAL EXCEPTION FILTER ─────────────────────────────────────────────────
// Catches all errors and returns consistent { success: false, message, statusCode }

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request  = ctx.getRequest<Request>()

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message    = 'Internal server error'
    let error: string | undefined

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const res  = exception.getResponse()
      message    = typeof res === 'string' ? res : (res as any).message ?? message
      error      = exception.name
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle common Prisma errors gracefully
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT
        const field = (exception.meta?.target as string[])?.join(', ')
        message    = `${field ?? 'Value'} already exists`
        error      = 'Conflict'
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND
        message    = 'Record not found'
        error      = 'NotFound'
      } else {
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`)
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled: ${exception.message}`, exception.stack)
    }

    response.status(statusCode).json({
      success:    false,
      statusCode,
      message:    Array.isArray(message) ? message[0] : message,
      error,
      path:       request.url,
      timestamp:  new Date().toISOString(),
    })
  }
}
