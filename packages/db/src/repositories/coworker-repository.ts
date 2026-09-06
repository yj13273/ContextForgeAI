import { eq, and } from "drizzle-orm";
import type { ContextForgeDb } from "../client.js";
import { coworkers, type CoworkerRecord } from "../schema/coworkers.js";
import { employees } from "../schema/employees.js";
import { TenantIsolationError } from "./errors.js";

export class CoworkerRepository {
  constructor(private readonly db: ContextForgeDb) {}

  async create(data: {
    organizationId: string;
    createdByEmployeeId: string;
    name: string;
    persona?: string;
    systemPrompt: string;
    capabilities?: string[];
    roleId?: string;
  }): Promise<CoworkerRecord> {
    // Enforce tenant boundary: employee must belong to the organization
    const [employee] = await this.db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, data.createdByEmployeeId),
          eq(employees.organizationId, data.organizationId)
        )
      );

    if (!employee) {
      throw new TenantIsolationError(
        `Cannot create AI coworker: Employee '${data.createdByEmployeeId}' not found in organization '${data.organizationId}'.`
      );
    }

    const [record] = await this.db
      .insert(coworkers)
      .values({
        organizationId: data.organizationId,
        createdByEmployeeId: data.createdByEmployeeId,
        name: data.name,
        persona: data.persona ?? "Software Engineer",
        systemPrompt: data.systemPrompt,
        capabilities: data.capabilities ?? [],
        roleId: data.roleId,
      })
      .returning();

    return record;
  }

  async findById(organizationId: string, id: string): Promise<CoworkerRecord | null> {
    const [record] = await this.db
      .select()
      .from(coworkers)
      .where(and(eq(coworkers.id, id), eq(coworkers.organizationId, organizationId)));
    return record || null;
  }

  async listByOrg(organizationId: string): Promise<CoworkerRecord[]> {
    return this.db
      .select()
      .from(coworkers)
      .where(eq(coworkers.organizationId, organizationId));
  }
}
