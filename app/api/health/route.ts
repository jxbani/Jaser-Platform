import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Lightweight liveness/readiness probe used by VM-level health checks
 * (scripts/health-check.sh) and the nginx upstream. Returns 200 only when
 * the database is reachable.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', uptime: process.uptime(), pid: process.pid },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', error: (err as Error).message },
      { status: 503 }
    );
  }
}
