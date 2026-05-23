import { Suspense } from 'react';
import { ChallengeStatus } from '@prisma/client';
import { getLocale, t } from '@/lib/i18n';
import {
  getFaculties,
  getTaxonomyOptions,
  getUniversities,
  searchPublicProjects,
  type ExplorerFilters as Filters
} from '@/lib/data/explorer';
import { DashboardShell } from '@/components/dashboard-shell';
import { ExplorerFilters } from '@/components/explorer-filters';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    q?: string;
    universityId?: string;
    facultyId?: string;
    tagId?: string;
    status?: string;
  };
}

function parseFilters(sp: PageProps['searchParams']): Filters {
  const statusValid =
    sp.status && (Object.values(ChallengeStatus) as string[]).includes(sp.status)
      ? (sp.status as ChallengeStatus)
      : undefined;
  return {
    q: sp.q?.trim() || undefined,
    universityId: sp.universityId || undefined,
    facultyId: sp.facultyId || undefined,
    tagId: sp.tagId || undefined,
    status: statusValid
  };
}

export default async function ExplorerPage({ searchParams }: PageProps) {
  const locale = getLocale();
  const filters = parseFilters(searchParams);

  const [universities, faculties, tags] = await Promise.all([
    getUniversities(),
    getFaculties(filters.universityId),
    getTaxonomyOptions()
  ]);

  return (
    <DashboardShell active="explorer">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('explorer.title', locale)}</h1>
        <p className="text-sm text-muted-foreground">{t('explorer.subtitle', locale)}</p>
      </div>

      <ExplorerFilters
        universities={universities}
        faculties={faculties}
        tags={tags}
        initial={filters}
        labels={{
          university: t('explorer.filter.university', locale),
          faculty: t('explorer.filter.faculty', locale),
          tag: t('explorer.filter.tag', locale),
          status: t('explorer.filter.status', locale),
          query: t('explorer.filter.query', locale),
          apply: t('common.apply', locale),
          reset: t('common.reset', locale),
          all: t('common.all', locale),
          filters: t('common.filters', locale)
        }}
      />

      <h2 className="mt-8 text-lg font-semibold">{t('explorer.results', locale)}</h2>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results filters={filters} emptyLabel={t('explorer.noResults', locale)} />
      </Suspense>
    </DashboardShell>
  );
}

async function Results({
  filters,
  emptyLabel
}: {
  filters: Filters;
  emptyLabel: string;
}) {
  const projects = await searchPublicProjects(filters);
  if (projects.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <Card key={p.id} className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">{p.title}</CardTitle>
              <Badge variant="secondary">{p.challengeStatus}</Badge>
            </div>
            <CardDescription className="line-clamp-1">
              {p.challengeTitle} · {p.company}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <p className="line-clamp-3 text-sm text-muted-foreground">{p.abstract}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.tags.slice(0, 5).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            {p.university ? (
              <p className="mt-auto text-xs text-muted-foreground">{p.university}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}
