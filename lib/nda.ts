import { createHash } from 'node:crypto';
import {
  ChallengeVisibility,
  type Nda,
  NdaStatus,
  type Prisma
} from '@prisma/client';
import { NotFound } from '@/lib/errors';

interface RenderArgs {
  challengeTitle: string;
  companyDisplayName: string;
  projectTitle: string;
  participants: { fullName: string; email: string; role: string }[];
}

/**
 * Render the (text/markdown) body of an NDA. Snapshotted into
 * `Nda.documentBody` at creation so future template changes don't mutate
 * historical agreements.
 */
export function renderNdaTemplate(args: RenderArgs): string {
  const parties = args.participants
    .map((p) => `  - ${p.fullName} <${p.email}> (${p.role})`)
    .join('\n');

  return [
    `# Non-Disclosure Agreement`,
    ``,
    `**Challenge:** ${args.challengeTitle}`,
    `**Project:** ${args.projectTitle}`,
    `**Disclosing party:** ${args.companyDisplayName}`,
    ``,
    `## Receiving parties`,
    parties,
    ``,
    `## Terms`,
    ``,
    `1. The receiving parties agree to treat all information disclosed by ` +
      `the disclosing party in connection with the challenge as confidential.`,
    `2. Confidential information may be used solely for the purpose of ` +
      `evaluating and executing the challenge.`,
    `3. Obligations of confidentiality survive for five (5) years after ` +
      `the date of last disclosure.`,
    `4. This agreement is governed by the laws of the jurisdiction of the ` +
      `disclosing party's principal place of business.`,
    ``,
    `By signing electronically each receiving party acknowledges they have ` +
      `read and accepted these terms.`,
    ``
  ].join('\n');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Create an electronic NDA record for a newly-approved project on a
 * PRIVATE_NDA challenge. Returns `null` when the challenge is public — the
 * caller can safely ignore the result in either case.
 *
 * IMPORTANT: this only creates the NDA *document*. Individual users must
 * subsequently produce an `NdaSignature` (which is what unlocks
 * `ChallengeAccess` for them).
 */
export async function generateNdaForProject(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<Nda | null> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    include: {
      challenge: { include: { company: true } },
      members: { include: { user: true } }
    }
  });
  if (!project) throw NotFound('Project not found');

  if (project.challenge.visibility !== ChallengeVisibility.PRIVATE_NDA) {
    return null;
  }

  // Idempotent: if an NDA already exists for (challenge, company) pair on
  // this project, reuse it instead of creating a duplicate.
  const existing = await tx.nda.findFirst({
    where: {
      challengeId: project.challengeId,
      companyId: project.challenge.companyId,
      status: { in: [NdaStatus.PENDING, NdaStatus.SIGNED] }
    }
  });
  if (existing) return existing;

  const body = renderNdaTemplate({
    challengeTitle: project.challenge.title,
    companyDisplayName: project.challenge.company.displayName,
    projectTitle: project.title,
    participants: project.members.map((m) => ({
      fullName: m.user.fullName,
      email: m.user.email,
      role: m.role
    }))
  });

  return tx.nda.create({
    data: {
      challengeId: project.challengeId,
      companyId: project.challenge.companyId,
      documentBody: body,
      documentHash: sha256(body),
      status: NdaStatus.PENDING
    }
  });
}
