import type { HumanEmployee, AICoworker } from "../domain/entities.js";
import {
  type Task,
  type TaskStatus,
} from "../domain/task.js";
import type { ContextEngine, ContextBundle } from "../domain/context.js";
import type { Reasoner, ReasoningResult } from "../domain/reasoner.js";
import {
  type Tool,
  type ToolCallIntent,
  type ToolResult,
  evaluateToolPermission,
} from "../domain/tools.js";
import type { ApprovalRequest } from "../domain/approval.js";
import type { AuditSink } from "../domain/audit.js";

export interface PipelineExecutionResult {
  task: Task;
  status: TaskStatus;
  contextBundle?: ContextBundle;
  reasoningResult?: ReasoningResult;
  toolResult?: ToolResult;
  approvalRequest?: ApprovalRequest;
  message: string;
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Deterministic Pipeline Orchestrator enforcing the ContextForge architectural model:
 * Human Employee
 * → AI Coworker
 * → Task
 * → Context Engine
 * → Reasoner
 * → Tool
 * → Permission Check
 * → Approval when required (writes require human approval)
 * → Action
 * → Result
 * → Memory + Audit
 */
export class PipelineOrchestrator {
  private tasks = new Map<string, Task>();
  private approvals = new Map<string, ApprovalRequest>();
  private contextBundles = new Map<string, ContextBundle>();
  private pendingToolCalls = new Map<string, ToolCallIntent>();

  constructor(
    private readonly contextEngine: ContextEngine,
    private readonly reasoner: Reasoner,
    private readonly tools: Map<string, Tool>,
    private readonly auditSink: AuditSink
  ) {}

  /**
   * Starts or triggers an issue investigation task.
   */
  async startTask(
    task: Task,
    coworker: AICoworker,
    human: HumanEmployee
  ): Promise<PipelineExecutionResult> {
    // 1. Validate distinct entity separation and ownership
    if (human.id === coworker.id) {
      throw new ValidationError(
        "HumanEmployee and AICoworker must be completely separate domain entities with distinct IDs."
      );
    }
    if (task.createdByHumanId !== human.id) {
      throw new ValidationError(
        `Task creator ID '${task.createdByHumanId}' does not match human employee ID '${human.id}'.`
      );
    }
    if (task.assignedToCoworkerId !== coworker.id) {
      throw new ValidationError(
        `Task assignee ID '${task.assignedToCoworkerId}' does not match AI coworker ID '${coworker.id}'.`
      );
    }

    this.tasks.set(task.id, task);

    // Audit: Task Initiated
    await this.auditSink.record({
      taskId: task.id,
      actorType: "human_employee",
      actorId: human.id,
      eventType: "task_initiated",
      payload: {
        taskTitle: task.title,
        workflow: task.workflow,
        assignedToCoworkerId: coworker.id,
      },
    });

    // 2. Context Engine Phase
    task.status = "GATHERING_CONTEXT";
    task.updatedAt = new Date();

    await this.auditSink.record({
      taskId: task.id,
      actorType: "ai_coworker",
      actorId: coworker.id,
      eventType: "context_gathering_started",
      payload: { coworkerPersona: coworker.persona },
    });

    const contextBundle = await this.contextEngine.gatherContext(task, coworker);
    this.contextBundles.set(task.id, contextBundle);

    await this.auditSink.record({
      taskId: task.id,
      actorType: "system",
      actorId: "context_engine",
      eventType: "context_gathered",
      payload: {
        artifactCount: contextBundle.artifacts.length,
        sources: contextBundle.artifacts.map((a) => a.source),
      },
    });

    // 3. Reasoner Phase
    task.status = "REASONING";
    task.updatedAt = new Date();

    await this.auditSink.record({
      taskId: task.id,
      actorType: "ai_coworker",
      actorId: coworker.id,
      eventType: "reasoning_started",
      payload: { contextBundleId: contextBundle.id },
    });

    const reasoning = await this.reasoner.reason(task, coworker, contextBundle);

    await this.auditSink.record({
      taskId: task.id,
      actorType: "ai_coworker",
      actorId: coworker.id,
      eventType: "reasoning_completed",
      payload: {
        analysisSummary: reasoning.analysis,
        hasToolIntent: Boolean(reasoning.toolIntent),
        toolName: reasoning.toolIntent?.toolName,
      },
    });

    // 4. Tool & Permission Check Phase
    if (reasoning.toolIntent) {
      const tool = this.tools.get(reasoning.toolIntent.toolName);
      if (!tool) {
        task.status = "FAILED";
        task.errorMessage = `Tool '${reasoning.toolIntent.toolName}' not found in registry.`;
        task.updatedAt = new Date();

        await this.auditSink.record({
          taskId: task.id,
          actorType: "system",
          actorId: "permission_engine",
          eventType: "tool_not_found",
          payload: { toolName: reasoning.toolIntent.toolName },
        });

        return {
          task,
          status: "FAILED",
          contextBundle,
          reasoningResult: reasoning,
          message: task.errorMessage,
        };
      }

      const permission = evaluateToolPermission(tool);

      await this.auditSink.record({
        taskId: task.id,
        actorType: "system",
        actorId: "permission_engine",
        eventType: "permission_evaluated",
        payload: {
          toolName: tool.name,
          toolType: tool.type,
          requiresApproval: permission.requiresApproval,
          reason: permission.reason,
        },
      });

      // 5. Gating: Write tools require human approval
      if (permission.requiresApproval) {
        task.status = "AWAITING_APPROVAL";
        task.updatedAt = new Date();

        const approval: ApprovalRequest = {
          id: `approval_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          taskId: task.id,
          toolCall: reasoning.toolIntent,
          requestedByCoworkerId: coworker.id,
          status: "pending",
          requestedAt: new Date(),
        };

        this.approvals.set(approval.id, approval);
        this.pendingToolCalls.set(approval.id, reasoning.toolIntent);
        task.activeApprovalId = approval.id;

        await this.auditSink.record({
          taskId: task.id,
          actorType: "ai_coworker",
          actorId: coworker.id,
          eventType: "approval_requested",
          payload: {
            approvalId: approval.id,
            toolName: tool.name,
            action: reasoning.toolIntent.action,
            parameters: reasoning.toolIntent.parameters,
          },
        });

        return {
          task,
          status: "AWAITING_APPROVAL",
          contextBundle,
          reasoningResult: reasoning,
          approvalRequest: approval,
          message: `Execution paused: Write tool '${tool.name}' requires explicit human approval.`,
        };
      }

      // 6. Read tool executes automatically
      task.status = "EXECUTING_ACTION";
      task.updatedAt = new Date();

      await this.auditSink.record({
        taskId: task.id,
        actorType: "system",
        actorId: "tool_executor",
        eventType: "tool_execution_started",
        payload: { toolName: tool.name, toolType: tool.type },
      });

      const toolResult = await tool.execute(reasoning.toolIntent);

      await this.auditSink.record({
        taskId: task.id,
        actorType: "system",
        actorId: "tool_executor",
        eventType: "tool_execution_completed",
        payload: {
          toolName: tool.name,
          success: toolResult.success,
          error: toolResult.error,
        },
      });

      task.status = "COMPLETED";
      task.resultSummary = reasoning.summary || reasoning.analysis;
      task.resultData = {
        investigation: reasoning.analysis,
        diagnosis: reasoning.diagnosis,
        recommendations: reasoning.recommendations,
        toolResult: toolResult.data,
      };
      task.updatedAt = new Date();

      await this.auditSink.record({
        taskId: task.id,
        actorType: "ai_coworker",
        actorId: coworker.id,
        eventType: "task_completed",
        payload: { resultSummary: task.resultSummary },
      });

      return {
        task,
        status: "COMPLETED",
        contextBundle,
        reasoningResult: reasoning,
        toolResult,
        message: "Investigation task completed successfully with read tool execution.",
      };
    }

    // 7. Reasoning completed with no tool intent
    task.status = "COMPLETED";
    task.resultSummary = reasoning.summary || reasoning.analysis;
    task.resultData = {
      investigation: reasoning.analysis,
      diagnosis: reasoning.diagnosis,
      recommendations: reasoning.recommendations,
    };
    task.updatedAt = new Date();

    await this.auditSink.record({
      taskId: task.id,
      actorType: "ai_coworker",
      actorId: coworker.id,
      eventType: "task_completed",
      payload: { resultSummary: task.resultSummary },
    });

    return {
      task,
      status: "COMPLETED",
      contextBundle,
      reasoningResult: reasoning,
      message: "Investigation task completed with reasoning analysis.",
    };
  }

  /**
   * Submits a human employee approval or rejection for a pending write tool action.
   */
  async submitApproval(params: {
    taskId: string;
    approvalId: string;
    human: HumanEmployee;
    approved: boolean;
    decisionNote?: string;
  }): Promise<PipelineExecutionResult> {
    const { taskId, approvalId, human, approved, decisionNote } = params;

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new ValidationError(`Task '${taskId}' not found.`);
    }

    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new ValidationError(`Approval request '${approvalId}' not found.`);
    }

    if (approval.status !== "pending") {
      throw new ValidationError(
        `Approval request '${approvalId}' is already resolved with status '${approval.status}'.`
      );
    }

    if (task.status !== "AWAITING_APPROVAL") {
      throw new ValidationError(
        `Task '${taskId}' is in status '${task.status}', not awaiting approval.`
      );
    }

    // Human cannot approve coworker request if IDs match
    if (human.id === approval.requestedByCoworkerId) {
      throw new ValidationError(
        "An AI Coworker cannot approve its own request; approval must come from a separate HumanEmployee."
      );
    }

    approval.reviewedByHumanId = human.id;
    approval.decisionNote = decisionNote;
    approval.reviewedAt = new Date();

    if (!approved) {
      // Rejection: tool must NEVER execute
      approval.status = "rejected";
      task.status = "REJECTED";
      task.errorMessage = `Write action rejected by human employee ${human.name}: ${decisionNote ?? "No reason provided"}`;
      task.updatedAt = new Date();

      await this.auditSink.record({
        taskId: task.id,
        actorType: "human_employee",
        actorId: human.id,
        eventType: "approval_rejected",
        payload: {
          approvalId,
          toolName: approval.toolCall.toolName,
          action: approval.toolCall.action,
          note: decisionNote,
        },
      });

      return {
        task,
        status: "REJECTED",
        approvalRequest: approval,
        message: "Tool execution cancelled: Human employee rejected the write action.",
      };
    }

    // Approval: resume execution
    approval.status = "approved";
    task.status = "EXECUTING_ACTION";
    task.updatedAt = new Date();

    await this.auditSink.record({
      taskId: task.id,
      actorType: "human_employee",
      actorId: human.id,
      eventType: "approval_granted",
      payload: {
        approvalId,
        toolName: approval.toolCall.toolName,
        action: approval.toolCall.action,
        note: decisionNote,
      },
    });

    const tool = this.tools.get(approval.toolCall.toolName);
    if (!tool) {
      task.status = "FAILED";
      task.errorMessage = `Tool '${approval.toolCall.toolName}' no longer available.`;
      task.updatedAt = new Date();

      return {
        task,
        status: "FAILED",
        approvalRequest: approval,
        message: task.errorMessage,
      };
    }

    // Execute the approved write tool
    const toolResult = await tool.execute(approval.toolCall);

    await this.auditSink.record({
      taskId: task.id,
      actorType: "system",
      actorId: "tool_executor",
      eventType: "tool_execution_completed",
      payload: {
        toolName: tool.name,
        success: toolResult.success,
        error: toolResult.error,
      },
    });

    task.status = "COMPLETED";
    task.resultSummary = `Approved action executed successfully: ${approval.toolCall.toolName}.${approval.toolCall.action}`;
    task.resultData = {
      approvedToolCall: approval.toolCall,
      toolResult: toolResult.data,
      approvedByHumanId: human.id,
      decisionNote,
    };
    task.updatedAt = new Date();

    await this.auditSink.record({
      taskId: task.id,
      actorType: "ai_coworker",
      actorId: approval.requestedByCoworkerId,
      eventType: "task_completed",
      payload: { resultSummary: task.resultSummary },
    });

    return {
      task,
      status: "COMPLETED",
      approvalRequest: approval,
      toolResult,
      message: "Approved write tool executed and task completed.",
    };
  }

  /**
   * Direct execution safety check: attempts to execute write tools directly
   * outside the approval flow must throw PermissionDeniedError.
   */
  async executeToolDirect(
    toolCall: ToolCallIntent,
    humanApprover?: HumanEmployee
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.toolName);
    if (!tool) {
      throw new ValidationError(`Tool '${toolCall.toolName}' not found.`);
    }

    const permission = evaluateToolPermission(tool);
    if (permission.requiresApproval && !humanApprover) {
      throw new PermissionDeniedError(
        `Cannot execute write tool '${tool.name}' directly: write actions strictly require human employee approval.`
      );
    }

    return tool.execute(toolCall);
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getApproval(approvalId: string): ApprovalRequest | undefined {
    return this.approvals.get(approvalId);
  }

  getPendingApprovals(taskId?: string): ApprovalRequest[] {
    const all = Array.from(this.approvals.values()).filter(
      (a) => a.status === "pending"
    );
    if (taskId) {
      return all.filter((a) => a.taskId === taskId);
    }
    return all;
  }
}
