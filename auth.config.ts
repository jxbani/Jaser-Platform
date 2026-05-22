import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@prisma/client';

/**
 * Edge-safe slice of the NextAuth config. Imported by `middleware.ts` and
 * extended in `auth.ts` (which adds the Node-only Credentials provider).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role as UserRole;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.role) session.user.role = token.role as UserRole;
      return session;
    }
  }
} satisfies NextAuthConfig;
