import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Response } from 'express';

// Prisma errors may contain parameterized operations. Never send/log raw ORM errors.
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
)
export class DatabaseErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '';
    const status = code === 'P2002' ? 409 : code === 'P2025' ? 404 : 503;
    const message =
      code === 'P2002'
        ? 'An account or record with this identity already exists.'
        : code === 'P2025'
          ? 'Record not found.'
          : 'Database operation unavailable.';
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message });
  }
}
