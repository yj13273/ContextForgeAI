import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "CREATED",
  "GATHERING_CONTEXT",
  "REASONING",
  "AWAITING_APPROVAL",
  "EXECUTING_ACTION",
  "COMPLETED",
  "REJECTED",
  "FAILED",
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskWorkflowSchema = z.enum([
  "investigate_issue",
]);

export type TaskWorkflow = z.infer<typeof TaskWorkflowSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  workflow: TaskWorkflowSchema.default("investigate_issue"),
  status: TaskStatusSchema.default("CREATED"),
  organizationId: z.string().min(1, "Organization ID is required"),
  createdByHumanId: z.string().min(1, "Task must be created by a Human Employee"),
  assignedToCoworkerId: z.string().min(1, "Task must be assigned to an AI Coworker"),
  activeApprovalId: z.string().optional(),
  resultSummary: z.string().optional(),
  resultData: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Task = z.infer<typeof TaskSchema>;
