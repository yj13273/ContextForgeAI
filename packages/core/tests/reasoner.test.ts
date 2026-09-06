import { describe, it, expect, vi } from "vitest";
import { LLMReasoner } from "../src/reasoner/llm-reasoner.js";
import { FakeLLMProvider } from "../src/llm/fake-llm-provider.js";
import { runAgentLoop } from "../src/orchestrator/agent-loop.js";
import type { Context } from "../src/domain/context.js";
import type { Task } from "../src/domain/task.js";
import type { AICoworker, HumanEmployee } from "../src/domain/entities.js";

describe("Milestone 5: LLM Reasoner & Agent Loop (Unit)", () => {
  const sampleEmployee: HumanEmployee = {
    id: "emp_alice",
    name: "Alice Engineer",
    email: "alice@acme.com",
    role: "Staff Engineer",
    organizationId: "org_acme",
    createdAt: new Date(),
  };

  const sampleCoworker: AICoworker = {
    id: "coworker_devbot",
    name: "DevBot",
    persona: "Software Engineer",
    capabilities: ["github:read", "github:write", "linear:read", "linear:write"],
    systemPrompt: "You are an automated engineering coworker. Analyze root causes systematically.",
    organizationId: "org_acme",
    createdByHumanId: "emp_alice",
    createdAt: new Date(),
  };

  const sampleTask: Task = {
    id: "task_100",
    title: "Investigate database connection leak",
    description: "Connection pool is exhausted under load",
    workflow: "investigate_issue",
    status: "CREATED",
    organizationId: "org_acme",
    createdByHumanId: "emp_alice",
    assignedToCoworkerId: "coworker_devbot",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleContext: Context = {
    employee: {
      id: "emp_alice",
      name: "Alice Engineer",
      email: "alice@acme.com",
      role: "Staff Engineer",
    },
    organization: {
      id: "org_acme",
      name: "Acme Corp",
      slug: "acme",
    },
    role: {
      name: "Staff Engineer",
      permissions: ["task:read", "task:execute"],
    },
    coworker: {
      id: "coworker_devbot",
      name: "DevBot",
      persona: "Software Engineer",
      capabilities: ["github:read", "linear:read"],
      systemPrompt: "You are an automated engineering coworker. Analyze root causes systematically.",
    },
    memories: [
      {
        id: "mem_1",
        organizationId: "org_acme",
        type: "solution",
        title: "Pool size configuration",
        content: "Set maximum connection pool to 20.",
        sourceType: "task",
        importance: 5,
        confidence: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    knowledge: [
      {
        id: "kno_1",
        organizationId: "org_acme",
        title: "PostgreSQL Pooling Spec",
        content: "We use PgBouncer in transaction mode.",
        category: "architecture",
        tags: ["db"],
        createdAt: new Date(),
      },
    ],
    conversation: {
      taskId: "task_100",
      steps: [],
    },
    task: {
      id: "task_100",
      title: "Investigate database connection leak",
      description: "Connection pool is exhausted under load",
      workflow: "investigate_issue",
      status: "CREATED",
    },
    tools: [
      {
        name: "github:get_issue",
        type: "read",
        description: "Fetch GitHub issue details",
        requiredCapability: "github:read",
      },
      {
        name: "github:create_comment",
        type: "write",
        description: "Post comment to GitHub issue",
        requiredCapability: "github:write",
      },
    ],
    permissions: {
      allowedToolNames: ["github:get_issue", "github:create_comment"],
      requiresApprovalToolNames: ["github:create_comment"],
    },
  };

  it("should return a final result when LLM returns a text answer", async () => {
    const fakeLLM = new FakeLLMProvider([
      {
        content: "The connection leak is caused by unclosed transactions in the health check endpoint.",
      },
    ]);

    const reasoner = new LLMReasoner(fakeLLM);
    const result = await reasoner.reason(sampleContext);

    expect(result.type).toBe("final");
    expect(result.isComplete).toBe(true);
    if (result.type === "final") {
      expect(result.content).toContain("unclosed transactions in the health check endpoint");
    }
  });

  it("should return a tool_call result when LLM returns a native tool call", async () => {
    const fakeLLM = new FakeLLMProvider([
      {
        content: "I need to inspect the issue on GitHub.",
        toolCall: {
          name: "github:get_issue",
          input: { owner: "acme", repo: "backend", issueNumber: 42 },
        },
      },
    ]);

    const reasoner = new LLMReasoner(fakeLLM);
    const result = await reasoner.reason(sampleContext);

    expect(result.type).toBe("tool_call");
    expect(result.isComplete).toBe(false);
    if (result.type === "tool_call") {
      expect(result.toolName).toBe("github:get_issue");
      expect(result.input).toEqual({ owner: "acme", repo: "backend", issueNumber: 42 });
    }
    expect(result.toolIntent).toEqual({
      toolName: "github:get_issue",
      action: "github:get_issue",
      parameters: { owner: "acme", repo: "backend", issueNumber: 42 },
    });
  });

  it("should handle embedded JSON tool request fallback", async () => {
    const fakeLLM = new FakeLLMProvider([
      {
        content: JSON.stringify({
          tool: "github:get_issue",
          parameters: { owner: "acme", repo: "backend", issueNumber: 99 },
          reasoning: "Checking issue details for context.",
        }),
      },
    ]);

    const reasoner = new LLMReasoner(fakeLLM);
    const result = await reasoner.reason(sampleContext);

    expect(result.type).toBe("tool_call");
    if (result.type === "tool_call") {
      expect(result.toolName).toBe("github:get_issue");
      expect(result.input).toEqual({ owner: "acme", repo: "backend", issueNumber: 99 });
      expect(result.reasoning).toBe("Checking issue details for context.");
    }
  });

  it("should strictly preserve boundary: LLMReasoner NEVER executes tools directly", async () => {
    const fakeLLM = new FakeLLMProvider([
      {
        content: "Executing tool",
        toolCall: {
          name: "github:get_issue",
          input: { issueNumber: 1 },
        },
      },
    ]);

    const reasoner = new LLMReasoner(fakeLLM);
    const result = await reasoner.reason(sampleContext);

    // Verify it only returned data structure and did not perform side effects
    expect(result.type).toBe("tool_call");
    expect((result as any).data).toBeUndefined(); // no tool execution data
    expect((result as any).output).toBeUndefined();
  });

  it("should inject coworker persona, memories, and knowledge into the LLM system prompt", async () => {
    const fakeLLM = new FakeLLMProvider([
      {
        content: "Understood.",
      },
    ]);

    const reasoner = new LLMReasoner(fakeLLM);
    await reasoner.reason(sampleContext);

    const received = fakeLLM.getReceivedRequests();
    expect(received.length).toBe(1);

    const systemMessage = received[0].messages.find((m) => m.role === "system")?.content;
    expect(systemMessage).toBeDefined();
    expect(systemMessage).toContain("DevBot");
    expect(systemMessage).toContain("Software Engineer");
    expect(systemMessage).toContain("Analyze root causes systematically.");
    expect(systemMessage).toContain("[SOLUTION] Pool size configuration: Set maximum connection pool to 20.");
    expect(systemMessage).toContain("[ARCHITECTURE] PostgreSQL Pooling Spec: We use PgBouncer in transaction mode.");
  });

  describe("runAgentLoop execution coordination", () => {
    it("should coordinate multi-step reasoning, execute read tools, and complete", async () => {
      const fakeLLM = new FakeLLMProvider([
        // Step 1: LLM requests read tool
        {
          content: "Let me check the issue first.",
          toolCall: {
            name: "github:get_issue",
            input: { owner: "acme", repo: "backend", issueNumber: 42 },
          },
        },
        // Step 2: LLM provides final root cause analysis
        {
          content: "Root cause found: connection pool leak in health check endpoint.",
        },
      ]);

      const mockToolExecutionService = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 42, title: "DB connection leak", state: "open" },
        }),
      };

      const mockContextEngine = {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      };

      const reasoner = new LLMReasoner(fakeLLM);

      const loopResult = await runAgentLoop({
        contextEngine: mockContextEngine as any,
        reasoner,
        toolExecutionService: mockToolExecutionService,
        coworker: sampleCoworker,
        employee: sampleEmployee,
        task: sampleTask,
        maxSteps: 5,
      });

      expect(loopResult.status).toBe("COMPLETED");
      expect(loopResult.finalContent).toContain("Root cause found");
      expect(loopResult.steps.length).toBe(2);
      expect(mockToolExecutionService.execute).toHaveBeenCalledOnce();
      expect(mockToolExecutionService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          call: {
            toolName: "github:get_issue",
            action: "github:get_issue",
            parameters: { owner: "acme", repo: "backend", issueNumber: 42 },
          },
        })
      );
    });

    it("should pause execution when a write tool is requested (requiring human approval)", async () => {
      const fakeLLM = new FakeLLMProvider([
        // LLM requests write tool: github:create_comment
        {
          content: "I want to post a comment.",
          toolCall: {
            name: "github:create_comment",
            input: { owner: "acme", repo: "backend", issueNumber: 42, body: "Root cause fixed." },
          },
        },
      ]);

      const mockToolExecutionService = {
        execute: vi.fn(),
      };

      const mockContextEngine = {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      };

      const reasoner = new LLMReasoner(fakeLLM);

      const loopResult = await runAgentLoop({
        contextEngine: mockContextEngine as any,
        reasoner,
        toolExecutionService: mockToolExecutionService,
        coworker: sampleCoworker,
        employee: sampleEmployee,
        task: sampleTask,
        maxSteps: 5,
      });

      expect(loopResult.status).toBe("AWAITING_APPROVAL");
      expect(loopResult.pendingApproval).toBeDefined();
      expect(loopResult.pendingApproval?.toolName).toBe("github:create_comment");
      expect(loopResult.pendingApproval?.parameters).toEqual({
        owner: "acme",
        repo: "backend",
        issueNumber: 42,
        body: "Root cause fixed.",
      });
      // The tool execution service must NEVER have been called for unapproved write
      expect(mockToolExecutionService.execute).not.toHaveBeenCalled();
    });
  });
});
