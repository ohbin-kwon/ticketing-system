import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception.js';
import { ApiErrorResponse } from '../interfaces/api-response.interface.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let errorResponse: ApiErrorResponse;

    if (exception instanceof DomainException) {
      status = HttpStatus.BAD_REQUEST;
      errorResponse = {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message;

      errorResponse = {
        success: false,
        error: {
          code: `HTTP_${status}`,
          message: Array.isArray(message)
            ? message.join(', ')
            : String(message),
        },
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error('Unhandled exception', exception);
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      };
    }

    response.status(status).json(errorResponse);
  }
}
