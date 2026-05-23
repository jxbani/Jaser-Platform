import Link from 'next/link';
import { ReactNode } from 'react';
import {
  Building2,
  Compass,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon
} from 'lucide-react';
import { auth, signOut } from '@/auth';
import { getLocale, t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LocaleToggle } from '@/components/locale-toggle';
import { Avatar } from '@/components/ui/avatar';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export async function DashboardShell({
  active,
  children
}: {
  active: 'student' | 'company' | 'explorer';
  children: ReactNode;
}) {
  const locale = getLocale();
  const session = await auth();

  const nav: NavItem[] = [
    { href: '/student', label: t('nav.student', locale), icon: GraduationCap },
    { href: '/company', label: t('nav.company', locale), icon: Building2 },
    { href: '/explorer', label: t('nav.explorer', locale), icon: Compass }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span>Jaser</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = item.href.endsWith(active);
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <LocaleToggle current={locale} />
            {session?.user ? (
              <>
                <Avatar name={session.user.name ?? session.user.email ?? '?'} className="h-8 w-8" />
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/' });
                  }}
                >
                  <Button variant="ghost" size="sm" type="submit">
                    {t('nav.signout', locale)}
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        </div>
        <nav className="container flex items-center gap-1 overflow-x-auto pb-2 md:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = item.href.endsWith(active);
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
              >
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>
        <Separator />
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
