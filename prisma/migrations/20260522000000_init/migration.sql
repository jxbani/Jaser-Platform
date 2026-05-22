-- =============================================================================
-- Jaser Platform – initial migration
-- Creates the relational schema and PostgreSQL Row-Level Security policies
-- that govern access to private (NDA-gated) challenges and their downstream
-- artifacts (projects, NDAs, audit events).
-- =============================================================================

-- ---------- Extensions -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------- Enumerations -----------------------------------------------------
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'PROFESSOR', 'COMPANY_REP', 'ADMIN');
CREATE TYPE "AcademicEntityType" AS ENUM ('UNIVERSITY', 'FACULTY', 'DEPARTMENT');
CREATE TYPE "ChallengeVisibility" AS ENUM ('PUBLIC', 'PRIVATE_NDA');
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'AWARDED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ProjectStatus" AS ENUM ('PROPOSED', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'COMPLETED');
CREATE TYPE "ProjectMemberRole" AS ENUM ('STUDENT_LEAD', 'STUDENT', 'PROFESSOR_SUPERVISOR', 'COMPANY_MENTOR');
CREATE TYPE "NdaStatus" AS ENUM ('PENDING', 'SIGNED', 'REVOKED', 'EXPIRED');
CREATE TYPE "TaxonomyDiscipline" AS ENUM (
  'TECHNOLOGY', 'ENGINEERING', 'SCIENCES', 'MEDICINE', 'LAW',
  'BUSINESS', 'HUMANITIES', 'ARTS', 'SOCIAL_SCIENCES', 'INTERDISCIPLINARY'
);

-- ---------- Tables -----------------------------------------------------------

CREATE TABLE "companies" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "legalName"   TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "taxId"       TEXT UNIQUE,
  "profileData" JSONB NOT NULL DEFAULT '{}',
  "verified"    BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

CREATE TABLE "academic_entities" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"      TEXT NOT NULL,
  "type"      "AcademicEntityType" NOT NULL,
  "metadata"  JSONB NOT NULL DEFAULT '{}',
  "parentId"  UUID REFERENCES "academic_entities"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("parentId", "name", "type")
);
CREATE INDEX "academic_entities_type_idx" ON "academic_entities" ("type");

CREATE TABLE "users" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"           CITEXT NOT NULL UNIQUE,
  "fullName"        TEXT NOT NULL,
  "role"            "UserRole" NOT NULL,
  "reputationScore" INTEGER NOT NULL DEFAULT 0,
  "profileData"     JSONB NOT NULL DEFAULT '{}',
  "isActive"        BOOLEAN NOT NULL DEFAULT TRUE,
  "departmentId"    UUID REFERENCES "academic_entities"("id") ON DELETE SET NULL,
  "companyId"       UUID REFERENCES "companies"("id") ON DELETE SET NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);
CREATE INDEX "users_role_idx"         ON "users" ("role");
CREATE INDEX "users_departmentId_idx" ON "users" ("departmentId");
CREATE INDEX "users_companyId_idx"    ON "users" ("companyId");

CREATE TABLE "taxonomy_tags" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"        TEXT NOT NULL UNIQUE,
  "label"       TEXT NOT NULL,
  "discipline"  "TaxonomyDiscipline" NOT NULL,
  "description" TEXT,
  "parentId"    UUID REFERENCES "taxonomy_tags"("id") ON DELETE CASCADE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  UNIQUE ("parentId", "label")
);
CREATE INDEX "taxonomy_tags_discipline_idx" ON "taxonomy_tags" ("discipline");

CREATE TABLE "challenges" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"              TEXT NOT NULL,
  "description"        TEXT NOT NULL,
  "visibility"         "ChallengeVisibility" NOT NULL DEFAULT 'PUBLIC',
  "budgetMicroGrant"   BIGINT NOT NULL DEFAULT 0,
  "currency"           CHAR(3) NOT NULL DEFAULT 'USD',
  "status"             "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
  "submissionDeadline" TIMESTAMP(3),
  "awardedAt"          TIMESTAMP(3),
  "companyId"          UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "postedById"         UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL
);
CREATE INDEX "challenges_companyId_idx"  ON "challenges" ("companyId");
CREATE INDEX "challenges_status_idx"     ON "challenges" ("status");
CREATE INDEX "challenges_visibility_idx" ON "challenges" ("visibility");

CREATE TABLE "challenge_tags" (
  "challengeId" UUID NOT NULL REFERENCES "challenges"("id") ON DELETE CASCADE,
  "tagId"       UUID NOT NULL REFERENCES "taxonomy_tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("challengeId", "tagId")
);

CREATE TABLE "challenge_access" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengeId" UUID NOT NULL REFERENCES "challenges"("id") ON DELETE CASCADE,
  "userId"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "grantedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"   TIMESTAMP(3),
  UNIQUE ("challengeId", "userId")
);
CREATE INDEX "challenge_access_userId_idx" ON "challenge_access" ("userId");

CREATE TABLE "projects" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"       TEXT NOT NULL,
  "abstract"    TEXT NOT NULL,
  "artifacts"   JSONB NOT NULL DEFAULT '{}',
  "status"      "ProjectStatus" NOT NULL DEFAULT 'PROPOSED',
  "challengeId" UUID NOT NULL REFERENCES "challenges"("id") ON DELETE CASCADE,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);
CREATE INDEX "projects_challengeId_idx" ON "projects" ("challengeId");
CREATE INDEX "projects_status_idx"      ON "projects" ("status");

CREATE TABLE "project_members" (
  "projectId" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "userId"    UUID NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
  "role"      "ProjectMemberRole" NOT NULL,
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("projectId", "userId")
);
CREATE INDEX "project_members_userId_idx" ON "project_members" ("userId");

CREATE TABLE "project_tags" (
  "projectId" UUID NOT NULL REFERENCES "projects"("id")     ON DELETE CASCADE,
  "tagId"     UUID NOT NULL REFERENCES "taxonomy_tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("projectId", "tagId")
);

CREATE TABLE "ndas" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengeId"  UUID NOT NULL REFERENCES "challenges"("id") ON DELETE CASCADE,
  "companyId"    UUID NOT NULL REFERENCES "companies"("id")  ON DELETE CASCADE,
  "documentBody" TEXT NOT NULL,
  "documentHash" CHAR(64) NOT NULL,
  "status"       "NdaStatus" NOT NULL DEFAULT 'PENDING',
  "effectiveAt"  TIMESTAMP(3),
  "expiresAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ndas_challengeId_idx" ON "ndas" ("challengeId");
CREATE INDEX "ndas_companyId_idx"   ON "ndas" ("companyId");

CREATE TABLE "nda_signatures" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ndaId"            UUID NOT NULL REFERENCES "ndas"("id")  ON DELETE CASCADE,
  "userId"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "signaturePayload" TEXT NOT NULL,
  "signatureContext" JSONB NOT NULL DEFAULT '{}',
  "signedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("ndaId", "userId")
);
CREATE INDEX "nda_signatures_userId_idx" ON "nda_signatures" ("userId");

CREATE TABLE "audit_events" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId"    UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action"     TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   UUID,
  "payload"    JSONB NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events" ("entityType", "entityId");
CREATE INDEX "audit_events_actorId_idx"             ON "audit_events" ("actorId");

-- =============================================================================
-- Row-Level Security
-- -----------------------------------------------------------------------------
-- The application sets two GUCs at the start of every transaction:
--     SELECT set_config('app.current_user_id',   '<uuid>', true);
--     SELECT set_config('app.current_user_role', '<role>', true);
-- The policies below read those values via helper functions and authorise
-- each row individually.
-- =============================================================================

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
$$;

CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_role', TRUE), '')
$$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT app_current_user_role() = 'ADMIN'
$$;

-- True when the calling user has signed an active NDA (or is the company rep
-- that posted the challenge, or an admin) for the given challenge.
CREATE OR REPLACE FUNCTION app_can_access_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "challenges" c
      WHERE c."id" = p_challenge_id
        AND (c."visibility" = 'PUBLIC' OR c."postedById" = app_current_user_id())
    )
    OR EXISTS (
      SELECT 1 FROM "challenge_access" ca
      WHERE ca."challengeId" = p_challenge_id
        AND ca."userId"      = app_current_user_id()
        AND ca."revokedAt" IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM "project_members" pm
      JOIN "projects" p ON p."id" = pm."projectId"
      WHERE p."challengeId" = p_challenge_id
        AND pm."userId"     = app_current_user_id()
    )
$$;

-- ---------- Challenges -------------------------------------------------------
ALTER TABLE "challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenges" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "challenges_select_public_or_authorized"
  ON "challenges" FOR SELECT
  USING (
    "visibility" = 'PUBLIC'
    OR app_is_admin()
    OR "postedById" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "challenge_access" ca
      WHERE ca."challengeId" = "challenges"."id"
        AND ca."userId"      = app_current_user_id()
        AND ca."revokedAt" IS NULL
    )
  );

CREATE POLICY "challenges_insert_company_rep"
  ON "challenges" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR ("postedById" = app_current_user_id()
        AND app_current_user_role() = 'COMPANY_REP')
  );

CREATE POLICY "challenges_update_owner"
  ON "challenges" FOR UPDATE
  USING (app_is_admin() OR "postedById" = app_current_user_id())
  WITH CHECK (app_is_admin() OR "postedById" = app_current_user_id());

CREATE POLICY "challenges_delete_owner"
  ON "challenges" FOR DELETE
  USING (app_is_admin() OR "postedById" = app_current_user_id());

-- ---------- Projects ---------------------------------------------------------
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "projects_select_member_or_challenge_owner"
  ON "projects" FOR SELECT
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "project_members" pm
      WHERE pm."projectId" = "projects"."id"
        AND pm."userId"    = app_current_user_id()
    )
    OR app_can_access_challenge("projects"."challengeId")
  );

CREATE POLICY "projects_insert_authorized_student"
  ON "projects" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR (
      app_current_user_role() IN ('STUDENT', 'PROFESSOR')
      AND app_can_access_challenge("challengeId")
    )
  );

CREATE POLICY "projects_update_member"
  ON "projects" FOR UPDATE
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "project_members" pm
      WHERE pm."projectId" = "projects"."id"
        AND pm."userId"    = app_current_user_id()
    )
  );

CREATE POLICY "projects_delete_admin"
  ON "projects" FOR DELETE
  USING (app_is_admin());

-- ---------- Project members --------------------------------------------------
ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_members" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "project_members_select_self_or_peer"
  ON "project_members" FOR SELECT
  USING (
    app_is_admin()
    OR "userId" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "project_members" peer
      WHERE peer."projectId" = "project_members"."projectId"
        AND peer."userId"    = app_current_user_id()
    )
  );

CREATE POLICY "project_members_write_self_or_admin"
  ON "project_members" FOR ALL
  USING (app_is_admin() OR "userId" = app_current_user_id())
  WITH CHECK (app_is_admin() OR "userId" = app_current_user_id());

-- ---------- NDAs -------------------------------------------------------------
ALTER TABLE "ndas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ndas" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "ndas_select_signatory_or_company"
  ON "ndas" FOR SELECT
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "nda_signatures" s
      WHERE s."ndaId"  = "ndas"."id"
        AND s."userId" = app_current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM "users" u
      WHERE u."id"        = app_current_user_id()
        AND u."companyId" = "ndas"."companyId"
    )
  );

CREATE POLICY "ndas_insert_company_rep"
  ON "ndas" FOR INSERT
  WITH CHECK (
    app_is_admin()
    OR (
      app_current_user_role() = 'COMPANY_REP'
      AND EXISTS (
        SELECT 1 FROM "users" u
        WHERE u."id"        = app_current_user_id()
          AND u."companyId" = "ndas"."companyId"
      )
    )
  );

CREATE POLICY "ndas_update_company_rep"
  ON "ndas" FOR UPDATE
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "users" u
      WHERE u."id"        = app_current_user_id()
        AND u."companyId" = "ndas"."companyId"
    )
  );

-- ---------- NDA signatures ---------------------------------------------------
ALTER TABLE "nda_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nda_signatures" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "nda_signatures_select_self_or_company"
  ON "nda_signatures" FOR SELECT
  USING (
    app_is_admin()
    OR "userId" = app_current_user_id()
    OR EXISTS (
      SELECT 1
      FROM "ndas" n
      JOIN "users" u ON u."companyId" = n."companyId"
      WHERE n."id" = "nda_signatures"."ndaId"
        AND u."id" = app_current_user_id()
    )
  );

CREATE POLICY "nda_signatures_insert_self"
  ON "nda_signatures" FOR INSERT
  WITH CHECK (app_is_admin() OR "userId" = app_current_user_id());

-- ---------- Challenge access (managed by system, readable by self) ----------
ALTER TABLE "challenge_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_access" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "challenge_access_select_self_or_owner"
  ON "challenge_access" FOR SELECT
  USING (
    app_is_admin()
    OR "userId" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "challenges" c
      WHERE c."id" = "challenge_access"."challengeId"
        AND c."postedById" = app_current_user_id()
    )
  );

CREATE POLICY "challenge_access_write_admin_or_owner"
  ON "challenge_access" FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "challenges" c
      WHERE c."id" = "challenge_access"."challengeId"
        AND c."postedById" = app_current_user_id()
    )
  )
  WITH CHECK (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM "challenges" c
      WHERE c."id" = "challenge_access"."challengeId"
        AND c."postedById" = app_current_user_id()
    )
  );

-- ---------- Users (self-readable; admins see all) ---------------------------
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "users_select_visible_profile"
  ON "users" FOR SELECT
  USING (
    app_is_admin()
    OR "id" = app_current_user_id()
    OR "isActive" = TRUE
  );

CREATE POLICY "users_update_self"
  ON "users" FOR UPDATE
  USING (app_is_admin() OR "id" = app_current_user_id())
  WITH CHECK (app_is_admin() OR "id" = app_current_user_id());

-- ---------- Audit events (append-only; readable by admins / actor) ----------
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "audit_events_select_admin_or_actor"
  ON "audit_events" FOR SELECT
  USING (app_is_admin() OR "actorId" = app_current_user_id());

CREATE POLICY "audit_events_insert_any_authenticated"
  ON "audit_events" FOR INSERT
  WITH CHECK (app_current_user_id() IS NOT NULL);

-- Public (no RLS) tables: companies, academic_entities, taxonomy_tags,
-- challenge_tags, project_tags – these are reference / catalog data and
-- intentionally readable by everyone.
