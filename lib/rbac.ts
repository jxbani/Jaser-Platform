import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { Forbidden, Unauthorized } from '@/lib/errors';

export interface AuthedUser {
  id: string;
  role: UserRole;
  email: string;
  name: string;
}

/**
 * Resolve the current session or throw an ApiError. Use at the top of every
 * protected route handler. The caller is expected to wrap the body in
 * try/catch and translate the error via `toErrorResponse`.
 */
export async function requireUser(): Promise<AuthedUser> {
  const session = await auth();
  if (!session?.user?.id) throw Unauthorized();
  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? '',
    name: session.user.name ?? ''
  };
}

/**
 * Resolve the current session and assert the user has one of `allowed`
 * roles. Throws 401 if unauthenticated, 403 if the role is wrong.
 */
export async function requireRole(
  ...allowed: UserRole[]
): Promise<AuthedUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw Forbidden(
      `This action requires one of: ${allowed.join(', ')}. You are ${user.role}.`
    );
  }
  return user;
}
