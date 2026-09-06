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

export interface TasksPluginOptions {
  orchestrator: PipelineOrchestrator;
  auditSink?: { getEventsForTask(taskId: string): Promise<any[]> };
}

const CreateTaskBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  workflow: z.enum(["investigate_issue"]).default("investigate_issue"),
  organizationId: z.string().default("org_default"),
  humanEmployee: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.string().default("Engineer"),
  }),
  coworker: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    persona: z.string().default("Software Engineer"),
    capabilities: z.array(z.string()).default(["investigate_issue"]),
    systemPrompt: z.string().default("You are an engineering coworker."),
  }),
});

export const taskRoutes: FastifyPluginAsync<TasksPluginOptions> = async (
  fastify,
  opts
) => {
  const { orchestrator, auditSink } = opts;

  fastify.post("/tasks", async (request, reply) => {
    const parseResult = CreateTaskBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation Failed",
        details: parseResult.error.flatten(),
      });
    }

    const { title, description, workflow, organizationId, humanEmployee, coworker } =
      parseResult.data;

    const parsedHuman: HumanEmployee = HumanEmployeeSchema.parse({
      ...humanEmployee,
      organizationId,
      createdAt: new Date(),
    });

    const parsedCoworker: AICoworker = AICoworkerSchema.parse({
      ...coworker,
      organizationId,
      createdByHumanId: parsedHuman.id,
      createdAt: new Date(),
    });

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const task: Task = TaskSchema.parse({
      id: taskId,
      title,
      description,
      workflow,
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

  fastify.get<{ Params: { id: string } }>("/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    const task = orchestrator.getTask(id);
    if (!task) {
      return reply.status(404).send({ error: `Task '${id}' not found.` });
    }

    const auditEvents = auditSink ? await auditSink.getEventsForTask(id) : [];

    return {
      task,
      auditEvents,
    };
  });
};
