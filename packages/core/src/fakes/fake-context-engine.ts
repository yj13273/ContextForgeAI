import type { ContextEngine, ContextBundle, ContextArtifact } from "../domain/context.js";
import type { Task } from "../domain/task.js";
import type { AICoworker } from "../domain/entities.js";

export class FakeContextEngine implements ContextEngine {
  constructor(private customArtifacts?: ContextArtifact[]) {}

  async gatherContext(task: Task, coworker: AICoworker): Promise<ContextBundle> {
    const defaultArtifacts: ContextArtifact[] = [
      {
        id: `art_gh_${task.id}`,
        source: "github",
        type: "issue",
        title: `GitHub Issue: ${task.title}`,
        content: `Issue details: ${task.description}\nReported by user in production environment. Stack trace indicates null reference.`,
        metadata: { repo: "acme/backend", issueNumber: 142 },
      },
      {
        id: `art_lin_${task.id}`,
        source: "linear",
        type: "issue",
        title: `Linear Ticket: ENG-521 - ${task.title}`,
        content: "Linear issue priority: Urgent. Customer report linked.",
        metadata: { teamKey: "ENG", identifier: "ENG-521" },
      },
      {
        id: `art_code_${task.id}`,
        source: "repository",
        type: "code_snippet",
        title: "src/auth/session.ts",
        content: "export function parseSession(token?: string) { return jwt.verify(token); }",
        metadata: { path: "src/auth/session.ts", language: "typescript" },
      },
    ];

    return {
      id: `bundle_${task.id}`,
      taskId: task.id,
      gatheredAt: new Date(),
      artifacts: this.customArtifacts ?? defaultArtifacts,
    };
  }
}
