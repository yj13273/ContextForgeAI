import type {
  ContextEngine,
  ContextBundle,
  ContextArtifact,
  Context,
  BuildContextParams,
} from "../domain/context.js";
import type { Task } from "../domain/task.js";
import type { AICoworker } from "../domain/entities.js";

export class FakeContextEngine implements ContextEngine {
  constructor(
    private customArtifacts?: ContextArtifact[],
    private customContext?: Partial<Context>
  ) {}

  async gatherContext(task: Task, _coworker: AICoworker): Promise<ContextBundle> {
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

  async buildContext(params: BuildContextParams): Promise<Context> {
    const defaultContext: Context = {
      employee: {
        id: params.employeeId,
        name: "Test Employee",
        email: "employee@example.com",
        role: "Engineer",
      },
      organization: {
        id: params.organizationId || "org_default",
        name: "Acme Corp",
        slug: "acme",
      },
      role: {
        name: "Engineer",
        permissions: ["task:read", "task:execute"],
      },
      coworker: {
        id: params.coworkerId,
        name: "Test Coworker",
        persona: "Software Engineer",
        capabilities: ["github:read", "linear:read"],
        systemPrompt: "Investigate issues thoroughly.",
      },
      memories: [],
      knowledge: [],
      conversation: {
        taskId: params.taskId,
        steps: [],
      },
      task: {
        id: params.taskId,
        title: "Investigate issue",
        description: "Diagnose root cause",
        workflow: "investigate_issue",
        status: "IN_PROGRESS",
      },
      tools: [],
      permissions: {
        allowedToolNames: ["github:get_issue"],
        requiresApprovalToolNames: [],
      },
    };

    return {
      ...defaultContext,
      ...this.customContext,
    };
  }
}
