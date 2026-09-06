import { eq } from "drizzle-orm";
import type { ContextForgeDb } from "../client.js";
import { organizations, type OrganizationRecord } from "../schema/organizations.js";

export class OrganizationRepository {
  constructor(private readonly db: ContextForgeDb) {}

  async create(data: { name: string; slug: string }): Promise<OrganizationRecord> {
    const [record] = await this.db
      .insert(organizations)
      .values({
        name: data.name,
        slug: data.slug,
      })
      .returning();
    return record;
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    const [record] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));
    return record || null;
  }

  async findBySlug(slug: string): Promise<OrganizationRecord | null> {
    const [record] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug));
    return record || null;
  }
}
