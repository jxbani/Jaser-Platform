import { redirect } from 'next/navigation';
import { Briefcase, Inbox, Star } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getLocale, t } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import {
  getActiveChallenges,
  getPendingApplications,
  getTalentPool
} from '@/lib/data/company';
import { DashboardShell } from '@/components/dashboard-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

export default async function CompanyDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/api/auth/signin?callbackUrl=/company');
  if (
    session.user.role !== UserRole.COMPANY_REP &&
    session.user.role !== UserRole.ADMIN
  ) {
    redirect('/');
  }

  const me = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { companyId: true, company: { select: { displayName: true } } }
    })
    .catch(() => null);

  const companyId = me?.companyId ?? '';
  const locale = getLocale();

  const [talent, challenges, pending] = await Promise.all([
    getTalentPool(),
    companyId ? getActiveChallenges(companyId) : Promise.resolve([]),
    companyId ? getPendingApplications(companyId) : Promise.resolve([])
  ]);

  return (
    <DashboardShell active="company">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('company.title', locale)}</h1>
          <p className="text-sm text-muted-foreground">
            {me?.company?.displayName ?? session.user.email}
          </p>
        </div>
        <Button asChild>
          <a href="/explorer">{t('common.viewAll', locale)}</a>
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <CardTitle>{t('company.activeChallenges', locale)}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {challenges.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty', locale)}</p>
            ) : (
              <ul className="divide-y">
                {challenges.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.applicantCount} applicants · {formatMoney(c.budgetCents, c.currency)}
                      </p>
                    </div>
                    <Badge variant={c.status === 'OPEN' ? 'success' : 'secondary'}>
                      {c.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <CardTitle>{t('company.talent', locale)}</CardTitle>
            </div>
            <CardDescription>{t('company.talentHint', locale)}</CardDescription>
          </CardHeader>
          <CardContent>
            {talent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty', locale)}</p>
            ) : (
              <ul className="space-y-3">
                {talent.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <Avatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.department ?? '—'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      <Star className="me-1 h-3 w-3 fill-current" />
                      {s.reputation}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <CardTitle>{t('company.pendingApplications', locale)}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty', locale)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-start text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 text-start font-medium">Project</th>
                      <th className="py-2 text-start font-medium">Challenge</th>
                      <th className="py-2 text-start font-medium">Student</th>
                      <th className="py-2 text-start font-medium">Supervisor</th>
                      <th className="py-2 text-end font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((p, i) => (
                      <tr key={p.id} className={i === 0 ? '' : 'border-t'}>
                        <td className="py-3 pe-3">{p.projectTitle}</td>
                        <td className="py-3 pe-3 text-muted-foreground">{p.challengeTitle}</td>
                        <td className="py-3 pe-3">{p.studentName}</td>
                        <td className="py-3 pe-3 text-muted-foreground">
                          {p.supervisorName ?? '—'}
                        </td>
                        <td className="py-3 text-end text-muted-foreground">
                          {p.submittedAt.toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="mt-10" />
    </DashboardShell>
  );
}
