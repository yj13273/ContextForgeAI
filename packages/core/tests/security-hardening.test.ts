import { describe, it, expect, vi } from "vitest";
import {
  DefaultContextEngine,
  type ContextDataProviders,
} from "../src/context/context-engine.js";
import {
  PipelineOrchestrator,
  type StepRecord,
} from "../src/index.js";
import { InvestigationWorkflow } from "../src/orchestrator/investigation-workflow.js";
import { ConfigurableLLMProvider } from "../src/llm/configurable-llm-provider.js";
import { LLMReasoner } from "../src/reasoner/llm-reasoner.js";
import { FakeLLMProvider } from "../src/llm/fake-llm-provider.js";
import type { HumanEmployee, AICoworker } from "../src/domain/entities.js";
import type { Task } from "../src/domain/task.js";
import type { Memory } from "../src/domain/memory.js";

describe("Milestone 8: Security & Reliability Hardening Suite", () => {
  const orgA = "org_alpha";
  const orgB = "org_beta_intruder";

  const employeeA: HumanEmployee = {
    id: "emp_alice_a",
    name: "Alice A",
    email: "alice@alpha.com",
    role: "Staff Engineer",
    organizationId: orgA,
    createdAt: new Date(),
  };

  const employeeB: HumanEmployee = {
    id: "emp_bob_b",
    name: "Bob B",
    email: "bob@beta.com",
    role: "Staff Engineer",
    organizationId: orgB,
    createdAt: new Date(),
  };

  const coworkerA: AICoworker = {
    id: "coworker_bot_a",
    name: "Bot A",
    persona: "Software Engineer",
    organizationId: orgA,
    capabilities: ["github:read", "linear:read", "linear:write"],
    systemPrompt: "Investigate issues.",
    createdByHumanId: employeeA.id,
    createdAt: new Date(),
  };

  const taskA: Task = {
    id: "task_secure_1",
    title: "Investigate sensitive auth vulnerability",
    description: "Confidential credentials issue",
    workflow: "investigate_issue",
    status: "CREATED",
    organizationId: orgA,
    createdByHumanId: employeeA.id,
    assignedToCoworkerId: coworkerA.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("1. Multi-Tenant Isolation & Access Control", () => {
    it("rejects cross-tenant employee access to organization task", async () => {
      const mockProviders: ContextDataProviders = {
        getEmployee: vi.fn().mockResolvedValue(employeeB), // Bob from Org B attempting Org A task
        getOrganization: vi.fn().mockResolvedValue({ id: orgA, name: "Alpha", slug: "alpha" }),
        getCoworker: vi.fn().mockResolvedValue(coworkerA),
        getTask: vi.fn().mockResolvedValue(taskA),
        getMemories: vi.fn().mockResolvedValue([]),
        getKnowledge: vi.fn().mockResolvedValue([]),
        getConversation: vi.fn().mockResolvedValue({ taskId: taskA.id, steps: [] }),
        getTools: vi.fn().mockReturnValue([]),
      };

      const engine = new DefaultContextEngine(mockProviders);
      await expect(
        engine.buildContext({
          organizationId: orgA,
          employeeId: employeeB.id,
          coworkerId: coworkerA.id,
          taskId: taskA.id,
        })
      ).rejects.toThrow(/Tenant isolation violation/);
    });

    it("rejects cross-tenant coworker access to task", async () => {
      const foreignCoworker: AICoworker = {
        ...coworkerA,
        organizationId: orgB,
      };

      const mockProviders: ContextDataProviders = {
        getEmployee: vi.fn().mockResolvedValue(employeeA),
        getOrganization: vi.fn().mockResolvedValue({ id: orgA, name: "Alpha", slug: "alpha" }),
        getCoworker: vi.fn().mockResolvedValue(foreignCoworker),
        getTask: vi.fn().mockResolvedValue(taskA),
        getMemories: vi.fn().mockResolvedValue([]),
        getKnowledge: vi.fn().mockResolvedValue([]),
        getConversation: vi.fn().mockResolvedValue({ taskId: taskA.id, steps: [] }),
        getTools: vi.fn().mockReturnValue([]),
      };

      const engine = new DefaultContextEngine(mockProviders);
      await expect(
        engine.buildContext({
          organizationId: orgA,
          employeeId: employeeA.id,
          coworkerId: foreignCoworker.id,
          taskId: taskA.id,
        })
      ).rejects.toThrow(/Tenant isolation violation/);
    });

    it("prevents coworker from self-approving write action", async () => {
      const workflow = new InvestigationWorkflow({
        contextEngine: { buildContext: vi.fn().mockResolvedValue({}) as any, gatherContext: vi.fn() },
        reasoner: { reason: vi.fn() },
        toolExecutionService: { execute: vi.fn() },
        approvalService: {
          createApproval: vi.fn(),
          resolveApproval: vi.fn().mockImplementation(async ({ reviewerEmployeeId, requestedByCoworkerId }: any) => {
            if (reviewerEmployeeId === coworkerA.id) {
              throw new Error("An AI Coworker cannot approve its own request.");
            }
            return { approved: true };
          }),
        },
      });

      // Coworker identity attempted as human approver
      const coworkerAsApprover: HumanEmployee = {
        id: coworkerA.id,
        name: "Bot A",
        email: "bot@alpha.com",
        role: "Engineer",
        organizationId: orgA,
        createdAt: new Date(),
      };

      await expect(
        workflow.resolveApprovalAndComplete({
          organizationId: orgA,
          employee: coworkerAsApprover,
          coworker: coworkerA,
          task: taskA,
          approvalId: "app_1",
          pendingWrite: { toolName: "linear:update_issue", parameters: {} },
          approved: true,
        })
      ).rejects.toThrow(/AI Coworker cannot approve its own request/);
    });

    it("filters out cross-tenant memory from entering model context", async () => {
      const contaminatedMemories: Memory[] = [
        {
          id: "mem_legit",
          organizationId: orgA,
          employeeId: null,
          coworkerId: null,
          type: "solution",
          title: "Legitimate Alpha Memory",
          content: "Safe content",
          sourceType: "task",
          importance: 5,
          confidence: 1.0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "mem_cross_tenant_leak",
          organizationId: orgB, // Stolen or foreign memory
          employeeId: null,
          coworkerId: null,
          type: "incident",
          title: "Foreign Beta Secret Memory",
          content: "Confidential beta secret payload",
          sourceType: "incident",
          importance: 5,
          confidence: 1.0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockProviders: ContextDataProviders = {
        getEmployee: vi.fn().mockResolvedValue(employeeA),
        getOrganization: vi.fn().mockResolvedValue({ id: orgA, name: "Alpha", slug: "alpha" }),
        getCoworker: vi.fn().mockResolvedValue(coworkerA),
        getTask: vi.fn().mockResolvedValue(taskA),
        getMemories: vi.fn().mockResolvedValue(contaminatedMemories),
        getKnowledge: vi.fn().mockResolvedValue([]),
        getConversation: vi.fn().mockResolvedValue({ taskId: taskA.id, steps: [] }),
        getTools: vi.fn().mockReturnValue([]),
      };

      const engine = new DefaultContextEngine(mockProviders);
      const context = await engine.buildContext({
        organizationId: orgA,
        employeeId: employeeA.id,
        coworkerId: coworkerA.id,
        taskId: taskA.id,
      });

      expect(context.memories.some((m) => m.id === "mem_cross_tenant_leak")).toBe(false);
      expect(context.memories.some((m) => m.content.includes("beta secret"))).toBe(false);
      expect(context.memories).toHaveLength(1);
    });
  });

  describe("2. Secret Redaction & Log Hardening", () => {
    it("redacts bearer tokens, GitHub tokens, and API keys from model context", async () => {
      const memoriesWithCredentials: Memory[] = [
        {
          id: "mem_cred_leak",
          organizationId: orgA,
          employeeId: null,
          coworkerId: null,
          type: "incident",
          title: "Production Incident Report",
          content: "Investigate database with Bearer ghp_secret_gh_pat_12345678 and key=lin_api_secret_key_8888",
          sourceType: "incident",
          importance: 5,
          confidence: 1.0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockProviders: ContextDataProviders = {
        getEmployee: vi.fn().mockResolvedValue(employeeA),
        getOrganization: vi.fn().mockResolvedValue({ id: orgA, name: "Alpha", slug: "alpha" }),
        getCoworker: vi.fn().mockResolvedValue(coworkerA),
        getTask: vi.fn().mockResolvedValue(taskA),
        getMemories: vi.fn().mockResolvedValue(memoriesWithCredentials),
        getKnowledge: vi.fn().mockResolvedValue([]),
        getConversation: vi.fn().mockResolvedValue({ taskId: taskA.id, steps: [] }),
        getTools: vi.fn().mockReturnValue([]),
      };

      const engine = new DefaultContextEngine(mockProviders);
      const context = await engine.buildContext({
        organizationId: orgA,
        employeeId: employeeA.id,
        coworkerId: coworkerA.id,
        taskId: taskA.id,
      });

      const memory = context.memories[0];
      expect(memory.content).not.toContain("ghp_secret_gh_pat_12345678");
      expect(memory.content).not.toContain("lin_api_secret_key_8888");
      expect(memory.content).toContain("Bearer [REDACTED]");
      expect(memory.content).toContain("key=[REDACTED]");
    });

    it("redacts API keys and bearer tokens from provider error messages", async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response("Unauthorized: Bearer sk-openai-super-secret-key-4444 failed authentication", {
            status: 401,
            statusText: "Unauthorized",
          })
        )
      );

      const provider = new ConfigurableLLMProvider({
        apiKey: "sk-openai-super-secret-key-4444",
        fetchFn: mockFetch as typeof fetch,
      });

      try {
        await provider.generate({ messages: [{ role: "user", content: "hello" }] });
      } catch (err: any) {
        expect(err.message).not.toContain("sk-openai-super-secret-key-4444");
        expect(err.message).toContain("Bearer [REDACTED]");
      }
    });
  });

  describe("3. Agent Loop Reliability & Error Handling", () => {
    it("halts and protects against infinite loops when exceeding maxSteps", async () => {
      // Reasoner loops endlessly requesting tool calls
      const endlessReasoner = {
        reason: vi.fn().mockResolvedValue({
          type: "tool_call",
          toolName: "github:get_issue",
          input: { issueId: "ENG-1" },
        }),
      };

      const workflow = new InvestigationWorkflow({
        contextEngine: {
          buildContext: vi.fn().mockResolvedValue({
            employee: employeeA,
            organization: { id: orgA, name: "Alpha", slug: "alpha" },
            role: { name: "Staff Engineer", permissions: [] },
            coworker: coworkerA,
            memories: [],
            knowledge: [],
            conversation: { taskId: taskA.id, steps: [] },
            task: taskA,
            tools: [{ name: "github:get_issue", type: "read", description: "Get issue", requiredCapability: "github:read" }],
            permissions: { allowedToolNames: ["github:get_issue"], requiresApprovalToolNames: [] },
          }),
          gatherContext: vi.fn(),
        },
        reasoner: endlessReasoner as any,
        toolExecutionService: {
          execute: vi.fn().mockResolvedValue({ success: true, data: {} }),
        },
        maxSteps: 4, // Hard limit
      });

      const result = await workflow.run({
        organizationId: orgA,
        employee: employeeA,
        coworker: coworkerA,
        task: taskA,
        issueKey: "ENG-1",
      });

      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toContain("Maximum iteration steps (4) reached");
    });

    it("recovers gracefully from malformed LLM response without crashing", async () => {
      const fakeLLM = new FakeLLMProvider([
        {
          content: "Raw unstructured text without valid JSON or tool call.",
        },
      ]);

      const reasoner = new LLMReasoner(fakeLLM);
      const result = await reasoner.reason({
        employee: employeeA,
        organization: { id: orgA, name: "Alpha", slug: "alpha" },
        role: { name: "Staff Engineer", permissions: [] },
        coworker: coworkerA,
        memories: [],
        knowledge: [],
        conversation: { taskId: taskA.id, steps: [] },
        task: taskA,
        tools: [],
        permissions: { allowedToolNames: [], requiresApprovalToolNames: [] },
      });

      expect(result.type).toBe("final");
      expect(result.isComplete).toBe(true);
      if (result.type === "final") {
        expect(result.content).toBe("Raw unstructured text without valid JSON or tool call.");
      }
    });

    it("handles tool execution failures gracefully and preserves error in task steps", async () => {
      const workflow = new InvestigationWorkflow({
        contextEngine: {
          buildContext: vi.fn().mockResolvedValue({
            employee: employeeA,
            organization: { id: orgA, name: "Alpha", slug: "alpha" },
            role: { name: "Staff Engineer", permissions: [] },
            coworker: coworkerA,
            memories: [],
            knowledge: [],
            conversation: { taskId: taskA.id, steps: [] },
            task: taskA,
            tools: [{ name: "linear:get_issue", type: "read", description: "Get issue", requiredCapability: "linear:read" }],
            permissions: { allowedToolNames: ["linear:get_issue"], requiresApprovalToolNames: [] },
          }),
          gatherContext: vi.fn(),
        },
        reasoner: {
          reason: vi.fn()
            .mockResolvedValueOnce({
              type: "tool_call",
              toolName: "linear:get_issue",
              input: { issueId: "ENG-404" },
            })
            .mockResolvedValueOnce({
              type: "final",
              content: "Linear issue not found; completed investigation with default notice.",
            }),
        } as any,
        toolExecutionService: {
          execute: vi.fn().mockRejectedValue(new Error("Linear GraphQL Error: Issue not found")),
        },
      });

      const result = await workflow.run({
        organizationId: orgA,
        employee: employeeA,
        coworker: coworkerA,
        task: taskA,
        issueKey: "ENG-404",
      });

      expect(result.status).toBe("COMPLETED");
      const toolResultStep = result.steps.find((s) => s.stepType === "tool_result");
      expect(toolResultStep?.status).toBe("failed");
      expect(toolResultStep?.result?.error).toContain("Linear GraphQL Error: Issue not found");
    });
  });
});
