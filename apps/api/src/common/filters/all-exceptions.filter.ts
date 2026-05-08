import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import * as Sentry from '@sentry/node';
import { AppException } from '@/common/exceptions/app.exception';
import { requestContextStorage } from '@/common/request-context/request-context.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let statusCode: number;
    let errorCode: string;
    let message: unknown;

    if (exception instanceof AppException) {
      statusCode = exception.statusCode;
      errorCode = exception.errorCode;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      errorCode = `HTTP_${statusCode.toString()}`;
      message = exception.getResponse();
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_ERROR';
      message = 'Internal server error';
    }

    // Only capture unexpected server errors — 4xx are expected business exceptions
    if (statusCode >= 500) {
      const requestId = requestContextStorage.getStore()?.requestId;
      Sentry.withScope((scope) => {
        if (requestId) scope.setTag('requestId', requestId);
        scope.setTag('errorCode', errorCode);
        Sentry.captureException(exception);
      });
    }

    const requestId = requestContextStorage.getStore()?.requestId;

    reply.status(statusCode).send({
      statusCode,
      errorCode,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
