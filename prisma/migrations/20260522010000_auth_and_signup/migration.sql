-- Authentication + signup fields.
ALTER TABLE "users"     ADD COLUMN "passwordHash"       TEXT;
ALTER TABLE "companies" ADD COLUMN "registrationNumber" TEXT;

CREATE UNIQUE INDEX "companies_registrationNumber_key"
  ON "companies" ("registrationNumber");
