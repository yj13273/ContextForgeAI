import { z } from "zod";

export const InvestigationEvidenceTypeSchema = z.enum([
  "linear_issue",
  "linear_comment",
  "github_code",
  "github_file",
  "github_commit",
  "github_pull_request",
]);

export type InvestigationEvidenceType = z.infer<typeof InvestigationEvidenceTypeSchema>;

export const InvestigationEvidenceSchema = z.object({
  type: InvestigationEvidenceTypeSchema,
  description: z.string().min(1),
  reference: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

export type InvestigationEvidence = z.infer<typeof InvestigationEvidenceSchema>;

export const ProposedLinearUpdateSchema = z.object({
  state: z.string().optional(),
  comment: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
});

export type ProposedLinearUpdate = z.infer<typeof ProposedLinearUpdateSchema>;

export const InvestigationResultSchema = z.object({
  issue: z.string().min(1),
  summary: z.string().min(1),
  findings: z.array(z.string()).default([]),
  likelyRootCause: z.string().min(1),
  evidence: z.array(InvestigationEvidenceSchema).default([]),
  relevantFiles: z.array(z.string()).default([]),
  relevantCommits: z.array(z.string()).default([]),
  recommendedFix: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.8),
  proposedLinearUpdate: ProposedLinearUpdateSchema.optional(),
});

export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;
