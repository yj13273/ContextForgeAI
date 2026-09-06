import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";

export const taskSteps = pgTable(
  "task_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    stepType: varchar("step_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_steps_task_id_idx").on(table.taskId),
    index("task_steps_task_step_order_idx").on(table.taskId, table.stepIndex),
  ]
);

export type TaskStepRecord = typeof taskSteps.$inferSelect;
export type NewTaskStepRecord = typeof taskSteps.$inferInsert;
