import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Organizations table.
 * Top-level multi-tenant boundary.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OrganizationRecord = typeof organizations.$inferSelect;
export type NewOrganizationRecord = typeof organizations.$inferInsert;

/**
 * Users table.
 * Human user authentication records.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;

/**
 * Roles table.
 * Organizational roles with permission definitions.
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    permissions: jsonb("permissions").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("roles_org_idx").on(table.organizationId)]
);

export type RoleRecord = typeof roles.$inferSelect;
export type NewRoleRecord = typeof roles.$inferInsert;

/**
 * Employees table.
 * Represents Human Employees — strictly separate from AI Coworkers.
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

/**
 * Coworkers table.
 * Represents AI Coworkers — strictly separate from Human Employees.
 * Genuinely owned by a human employee (createdByEmployeeId).
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

/**
 * Tasks table.
 * Autonomous workflows executed by AI Coworkers with human oversight.
 */
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

/**
 * Task Steps table.
 * Detailed chronological progression of task phases.
 */
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

/**
 * Approvals table.
 * Deterministic human-in-the-loop gate for write actions.
 */
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

/**
 * Activity Events table.
 * Append-only audit record table.
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
    actorId: varchar("actor_id", { length: 255 }).notNull(),
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

// Drizzle Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  roles: many(roles),
  employees: many(employees),
  coworkers: many(coworkers),
  tasks: many(tasks),
  approvals: many(approvals),
  activityEvents: many(activityEvents),
  memories: many(memories),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [employees.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [employees.roleId],
    references: [roles.id],
  }),
  ownedCoworkers: many(coworkers),
  createdTasks: many(tasks),
  reviewedApprovals: many(approvals),
  memories: many(memories),
}));

export const coworkersRelations = relations(coworkers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [coworkers.organizationId],
    references: [organizations.id],
  }),
  createdByEmployee: one(employees, {
    fields: [coworkers.createdByEmployeeId],
    references: [employees.id],
  }),
  role: one(roles, {
    fields: [coworkers.roleId],
    references: [roles.id],
  }),
  assignedTasks: many(tasks),
  requestedApprovals: many(approvals),
  memories: many(memories),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  createdByEmployee: one(employees, {
    fields: [tasks.createdByEmployeeId],
    references: [employees.id],
  }),
  assignedToCoworker: one(coworkers, {
    fields: [tasks.assignedToCoworkerId],
    references: [coworkers.id],
  }),
  steps: many(taskSteps),
  approvals: many(approvals),
  activityEvents: many(activityEvents),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  organization: one(organizations, {
    fields: [approvals.organizationId],
    references: [organizations.id],
  }),
  task: one(tasks, {
    fields: [approvals.taskId],
    references: [tasks.id],
  }),
  requestedByCoworker: one(coworkers, {
    fields: [approvals.requestedByCoworkerId],
    references: [coworkers.id],
  }),
  reviewedByEmployee: one(employees, {
    fields: [approvals.reviewedByEmployeeId],
    references: [employees.id],
  }),
}));

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
