import 'server-only';
import {
  ChallengeStatus,
  ChallengeVisibility,
  ProjectMemberRole,
  ProjectStatus
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface RecommendedChallenge {
  id: string;
  title: string;
  company: string;
  budget: bigint;
  currency: string;
  tags: string[];
  matchedTags: number;
  visibility: ChallengeVisibility;
}

export interface ActiveProjectRow {
  id: string;
  title: string;
  challenge: string;
  status: ProjectStatus;
  supervisor: string | null;
}

export interface MicroGrantSummary {
  awardedCents: bigint;
  pendingCents: bigint;
  disbursedCents: bigint;
  byProject: { id: string; title: string; amountCents: bigint; status: ProjectStatus }[];
}

async function getStudentTagIds(userId: string): Promise<string[]> {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { project: { select: { tags: { select: { tagId: true } } } } }
  });
  return Array.from(
    new Set(memberships.flatMap((m) => m.project.tags.map((t) => t.tagId)))
  );
}

export async function getRecommendedChallenges(
  userId: string,
  limit = 6
): Promise<RecommendedChallenge[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true }
    });

    const interestTagIds = await getStudentTagIds(userId);

    const challenges = await prisma.challenge.findMany({
      where: {
        status: ChallengeStatus.OPEN,
        visibility: ChallengeVisibility.PUBLIC
      },
      include: {
        company: { select: { displayName: true } },
        tags: { include: { tag: { select: { id: true, label: true } } } }
      },
      take: 60
    });

    const ranked = challenges
      .map((c) => {
        const matchedTags = c.tags.filter((t) =>
          interestTagIds.includes(t.tag.id)
        ).length;
        return {
          id: c.id,
          title: c.title,
          company: c.company.displayName,
          budget: c.budgetMicroGrant,
          currency: c.currency,
          tags: c.tags.map((t) => t.tag.label),
          matchedTags,
          visibility: c.visibility
        } satisfies RecommendedChallenge;
      })
      .sort((a, b) => b.matchedTags - a.matchedTags)
      .slice(0, limit);

    // departmentId currently informs only the user-side context; richer
    // recommendation would join challenge tags with department metadata.
    void user;
    return ranked;
  } catch (err) {
    console.warn('[data/student] recommendation fallback', err);
    return [];
  }
}

export async function getActiveProjects(userId: string): Promise<ActiveProjectRow[]> {
  try {
    const rows = await prisma.projectMember.findMany({
      where: {
        userId,
        role: { in: [ProjectMemberRole.STUDENT, ProjectMemberRole.STUDENT_LEAD] },
        project: {
          status: { in: [ProjectStatus.PROPOSED, ProjectStatus.IN_PROGRESS, ProjectStatus.SUBMITTED] }
        }
      },
      include: {
        project: {
          include: {
            challenge: { select: { title: true } },
            members: {
              where: { role: ProjectMemberRole.PROFESSOR_SUPERVISOR },
              include: { user: { select: { fullName: true } } }
            }
          }
        }
      }
    });

    return rows.map((r) => ({
      id: r.project.id,
      title: r.project.title,
      challenge: r.project.challenge.title,
      status: r.project.status,
      supervisor: r.project.members[0]?.user.fullName ?? null
    }));
  } catch (err) {
    console.warn('[data/student] active projects fallback', err);
    return [];
  }
}

export async function getMicroGrantSummary(userId: string): Promise<MicroGrantSummary> {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            challenge: { select: { budgetMicroGrant: true, awardedAt: true } }
          }
        }
      }
    });

    let awarded = 0n;
    let pending = 0n;
    let disbursed = 0n;
    const byProject: MicroGrantSummary['byProject'] = [];

    for (const m of memberships) {
      const amount = m.project.challenge.budgetMicroGrant;
      byProject.push({
        id: m.project.id,
        title: m.project.title,
        amountCents: amount,
        status: m.project.status
      });
      if (m.project.status === ProjectStatus.PROPOSED) pending += amount;
      else if (m.project.status === ProjectStatus.COMPLETED) disbursed += amount;
      else if (m.project.challenge.awardedAt) awarded += amount;
    }

    return { awardedCents: awarded, pendingCents: pending, disbursedCents: disbursed, byProject };
  } catch (err) {
    console.warn('[data/student] grants fallback', err);
    return { awardedCents: 0n, pendingCents: 0n, disbursedCents: 0n, byProject: [] };
  }
}
