import Link from 'next/link';
import { ArrowRight, Building2, Compass, GraduationCap } from 'lucide-react';
import { getLocale, t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { LocaleToggle } from '@/components/locale-toggle';

export default function HomePage() {
  const locale = getLocale();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="font-semibold">Jaser</Link>
          <LocaleToggle current={locale} />
        </div>
      </header>
      <main className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Jaser Platform</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A national academic–industry collaboration platform connecting students,
            professors and companies through challenges, projects and verified NDAs.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <DashCard
            href="/student"
            icon={GraduationCap}
            title={t('nav.student', locale)}
            description={t('student.matching', locale)}
          />
          <DashCard
            href="/company"
            icon={Building2}
            title={t('nav.company', locale)}
            description={t('company.talent', locale)}
          />
          <DashCard
            href="/explorer"
            icon={Compass}
            title={t('nav.explorer', locale)}
            description={t('explorer.subtitle', locale)}
          />
        </div>
      </main>
    </div>
  );
}

function DashCard({
  href,
  icon: Icon,
  title,
  description
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <Icon className="h-6 w-6 text-primary" />
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button asChild variant="outline" className="w-full justify-between">
          <Link href={href}>
            Open
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
