import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { PipelineOrchestrator } from "@contextforge/core";
import {
  type HumanEmployee,
  type AICoworker,
  type Task,
  HumanEmployeeSchema,
  AICoworkerSchema,
  TaskSchema,
} from "@contextforge/core";
import { resolveRequestIdentity } from "../auth.js";

export interface TasksPluginOptions {
  orchestrator: PipelineOrchestrator;
  auditSink?: { getEventsForTask(taskId: string): Promise<any[]> };
  taskRepository?: {
    listByOrg(orgId: string, limit?: number): Promise<any[]>;
    findById(orgId: string, id: string): Promise<any | null>;
    listSteps(taskId: string): Promise<any[]>;
  };
}

const CreateTaskBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().default(""),
  workflow: z.enum(["investigate_issue"]).default("investigate_issue"),
  issueKey: z.string().optional(),
  organizationId: z.string().optional(),
  humanEmployee: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.string().default("Engineer"),
  }).optional(),
  coworker: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    persona: z.string().default("Software Engineer"),
    capabilities: z.array(z.string()).default(["github:read", "linear:read", "linear:write"]),
    systemPrompt: z.string().default("You are an engineering coworker."),
  }).optional(),
});

export const taskRoutes: FastifyPluginAsync<TasksPluginOptions> = async (
  fastify,
  opts
) => {
  const { orchestrator, auditSink, taskRepository } = opts;

  // GET /tasks - List tasks for authenticated tenant
  fastify.get<{ Querystring: { limit?: string } }>("/tasks", async (request) => {
    const { organizationId } = resolveRequestIdentity(request);
    const limit = Number(request.query.limit || 50);

    if (taskRepository) {
      const dbTasks = await taskRepository.listByOrg(organizationId, limit);
      return { tasks: dbTasks };
    }

    // In-memory fallback
    const all = Array.from((orchestrator as any).tasks?.values() ?? []) as Task[];
    const filtered = all.filter((t) => t.organizationId === organizationId);
    return { tasks: filtered };
  });

  // POST /tasks - Create and start investigation task
  fastify.post("/tasks", async (request, reply) => {
    const parseResult = CreateTaskBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation Failed",
        details: parseResult.error.flatten(),
      });
    }

    const { employee: defaultEmployee, coworker: defaultCoworker, organizationId: defaultOrgId } =
      resolveRequestIdentity(request);

    const data = parseResult.data;
    const organizationId = data.organizationId || defaultOrgId;

    const parsedHuman: HumanEmployee = data.humanEmployee
      ? HumanEmployeeSchema.parse({ ...data.humanEmployee, organizationId, createdAt: new Date() })
      : defaultEmployee;

    const parsedCoworker: AICoworker = data.coworker
      ? AICoworkerSchema.parse({
          ...data.coworker,
          organizationId,
          createdByHumanId: parsedHuman.id,
          createdAt: new Date(),
        })
      : defaultCoworker;

    const issueKey = data.issueKey || (data.title?.match(/[A-Z]+-\d+/)?.[0]);
    const title = data.title || (issueKey ? `Investigate ${issueKey}` : "Investigate Issue");

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const task: Task = TaskSchema.parse({
      id: taskId,
      title,
      description: data.description || (issueKey ? `Automated investigation of ${issueKey}` : ""),
      workflow: data.workflow,
      status: "CREATED",
      organizationId,
      createdByHumanId: parsedHuman.id,
      assignedToCoworkerId: parsedCoworker.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const result = await orchestrator.startTask(task, parsedCoworker, parsedHuman);
      return reply.status(201).send({
        success: true,
        task: result.task,
        status: result.status,
        message: result.message,
        approvalRequest: result.approvalRequest,
        toolResult: result.toolResult,
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: err.name || "TaskExecutionError",
        message: err.message,
      });
    }
  });

  // GET /tasks/:id - Get task with steps and audit records
  fastify.get<{ Params: { id: string } }>("/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    const task = orchestrator.getTask(id);
    if (!task) {
      return reply.status(404).send({ error: `Task '${id}' not found.` });
    }

    const auditEvents = auditSink ? await auditSink.getEventsForTask(id) : [];
    const steps = taskRepository ? await taskRepository.listSteps(id) : [];

    return {
      task,
      auditEvents,
      steps,
    };
  });

  // POST /tasks/:id/approve - Convenience route for task approval
  fastify.post<{ Params: { id: string }; Body: { decisionNote?: string } }>(
    "/tasks/:id/approve",
    async (request, reply) => {
      const { id: taskId } = request.params;
      const { employee } = resolveRequestIdentity(request);
      const pending = orchestrator.getPendingApprovals(taskId);

      if (pending.length === 0) {
        return reply.status(404).send({ error: `No pending approval found for task '${taskId}'.` });
      }

      const approval = pending[0];
      try {
        const result = await orchestrator.submitApproval({
          taskId,
          approvalId: approval.id,
          human: employee,
          approved: true,
          decisionNote: request.body?.decisionNote,
        });

        return reply.status(200).send({
          success: true,
          status: result.status,
          message: result.message,
          task: result.task,
          toolResult: result.toolResult,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: err.name || "ApprovalError",
          message: err.message,
        });
      }
    }
  );

  // POST /tasks/:id/reject - Convenience route for task rejection
  fastify.post<{ Params: { id: string }; Body: { decisionNote?: string } }>(
    "/tasks/:id/reject",
    async (request, reply) => {
      const { id: taskId } = request.params;
      const { employee } = resolveRequestIdentity(request);
      const pending = orchestrator.getPendingApprovals(taskId);

      if (pending.length === 0) {
        return reply.status(404).send({ error: `No pending approval found for task '${taskId}'.` });
      }

      const approval = pending[0];
      try {
        const result = await orchestrator.submitApproval({
          taskId,
          approvalId: approval.id,
          human: employee,
          approved: false,
          decisionNote: request.body?.decisionNote,
        });

        return reply.status(200).send({
          success: true,
          status: result.status,
          message: result.message,
          task: result.task,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: err.name || "ApprovalError",
          message: err.message,
        });
      }
    }
  );
};
