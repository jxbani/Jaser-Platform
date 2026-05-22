import { PrismaClient, AcademicEntityType, TaxonomyDiscipline, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const university = await prisma.academicEntity.create({
    data: { name: 'National University', type: AcademicEntityType.UNIVERSITY }
  });
  const faculty = await prisma.academicEntity.create({
    data: { name: 'Faculty of Engineering', type: AcademicEntityType.FACULTY, parentId: university.id }
  });
  await prisma.academicEntity.create({
    data: { name: 'Computer Science', type: AcademicEntityType.DEPARTMENT, parentId: faculty.id }
  });

  await prisma.taxonomyTag.createMany({
    data: [
      { slug: 'tech',   label: 'Technology',  discipline: TaxonomyDiscipline.TECHNOLOGY },
      { slug: 'eng',    label: 'Engineering', discipline: TaxonomyDiscipline.ENGINEERING },
      { slug: 'law',    label: 'Law',         discipline: TaxonomyDiscipline.LAW },
      { slug: 'med',    label: 'Medicine',    discipline: TaxonomyDiscipline.MEDICINE }
    ]
  });

  await prisma.user.upsert({
    where: { email: 'admin@jaser.local' },
    update: {},
    create: { email: 'admin@jaser.local', fullName: 'Platform Admin', role: UserRole.ADMIN }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
