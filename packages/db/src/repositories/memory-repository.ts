import { eq, and, or, isNull, ilike, desc } from "drizzle-orm";
import type { ContextForgeDb } from "../client.js";
import {
  memories,
  type MemoryRecord,
  type NewMemoryRecord,
} from "../schema/schema.js";

export interface FindScopedMemoriesParams {
  organizationId: string;
  employeeId?: string;
  coworkerId?: string;
  type?: string;
  query?: string;
  limit?: number;
}

export class MemoryRepository {
  constructor(private readonly db: ContextForgeDb) {}

  async create(record: NewMemoryRecord): Promise<MemoryRecord> {
    const [created] = await this.db.insert(memories).values(record).returning();
    return created;
  }

  async createMemory(record: NewMemoryRecord): Promise<MemoryRecord> {
    return this.create(record);
  }

  async findById(organizationId: string, id: string): Promise<MemoryRecord | null> {
    const [found] = await this.db
      .select()
      .from(memories)
      .where(and(eq(memories.id, id), eq(memories.organizationId, organizationId)))
      .limit(1);

    return found ?? null;
  }

  async getMemoryById(id: string, organizationId: string): Promise<MemoryRecord | null> {
    return this.findById(organizationId, id);
  }

  /**
   * Retrieves bounded memories enforcing strict multi-tenant isolation and scoping:
   * - Never returns memories from other organizations.
   * - Exposes organization-wide memories (employeeId IS NULL and coworkerId IS NULL).
   * - Exposes employee-scoped memories only if employeeId matches.
   * - Exposes coworker-scoped memories only if coworkerId matches.
   * - Exposes pair-scoped memories if both match.
   */
  async findScopedMemories(params: FindScopedMemoriesParams): Promise<MemoryRecord[]> {
    const { organizationId, employeeId, coworkerId, type, query, limit = 10 } = params;

    // Build visibility scope conditions
    const scopeConditions = [
      // 1. Organization-wide memories
      and(isNull(memories.employeeId), isNull(memories.coworkerId)),
    ];

    if (employeeId && coworkerId) {
      scopeConditions.push(
        and(eq(memories.employeeId, employeeId), isNull(memories.coworkerId)),
        and(eq(memories.coworkerId, coworkerId), isNull(memories.employeeId)),
        and(eq(memories.employeeId, employeeId), eq(memories.coworkerId, coworkerId))
      );
    } else if (employeeId) {
      scopeConditions.push(
        and(eq(memories.employeeId, employeeId), isNull(memories.coworkerId))
      );
    } else if (coworkerId) {
      scopeConditions.push(
        and(eq(memories.coworkerId, coworkerId), isNull(memories.employeeId))
      );
    }

    const conditions = [
      eq(memories.organizationId, organizationId),
      or(...scopeConditions),
    ];

    if (type) {
      conditions.push(eq(memories.type, type));
    }

    if (query && query.trim().length > 0) {
      const q = `%${query.trim()}%`;
      conditions.push(or(ilike(memories.title, q), ilike(memories.content, q))!);
    }

    return this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.importance), desc(memories.createdAt))
      .limit(limit);
  }

  async deleteMemory(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(memories)
      .where(and(eq(memories.id, id), eq(memories.organizationId, organizationId)))
      .returning();

    return result.length > 0;
  }
}
