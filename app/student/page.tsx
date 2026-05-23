import { redirect } from 'next/navigation';
import { ArrowUpRight, Lock, Sparkles, Target } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { getLocale, t } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import {
  getActiveProjects,
  getMicroGrantSummary,
  getRecommendedChallenges
} from '@/lib/data/student';
import { DashboardShell } from '@/components/dashboard-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from '@/components/project-status-badge';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/api/auth/signin?callbackUrl=/student');
  if (session.user.role !== UserRole.STUDENT && session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  const locale = getLocale();
  const [matches, activeProjects, grants] = await Promise.all([
    getRecommendedChallenges(session.user.id),
    getActiveProjects(session.user.id),
    getMicroGrantSummary(session.user.id)
  ]);

  const totalGrants =
    grants.awardedCents + grants.pendingCents + grants.disbursedCents;
  const disbursedPct =
    totalGrants > 0n ? Number((grants.disbursedCents * 100n) / totalGrants) : 0;

  return (
    <DashboardShell active="student">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('student.title', locale)}</h1>
          <p className="text-sm text-muted-foreground">
            {session.user.name ?? session.user.email}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle>{t('student.matching', locale)}</CardTitle>
            </div>
            <CardDescription>{t('student.matchingHint', locale)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty', locale)}</p>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{m.title}</p>
                      {m.visibility === 'PRIVATE_NDA' ? (
                        <Badge variant="warning" className="gap-1">
                          <Lock className="h-3 w-3" /> NDA
                        </Badge>
                      ) : null}
                      {m.matchedTags > 0 ? (
                        <Badge variant="success">{m.matchedTags} match</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{m.company}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <span className="text-sm font-semibold">
                      {formatMoney(m.budget, m.currency)}
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/explorer?q=${encodeURIComponent(m.title)}`}>
                        {t('common.apply', locale)}
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle>{t('student.grants', locale)}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Stat label={t('student.grantsAwarded', locale)} value={formatMoney(grants.awardedCents)} />
            <Stat label={t('student.grantsPending', locale)} value={formatMoney(grants.pendingCents)} />
            <Stat label={t('student.grantsDisbursed', locale)} value={formatMoney(grants.disbursedCents)} />
            <div className="space-y-1">
              <Progress value={disbursedPct} />
              <p className="text-xs text-muted-foreground">{disbursedPct}% disbursed</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('student.activeProjects', locale)}</CardTitle>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty', locale)}</p>
            ) : (
              <ul className="divide-y">
                {activeProjects.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-sm text-muted-foreground">{p.challenge}</p>
                      {p.supervisor ? (
                        <p className="text-xs text-muted-foreground">
                          Supervisor: {p.supervisor}
                        </p>
                      ) : null}
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
