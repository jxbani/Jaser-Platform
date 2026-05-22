import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const Unauthorized = (msg = 'Sign in required') =>
  new ApiError(401, 'UNAUTHENTICATED', msg);
export const Forbidden = (msg = 'Insufficient permissions') =>
  new ApiError(403, 'FORBIDDEN', msg);
export const NotFound = (msg = 'Resource not found') =>
  new ApiError(404, 'NOT_FOUND', msg);
export const Conflict = (msg: string) => new ApiError(409, 'CONFLICT', msg);
export const BadRequest = (msg: string, details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', msg, details);

/**
 * Translate any thrown value into a JSON Response. Safe to use as the
 * `catch` body for every route handler.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request failed validation',
          issues: err.errors
        }
      },
      { status: 400 }
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'A record with the same unique field already exists',
            target: (err.meta as { target?: string[] } | undefined)?.target
          }
        },
        { status: 409 }
      );
    }
    if (err.code === 'P2025') {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Record not found' } },
        { status: 404 }
      );
    }
  }

  console.error('[api] unhandled error', err);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 }
  );
}
