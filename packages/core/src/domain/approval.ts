import { z } from "zod";
import { ToolCallIntentSchema } from "./tools.js";

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  toolCall: ToolCallIntentSchema,
  requestedByCoworkerId: z.string().min(1),
  status: ApprovalStatusSchema.default("pending"),
  reviewedByHumanId: z.string().optional(),
  decisionNote: z.string().optional(),
  requestedAt: z.date().default(() => new Date()),
  reviewedAt: z.date().optional(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
