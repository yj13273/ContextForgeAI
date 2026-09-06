import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { employees } from "./employees.js";
import { roles } from "./roles.js";

/**
 * Coworkers table representing AI Coworkers.
 * Explicitly separated from Human Employees, with mandatory human employee ownership.
 */
export const coworkers = pgTable(
  "coworkers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByEmployeeId: uuid("created_by_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    persona: varchar("persona", { length: 255 }).notNull().default("Software Engineer"),
    systemPrompt: text("system_prompt").notNull(),
    capabilities: jsonb("capabilities").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("coworkers_org_idx").on(table.organizationId),
    index("coworkers_created_by_idx").on(table.createdByEmployeeId),
    index("coworkers_role_idx").on(table.roleId),
  ]
);

export type CoworkerRecord = typeof coworkers.$inferSelect;
export type NewCoworkerRecord = typeof coworkers.$inferInsert;
