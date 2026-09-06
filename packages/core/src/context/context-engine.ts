import type {
  Context,
  ContextBundle,
  ContextEngine,
  BuildContextParams,
  EmployeeContext,
  OrganizationContext,
  RoleContext,
  CoworkerContext,
  TaskContext,
  ConversationContext,
  ToolContext,
  PermissionContext,
} from "../domain/context.js";
import type { Memory } from "../domain/memory.js";
import type { Knowledge } from "../domain/knowledge.js";
import type { Task } from "../domain/task.js";
import type { AICoworker } from "../domain/entities.js";

export interface ContextDataProviders {
  getEmployee(id: string): Promise<(EmployeeContext & { organizationId: string }) | null>;
  getOrganization(id: string): Promise<OrganizationContext | null>;
  getRole?(id?: string): Promise<RoleContext | null>;
  getCoworker(id: string): Promise<(CoworkerContext & { organizationId: string; createdByHumanId: string }) | null>;
  getTask(id: string): Promise<(TaskContext & { organizationId: string; createdByHumanId: string; assignedToCoworkerId: string }) | null>;
  getMemories(params: {
    organizationId: string;
    employeeId: string;
    coworkerId: string;
    query?: string;
    limit?: number;
  }): Promise<Memory[]>;
  getKnowledge?(params: {
    organizationId: string;
    query?: string;
    limit?: number;
  }): Promise<Knowledge[]>;
  getConversation?(taskId: string): Promise<ConversationContext>;
  getTools?(): ToolContext[];
}

/**
 * Sanitizes context strings to prevent accidental secret leakage.
 */
function sanitizeContextText(text: string): string {
  if (!text) return "";
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(token=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(key=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(apiKey=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(ghp_[A-Za-z0-9_]+)/gi, "[REDACTED]")
    .replace(/(lin_api_[A-Za-z0-9_]+)/gi, "[REDACTED]");
}

export class DefaultContextEngine implements ContextEngine {
  constructor(private readonly providers: ContextDataProviders) {}

  async buildContext(params: BuildContextParams): Promise<Context> {
    const { employeeId, coworkerId, taskId, query } = params;
    const maxMemories = params.maxMemories ?? 10;
    const maxKnowledge = params.maxKnowledge ?? 5;

    // 1. Fetch core entities
    const employee = await this.providers.getEmployee(employeeId);
    if (!employee) {
      throw new Error(`ContextEngine: Employee '${employeeId}' not found.`);
    }

    const coworker = await this.providers.getCoworker(coworkerId);
    if (!coworker) {
      throw new Error(`ContextEngine: AI Coworker '${coworkerId}' not found.`);
    }

    const task = await this.providers.getTask(taskId);
    if (!task) {
      throw new Error(`ContextEngine: Task '${taskId}' not found.`);
    }

    const targetOrgId = params.organizationId || task.organizationId;

    // 2. Strict Tenant Isolation Check
    if (employee.organizationId !== targetOrgId) {
      throw new Error(
        `Tenant isolation violation in ContextEngine: Employee organization '${employee.organizationId}' does not match target organization '${targetOrgId}'.`
      );
    }
    if (coworker.organizationId !== targetOrgId) {
      throw new Error(
        `Tenant isolation violation in ContextEngine: AI Coworker organization '${coworker.organizationId}' does not match target organization '${targetOrgId}'.`
      );
    }
    if (task.organizationId !== targetOrgId) {
      throw new Error(
        `Tenant isolation violation in ContextEngine: Task organization '${task.organizationId}' does not match target organization '${targetOrgId}'.`
      );
    }

    // 3. Coworker Ownership Check
    if (coworker.createdByHumanId !== employee.id) {
      throw new Error(
        `ContextEngine: Coworker '${coworker.id}' is not owned by or assigned to employee '${employee.id}'.`
      );
    }

    const organization = await this.providers.getOrganization(targetOrgId);
    if (!organization) {
      throw new Error(`ContextEngine: Organization '${targetOrgId}' not found.`);
    }

    // 4. Role & Permissions
    const role: RoleContext = (this.providers.getRole
      ? await this.providers.getRole()
      : null) ?? {
      name: employee.role,
      permissions: ["task:read", "task:execute"],
    };

    // 5. Memories (Bounded & Tenant-Safe)
    const rawMemories = await this.providers.getMemories({
      organizationId: targetOrgId,
      employeeId,
      coworkerId,
      query,
      limit: maxMemories,
    });

    // Secondary security gate: filter out any mismatched memory before it enters context
    const secureMemories = rawMemories
      .filter((m) => {
        if (m.organizationId !== targetOrgId) return false;
        if (m.employeeId && m.employeeId !== employeeId) return false;
        if (m.coworkerId && m.coworkerId !== coworkerId) return false;
        return true;
      })
      .slice(0, maxMemories)
      .map((m) => ({
        ...m,
        title: sanitizeContextText(m.title),
        content: sanitizeContextText(m.content),
      }));

    // 6. Knowledge
    const rawKnowledge = this.providers.getKnowledge
      ? await this.providers.getKnowledge({
          organizationId: targetOrgId,
          query,
          limit: maxKnowledge,
        })
      : [];

    const secureKnowledge = rawKnowledge
      .filter((k) => k.organizationId === targetOrgId)
      .slice(0, maxKnowledge)
      .map((k) => ({
        ...k,
        title: sanitizeContextText(k.title),
        content: sanitizeContextText(k.content),
      }));

    // 7. Conversation / Steps
    const conversation: ConversationContext = this.providers.getConversation
      ? await this.providers.getConversation(taskId)
      : { taskId, steps: [] };

    // 8. Tools & Permissions
    const tools: ToolContext[] = this.providers.getTools ? this.providers.getTools() : [];
    const allowedToolNames = tools
      .filter((t) => coworker.capabilities.includes(t.requiredCapability))
      .map((t) => t.name);

    const requiresApprovalToolNames = tools
      .filter((t) => t.type === "write" && allowedToolNames.includes(t.name))
      .map((t) => t.name);

    const permissions: PermissionContext = {
      allowedToolNames,
      requiresApprovalToolNames,
    };

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        title: employee.title,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      role,
      coworker: {
        id: coworker.id,
        name: coworker.name,
        persona: coworker.persona,
        capabilities: coworker.capabilities,
        systemPrompt: coworker.systemPrompt,
      },
      memories: secureMemories,
      knowledge: secureKnowledge,
      conversation,
      task: {
        id: task.id,
        title: sanitizeContextText(task.title),
        description: sanitizeContextText(task.description),
        workflow: task.workflow,
        status: task.status,
      },
      tools,
      permissions,
    };
  }

  async gatherContext(task: Task, coworker: AICoworker): Promise<ContextBundle> {
    const context = await this.buildContext({
      organizationId: task.organizationId,
      employeeId: task.createdByHumanId,
      coworkerId: coworker.id,
      taskId: task.id,
      query: task.title,
    });

    const artifacts = [
      ...context.memories.map((m) => ({
        id: m.id,
        source: "memory" as const,
        type: "memory_item" as const,
        title: m.title,
        content: m.content,
        metadata: { importance: m.importance, memoryType: m.type },
      })),
      ...context.knowledge.map((k) => ({
        id: k.id,
        source: "documentation" as const,
        type: "log" as const,
        title: k.title,
        content: k.content,
        metadata: { category: k.category },
      })),
    ];

    return {
      id: `bundle_${task.id}_${Date.now()}`,
      taskId: task.id,
      gatheredAt: new Date(),
      artifacts,
    };
  }
}
