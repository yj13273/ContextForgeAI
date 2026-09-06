import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDbClient, closeDbClient, type ContextForgeDb } from "../src/client.js";
import { OrganizationRepository } from "../src/repositories/organization-repository.js";
import { EmployeeRepository } from "../src/repositories/employee-repository.js";
import { CoworkerRepository } from "../src/repositories/coworker-repository.js";
import { MemoryRepository } from "../src/repositories/memory-repository.js";
import type pg from "pg";

describe("Milestone 4: Memory Repository & Scoping (Integration)", () => {
  let db: ContextForgeDb;
  let pool: pg.Pool;
  let orgRepo: OrganizationRepository;
  let empRepo: EmployeeRepository;
  let cowRepo: CoworkerRepository;
  let memRepo: MemoryRepository;

  let orgAId: string;
  let orgBId: string;
  let empA1Id: string;
  let empA2Id: string;
  let cowA1Id: string;
  let cowA2Id: string;

  beforeAll(async () => {
    const client = createDbClient();
    db = client.db;
    pool = client.pool;
    orgRepo = new OrganizationRepository(db);
    empRepo = new EmployeeRepository(db);
    cowRepo = new CoworkerRepository(db);
    memRepo = new MemoryRepository(db);

    // Setup Organization A
    const orgA = await orgRepo.create({
      name: "Acme Cybernetics",
      slug: `acme-mem-${Date.now()}`,
    });
    orgAId = orgA.id;

    // Setup Organization B
    const orgB = await orgRepo.create({
      name: "Competitor Corp",
      slug: `comp-mem-${Date.now()}`,
    });
    orgBId = orgB.id;

    // Employees in Org A
    const empA1 = await empRepo.create({
      organizationId: orgAId,
      name: "Alice Engineer",
      email: `alice-${Date.now()}@acme.com`,
      title: "Senior Backend Engineer",
    });
    empA1Id = empA1.id;

    const empA2 = await empRepo.create({
      organizationId: orgAId,
      name: "Bob Engineer",
      email: `bob-${Date.now()}@acme.com`,
      title: "QA Engineer",
    });
    empA2Id = empA2.id;

    // Coworkers in Org A
    const cowA1 = await cowRepo.create({
      organizationId: orgAId,
      createdByEmployeeId: empA1Id,
      name: "CodeBot",
      persona: "Backend Specialist",
      systemPrompt: "Solve backend issues.",
      capabilities: ["github:read", "linear:read"],
    });
    cowA1Id = cowA1.id;

    const cowA2 = await cowRepo.create({
      organizationId: orgAId,
      createdByEmployeeId: empA2Id,
      name: "TestBot",
      persona: "Testing Specialist",
      systemPrompt: "Run test suites.",
      capabilities: ["github:read"],
    });
    cowA2Id = cowA2.id;
  });

  afterAll(async () => {
    await closeDbClient(pool);
  });

  it("should create and retrieve a memory", async () => {
    const mem = await memRepo.create({
      organizationId: orgAId,
      type: "solution",
      title: "Fix for database connection timeout",
      content: "Set idleTimeoutMillis to 30000 in connection pool.",
      sourceType: "investigation",
      importance: 4,
      confidence: 0.95,
    });

    expect(mem.id).toBeDefined();
    expect(mem.organizationId).toBe(orgAId);
    expect(mem.title).toBe("Fix for database connection timeout");
    expect(mem.importance).toBe(4);

    const retrieved = await memRepo.findById(orgAId, mem.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(mem.id);
  });

  it("should strictly enforce tenant isolation: Org B cannot access Org A memories", async () => {
    const memA = await memRepo.create({
      organizationId: orgAId,
      type: "fact",
      title: "Confidential Project Phoenix Architecture",
      content: "Microservices deployed on private Kubernetes cluster.",
      sourceType: "architecture",
      importance: 5,
    });

    // 1. Direct ID lookup scoped to Org B returns null
    const notFoundInOrgB = await memRepo.findById(orgBId, memA.id);
    expect(notFoundInOrgB).toBeNull();

    // 2. Scoped query in Org B returns 0 memories from Org A
    const orgBMemories = await memRepo.findScopedMemories({
      organizationId: orgBId,
      query: "Phoenix",
    });
    expect(orgBMemories.length).toBe(0);
  });

  it("should enforce employee scoping: employee-scoped memories only exposed to authorized employee", async () => {
    // Memory scoped specifically to Alice (empA1)
    await memRepo.create({
      organizationId: orgAId,
      employeeId: empA1Id,
      type: "preference",
      title: "Alice's editor settings",
      content: "Prefers 2-space indentation and explicit return types.",
      importance: 2,
    });

    // Query for Alice: should see the preference
    const aliceMemories = await memRepo.findScopedMemories({
      organizationId: orgAId,
      employeeId: empA1Id,
      type: "preference",
    });
    expect(aliceMemories.some((m) => m.title === "Alice's editor settings")).toBe(true);

    // Query for Bob: should NOT see Alice's preference
    const bobMemories = await memRepo.findScopedMemories({
      organizationId: orgAId,
      employeeId: empA2Id,
      type: "preference",
    });
    expect(bobMemories.some((m) => m.title === "Alice's editor settings")).toBe(false);
  });

  it("should enforce coworker scoping: coworker-scoped memories only exposed to appropriate coworker", async () => {
    // Memory scoped specifically to CodeBot (cowA1)
    await memRepo.create({
      organizationId: orgAId,
      coworkerId: cowA1Id,
      type: "lesson",
      title: "CodeBot learned: avoid inline regex recompilation",
      content: "Pre-compile regular expressions in static scope for high-throughput loops.",
      importance: 4,
    });

    // Query for CodeBot (cowA1): should see lesson
    const codeBotMemories = await memRepo.findScopedMemories({
      organizationId: orgAId,
      coworkerId: cowA1Id,
      type: "lesson",
    });
    expect(codeBotMemories.some((m) => m.title.includes("avoid inline regex"))).toBe(true);

    // Query for TestBot (cowA2): should NOT see CodeBot's lesson
    const testBotMemories = await memRepo.findScopedMemories({
      organizationId: orgAId,
      coworkerId: cowA2Id,
      type: "lesson",
    });
    expect(testBotMemories.some((m) => m.title.includes("avoid inline regex"))).toBe(false);
  });

  it("should expose organization-wide memories to all employees and coworkers in that org", async () => {
    // Org-wide memory (both employeeId and coworkerId are null)
    await memRepo.create({
      organizationId: orgAId,
      employeeId: null,
      coworkerId: null,
      type: "procedure",
      title: "Standard Pull Request Checklist",
      content: "All PRs must include unit tests and pass linter before review.",
      importance: 5,
    });

    // Both Alice + CodeBot query
    const resultsAlice = await memRepo.findScopedMemories({
      organizationId: orgAId,
      employeeId: empA1Id,
      coworkerId: cowA1Id,
      type: "procedure",
    });
    expect(resultsAlice.some((m) => m.title === "Standard Pull Request Checklist")).toBe(true);

    // Bob + TestBot query
    const resultsBob = await memRepo.findScopedMemories({
      organizationId: orgAId,
      employeeId: empA2Id,
      coworkerId: cowA2Id,
      type: "procedure",
    });
    expect(resultsBob.some((m) => m.title === "Standard Pull Request Checklist")).toBe(true);
  });

  it("should filter by query and order by importance descending", async () => {
    await memRepo.create({
      organizationId: orgAId,
      type: "incident",
      title: "High memory alert on Redis node",
      content: "Key eviction policy was disabled leading to Out Of Memory crash.",
      importance: 5,
    });

    await memRepo.create({
      organizationId: orgAId,
      type: "incident",
      title: "Minor Redis latency spike",
      content: "Transient latency during cache warmup period.",
      importance: 2,
    });

    const results = await memRepo.findScopedMemories({
      organizationId: orgAId,
      query: "Redis",
      limit: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(2);
    // Highest importance first
    expect(results[0].importance).toBeGreaterThanOrEqual(results[1].importance);
  });
});
