import { handlers } from '@/auth';

export const { GET, POST } = handlers;

// NextAuth uses cookies and dynamic request data — never statically render.
export const dynamic = 'force-dynamic';
