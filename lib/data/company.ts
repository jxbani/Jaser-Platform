import 'server-only';
import {
  ChallengeStatus,
  ProjectStatus,
  UserRole
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface TalentRow {
  id: string;
  name: string;
  reputation: number;
  department: string | null;
}

export interface CompanyChallengeRow {
  id: string;
  title: string;
  status: ChallengeStatus;
  applicantCount: number;
  budgetCents: bigint;
  currency: string;
}

export interface PendingApplicationRow {
  id: string;
  projectTitle: string;
  challengeTitle: string;
  studentName: string;
  supervisorName: string | null;
  submittedAt: Date;
}

export async function getTalentPool(limit = 10): Promise<TalentRow[]> {
  try {
    const users = await prisma.user.findMany({
      where: { role: UserRole.STUDENT, isActive: true },
      orderBy: { reputationScore: 'desc' },
      take: limit,
      include: { department: { select: { name: true } } }
    });
    return users.map((u) => ({
      id: u.id,
      name: u.fullName,
      reputation: u.reputationScore,
      department: u.department?.name ?? null
    }));
  } catch (err) {
    console.warn('[data/company] talent pool fallback', err);
    return [];
  }
}

export async function getActiveChallenges(
  companyId: string
): Promise<CompanyChallengeRow[]> {
  try {
    const rows = await prisma.challenge.findMany({
      where: {
        companyId,
        status: { in: [ChallengeStatus.OPEN, ChallengeStatus.IN_REVIEW] }
      },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      applicantCount: c._count.projects,
      budgetCents: c.budgetMicroGrant,
      currency: c.currency
    }));
  } catch (err) {
    console.warn('[data/company] challenges fallback', err);
    return [];
  }
}

export async function getPendingApplications(
  companyId: string
): Promise<PendingApplicationRow[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        status: ProjectStatus.PROPOSED,
        challenge: { companyId }
      },
      include: {
        challenge: { select: { title: true } },
        members: {
          include: { user: { select: { fullName: true, role: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return projects.map((p) => {
      const student = p.members.find((m) => m.role === 'STUDENT_LEAD');
      const supervisor = p.members.find((m) => m.role === 'PROFESSOR_SUPERVISOR');
      return {
        id: p.id,
        projectTitle: p.title,
        challengeTitle: p.challenge.title,
        studentName: student?.user.fullName ?? 'Unknown',
        supervisorName: supervisor?.user.fullName ?? null,
        submittedAt: p.createdAt
      };
    });
  } catch (err) {
    console.warn('[data/company] pending applications fallback', err);
    return [];
  }
}
