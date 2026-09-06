import { eq, desc, and } from "drizzle-orm";
import type { AuditSink, AuditRecord } from "@contextforge/core";
import type { ContextForgeDb } from "../client.js";
import { activityEvents, type ActivityEventRecord } from "../schema/activity-events.js";
import { tasks } from "../schema/tasks.js";

/**
 * AuditRepository implementing the core AuditSink contract using PostgreSQL.
 * Note: Designed as append-only at the application layer. No update or delete
 * operations are exposed.
 */
export class AuditRepository implements AuditSink {
  constructor(
    private readonly db: ContextForgeDb,
    private readonly defaultOrgId?: string
  ) {}

  async record(entry: Omit<AuditRecord, "id" | "timestamp">): Promise<AuditRecord> {
    // Resolve organizationId from task if available, or default
    let orgId = this.defaultOrgId;
    if (entry.taskId) {
      const [task] = await this.db
        .select({ organizationId: tasks.organizationId })
        .from(tasks)
        .where(eq(tasks.id, entry.taskId));
      if (task) {
        orgId = task.organizationId;
      }
    }

    if (!orgId) {
      // Fallback or throw if no organizationId can be resolved
      orgId = "00000000-0000-0000-0000-000000000000";
    }

    const [record] = await this.db
      .insert(activityEvents)
      .values({
        organizationId: orgId,
        taskId: entry.taskId || null,
        actorType: entry.actorType,
        actorId: entry.actorId,
        eventType: entry.eventType,
        payload: entry.payload,
      })
      .returning();

    return {
      id: record.id,
      timestamp: record.timestamp,
      taskId: record.taskId ?? "",
      actorType: record.actorType as AuditRecord["actorType"],
      actorId: record.actorId,
      eventType: record.eventType,
      payload: record.payload ?? {},
    };
  }

  async getEventsForTask(taskId: string): Promise<AuditRecord[]> {
    const rows = await this.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.taskId, taskId))
      .orderBy(activityEvents.timestamp);

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      taskId: r.taskId ?? "",
      actorType: r.actorType as AuditRecord["actorType"],
      actorId: r.actorId,
      eventType: r.eventType,
      payload: r.payload ?? {},
    }));
  }

  async getEventsForOrg(organizationId: string, limit = 100): Promise<ActivityEventRecord[]> {
    return this.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.organizationId, organizationId))
      .orderBy(desc(activityEvents.timestamp))
      .limit(limit);
  }
}
