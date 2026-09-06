import { z } from "zod";

export const KnowledgeCategorySchema = z.enum([
  "architecture",
  "policy",
  "runbook",
  "documentation",
  "guide",
]);

export type KnowledgeCategory = z.infer<typeof KnowledgeCategorySchema>;

export const KnowledgeSchema = z.object({
  id: z.string().min(1, "Knowledge ID is required"),
  organizationId: z.string().min(1, "Organization ID is required"),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: KnowledgeCategorySchema.default("documentation"),
  sourceUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
});

export type Knowledge = z.infer<typeof KnowledgeSchema>;
