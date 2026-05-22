import { z } from 'zod';
import { ChallengeVisibility } from '@prisma/client';

export const createChallengeSchema = z.object({
  title: z.string().min(8).max(200),
  description: z.string().min(50).max(20_000),
  visibility: z.nativeEnum(ChallengeVisibility).default(ChallengeVisibility.PUBLIC),
  budgetMicroGrant: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .default(0),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be an ISO 4217 code')
    .default('USD'),
  submissionDeadline: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  tagIds: z.array(z.string().uuid()).max(20).default([])
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const applyToChallengeSchema = z.object({
  title: z.string().min(8).max(200),
  abstract: z.string().min(50).max(10_000),
  supervisorId: z.string().uuid(),
  artifacts: z.record(z.unknown()).optional()
});

export type ApplyToChallengeInput = z.infer<typeof applyToChallengeSchema>;
