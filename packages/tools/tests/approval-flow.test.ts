import { describe, it, expect, vi } from "vitest";
import { createDefaultToolRegistry } from "../src/registry/tool-registry.js";
import {
  PipelineOrchestrator,
  ValidationError,
  type HumanEmployee,
  type AICoworker,
  type Task,
  type ContextEngine,
  type Reasoner,
  type AuditSink,
} from "@contextforge/core";
import { createMockGitHubClient, createMockLinearClient } from "./mocks/provider-mocks.js";

describe("Milestone 3: Approval Flow Integration (Tests 11-14)", () => {
  const ghClient = createMockGitHubClient();
  const linClient = createMockLinearClient();
  const registry = createDefaultToolRegistry(ghClient, linClient);

  const humanEmployee: HumanEmployee = {
    id: "emp_human_01",
    email: "alice@acme.com",
    name: "Alice Engineer",
    role: "Staff Engineer",
    organizationId: "org_acme_prod",
    createdAt: new Date(),
  };

  const aiCoworker: AICoworker = {
    id: "coworker_ai_01",
    name: "DevBot",
    persona: "Software Engineer",
    organizationId: "org_acme_prod",
    capabilities: ["github:read", "linear:read", "linear:write"],
    systemPrompt: "Investigate issues and propose updates.",
    createdByHumanId: "emp_human_01",
    createdAt: new Date(),
  };

  const createInitialTask = (): Task => ({
    id: "task_investigate_write_01",
    title: "Investigate and update Linear ticket ENG-404",
    description: "Investigate auth crash and update Linear issue priority",
    workflow: "investigate_issue",
    status: "CREATED",
    organizationId: "org_acme_prod",
    createdByHumanId: "emp_human_01",
    assignedToCoworkerId: "coworker_ai_01",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const contextEngine: ContextEngine = {
    gatherContext: vi.fn().mockResolvedValue({
      id: "ctx_bundle_01",
      taskId: "task_investigate_write_01",
      artifacts: [],
      gatheredAt: new Date(),
    }),
  };

  const reasonerWithWriteIntent: Reasoner = {
    reason: vi.fn().mockResolvedValue({
      analysis: "Diagnosis completed. Proposing priority update for ENG-404.",
      diagnosis: "Redis connection pool starvation causes session renewal timeout.",
      recommendations: ["Increase pool size to 50", "Update Linear ticket"],
      toolIntent: {
        toolName: "linear:update_issue",
        action: "update_issue",
        parameters: {
          issueId: "ENG-404",
          title: "Service crashes on auth timeout (Investigated)",
          priority: 2,
        },
      },
      confidence: 0.95,
    }),
  };

  const auditSink: AuditSink = {
    record: vi.fn().mockResolvedValue(undefined),
    getEventsForTask: vi.fn().mockResolvedValue([]),
  };

  it("Test 11: should pause at AWAITING_APPROVAL and create pending approval for WRITE tool", async () => {
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasonerWithWriteIntent,
      registry.toMap(),
      auditSink
    );

    const task = createInitialTask();
    const result = await orchestrator.startTask(task, aiCoworker, humanEmployee);

    expect(result.status).toBe("AWAITING_APPROVAL");
    expect(result.task.status).toBe("AWAITING_APPROVAL");
    expect(result.approvalRequest).toBeDefined();
    expect(result.approvalRequest?.status).toBe("pending");
    expect(result.approvalRequest?.toolCall.toolName).toBe("linear:update_issue");
    expect(result.toolResult).toBeUndefined(); // Write did NOT execute yet!
  });

  it("Test 12: should halt execution and set task to REJECTED when human rejects approval", async () => {
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasonerWithWriteIntent,
      registry.toMap(),
      auditSink
    );

    const task = createInitialTask();
    const startResult = await orchestrator.startTask(task, aiCoworker, humanEmployee);
    const approvalId = startResult.approvalRequest!.id;

    const approvalResult = await orchestrator.submitApproval({
      taskId: task.id,
      approvalId,
      human: humanEmployee,
      approved: false,
      decisionNote: "Do not update ticket status until PR is reviewed.",
    });

    expect(approvalResult.status).toBe("REJECTED");
    expect(approvalResult.task.status).toBe("REJECTED");
    expect(approvalResult.approvalRequest?.status).toBe("rejected");
    expect(approvalResult.toolResult).toBeUndefined(); // Write tool never executed
  });

  it("Test 13: should execute WRITE tool and complete task upon human approval", async () => {
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasonerWithWriteIntent,
      registry.toMap(),
      auditSink
    );

    const task = createInitialTask();
    const startResult = await orchestrator.startTask(task, aiCoworker, humanEmployee);
    const approvalId = startResult.approvalRequest!.id;

    const approvalResult = await orchestrator.submitApproval({
      taskId: task.id,
      approvalId,
      human: humanEmployee,
      approved: true,
      decisionNote: "Approved update based on Redis diagnosis.",
    });

    expect(approvalResult.status).toBe("COMPLETED");
    expect(approvalResult.task.status).toBe("COMPLETED");
    expect(approvalResult.approvalRequest?.status).toBe("approved");
    expect(approvalResult.toolResult).toBeDefined();
    expect(approvalResult.toolResult?.success).toBe(true);
    expect((approvalResult.toolResult?.data as any).success).toBe(true);
  });

  it("Test 14: should block replay of already resolved approval", async () => {
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasonerWithWriteIntent,
      registry.toMap(),
      auditSink
    );

    const task = createInitialTask();
    const startResult = await orchestrator.startTask(task, aiCoworker, humanEmployee);
    const approvalId = startResult.approvalRequest!.id;

    // First resolution: approved
    await orchestrator.submitApproval({
      taskId: task.id,
      approvalId,
      human: humanEmployee,
      approved: true,
    });

    // Second resolution attempt: must be rejected!
    await expect(
      orchestrator.submitApproval({
        taskId: task.id,
        approvalId,
        human: humanEmployee,
        approved: true,
      })
    ).rejects.toThrow(ValidationError);
  });
});
