import { z } from "zod";

/**
 * Human Employee schema and domain entity.
 * Represents an actual person within the organization.
 */
export const HumanEmployeeSchema = z.object({
  id: z.string().min(1, "Human employee ID is required"),
  email: z.string().email("Valid email required"),
  name: z.string().min(1, "Name is required"),
  role: z.string().default("Engineer"),
  organizationId: z.string().min(1, "Organization ID is required"),
  createdAt: z.date().default(() => new Date()),
});

export type HumanEmployee = z.infer<typeof HumanEmployeeSchema>;

/**
 * AI Coworker schema and domain entity.
 * Represents an AI team member with a specialized persona.
 * Explicitly separated from HumanEmployee with separate IDs and ownership.
 */
export const AICoworkerSchema = z.object({
  id: z.string().min(1, "AI coworker ID is required"),
  name: z.string().min(1, "Coworker name is required"),
  persona: z.string().default("Software Engineer"),
  organizationId: z.string().min(1, "Organization ID is required"),
  capabilities: z.array(z.string()).default([]),
  systemPrompt: z.string().min(1, "System prompt is required"),
  createdByHumanId: z.string().min(1, "Must be created and owned by a Human Employee"),
  createdAt: z.date().default(() => new Date()),
});

export type AICoworker = z.infer<typeof AICoworkerSchema>;
