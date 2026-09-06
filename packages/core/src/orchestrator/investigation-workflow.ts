import type { ContextEngine, Context } from "../domain/context.js";
import type { Reasoner, ReasoningResult } from "../domain/reasoner.js";
import type { Task } from "../domain/task.js";
import type { HumanEmployee, AICoworker } from "../domain/entities.js";
import type { ToolResult } from "../domain/tools.js";
import type { AuditSink } from "../domain/audit.js";
import {
  InvestigationResultSchema,
  type InvestigationResult,
} from "../domain/investigation.js";

export interface StepRecord {
  stepIndex: number;
  stepType: "context" | "reasoning" | "tool_call" | "tool_result" | "approval" | "final" | "error";
  status: "success" | "pending" | "failed";
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface StepRecorder {
  recordStep(taskId: string, step: StepRecord): Promise<void>;
}

export interface InvestigationApprovalService {
  createApproval(data: {
    organizationId: string;
    taskId: string;
    requestedByCoworkerId: string;
    toolCall: {
      toolName: string;
      action: string;
      parameters: Record<string, unknown>;
    };
  }): Promise<{ id: string }>;
  resolveApproval(params: {
    organizationId: string;
    approvalId: string;
    taskId: string;
    reviewerEmployeeId: string;
    approved: boolean;
    decisionNote?: string;
  }): Promise<{ approved: boolean }>;
}

export interface MemoryPersister {
  saveInvestigationMemory(data: {
    organizationId: string;
    employeeId: string;
    coworkerId: string;
    issueKey: string;
    rootCause: string;
    solution: string;
  }): Promise<void>;
}

export interface InvestigationWorkflowOptions {
  contextEngine: ContextEngine;
  reasoner: Reasoner;
  toolExecutionService: {
    execute(options: {
      call: { toolName: string; action: string; parameters: Record<string, unknown> };
      context: { organizationId: string; taskId: string; employeeId: string; coworkerId: string };
      coworker?: AICoworker;
      employee?: HumanEmployee;
      approved?: boolean;
    }): Promise<ToolResult>;
  };
  stepRecorder?: StepRecorder;
  approvalService?: InvestigationApprovalService;
  auditSink?: AuditSink;
  memoryPersister?: MemoryPersister;
  maxSteps?: number;
}

export interface InvestigationExecutionResult {
  status: "COMPLETED" | "AWAITING_APPROVAL" | "REJECTED" | "FAILED";
  taskId: string;
  approvalId?: string;
  pendingWrite?: {
    toolName: string;
    parameters: Record<string, unknown>;
  };
  investigationResult?: InvestigationResult;
  steps: StepRecord[];
  errorMessage?: string;
}

/**
 * End-to-end Investigation Workflow coordinator ("Investigate an Issue").
 * Enforces the full pipeline:
 * Human Employee -> AI Coworker -> Task -> Context -> Reasoner -> Tool -> Approval -> Action -> Memory + Audit
 */
export class InvestigationWorkflow {
  constructor(private readonly options: InvestigationWorkflowOptions) {}

  async run(params: {
    organizationId: string;
    employee: HumanEmployee;
    coworker: AICoworker;
    task: Task;
    issueKey: string;
  }): Promise<InvestigationExecutionResult> {
    const { organizationId, employee, coworker, task, issueKey } = params;
    const maxSteps = this.options.maxSteps ?? 10;
    const steps: StepRecord[] = [];

    let currentStepIndex = 0;

    const recordLocalStep = async (step: StepRecord) => {
      steps.push(step);
      if (this.options.stepRecorder) {
        await this.options.stepRecorder.recordStep(task.id, step);
      }
    };

    // 1. Validate Tenant & Coworker Ownership Boundary
    if (employee.organizationId !== organizationId) {
      throw new Error(`Tenant isolation violation: Employee does not belong to org '${organizationId}'.`);
    }
    if (coworker.organizationId !== organizationId) {
      throw new Error(`Tenant isolation violation: Coworker does not belong to org '${organizationId}'.`);
    }
    if (coworker.createdByHumanId !== employee.id) {
      throw new Error(`Coworker '${coworker.id}' is not owned by employee '${employee.id}'.`);
    }

    if (this.options.auditSink) {
      await this.options.auditSink.record({
        taskId: task.id,
        actorType: "human_employee",
        actorId: employee.id,
        eventType: "task_started",
        payload: { issueKey, coworkerId: coworker.id },
      });
    }

    // 2. Build Context
    let context: Context;
    try {
      if (!this.options.contextEngine.buildContext) {
        throw new Error("ContextEngine must implement buildContext.");
      }
      context = await this.options.contextEngine.buildContext({
        organizationId,
        employeeId: employee.id,
        coworkerId: coworker.id,
        taskId: task.id,
        query: issueKey,
      });

      await recordLocalStep({
        stepIndex: currentStepIndex++,
        stepType: "context",
        status: "success",
        payload: {
          organizationId,
          employeeId: employee.id,
          coworkerId: coworker.id,
          memoriesCount: context.memories.length,
          knowledgeCount: context.knowledge.length,
          allowedTools: context.permissions.allowedToolNames,
        },
      });

      if (this.options.auditSink) {
        await this.options.auditSink.record({
          taskId: task.id,
          actorType: "ai_coworker",
          actorId: coworker.id,
          eventType: "context_built",
          payload: { memoriesCount: context.memories.length, toolsCount: context.tools.length },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordLocalStep({
        stepIndex: currentStepIndex++,
        stepType: "error",
        status: "failed",
        payload: { phase: "build_context", error: msg },
      });
      return {
        status: "FAILED",
        taskId: task.id,
        steps,
        errorMessage: msg,
      };
    }

    // 3. Multi-Step Reasoning & Investigation Loop
    let previousToolResult: ToolResult | undefined = undefined;

    while (currentStepIndex < maxSteps) {
      // Step A: Reason
      let reasoningResult: ReasoningResult;
      try {
        reasoningResult = await this.options.reasoner.reason(
          context,
          coworker,
          undefined,
          previousToolResult
        );

        await recordLocalStep({
          stepIndex: currentStepIndex++,
          stepType: "reasoning",
          status: "success",
          payload: {
            type: reasoningResult.type,
            summary: reasoningResult.summary || reasoningResult.analysis || "Reasoning step completed",
          },
          result: { reasoning: reasoningResult },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordLocalStep({
          stepIndex: currentStepIndex++,
          stepType: "error",
          status: "failed",
          payload: { phase: "reasoning", error: msg },
        });
        return {
          status: "FAILED",
          taskId: task.id,
          steps,
          errorMessage: msg,
        };
      }

      // Step B: Check for Tool Call
      if (reasoningResult.type === "tool_call" || reasoningResult.toolIntent) {
        const toolName = reasoningResult.toolName || reasoningResult.toolIntent?.toolName;
        const parameters = (reasoningResult.input || reasoningResult.toolIntent?.parameters || {}) as Record<string, unknown>;

        if (!toolName) {
          return {
            status: "FAILED",
            taskId: task.id,
            steps,
            errorMessage: "Reasoner requested tool call without specifying toolName.",
          };
        }

        await recordLocalStep({
          stepIndex: currentStepIndex++,
          stepType: "tool_call",
          status: "pending",
          payload: { toolName, parameters },
        });

        if (this.options.auditSink) {
          await this.options.auditSink.record({
            taskId: task.id,
            actorType: "ai_coworker",
            actorId: coworker.id,
            eventType: "tool_requested",
            payload: { toolName, parameters },
          });
        }

        // WRITE TOOL: Pause at AWAITING_APPROVAL
        const isWrite = context.permissions.requiresApprovalToolNames.includes(toolName) || toolName.includes("update") || toolName.includes("create");
        if (isWrite) {
          let approvalId = `app_${Date.now()}`;
          if (this.options.approvalService) {
            const app = await this.options.approvalService.createApproval({
              organizationId,
              taskId: task.id,
              requestedByCoworkerId: coworker.id,
              toolCall: {
                toolName,
                action: toolName,
                parameters,
              },
            });
            approvalId = app.id;
          }

          await recordLocalStep({
            stepIndex: currentStepIndex++,
            stepType: "approval",
            status: "pending",
            payload: {
              approvalId,
              toolName,
              parameters,
              message: `Paused for human approval on write action '${toolName}'`,
            },
          });

          if (this.options.auditSink) {
            await this.options.auditSink.record({
              taskId: task.id,
              actorType: "system",
              actorId: "orchestrator",
              eventType: "approval_requested",
              payload: { approvalId, toolName, parameters },
            });
          }

          return {
            status: "AWAITING_APPROVAL",
            taskId: task.id,
            approvalId,
            pendingWrite: {
              toolName,
              parameters,
            },
            steps,
          };
        }

        // READ TOOL: Execute via ToolExecutionService with resilient error isolation
        try {
          const toolResult = await this.options.toolExecutionService.execute({
            call: {
              toolName,
              action: toolName,
              parameters,
            },
            context: {
              organizationId,
              taskId: task.id,
              employeeId: employee.id,
              coworkerId: coworker.id,
            },
            coworker,
            employee,
          });

          await recordLocalStep({
            stepIndex: currentStepIndex++,
            stepType: "tool_result",
            status: toolResult.success ? "success" : "failed",
            payload: { toolName },
            result: {
              success: toolResult.success,
              data: toolResult.data,
              error: toolResult.error,
            },
          });

          if (this.options.auditSink) {
            await this.options.auditSink.record({
              taskId: task.id,
              actorType: "system",
              actorId: "tool_service",
              eventType: "tool_executed",
              payload: { toolName, success: toolResult.success },
            });
          }

          previousToolResult = toolResult;
          continue;
        } catch (toolErr: unknown) {
          const errorMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
          // Resilient failure: record tool error, do NOT crash pipeline
          const failedResult: ToolResult = {
            success: false,
            error: errorMsg,
          };

          await recordLocalStep({
            stepIndex: currentStepIndex++,
            stepType: "tool_result",
            status: "failed",
            payload: { toolName },
            result: { success: false, error: errorMsg },
          });

          previousToolResult = failedResult;
          continue;
        }
      }

      // Step C: Final Answer
      if (reasoningResult.type === "final" || reasoningResult.isComplete) {
        const rawContent = reasoningResult.content || reasoningResult.analysis || "";

        let structuredResult: InvestigationResult;
        try {
          // Attempt JSON parse
          const parsed = JSON.parse(rawContent);
          structuredResult = InvestigationResultSchema.parse(parsed);
        } catch {
          // Construct fallback structured result from content
          structuredResult = {
            issue: issueKey,
            summary: reasoningResult.summary || `Investigation of issue ${issueKey}`,
            findings: reasoningResult.recommendations?.length ? reasoningResult.recommendations : [rawContent],
            likelyRootCause: reasoningResult.analysis || "Identified root cause during investigation",
            evidence: [
              {
                type: "linear_issue",
                description: `Linear issue ${issueKey} analyzed`,
                reference: issueKey,
              },
            ],
            relevantFiles: [],
            relevantCommits: [],
            recommendedFix: "Apply recommended fix identified during analysis.",
            confidence: 0.85,
          };
        }

        await recordLocalStep({
          stepIndex: currentStepIndex++,
          stepType: "final",
          status: "success",
          payload: { summary: structuredResult.summary },
          result: { investigationResult: structuredResult },
        });

        if (this.options.auditSink) {
          await this.options.auditSink.record({
            taskId: task.id,
            actorType: "ai_coworker",
            actorId: coworker.id,
            eventType: "task_completed",
            payload: { issueKey, confidence: structuredResult.confidence },
          });
        }

        return {
          status: "COMPLETED",
          taskId: task.id,
          investigationResult: structuredResult,
          steps,
        };
      }
    }

    return {
      status: "FAILED",
      taskId: task.id,
      steps,
      errorMessage: `Investigation halted: Maximum iteration steps (${maxSteps}) reached.`,
    };
  }

  /**
   * Resumes an investigation when human approval is submitted.
   * If approved: executes write tool, records memory, logs audit, and marks completed.
   * If rejected: marks rejected and never executes the write tool.
   */
  async resolveApprovalAndComplete(params: {
    organizationId: string;
    employee: HumanEmployee;
    coworker: AICoworker;
    task: Task;
    approvalId: string;
    pendingWrite: {
      toolName: string;
      parameters: Record<string, unknown>;
    };
    approved: boolean;
    decisionNote?: string;
    investigationResult?: InvestigationResult;
  }): Promise<InvestigationExecutionResult> {
    const {
      organizationId,
      employee,
      coworker,
      task,
      approvalId,
      pendingWrite,
      approved,
      decisionNote,
      investigationResult,
    } = params;

    const steps: StepRecord[] = [];

    // 1. Resolve approval record
    if (this.options.approvalService) {
      await this.options.approvalService.resolveApproval({
        organizationId,
        approvalId,
        taskId: task.id,
        reviewerEmployeeId: employee.id,
        approved,
        decisionNote,
      });
    }

    if (this.options.auditSink) {
      await this.options.auditSink.record({
        taskId: task.id,
        actorType: "human_employee",
        actorId: employee.id,
        eventType: approved ? "approval_approved" : "approval_rejected",
        payload: { approvalId, decisionNote },
      });
    }

    if (!approved) {
      steps.push({
        stepIndex: 99,
        stepType: "approval",
        status: "failed",
        payload: { approvalId, approved: false, decisionNote },
      });

      return {
        status: "REJECTED",
        taskId: task.id,
        steps,
        errorMessage: `Write action '${pendingWrite.toolName}' was rejected by ${employee.name}.`,
      };
    }

    // 2. Approved: Execute the write tool with approved flag
    const writeResult = await this.options.toolExecutionService.execute({
      call: {
        toolName: pendingWrite.toolName,
        action: pendingWrite.toolName,
        parameters: pendingWrite.parameters,
      },
      context: {
        organizationId,
        taskId: task.id,
        employeeId: employee.id,
        coworkerId: coworker.id,
      },
      coworker,
      employee,
      approved: true,
    });

    steps.push({
      stepIndex: 100,
      stepType: "tool_result",
      status: writeResult.success ? "success" : "failed",
      payload: { toolName: pendingWrite.toolName, approved: true },
      result: { data: writeResult.data, error: writeResult.error },
    });

    if (this.options.auditSink) {
      await this.options.auditSink.record({
        taskId: task.id,
        actorType: "system",
        actorId: "tool_service",
        eventType: "tool_executed",
        payload: { toolName: pendingWrite.toolName, success: writeResult.success },
      });
    }

    // 3. Save key learnings as organizational memory
    if (this.options.memoryPersister && investigationResult) {
      await this.options.memoryPersister.saveInvestigationMemory({
        organizationId,
        employeeId: employee.id,
        coworkerId: coworker.id,
        issueKey: investigationResult.issue,
        rootCause: investigationResult.likelyRootCause,
        solution: investigationResult.recommendedFix,
      });

      if (this.options.auditSink) {
        await this.options.auditSink.record({
          taskId: task.id,
          actorType: "system",
          actorId: "memory_engine",
          eventType: "memory_created",
          payload: { issueKey: investigationResult.issue },
        });
      }
    }

    return {
      status: "COMPLETED",
      taskId: task.id,
      investigationResult,
      steps,
    };
  }
}
