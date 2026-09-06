import { describe, it, expect, vi } from "vitest";
import { DefaultContextEngine, type ContextDataProviders } from "../src/context/context-engine.js";
import type { Memory } from "../src/domain/memory.js";
import type { Knowledge } from "../src/domain/knowledge.js";

describe("Milestone 4: Context Engine & Security (Unit)", () => {
  const orgA = { id: "org_acme", name: "Acme Corp", slug: "acme" };
  const employeeA = {
    id: "emp_alice",
    name: "Alice",
    email: "alice@acme.com",
    role: "Senior Staff Engineer",
    title: "Platform Architect",
    organizationId: "org_acme",
  };
  const coworkerA = {
    id: "coworker_devbot",
    name: "DevBot",
    persona: "Software Engineer",
    capabilities: ["github:read", "linear:read", "linear:write"],
    systemPrompt: "Investigate and resolve engineering issues.",
    organizationId: "org_acme",
    createdByHumanId: "emp_alice",
  };
  const taskA = {
    id: "task_100",
    title: "Investigate auth session leak",
    description: "Memory consumption grows on session cache",
    workflow: "investigate_issue",
    status: "CREATED",
    organizationId: "org_acme",
    createdByHumanId: "emp_alice",
    assignedToCoworkerId: "coworker_devbot",
  };

  const sampleMemories: Memory[] = [
    {
      id: "mem_1",
      organizationId: "org_acme",
      employeeId: null,
      coworkerId: null,
      type: "solution",
      title: "Session cache TTL config",
      content: "Set Redis session TTL to 3600 seconds.",
      sourceType: "task",
      importance: 5,
      confidence: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "mem_2",
      organizationId: "org_acme",
      employeeId: "emp_alice",
      coworkerId: null,
      type: "preference",
      title: "Alice coding preferences",
      content: "Prefers functional decomposition and early returns.",
      sourceType: "manual",
      importance: 3,
      confidence: 0.9,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const sampleKnowledge: Knowledge[] = [
    {
      id: "kno_1",
      organizationId: "org_acme",
      title: "Authentication Architecture Spec",
      content: "JWT sessions are verified via stateless public key rotation.",
      category: "architecture",
      tags: ["auth", "security"],
      createdAt: new Date(),
    },
  ];

  const mockProviders: ContextDataProviders = {
    getEmployee: vi.fn().mockResolvedValue(employeeA),
    getOrganization: vi.fn().mockResolvedValue(orgA),
    getCoworker: vi.fn().mockResolvedValue(coworkerA),
    getTask: vi.fn().mockResolvedValue(taskA),
    getMemories: vi.fn().mockResolvedValue(sampleMemories),
    getKnowledge: vi.fn().mockResolvedValue(sampleKnowledge),
    getConversation: vi.fn().mockResolvedValue({ taskId: "task_100", steps: [] }),
    getTools: vi.fn().mockReturnValue([
      {
        name: "github:get_issue",
        type: "read",
        description: "Fetch GitHub issue",
        requiredCapability: "github:read",
      },
      {
        name: "linear:update_issue",
        type: "write",
        description: "Update Linear issue",
        requiredCapability: "linear:write",
      },
    ]),
  };

  it("should assemble a complete, bounded Context for the reasoner", async () => {
    const engine = new DefaultContextEngine(mockProviders);
    const context = await engine.buildContext({
      employeeId: "emp_alice",
      coworkerId: "coworker_devbot",
      taskId: "task_100",
      query: "session cache",
    });

    expect(context.employee.id).toBe("emp_alice");
    expect(context.organization.id).toBe("org_acme");
    expect(context.coworker.id).toBe("coworker_devbot");
    expect(context.task.id).toBe("task_100");
    expect(context.memories.length).toBe(2);
    expect(context.knowledge.length).toBe(1);
    expect(context.tools.length).toBe(2);
    expect(context.permissions.allowedToolNames).toContain("github:get_issue");
    expect(context.permissions.requiresApprovalToolNames).toContain("linear:update_issue");
  });

  it("should reject cross-tenant context assembly (employee from different organization)", async () => {
    const foreignEmployee = { ...employeeA, organizationId: "org_foreign" };
    const foreignProviders = {
      ...mockProviders,
      getEmployee: vi.fn().mockResolvedValue(foreignEmployee),
    };

    const engine = new DefaultContextEngine(foreignProviders);
    await expect(
      engine.buildContext({
        employeeId: "emp_alice",
        coworkerId: "coworker_devbot",
        taskId: "task_100",
      })
    ).rejects.toThrow("Tenant isolation violation");
  });

  it("should reject coworker ownership violation (coworker not owned by employee)", async () => {
    const unownedCoworker = { ...coworkerA, createdByHumanId: "emp_someone_else" };
    const unownedProviders = {
      ...mockProviders,
      getCoworker: vi.fn().mockResolvedValue(unownedCoworker),
    };

    const engine = new DefaultContextEngine(unownedProviders);
    await expect(
      engine.buildContext({
        employeeId: "emp_alice",
        coworkerId: "coworker_devbot",
        taskId: "task_100",
      })
    ).rejects.toThrow("not owned by or assigned to employee");
  });

  it("should enforce memory boundaries and sanitize secrets from context", async () => {
    const memoriesWithSecret: Memory[] = [
      {
        id: "mem_leak",
        organizationId: "org_acme",
        employeeId: null,
        coworkerId: null,
        type: "incident",
        title: "Leaked credentials in incident ticket",
        content: "API connection string with Bearer ghp_super_secret_pat_99999 and apiKey=lin_api_key_88888",
        sourceType: "incident",
        importance: 5,
        confidence: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        // Mismatched foreign organization memory (must be dropped)
        id: "mem_foreign",
        organizationId: "org_foreign_hack",
        employeeId: null,
        coworkerId: null,
        type: "fact",
        title: "Foreign memory",
        content: "Should never enter context.",
        sourceType: "manual",
        importance: 5,
        confidence: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const secretProviders: ContextDataProviders = {
      ...mockProviders,
      getMemories: vi.fn().mockResolvedValue(memoriesWithSecret),
    };

    const engine = new DefaultContextEngine(secretProviders);
    const context = await engine.buildContext({
      employeeId: "emp_alice",
      coworkerId: "coworker_devbot",
      taskId: "task_100",
    });

    // Foreign memory was filtered out
    expect(context.memories.some((m) => m.id === "mem_foreign")).toBe(false);

    // Secrets in memories were sanitized
    const incidentMemory = context.memories.find((m) => m.id === "mem_leak");
    expect(incidentMemory).toBeDefined();
    expect(incidentMemory?.content).not.toContain("ghp_super_secret_pat_99999");
    expect(incidentMemory?.content).not.toContain("lin_api_key_88888");
    expect(incidentMemory?.content).toContain("Bearer [REDACTED]");
    expect(incidentMemory?.content).toContain("apiKey=[REDACTED]");
  });

  it("should keep context bounded to maxMemories and maxKnowledge", async () => {
    const manyMemories: Memory[] = Array.from({ length: 25 }, (_, i) => ({
      id: `mem_${i}`,
      organizationId: "org_acme",
      employeeId: null,
      coworkerId: null,
      type: "fact",
      title: `Fact ${i}`,
      content: `Content of fact ${i}`,
      sourceType: "manual",
      importance: 3,
      confidence: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const boundedProviders: ContextDataProviders = {
      ...mockProviders,
      getMemories: vi.fn().mockResolvedValue(manyMemories),
    };

    const engine = new DefaultContextEngine(boundedProviders);
    const context = await engine.buildContext({
      employeeId: "emp_alice",
      coworkerId: "coworker_devbot",
      taskId: "task_100",
      maxMemories: 5,
    });

    expect(context.memories.length).toBe(5);
  });
});
