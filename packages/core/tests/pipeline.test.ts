import { describe, it, expect, beforeEach } from "vitest";
import {
  HumanEmployeeSchema,
  AICoworkerSchema,
  type HumanEmployee,
  type AICoworker,
} from "../src/domain/entities.js";
import { type Task } from "../src/domain/task.js";
import { InMemoryAuditSink } from "../src/domain/audit.js";
import {
  PipelineOrchestrator,
  PermissionDeniedError,
  ValidationError,
} from "../src/orchestrator/pipeline.js";
import { FakeContextEngine } from "../src/fakes/fake-context-engine.js";
import { FakeReasoner } from "../src/fakes/fake-reasoner.js";
import { FakeReadTool, FakeWriteTool } from "../src/fakes/fake-tools.js";

describe("ContextForge Core Pipeline", () => {
  let human: HumanEmployee;
  let coworker: AICoworker;
  let auditSink: InMemoryAuditSink;
  let contextEngine: FakeContextEngine;
  let readTool: FakeReadTool;
  let writeTool: FakeWriteTool;
  let toolMap: Map<string, any>;

  beforeEach(() => {
    human = HumanEmployeeSchema.parse({
      id: "human_emp_001",
      email: "engineer@company.com",
      name: "Jane Doe",
      role: "Staff Software Engineer",
      organizationId: "org_acme_corp",
    });

    coworker = AICoworkerSchema.parse({
      id: "coworker_ai_001",
      name: "ContextForge SWE",
      persona: "Software Engineer",
      organizationId: "org_acme_corp",
      capabilities: ["investigate_issue", "read_code", "review_prs"],
      systemPrompt: "You are an autonomous engineering coworker who investigates bugs.",
      createdByHumanId: human.id,
    });

    auditSink = new InMemoryAuditSink();
    contextEngine = new FakeContextEngine();
    readTool = new FakeReadTool();
    writeTool = new FakeWriteTool();

    toolMap = new Map();
    toolMap.set(readTool.name, readTool);
    toolMap.set(writeTool.name, writeTool);
  });

  describe("Domain Entity Separation", () => {
    it("enforces HumanEmployee and AICoworker as distinct domain entities", () => {
      expect(human.id).not.toBe(coworker.id);
      expect(coworker.createdByHumanId).toBe(human.id);
      expect(coworker.persona).toBe("Software Engineer");
      expect(human.email).toBe("engineer@company.com");
    });

    it("rejects pipeline execution if human and coworker have the same identity", async () => {
      const reasoner = new FakeReasoner("analysis_only");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const invalidTask: Task = {
        id: "task_001",
        title: "Investigate outage",
        description: "Services throwing 500s",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: "same_id",
        assignedToCoworkerId: "same_id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const confusedEntity = { ...human, id: "same_id" };
      const confusedCoworker = { ...coworker, id: "same_id" };

      await expect(
        orchestrator.startTask(invalidTask, confusedCoworker, confusedEntity)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Read-Only Tool Execution Flow", () => {
    it("automatically executes read-only tools without requiring human approval", async () => {
      const reasoner = new FakeReasoner("read_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_read_test",
        title: "Investigate login latency regression",
        description: "Login takes > 3s on edge nodes",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orchestrator.startTask(task, coworker, human);

      // Verify task completed
      expect(result.status).toBe("COMPLETED");
      expect(task.status).toBe("COMPLETED");

      // Verify read tool executed automatically
      expect(readTool.executionCount).toBe(1);
      expect(result.toolResult?.success).toBe(true);
      expect(result.approvalRequest).toBeUndefined();

      // Verify context engine gathered artifacts
      expect(result.contextBundle?.artifacts.length).toBeGreaterThan(0);

      // Verify audit events emitted
      const events = await auditSink.getEventsForTask(task.id);
      const eventTypes = events.map((e) => e.eventType);

      expect(eventTypes).toContain("task_initiated");
      expect(eventTypes).toContain("context_gathering_started");
      expect(eventTypes).toContain("context_gathered");
      expect(eventTypes).toContain("reasoning_started");
      expect(eventTypes).toContain("reasoning_completed");
      expect(eventTypes).toContain("permission_evaluated");
      expect(eventTypes).toContain("tool_execution_started");
      expect(eventTypes).toContain("tool_execution_completed");
      expect(eventTypes).toContain("task_completed");

      // Verify human and coworker actor IDs were logged distinctly
      const humanEvent = events.find((e) => e.actorType === "human_employee");
      expect(humanEvent?.actorId).toBe(human.id);

      const coworkerEvent = events.find((e) => e.actorType === "ai_coworker");
      expect(coworkerEvent?.actorId).toBe(coworker.id);
    });
  });

  describe("Write Tool Gating & Human Approval Flow", () => {
    it("pauses at AWAITING_APPROVAL and does NOT execute the write tool without approval", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_write_test",
        title: "Post investigation results to Linear",
        description: "Update Linear issue ENG-521 with findings",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orchestrator.startTask(task, coworker, human);

      // Verify paused at AWAITING_APPROVAL
      expect(result.status).toBe("AWAITING_APPROVAL");
      expect(task.status).toBe("AWAITING_APPROVAL");
      expect(result.approvalRequest).toBeDefined();
      expect(result.approvalRequest?.status).toBe("pending");
      expect(result.approvalRequest?.requestedByCoworkerId).toBe(coworker.id);

      // CRITICAL: Write tool MUST NOT have executed yet
      expect(writeTool.executionCount).toBe(0);

      // Verify audit events
      const events = await auditSink.getEventsForTask(task.id);
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain("permission_evaluated");
      expect(eventTypes).toContain("approval_requested");
      expect(eventTypes).not.toContain("tool_execution_started");
    });

    it("resumes execution and executes the write tool once HumanEmployee approval is submitted", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_approval_resume",
        title: "Post investigation diagnosis to ticket",
        description: "Requires updating Linear ticket",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const initialResult = await orchestrator.startTask(task, coworker, human);
      const approvalId = initialResult.approvalRequest!.id;

      expect(writeTool.executionCount).toBe(0);

      // Human employee approves the write action
      const resumeResult = await orchestrator.submitApproval({
        taskId: task.id,
        approvalId,
        human,
        approved: true,
        decisionNote: "Confirmed diagnosis looks accurate, proceed with comment.",
      });

      // Verify task completed and write tool executed
      expect(resumeResult.status).toBe("COMPLETED");
      expect(task.status).toBe("COMPLETED");
      expect(writeTool.executionCount).toBe(1);
      expect(writeTool.lastExecutedCall?.parameters.issueId).toBe("ENG-521");

      // Verify audit events logged human approval and subsequent tool execution
      const events = await auditSink.getEventsForTask(task.id);
      const eventTypes = events.map((e) => e.eventType);

      expect(eventTypes).toContain("approval_granted");
      expect(eventTypes).toContain("tool_execution_completed");
      expect(eventTypes).toContain("task_completed");

      const approvalEvent = events.find((e) => e.eventType === "approval_granted");
      expect(approvalEvent?.actorId).toBe(human.id);
      expect(approvalEvent?.actorType).toBe("human_employee");
    });

    it("cancels execution and NEVER executes write tool if HumanEmployee rejects", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_rejection_test",
        title: "Update Linear ticket",
        description: "Post investigation results",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const initialResult = await orchestrator.startTask(task, coworker, human);
      const approvalId = initialResult.approvalRequest!.id;

      // Human employee rejects
      const rejectionResult = await orchestrator.submitApproval({
        taskId: task.id,
        approvalId,
        human,
        approved: false,
        decisionNote: "Do not post comment yet; investigation is incomplete.",
      });

      expect(rejectionResult.status).toBe("REJECTED");
      expect(task.status).toBe("REJECTED");

      // Write tool MUST NOT have executed!
      expect(writeTool.executionCount).toBe(0);

      // Verify audit trail
      const events = await auditSink.getEventsForTask(task.id);
      const rejectionEvent = events.find((e) => e.eventType === "approval_rejected");
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.actorId).toBe(human.id);
    });

    it("strictly prevents unapproved write tools from direct execution via permission gate", async () => {
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        new FakeReasoner(),
        toolMap,
        auditSink
      );

      // Attempting to execute write tool without human approver must throw
      await expect(
        orchestrator.executeToolDirect({
          toolName: "linear:post_comment",
          action: "create_comment",
          parameters: { issueId: "ENG-999", body: "Direct unapproved write!" },
        })
      ).rejects.toThrow(PermissionDeniedError);

      expect(writeTool.executionCount).toBe(0);

      // Read tools can be executed direct without human approval
      const readResult = await orchestrator.executeToolDirect({
        toolName: "github:read_issue",
        action: "get_issue_comments",
        parameters: { repo: "acme/backend", issueNumber: 1 },
      });

      expect(readResult.success).toBe(true);
      expect(readTool.executionCount).toBe(1);
    });

    it("prevents an AI coworker from approving its own write tool request", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_self_approval_test",
        title: "Self approval attempt",
        description: "Test self approval guard",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orchestrator.startTask(task, coworker, human);
      const approvalId = result.approvalRequest!.id;

      // Pretend coworker tries to approve its own request
      const fakeHumanWithCoworkerId: HumanEmployee = {
        id: coworker.id, // same ID as coworker
        email: "fake@acme.com",
        name: "Imposter",
        role: "Engineer",
        organizationId: "org_acme_corp",
        createdAt: new Date(),
      };

      await expect(
        orchestrator.submitApproval({
          taskId: task.id,
          approvalId,
          human: fakeHumanWithCoworkerId,
          approved: true,
        })
      ).rejects.toThrow(ValidationError);

      expect(writeTool.executionCount).toBe(0);
    });

    it("rejects approval if HumanEmployee belongs to a different organization (cross-tenant security)", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_cross_org_test",
        title: "Cross-organization test task",
        description: "Verify tenant isolation in approvals",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orchestrator.startTask(task, coworker, human);
      const approvalId = result.approvalRequest!.id;

      // Employee from a different organization
      const externalEmployee: HumanEmployee = {
        id: "human_other_org",
        email: "external@othercorp.com",
        name: "External Approver",
        role: "Engineer",
        organizationId: "org_other_corp", // mismatch!
        createdAt: new Date(),
      };

      await expect(
        orchestrator.submitApproval({
          taskId: task.id,
          approvalId,
          human: externalEmployee,
          approved: true,
        })
      ).rejects.toThrow(ValidationError);

      expect(writeTool.executionCount).toBe(0);
      expect(task.status).toBe("AWAITING_APPROVAL");
    });

    it("rejects approval if approval.taskId does not match the provided taskId", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const taskA: Task = {
        id: "task_A",
        title: "Task A",
        description: "First task",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskB: Task = {
        id: "task_B",
        title: "Task B",
        description: "Second task",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const resultA = await orchestrator.startTask(taskA, coworker, human);
      await orchestrator.startTask(taskB, coworker, human);

      const approvalIdA = resultA.approvalRequest!.id;

      // Attempt to submit approval for task A against task B
      await expect(
        orchestrator.submitApproval({
          taskId: taskB.id,
          approvalId: approvalIdA,
          human,
          approved: true,
        })
      ).rejects.toThrow(ValidationError);

      expect(writeTool.executionCount).toBe(0);
    });

    it("rejects approval if an invalid HumanEmployee payload is supplied", async () => {
      const reasoner = new FakeReasoner("write_tool");
      const orchestrator = new PipelineOrchestrator(
        contextEngine,
        reasoner,
        toolMap,
        auditSink
      );

      const task: Task = {
        id: "task_invalid_human",
        title: "Task with invalid approver",
        description: "Check boundary validation",
        workflow: "investigate_issue",
        status: "CREATED",
        organizationId: "org_acme_corp",
        createdByHumanId: human.id,
        assignedToCoworkerId: coworker.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orchestrator.startTask(task, coworker, human);
      const approvalId = result.approvalRequest!.id;

      const malformedHuman = {
        id: "",
        email: "not-an-email",
        name: "",
        organizationId: "org_acme_corp",
      } as unknown as HumanEmployee;

      await expect(
        orchestrator.submitApproval({
          taskId: task.id,
          approvalId,
          human: malformedHuman,
          approved: true,
        })
      ).rejects.toThrow(ValidationError);

      expect(writeTool.executionCount).toBe(0);
    });
  });
});
