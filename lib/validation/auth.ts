import { z } from 'zod';
import { UserRole } from '@prisma/client';

/**
 * Suffixes (matched case-insensitively, from the end of the email) that
 * count as an academic email. Configurable via ACADEMIC_EMAIL_SUFFIXES.
 */
export function academicEmailSuffixes(): string[] {
  const raw =
    process.env.ACADEMIC_EMAIL_SUFFIXES ?? '.edu,.edu.jo,.ac.jo,.edu.sa,.ac.uk';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAcademicEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return academicEmailSuffixes().some((s) => lower.endsWith(s));
}

export function commercialRegistrationRegex(): RegExp {
  const raw = process.env.COMMERCIAL_REGISTRATION_REGEX ?? '^[A-Z0-9-]{5,20}$';
  return new RegExp(raw);
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

export const signinSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200)
});

// ---------------------------------------------------------------------------
// Sign-up
// ---------------------------------------------------------------------------

const baseSignup = z.object({
  email: z.string().email().max(254),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(200, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  fullName: z.string().min(2).max(120)
});

export const studentSignupSchema = baseSignup
  .extend({
    role: z.literal(UserRole.STUDENT),
    departmentId: z.string().uuid().optional()
  })
  .superRefine((data, ctx) => {
    if (!isAcademicEmail(data.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: `Students must register with an academic email (one of: ${academicEmailSuffixes().join(', ')})`
      });
    }
  });

export const professorSignupSchema = baseSignup
  .extend({
    role: z.literal(UserRole.PROFESSOR),
    departmentId: z.string().uuid().optional()
  })
  .superRefine((data, ctx) => {
    if (!isAcademicEmail(data.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: `Professors must register with an academic email (one of: ${academicEmailSuffixes().join(', ')})`
      });
    }
  });

export const companySignupSchema = baseSignup
  .extend({
    role: z.literal(UserRole.COMPANY_REP),
    companyLegalName: z.string().min(2).max(200),
    companyDisplayName: z.string().min(2).max(200),
    registrationNumber: z.string().min(1).max(40),
    taxId: z.string().max(40).optional()
  })
  .superRefine((data, ctx) => {
    if (!commercialRegistrationRegex().test(data.registrationNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registrationNumber'],
        message:
          'Invalid commercial registration number format. ' +
          `Expected pattern: ${commercialRegistrationRegex().source}`
      });
    }
  });

export const signupSchema = z.union([
  studentSignupSchema,
  professorSignupSchema,
  companySignupSchema
]);

export type SignupInput =
  | z.infer<typeof studentSignupSchema>
  | z.infer<typeof professorSignupSchema>
  | z.infer<typeof companySignupSchema>;
