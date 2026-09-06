import type { Reasoner, ReasoningResult } from "../domain/reasoner.js";
import type { Task } from "../domain/task.js";
import type { AICoworker } from "../domain/entities.js";
import type { ContextBundle } from "../domain/context.js";
import type { ToolResult, ToolCallIntent } from "../domain/tools.js";

export type ReasonerMode = "read_tool" | "write_tool" | "analysis_only";

export class FakeReasoner implements Reasoner {
  constructor(
    public mode: ReasonerMode = "analysis_only",
    public customToolIntent?: ToolCallIntent
  ) {}

  async reason(
    task: Task,
    coworker: AICoworker,
    context: ContextBundle,
    previousToolResult?: ToolResult
  ): Promise<ReasoningResult> {
    if (this.mode === "read_tool") {
      return {
        analysis: `Investigated issue based on ${context.artifacts.length} context artifacts. Identified candidate cause.`,
        diagnosis: "Potential undefined dereference in session parser.",
        recommendations: [
          "Check recent commits touching session.ts",
          "Read GitHub PR #142 for context",
        ],
        toolIntent: this.customToolIntent ?? {
          toolName: "github:read_issue",
          action: "get_issue_comments",
          parameters: { repo: "acme/backend", issueNumber: 142 },
        },
        isComplete: false,
        summary: "Read GitHub issue comments to confirm crash log.",
      };
    }

    if (this.mode === "write_tool") {
      return {
        analysis: `Root cause confirmed via context artifacts. Proposing write action to update ticket status.`,
        diagnosis: "Confirmed regression introduced in release v2.4.1.",
        recommendations: [
          "Post investigation diagnosis on Linear ticket ENG-521",
          "Open bug hotfix PR",
        ],
        toolIntent: this.customToolIntent ?? {
          toolName: "linear:post_comment",
          action: "create_comment",
          parameters: {
            issueId: "ENG-521",
            body: "Investigation completed: Root cause is missing null check in parseSession().",
          },
        },
        isComplete: false,
        summary: "Post investigation results to Linear ticket.",
      };
    }

    // Default: analysis_only
    return {
      analysis: `Completed comprehensive investigation for ${task.title}. Evaluated ${context.artifacts.length} artifacts.`,
      diagnosis: "Transient network timeout during auth token verification.",
      recommendations: [
        "Increase timeout to 5000ms",
        "Add exponential backoff",
      ],
      isComplete: true,
      summary: "Investigation completed. Cause identified as network timeout.",
    };
  }
}
