import 'server-only';
import { cookies } from 'next/headers';

export type Locale = 'en' | 'ar';
export const LOCALES: Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'locale';

export function getDir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function getLocale(): Locale {
  const raw = cookies().get(LOCALE_COOKIE)?.value;
  return raw === 'ar' || raw === 'en' ? raw : DEFAULT_LOCALE;
}

type Dict = Record<string, string>;

const en: Dict = {
  'nav.dashboard': 'Dashboard',
  'nav.student': 'Student',
  'nav.company': 'Company',
  'nav.explorer': 'Explorer',
  'nav.signout': 'Sign out',
  'common.loading': 'Loading…',
  'common.empty': 'Nothing here yet.',
  'common.all': 'All',
  'common.search': 'Search',
  'common.apply': 'Apply',
  'common.filters': 'Filters',
  'common.reset': 'Reset',
  'common.viewAll': 'View all',
  'student.title': 'Student Dashboard',
  'student.matching': 'Challenges recommended for your major',
  'student.matchingHint': 'Ranked by overlap between your department, taxonomy interests and the challenge tags.',
  'student.activeProjects': 'Active project status',
  'student.grants': 'Micro-grant tracking',
  'student.grantsAwarded': 'Awarded',
  'student.grantsPending': 'Pending review',
  'student.grantsDisbursed': 'Disbursed',
  'company.title': 'Company Dashboard',
  'company.talent': 'Talent discovery pool',
  'company.talentHint': 'Students sorted by reputation score across this platform.',
  'company.activeChallenges': 'Active challenges',
  'company.pendingApplications': 'Applications pending review',
  'explorer.title': 'Taxonomy Explorer',
  'explorer.subtitle': 'Browse public projects and research across universities, faculties and tags.',
  'explorer.filter.university': 'University',
  'explorer.filter.faculty': 'Faculty',
  'explorer.filter.tag': 'Tag',
  'explorer.filter.status': 'Status',
  'explorer.filter.query': 'Search title or abstract',
  'explorer.results': 'Results',
  'explorer.noResults': 'No projects match your filters.'
};

const ar: Dict = {
  'nav.dashboard': 'لوحة التحكم',
  'nav.student': 'الطالب',
  'nav.company': 'الشركة',
  'nav.explorer': 'المستكشف',
  'nav.signout': 'تسجيل الخروج',
  'common.loading': 'جارٍ التحميل…',
  'common.empty': 'لا يوجد شيء بعد.',
  'common.all': 'الكل',
  'common.search': 'بحث',
  'common.apply': 'تطبيق',
  'common.filters': 'مرشحات',
  'common.reset': 'إعادة تعيين',
  'common.viewAll': 'عرض الكل',
  'student.title': 'لوحة تحكم الطالب',
  'student.matching': 'تحديات موصى بها لتخصصك',
  'student.matchingHint': 'مرتّبة حسب التقاطع بين قسمك واهتماماتك ووسوم التحدي.',
  'student.activeProjects': 'حالة المشاريع النشطة',
  'student.grants': 'تتبع المنح الصغيرة',
  'student.grantsAwarded': 'تمت الموافقة',
  'student.grantsPending': 'قيد المراجعة',
  'student.grantsDisbursed': 'تم الصرف',
  'company.title': 'لوحة تحكم الشركة',
  'company.talent': 'مجمع اكتشاف المواهب',
  'company.talentHint': 'الطلاب مرتبون حسب درجة السمعة على المنصة.',
  'company.activeChallenges': 'التحديات النشطة',
  'company.pendingApplications': 'الطلبات قيد المراجعة',
  'explorer.title': 'مستكشف التصنيفات',
  'explorer.subtitle': 'تصفح المشاريع والأبحاث العامة عبر الجامعات والكليات والوسوم.',
  'explorer.filter.university': 'الجامعة',
  'explorer.filter.faculty': 'الكلية',
  'explorer.filter.tag': 'الوسم',
  'explorer.filter.status': 'الحالة',
  'explorer.filter.query': 'ابحث في العنوان أو الملخص',
  'explorer.results': 'النتائج',
  'explorer.noResults': 'لا توجد مشاريع تطابق المرشحات.'
};

const DICTIONARIES: Record<Locale, Dict> = { en, ar };

export function t(key: keyof typeof en, locale: Locale = getLocale()): string {
  return DICTIONARIES[locale][key] ?? key;
}
