import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { employees } from "./employees.js";
import { coworkers } from "./coworkers.js";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByEmployeeId: uuid("created_by_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    assignedToCoworkerId: uuid("assigned_to_coworker_id")
      .notNull()
      .references(() => coworkers.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").default(""),
    workflow: varchar("workflow", { length: 100 }).notNull().default("investigate_issue"),
    status: varchar("status", { length: 50 }).notNull().default("CREATED"),
    activeApprovalId: uuid("active_approval_id"),
    resultSummary: text("result_summary"),
    resultData: jsonb("result_data").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_org_idx").on(table.organizationId),
    index("tasks_created_by_idx").on(table.createdByEmployeeId),
    index("tasks_assigned_to_idx").on(table.assignedToCoworkerId),
    index("tasks_status_idx").on(table.status),
  ]
);

export type TaskRecord = typeof tasks.$inferSelect;
export type NewTaskRecord = typeof tasks.$inferInsert;
