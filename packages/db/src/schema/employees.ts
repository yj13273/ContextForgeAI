import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { roles } from "./roles.js";

/**
 * Employees table representing Human Employees.
 * Genuinely separate entity from AI Coworkers.
 */
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull().default("Software Engineer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("employees_org_idx").on(table.organizationId),
    index("employees_user_idx").on(table.userId),
    index("employees_role_idx").on(table.roleId),
    uniqueIndex("employees_org_email_idx").on(table.organizationId, table.email),
  ]
);

export type EmployeeRecord = typeof employees.$inferSelect;
export type NewEmployeeRecord = typeof employees.$inferInsert;
