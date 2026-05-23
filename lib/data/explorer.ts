import 'server-only';
import {
  AcademicEntityType,
  ChallengeStatus,
  ChallengeVisibility,
  type Prisma,
  ProjectStatus
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface ExplorerFilters {
  q?: string;
  universityId?: string;
  facultyId?: string;
  tagId?: string;
  status?: ChallengeStatus;
}

export interface ExplorerOption {
  id: string;
  label: string;
}

export interface ExplorerProject {
  id: string;
  title: string;
  abstract: string;
  status: ProjectStatus;
  challengeTitle: string;
  challengeStatus: ChallengeStatus;
  company: string;
  tags: string[];
  university: string | null;
}

export async function getUniversities(): Promise<ExplorerOption[]> {
  try {
    const rows = await prisma.academicEntity.findMany({
      where: { type: AcademicEntityType.UNIVERSITY },
      orderBy: { name: 'asc' }
    });
    return rows.map((r) => ({ id: r.id, label: r.name }));
  } catch {
    return [];
  }
}

export async function getFaculties(universityId?: string): Promise<ExplorerOption[]> {
  try {
    const rows = await prisma.academicEntity.findMany({
      where: {
        type: AcademicEntityType.FACULTY,
        ...(universityId ? { parentId: universityId } : {})
      },
      orderBy: { name: 'asc' }
    });
    return rows.map((r) => ({ id: r.id, label: r.name }));
  } catch {
    return [];
  }
}

export async function getTaxonomyOptions(): Promise<ExplorerOption[]> {
  try {
    const rows = await prisma.taxonomyTag.findMany({
      orderBy: [{ discipline: 'asc' }, { label: 'asc' }]
    });
    return rows.map((r) => ({ id: r.id, label: `${r.discipline} · ${r.label}` }));
  } catch {
    return [];
  }
}

export async function searchPublicProjects(
  filters: ExplorerFilters,
  limit = 30
): Promise<ExplorerProject[]> {
  try {
    const where: Prisma.ProjectWhereInput = {
      challenge: {
        visibility: ChallengeVisibility.PUBLIC,
        ...(filters.status ? { status: filters.status } : {})
      },
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { abstract: { contains: filters.q, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(filters.tagId
        ? { tags: { some: { tagId: filters.tagId } } }
        : {}),
      ...(filters.facultyId || filters.universityId
        ? {
            members: {
              some: {
                user: {
                  department: filters.facultyId
                    ? { parentId: filters.facultyId }
                    : {
                        parent: filters.universityId
                          ? { parentId: filters.universityId }
                          : undefined
                      }
                }
              }
            }
          }
        : {})
    };

    const projects = await prisma.project.findMany({
      where,
      include: {
        challenge: {
          include: { company: { select: { displayName: true } } }
        },
        tags: { include: { tag: { select: { label: true } } } },
        members: {
          include: {
            user: {
              include: {
                department: {
                  include: { parent: { include: { parent: true } } }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return projects.map((p) => {
      const dept = p.members.find((m) => m.user.department)?.user.department;
      const university = dept?.parent?.parent?.name ?? dept?.parent?.name ?? null;
      return {
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        status: p.status,
        challengeTitle: p.challenge.title,
        challengeStatus: p.challenge.status,
        company: p.challenge.company.displayName,
        tags: p.tags.map((t) => t.tag.label),
        university
      } satisfies ExplorerProject;
    });
  } catch (err) {
    console.warn('[data/explorer] search fallback', err);
    return [];
  }
}
