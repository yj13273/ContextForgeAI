import { z } from "zod";

export const MemoryTypeSchema = z.enum([
  "fact",
  "decision",
  "solution",
  "incident",
  "preference",
  "procedure",
  "lesson",
]);

export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MemorySchema = z.object({
  id: z.string().min(1, "Memory ID is required"),
  organizationId: z.string().min(1, "Organization ID is required"),
  employeeId: z.string().nullable().optional(),
  coworkerId: z.string().nullable().optional(),
  type: MemoryTypeSchema,
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  sourceType: z.string().default("manual"),
  sourceId: z.string().nullable().optional(),
  importance: z.number().int().min(1).max(5).default(3),
  confidence: z.number().min(0).max(1).default(1.0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Memory = z.infer<typeof MemorySchema>;
