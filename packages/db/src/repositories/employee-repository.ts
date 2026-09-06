import { eq, and } from "drizzle-orm";
import type { ContextForgeDb } from "../client.js";
import { employees, type EmployeeRecord } from "../schema/employees.js";

export class EmployeeRepository {
  constructor(private readonly db: ContextForgeDb) {}

  async create(data: {
    organizationId: string;
    name: string;
    email: string;
    title?: string;
    userId?: string;
    roleId?: string;
  }): Promise<EmployeeRecord> {
    const [record] = await this.db
      .insert(employees)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        email: data.email,
        title: data.title ?? "Software Engineer",
        userId: data.userId,
        roleId: data.roleId,
      })
      .returning();
    return record;
  }

  async findById(organizationId: string, id: string): Promise<EmployeeRecord | null> {
    const [record] = await this.db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId)));
    return record || null;
  }

  async findByIdGlobal(id: string): Promise<EmployeeRecord | null> {
    const [record] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id));
    return record || null;
  }

  async findByEmail(organizationId: string, email: string): Promise<EmployeeRecord | null> {
    const [record] = await this.db
      .select()
      .from(employees)
      .where(and(eq(employees.email, email), eq(employees.organizationId, organizationId)));
    return record || null;
  }

  async listByOrg(organizationId: string): Promise<EmployeeRecord[]> {
    return this.db
      .select()
      .from(employees)
      .where(eq(employees.organizationId, organizationId));
  }
}
