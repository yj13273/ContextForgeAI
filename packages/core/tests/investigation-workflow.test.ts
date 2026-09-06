import { describe, it, expect, vi } from "vitest";
import {
  InvestigationWorkflow,
  type StepRecord,
} from "../src/orchestrator/investigation-workflow.js";
import type { Context } from "../src/domain/context.js";
import type { HumanEmployee, AICoworker } from "../src/domain/entities.js";
import type { Task } from "../src/domain/task.js";
import type { Reasoner, ReasoningResult } from "../src/domain/reasoner.js";

describe("Milestone 6: Investigation Workflow ('Investigate an Issue')", () => {
  const employee: HumanEmployee = {
    id: "emp_alice",
    name: "Alice",
    email: "alice@acme.com",
    role: "Staff Engineer",
    organizationId: "org_acme",
    createdAt: new Date(),
  };

  const coworker: AICoworker = {
    id: "coworker_devbot",
    name: "DevBot",
    persona: "Software Engineer",
    organizationId: "org_acme",
    capabilities: ["github:read", "linear:read", "linear:write"],
    systemPrompt: "Investigate issues systematically.",
    createdByHumanId: "emp_alice",
    createdAt: new Date(),
  };

  const task: Task = {
    id: "task_inv_101",
    title: "Investigate ENG-142",
    description: "Session leak in auth service",
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
      name: "Alice",
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
      capabilities: ["github:read", "linear:read", "linear:write"],
      systemPrompt: "Investigate issues systematically.",
    },
    memories: [],
    knowledge: [],
    conversation: { taskId: "task_inv_101", steps: [] },
    task: {
      id: "task_inv_101",
      title: "Investigate ENG-142",
      description: "Session leak in auth service",
      workflow: "investigate_issue",
      status: "CREATED",
    },
    tools: [
      { name: "linear:get_issue", type: "read", description: "Get issue", requiredCapability: "linear:read" },
      { name: "github:search_code", type: "read", description: "Search code", requiredCapability: "github:read" },
      { name: "github:get_file", type: "read", description: "Get file", requiredCapability: "github:read" },
      { name: "linear:update_issue", type: "write", description: "Update issue", requiredCapability: "linear:write" },
    ],
    permissions: {
      allowedToolNames: ["linear:get_issue", "github:search_code", "github:get_file", "linear:update_issue"],
      requiresApprovalToolNames: ["linear:update_issue"],
    },
  };

  it("should complete a full read-only investigation with evidence and findings", async () => {
    const recordedSteps: StepRecord[] = [];
    const auditRecords: any[] = [];

    // Simulate multi-step reasoner returning tool calls then final result
    let reasonerCallCount = 0;
    const mockReasoner: Reasoner = {
      reason: vi.fn().mockImplementation(async () => {
        reasonerCallCount++;
        if (reasonerCallCount === 1) {
          // Step 1: request Linear issue
          return {
            type: "tool_call",
            toolName: "linear:get_issue",
            input: { issueId: "ENG-142" },
            reasoning: "Checking Linear issue description and stack trace.",
          } as unknown as ReasoningResult;
        }
        if (reasonerCallCount === 2) {
          // Step 2: request GitHub code search
          return {
            type: "tool_call",
            toolName: "github:search_code",
            input: { query: "sessionCache.set", owner: "acme", repo: "auth-service" },
            reasoning: "Searching for sessionCache in auth service repository.",
          } as unknown as ReasoningResult;
        }
        // Step 3: produce final structured investigation result
        return {
          type: "final",
          content: JSON.stringify({
            issue: "ENG-142",
            summary: "Memory leak caused by unbounded session cache Map in auth-service.",
            findings: [
              "Linear issue ENG-142 reports memory growth under high session creation volume.",
              "Found Map-based sessionCache in src/session.ts without eviction or TTL.",
            ],
            likelyRootCause: "Missing TTL expiration on session cache entries in auth-service/src/session.ts.",
            evidence: [
              {
                type: "linear_issue",
                description: "ENG-142 reports session cache memory leak",
                reference: "ENG-142",
              },
              {
                type: "github_code",
                description: "Map instantiation without TTL in session.ts",
                reference: "src/session.ts:L42",
              },
            ],
            relevantFiles: ["src/session.ts"],
            relevantCommits: ["c8f2a1b"],
            recommendedFix: "Replace native Map with LRUCache and enforce a 3600s TTL.",
            confidence: 0.95,
          }),
        } as unknown as ReasoningResult;
      }),
    };

    const mockToolExecutionService = {
      execute: vi.fn().mockImplementation(async ({ call }: any) => {
        if (call.toolName === "linear:get_issue") {
          return {
            success: true,
            data: { id: "ENG-142", title: "Auth session leak", description: "OOM on session cache" },
          };
        }
        if (call.toolName === "github:search_code") {
          return {
            success: true,
            data: { items: [{ path: "src/session.ts", score: 1.0 }] },
          };
        }
        return { success: true, data: {} };
      }),
    };

    const mockAuditSink = {
      record: vi.fn().mockImplementation(async (rec) => {
        auditRecords.push(rec);
        return { ...rec, id: "audit_1", timestamp: new Date() };
      }),
      getEventsForTask: vi.fn().mockResolvedValue([]),
    };

    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      },
      reasoner: mockReasoner,
      toolExecutionService: mockToolExecutionService,
      stepRecorder: {
        recordStep: async (_, step) => {
          recordedSteps.push(step);
        },
      },
      auditSink: mockAuditSink,
    });

    const result = await workflow.run({
      organizationId: "org_acme",
      employee,
      coworker,
      task,
      issueKey: "ENG-142",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.investigationResult).toBeDefined();
    expect(result.investigationResult?.issue).toBe("ENG-142");
    expect(result.investigationResult?.likelyRootCause).toContain("Missing TTL expiration");
    expect(result.investigationResult?.evidence.length).toBe(2);
    expect(result.investigationResult?.confidence).toBe(0.95);

    // Verify task steps tracking
    expect(recordedSteps.some((s) => s.stepType === "context")).toBe(true);
    expect(recordedSteps.some((s) => s.stepType === "tool_call" && s.payload.toolName === "linear:get_issue")).toBe(true);
    expect(recordedSteps.some((s) => s.stepType === "tool_call" && s.payload.toolName === "github:search_code")).toBe(true);
    expect(recordedSteps.some((s) => s.stepType === "final")).toBe(true);

    // Verify tool execution service was invoked for read tools
    expect(mockToolExecutionService.execute).toHaveBeenCalledTimes(2);

    // Verify audit events
    expect(auditRecords.some((a) => a.eventType === "task_started")).toBe(true);
    expect(auditRecords.some((a) => a.eventType === "context_built")).toBe(true);
    expect(auditRecords.some((a) => a.eventType === "task_completed")).toBe(true);
  });

  it("should pause at AWAITING_APPROVAL when write tool (linear:update_issue) is requested", async () => {
    const mockReasoner: Reasoner = {
      reason: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolName: "linear:update_issue",
        input: {
          issueId: "ENG-142",
          state: "In Review",
          comment: "Investigation completed. Root cause identified as missing TTL.",
        },
      } as unknown as ReasoningResult),
    };

    const mockToolExecutionService = {
      execute: vi.fn(),
    };

    const mockApprovalService = {
      createApproval: vi.fn().mockResolvedValue({ id: "app_linear_1" }),
      resolveApproval: vi.fn(),
    };

    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      },
      reasoner: mockReasoner,
      toolExecutionService: mockToolExecutionService,
      approvalService: mockApprovalService,
    });

    const result = await workflow.run({
      organizationId: "org_acme",
      employee,
      coworker,
      task,
      issueKey: "ENG-142",
    });

    expect(result.status).toBe("AWAITING_APPROVAL");
    expect(result.approvalId).toBe("app_linear_1");
    expect(result.pendingWrite?.toolName).toBe("linear:update_issue");
    expect(result.pendingWrite?.parameters).toEqual({
      issueId: "ENG-142",
      state: "In Review",
      comment: "Investigation completed. Root cause identified as missing TTL.",
    });

    // CRITICAL: Write tool must NOT have been executed
    expect(mockToolExecutionService.execute).not.toHaveBeenCalled();
    expect(mockApprovalService.createApproval).toHaveBeenCalledOnce();
  });

  it("should execute write and save memory upon human approval", async () => {
    const mockToolExecutionService = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        data: { updated: true, issueId: "ENG-142" },
      }),
    };

    const mockApprovalService = {
      createApproval: vi.fn(),
      resolveApproval: vi.fn().mockResolvedValue({ approved: true }),
    };

    const mockMemoryPersister = {
      saveInvestigationMemory: vi.fn().mockResolvedValue(undefined),
    };

    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      },
      reasoner: { reason: vi.fn() },
      toolExecutionService: mockToolExecutionService,
      approvalService: mockApprovalService,
      memoryPersister: mockMemoryPersister,
    });

    const result = await workflow.resolveApprovalAndComplete({
      organizationId: "org_acme",
      employee,
      coworker,
      task,
      approvalId: "app_linear_1",
      pendingWrite: {
        toolName: "linear:update_issue",
        parameters: { issueId: "ENG-142", state: "In Review" },
      },
      approved: true,
      decisionNote: "Fix looks solid, proceed with Linear status update.",
      investigationResult: {
        issue: "ENG-142",
        summary: "Session memory leak resolved.",
        findings: ["Leak found in session.ts"],
        likelyRootCause: "Missing TTL in sessionCache",
        evidence: [],
        relevantFiles: ["src/session.ts"],
        relevantCommits: [],
        recommendedFix: "Implement LRUCache with 1hr TTL",
        confidence: 0.9,
      },
    });

    expect(result.status).toBe("COMPLETED");
    // Write tool executed with approved: true
    expect(mockToolExecutionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        call: {
          toolName: "linear:update_issue",
          action: "linear:update_issue",
          parameters: { issueId: "ENG-142", state: "In Review" },
        },
        approved: true,
      })
    );

    // Memory saved
    expect(mockMemoryPersister.saveInvestigationMemory).toHaveBeenCalledWith({
      organizationId: "org_acme",
      employeeId: "emp_alice",
      coworkerId: "coworker_devbot",
      issueKey: "ENG-142",
      rootCause: "Missing TTL in sessionCache",
      solution: "Implement LRUCache with 1hr TTL",
    });
  });

  it("should NOT execute write tool upon human rejection", async () => {
    const mockToolExecutionService = {
      execute: vi.fn(),
    };

    const mockApprovalService = {
      createApproval: vi.fn(),
      resolveApproval: vi.fn().mockResolvedValue({ approved: false }),
    };

    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      },
      reasoner: { reason: vi.fn() },
      toolExecutionService: mockToolExecutionService,
      approvalService: mockApprovalService,
    });

    const result = await workflow.resolveApprovalAndComplete({
      organizationId: "org_acme",
      employee,
      coworker,
      task,
      approvalId: "app_linear_1",
      pendingWrite: {
        toolName: "linear:update_issue",
        parameters: { issueId: "ENG-142" },
      },
      approved: false,
      decisionNote: "Do not update Linear yet, need more verification.",
    });

    expect(result.status).toBe("REJECTED");
    expect(mockToolExecutionService.execute).not.toHaveBeenCalled();
    expect(mockApprovalService.resolveApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        approved: false,
        decisionNote: "Do not update Linear yet, need more verification.",
      })
    );
  });

  it("should handle tool errors gracefully without crashing the workflow", async () => {
    let callCount = 0;
    const mockReasoner: Reasoner = {
      reason: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            type: "tool_call",
            toolName: "github:get_file",
            input: { owner: "acme", repo: "auth", path: "src/not_found.ts" },
          } as unknown as ReasoningResult;
        }
        return {
          type: "final",
          content: "File was not found, concluding investigation with alternative findings.",
        } as unknown as ReasoningResult;
      }),
    };

    const mockToolExecutionService = {
      execute: vi.fn().mockRejectedValue(new Error("GitHub 404: Not Found")),
    };

    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      },
      reasoner: mockReasoner,
      toolExecutionService: mockToolExecutionService,
    });

    const result = await workflow.run({
      organizationId: "org_acme",
      employee,
      coworker,
      task,
      issueKey: "ENG-142",
    });

    expect(result.status).toBe("COMPLETED");
    const failedStep = result.steps.find((s) => s.stepType === "tool_result");
    expect(failedStep?.status).toBe("failed");
    expect(failedStep?.result?.error).toContain("GitHub 404: Not Found");
  });

  it("should enforce tenant and coworker ownership boundaries", async () => {
    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: vi.fn().mockResolvedValue(sampleContext),
        gatherContext: vi.fn(),
      },
      reasoner: { reason: vi.fn() },
      toolExecutionService: { execute: vi.fn() },
    });

    // Cross-tenant employee
    const foreignEmployee = { ...employee, organizationId: "org_other" };
    await expect(
      workflow.run({
        organizationId: "org_acme",
        employee: foreignEmployee,
        coworker,
        task,
        issueKey: "ENG-142",
      })
    ).rejects.toThrow("Tenant isolation violation");

    // Unowned coworker
    const unownedCoworker = { ...coworker, createdByHumanId: "emp_someone_else" };
    await expect(
      workflow.run({
        organizationId: "org_acme",
        employee,
        coworker: unownedCoworker,
        task,
        issueKey: "ENG-142",
      })
    ).rejects.toThrow("not owned by employee");
  });
});
