import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signupSchema } from '@/lib/validation/auth';
import { BadRequest, Conflict, toErrorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw BadRequest('Request body must be valid JSON');
    });

    const input = signupSchema.parse(body);

    const passwordHash = await bcrypt.hash(input.password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) throw Conflict('An account with this email already exists');

      if (input.role === UserRole.COMPANY_REP) {
        const dupReg = await tx.company.findUnique({
          where: { registrationNumber: input.registrationNumber }
        });
        const company =
          dupReg ??
          (await tx.company.create({
            data: {
              legalName: input.companyLegalName,
              displayName: input.companyDisplayName,
              registrationNumber: input.registrationNumber,
              taxId: input.taxId
            }
          }));

        return tx.user.create({
          data: {
            email: input.email,
            fullName: input.fullName,
            role: UserRole.COMPANY_REP,
            passwordHash,
            companyId: company.id
          },
          select: { id: true, email: true, fullName: true, role: true }
        });
      }

      // STUDENT or PROFESSOR
      return tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          passwordHash,
          departmentId: input.departmentId
        },
        select: { id: true, email: true, fullName: true, role: true }
      });
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta as { target?: string[] } | undefined)?.target;
      if (target?.includes('registrationNumber')) {
        return toErrorResponse(
          Conflict('A company is already registered with this commercial registration number')
        );
      }
    }
    return toErrorResponse(err);
  }
}
