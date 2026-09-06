import type { ContextEngine, Context } from "../domain/context.js";
import type { Reasoner, ReasoningResult } from "../domain/reasoner.js";
import type { Task } from "../domain/task.js";
import type { AICoworker, HumanEmployee } from "../domain/entities.js";
import type { ToolResult } from "../domain/tools.js";

export interface AgentLoopStep {
  stepIndex: number;
  reasoning: ReasoningResult;
  toolResult?: ToolResult;
}

export interface AgentLoopExecutionResult {
  status: "COMPLETED" | "AWAITING_APPROVAL" | "FAILED";
  finalContent?: string;
  pendingApproval?: {
    toolName: string;
    parameters: Record<string, unknown>;
  };
  steps: AgentLoopStep[];
  message: string;
}

export interface AgentLoopOptions {
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
  coworker: AICoworker;
  employee: HumanEmployee;
  task: Task;
  maxSteps?: number;
}

/**
 * Deterministic agent loop coordinator executing the reasoning-action loop:
 * while (!finished) {
 *   context = await buildContext();
 *   response = await reasoner.reason(context);
 *   if (response.type === "final") return response;
 *   if (response.type === "tool_call") handleExecution();
 * }
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopExecutionResult> {
  const {
    contextEngine,
    reasoner,
    toolExecutionService,
    coworker,
    employee,
    task,
    maxSteps = 5,
  } = options;

  const steps: AgentLoopStep[] = [];
  let previousToolResult: ToolResult | undefined = undefined;

  for (let i = 0; i < maxSteps; i++) {
    // 1. Build bounded, tenant-safe context
    let context: Context;
    if (contextEngine.buildContext) {
      context = await contextEngine.buildContext({
        organizationId: task.organizationId,
        employeeId: employee.id,
        coworkerId: coworker.id,
        taskId: task.id,
        query: task.title,
      });
    } else {
      throw new Error("ContextEngine does not support buildContext.");
    }

    // 2. Reason over context
    const response = await reasoner.reason(context, coworker, undefined, previousToolResult);

    // 3. Handle Final Response
    if (response.type === "final") {
      steps.push({
        stepIndex: i,
        reasoning: response,
      });

      return {
        status: "COMPLETED",
        finalContent: response.content,
        steps,
        message: "Task completed successfully with final answer.",
      };
    }

    // 4. Handle Tool Call Request
    if (response.type === "tool_call" || response.toolIntent) {
      const toolName = response.toolName || response.toolIntent?.toolName;
      if (!toolName) {
        return {
          status: "FAILED",
          steps,
          message: "Reasoning requested tool call but no toolName was specified.",
        };
      }

      const input = (response.input || response.toolIntent?.parameters || {}) as Record<string, unknown>;

      // Check if write tool requires human approval
      if (context.permissions.requiresApprovalToolNames.includes(toolName)) {
        steps.push({
          stepIndex: i,
          reasoning: response,
        });

        return {
          status: "AWAITING_APPROVAL",
          pendingApproval: {
            toolName,
            parameters: input,
          },
          steps,
          message: `Execution paused: Tool '${toolName}' requires human approval.`,
        };
      }

      // Read tool: executes automatically via ToolExecutionService
      const toolResult = await toolExecutionService.execute({
        call: {
          toolName,
          action: toolName,
          parameters: input,
        },
        context: {
          organizationId: task.organizationId,
          taskId: task.id,
          employeeId: employee.id,
          coworkerId: coworker.id,
        },
        coworker,
        employee,
      });

      steps.push({
        stepIndex: i,
        reasoning: response,
        toolResult,
      });

      previousToolResult = toolResult;
    }
  }

  return {
    status: "FAILED",
    steps,
    message: `Execution halted: Maximum iteration steps (${maxSteps}) reached.`,
  };
}
