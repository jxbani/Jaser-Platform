import { Prisma, PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

/**
 * Run a callback inside a transaction that sets the RLS GUCs
 * (`app.current_user_id`, `app.current_user_role`) so PostgreSQL row-level
 * security policies can authorize the query. The Prisma client itself
 * connects as the table owner, so RLS only applies to statements that opt
 * in via these session variables.
 */
export async function withRlsContext<T>(
  ctx: { userId: string; role: string },
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_role', ${ctx.role}, true)`;
    return fn(tx);
  });
}
