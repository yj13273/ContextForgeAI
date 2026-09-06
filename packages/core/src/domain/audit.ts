import { z } from "zod";

export const AuditActorTypeSchema = z.enum([
  "human_employee",
  "ai_coworker",
  "system",
]);

export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;

export const AuditRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.date().default(() => new Date()),
  taskId: z.string().min(1),
  actorType: AuditActorTypeSchema,
  actorId: z.string().min(1),
  eventType: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

export type AuditRecord = z.infer<typeof AuditRecordSchema>;

/**
 * Architectural contract for recording audit trails and state changes.
 * Milestone 1 implements in-memory retention; persistent database storage
 * is deferred to the database milestone.
 */
export interface AuditSink {
  record(entry: Omit<AuditRecord, "id" | "timestamp">): Promise<AuditRecord>;
  getEventsForTask(taskId: string): Promise<AuditRecord[]>;
}

export class InMemoryAuditSink implements AuditSink {
  private records: AuditRecord[] = [];

  async record(entry: Omit<AuditRecord, "id" | "timestamp">): Promise<AuditRecord> {
    const record: AuditRecord = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async getEventsForTask(taskId: string): Promise<AuditRecord[]> {
    return this.records.filter((r) => r.taskId === taskId);
  }

  getAllEvents(): AuditRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}
