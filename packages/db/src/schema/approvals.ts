import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { tasks } from "./tasks.js";
import { coworkers } from "./coworkers.js";
import { employees } from "./employees.js";

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    requestedByCoworkerId: uuid("requested_by_coworker_id")
      .notNull()
      .references(() => coworkers.id, { onDelete: "restrict" }),
    reviewedByEmployeeId: uuid("reviewed_by_employee_id").references(
      () => employees.id,
      { onDelete: "set null" }
    ),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    toolCall: jsonb("tool_call")
      .$type<{
        toolName: string;
        action: string;
        parameters: Record<string, unknown>;
      }>()
      .notNull(),
    decisionNote: text("decision_note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("approvals_org_idx").on(table.organizationId),
    index("approvals_task_idx").on(table.taskId),
    index("approvals_status_idx").on(table.status),
    index("approvals_requested_by_idx").on(table.requestedByCoworkerId),
  ]
);

export type ApprovalRecord = typeof approvals.$inferSelect;
export type NewApprovalRecord = typeof approvals.$inferInsert;
