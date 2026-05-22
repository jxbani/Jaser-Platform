# Jaser Platform

A national academic–industry collaboration platform that connects **students**,
**professors**, and **companies** through real-world challenges, student-led
projects, and digitally-signed NDAs for confidential work.

Built with **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL**.

---

## Domain model

| Model | Purpose |
| --- | --- |
| `User` | Students, professors, company reps, and admins. Carries `role`, `reputationScore`, free-form `profileData`. |
| `Company` | Industry partner that posts challenges. |
| `AcademicEntity` | Self-referential hierarchy: University → Faculty → Department. |
| `TaxonomyTag` | Self-referential hierarchy classified by `discipline` (Technology, Engineering, Law, …). Many-to-many with both challenges and projects. |
| `Challenge` | Posted by a company. Has `visibility` (`PUBLIC` / `PRIVATE_NDA`), `budgetMicroGrant`, `status`. |
| `Project` | Student-led solution to a challenge. Has `ProjectMember` rows linking students, professor supervisors, and company mentors. |
| `Nda` + `NdaSignature` | Snapshotted NDA document and per-user cryptographic signatures. |
| `ChallengeAccess` | Materialised access grants used by RLS to authorise private-challenge reads. |
| `AuditEvent` | Append-only audit log for sensitive mutations. |

## Row-Level Security

Authorization for private challenges (and the projects/NDAs derived from
them) is enforced at the **database** layer using PostgreSQL Row-Level
Security.

The application is expected to begin every request transaction with:

```sql
SELECT set_config('app.current_user_id',   '<uuid>', true);
SELECT set_config('app.current_user_role', '<role>', true);
```

The helper `withRlsContext()` in `lib/prisma.ts` does this automatically.
Policies declared in `prisma/migrations/.../migration.sql` then ensure that:

- `PUBLIC` challenges are visible to everyone.
- `PRIVATE_NDA` challenges are visible only to: admins, the posting
  company rep, users with an active row in `challenge_access`, and project
  members already on the challenge.
- Projects, NDAs and signatures inherit the same access rule via the
  `app_can_access_challenge()` SQL function.
- Users can only update their own profile; signatures can only be inserted
  for the calling user.

Reference / catalog tables (`companies`, `academic_entities`, `taxonomy_tags`,
join tables) intentionally have RLS disabled — they are public reads.

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL
npm install
npx prisma migrate deploy     # applies the initial migration incl. RLS
npm run db:seed               # optional: minimal reference data
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server. |
| `npm run db:generate` | Regenerate the Prisma client. |
| `npm run db:migrate` | Create a new migration (development). |
| `npm run db:deploy` | Apply migrations (CI / production). |
| `npm run db:seed` | Insert minimal reference data. |
