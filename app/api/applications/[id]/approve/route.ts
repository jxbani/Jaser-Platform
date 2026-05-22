import { NextResponse } from 'next/server';
import {
  ChallengeVisibility,
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
import { generateNdaForProject } from '@/lib/nda';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PUT /api/applications/[id]/approve
 * The PROFESSOR_SUPERVISOR on a PROPOSED project flips the status to
 * IN_PROGRESS. If the underlying challenge is PRIVATE_NDA, an NDA record
 * is generated as part of the same transaction.
 */
export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supervisor = await requireRole(UserRole.PROFESSOR, UserRole.ADMIN);

    if (!z.string().uuid().safeParse(params.id).success) {
      throw BadRequest('Invalid application id');
    }
    const projectId = params.id;

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          members: true,
          challenge: { select: { visibility: true } }
        }
      });
      if (!project) throw NotFound('Application not found');

      const isSupervisor = project.members.some(
        (m) =>
          m.userId === supervisor.id &&
          m.role === ProjectMemberRole.PROFESSOR_SUPERVISOR
      );
      if (!isSupervisor && supervisor.role !== UserRole.ADMIN) {
        throw Forbidden(
          'Only the assigned PROFESSOR_SUPERVISOR can approve this application'
        );
      }

      if (project.status !== ProjectStatus.PROPOSED) {
        throw Conflict(
          `Application is not pending approval (status=${project.status})`
        );
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.IN_PROGRESS,
          reviewedAt: new Date()
        },
        include: { members: true, challenge: true }
      });

      let nda = null;
      if (updated.challenge.visibility === ChallengeVisibility.PRIVATE_NDA) {
        nda = await generateNdaForProject(tx, projectId);
      }

      await tx.auditEvent.create({
        data: {
          actorId: supervisor.id,
          action: 'APPLICATION_APPROVE',
          entityType: 'Project',
          entityId: projectId,
          payload: {
            previousStatus: ProjectStatus.PROPOSED,
            newStatus: ProjectStatus.IN_PROGRESS,
            ndaId: nda?.id ?? null
          }
        }
      });

      return { project: updated, nda };
    });

    return NextResponse.json({
      project: result.project,
      nda: result.nda
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
