import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { BadRequest, Forbidden, toErrorResponse } from '@/lib/errors';
import { createChallengeSchema } from '@/lib/validation/challenges';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/challenges
 * Company representatives create challenges on behalf of their company.
 */
export async function POST(request: Request) {
  try {
    const user = await requireRole(UserRole.COMPANY_REP, UserRole.ADMIN);

    const body = await request.json().catch(() => {
      throw BadRequest('Request body must be valid JSON');
    });
    const input = createChallengeSchema.parse(body);

    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { companyId: true, company: { select: { verified: true } } }
    });
    if (!account?.companyId) {
      throw Forbidden('Company representative is not linked to a company');
    }
    if (!account.company?.verified && user.role !== UserRole.ADMIN) {
      throw Forbidden(
        'Your company must be verified by an admin before posting challenges'
      );
    }

    if (input.tagIds.length) {
      const found = await prisma.taxonomyTag.count({
        where: { id: { in: input.tagIds } }
      });
      if (found !== input.tagIds.length) {
        throw BadRequest('One or more tagIds are invalid');
      }
    }

    const challenge = await prisma.challenge.create({
      data: {
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        budgetMicroGrant: BigInt(input.budgetMicroGrant),
        currency: input.currency,
        submissionDeadline: input.submissionDeadline,
        companyId: account.companyId,
        postedById: user.id,
        tags: {
          create: input.tagIds.map((tagId) => ({ tagId }))
        }
      },
      include: { tags: true }
    });

    return NextResponse.json(
      {
        challenge: {
          ...challenge,
          budgetMicroGrant: challenge.budgetMicroGrant.toString()
        }
      },
      { status: 201 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
