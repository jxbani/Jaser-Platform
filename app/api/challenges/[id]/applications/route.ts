import { NextResponse } from 'next/server';
import {
  ChallengeStatus,
  ProjectMemberRole,
  ProjectStatus,
  UserRole
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  toErrorResponse
} from '@/lib/errors';
import { applyToChallengeSchema } from '@/lib/validation/challenges';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/challenges/[id]/applications
 * A STUDENT applies to a challenge by submitting a project proposal that
 * is linked to an academic supervisor (PROFESSOR). The created project
 * starts in `PROPOSED` and is later approved by the supervisor.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const student = await requireRole(UserRole.STUDENT);

    if (!z.string().uuid().safeParse(params.id).success) {
      throw BadRequest('Invalid challenge id');
    }
    const challengeId = params.id;

    const body = await request.json().catch(() => {
      throw BadRequest('Request body must be valid JSON');
    });
    const input = applyToChallengeSchema.parse(body);

    if (input.supervisorId === student.id) {
      throw BadRequest('Supervisor must be a different user');
    }

    const project = await prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findUnique({
        where: { id: challengeId },
        select: {
          id: true,
          status: true,
          submissionDeadline: true,
          visibility: true
        }
      });
      if (!challenge) throw NotFound('Challenge not found');
      if (challenge.status !== ChallengeStatus.OPEN) {
        throw Forbidden(
          `Challenge is not accepting applications (status=${challenge.status})`
        );
      }
      if (
        challenge.submissionDeadline &&
        challenge.submissionDeadline.getTime() < Date.now()
      ) {
        throw Forbidden('Submission deadline has passed');
      }

      const supervisor = await tx.user.findUnique({
        where: { id: input.supervisorId },
        select: { id: true, role: true, isActive: true }
      });
      if (!supervisor || !supervisor.isActive) {
        throw BadRequest('Supervisor not found');
      }
      if (supervisor.role !== UserRole.PROFESSOR) {
        throw BadRequest('Supervisor must be a user with the PROFESSOR role');
      }

      const duplicate = await tx.projectMember.findFirst({
        where: {
          userId: student.id,
          role: ProjectMemberRole.STUDENT_LEAD,
          project: { challengeId, status: { not: ProjectStatus.REJECTED } }
        },
        select: { projectId: true }
      });
      if (duplicate) {
        throw Conflict('You have already applied to this challenge');
      }

      return tx.project.create({
        data: {
          title: input.title,
          abstract: input.abstract,
          artifacts: input.artifacts ?? {},
          status: ProjectStatus.PROPOSED,
          challengeId,
          members: {
            create: [
              { userId: student.id, role: ProjectMemberRole.STUDENT_LEAD },
              {
                userId: supervisor.id,
                role: ProjectMemberRole.PROFESSOR_SUPERVISOR
              }
            ]
          }
        },
        include: { members: true }
      });
    });

    await prisma.auditEvent.create({
      data: {
        actorId: student.id,
        action: 'CHALLENGE_APPLY',
        entityType: 'Project',
        entityId: project.id,
        payload: { challengeId, supervisorId: input.supervisorId }
      }
    });

    return NextResponse.json({ application: project }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
