import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from './api-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      response
        .status(status)
        .json(ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many requests. Try again later.'));
      return;
    }

    const errorPayload =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const normalizedMessage =
      typeof errorPayload === 'string' ? errorPayload : 'Request failed';

    response.status(status).json(
      ApiResponse.error('HTTP_ERROR', normalizedMessage, {
        path: request.url,
        status,
      }),
    );
  }
}
