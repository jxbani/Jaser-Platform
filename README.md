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

## Authentication & API

Authentication is handled by **NextAuth.js (Auth.js v5)** with a Credentials
provider backed by a bcrypt-hashed `User.passwordHash`. Sessions are JWTs.

### Signup rules

`POST /api/auth/signup` enforces role-conditional validation:

| Role | Extra rule |
| --- | --- |
| `STUDENT`, `PROFESSOR` | Email must end with one of `ACADEMIC_EMAIL_SUFFIXES` (default `.edu`, `.edu.jo`, `.ac.jo`, `.edu.sa`, `.ac.uk`). |
| `COMPANY_REP` | Must supply `companyLegalName`, `companyDisplayName`, and a `registrationNumber` that matches `COMMERCIAL_REGISTRATION_REGEX`. |

A Company row is created (or reused by registration number) atomically with
the user inside one transaction.

### Challenge lifecycle

| Method | Path | Caller | Effect |
| --- | --- | --- | --- |
| `POST` | `/api/challenges` | `COMPANY_REP` (verified company) | Creates a challenge owned by the rep's company. |
| `POST` | `/api/challenges/:id/applications` | `STUDENT` | Submits a project proposal linked to a `PROFESSOR` supervisor. Project starts in `PROPOSED`. |
| `PUT`  | `/api/applications/:id/approve` | `PROFESSOR` (assigned supervisor) | Moves the project to `IN_PROGRESS`. If the challenge is `PRIVATE_NDA`, an `Nda` record is generated in the same transaction (`lib/nda.ts`). |

Cross-cutting concerns:

- **RBAC** — `lib/rbac.ts` exposes `requireUser()` / `requireRole(...roles)`
  used at the top of every protected handler. The edge middleware in
  `middleware.ts` rejects unauthenticated requests at the network edge,
  except for `/api/auth/*` (NextAuth's own endpoints + signup).
- **Error handling** — every handler wraps its body in `try/catch` and
  forwards to `toErrorResponse()` in `lib/errors.ts`, which translates
  `ApiError`, `ZodError`, and Prisma errors (`P2002`, `P2025`) into JSON
  responses with stable error codes.
- **Audit log** — application and approval mutations append an
  `AuditEvent` row tagged with actor and previous/next state.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server. |
| `npm run db:generate` | Regenerate the Prisma client. |
| `npm run db:migrate` | Create a new migration (development). |
| `npm run db:deploy` | Apply migrations (CI / production). |
| `npm run db:seed` | Insert minimal reference data. |
