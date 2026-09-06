import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { tasks } from "./tasks.js";

/**
 * Activity Events table representing immutable audit logs.
 * Note: Table structure is append-only by design; application repositories
 * enforce append-only insertions without in-place mutation.
 */
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    actorType: varchar("actor_type", { length: 50 }).notNull(),
    actorId: uuid("actor_id").notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_events_org_idx").on(table.organizationId),
    index("activity_events_task_idx").on(table.taskId),
    index("activity_events_actor_idx").on(table.actorId),
    index("activity_events_timestamp_idx").on(table.timestamp),
  ]
);

export type ActivityEventRecord = typeof activityEvents.$inferSelect;
export type NewActivityEventRecord = typeof activityEvents.$inferInsert;
