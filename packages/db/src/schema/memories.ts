import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { employees } from "./employees.js";
import { coworkers } from "./coworkers.js";

/**
 * Memories table.
 * First-class domain model for information learned or preserved from previous work.
 * Supports organization-wide, employee-scoped, or coworker-scoped persistence.
 */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "cascade",
    }),
    coworkerId: uuid("coworker_id").references(() => coworkers.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 50 }).notNull(), // fact, decision, solution, incident, preference, procedure, lesson
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    sourceType: varchar("source_type", { length: 100 }).notNull().default("manual"),
    sourceId: varchar("source_id", { length: 255 }),
    importance: integer("importance").notNull().default(3),
    confidence: doublePrecision("confidence").notNull().default(1.0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memories_org_idx").on(table.organizationId),
    index("memories_employee_idx").on(table.employeeId),
    index("memories_coworker_idx").on(table.coworkerId),
    index("memories_type_idx").on(table.type),
    index("memories_org_type_idx").on(table.organizationId, table.type),
  ]
);

export type MemoryRecord = typeof memories.$inferSelect;
export type NewMemoryRecord = typeof memories.$inferInsert;

export const memoriesRelations = relations(memories, ({ one }) => ({
  organization: one(organizations, {
    fields: [memories.organizationId],
    references: [organizations.id],
  }),
  employee: one(employees, {
    fields: [memories.employeeId],
    references: [employees.id],
  }),
  coworker: one(coworkers, {
    fields: [memories.coworkerId],
    references: [coworkers.id],
  }),
}));
