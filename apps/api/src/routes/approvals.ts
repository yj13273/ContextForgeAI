import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { PipelineOrchestrator } from "@contextforge/core";
import { type HumanEmployee, HumanEmployeeSchema } from "@contextforge/core";

export interface ApprovalsPluginOptions {
  orchestrator: PipelineOrchestrator;
}

const SubmitApprovalBodySchema = z.object({
  taskId: z.string().min(1),
  approved: z.boolean(),
  decisionNote: z.string().optional(),
  humanEmployee: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.string().default("Engineer"),
    organizationId: z.string().default("org_default"),
  }),
});

export const approvalRoutes: FastifyPluginAsync<ApprovalsPluginOptions> = async (
  fastify,
  opts
) => {
  const { orchestrator } = opts;

  fastify.get<{ Querystring: { taskId?: string } }>("/approvals", async (request) => {
    const { taskId } = request.query;
    const pending = orchestrator.getPendingApprovals(taskId);
    return {
      count: pending.length,
      approvals: pending,
    };
  });

  fastify.post<{ Params: { id: string } }>("/approvals/:id", async (request, reply) => {
    const { id: approvalId } = request.params;
    const parseResult = SubmitApprovalBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation Failed",
        details: parseResult.error.flatten(),
      });
    }

    const { taskId, approved, decisionNote, humanEmployee } = parseResult.data;

    const parsedHuman: HumanEmployee = HumanEmployeeSchema.parse({
      ...humanEmployee,
      createdAt: new Date(),
    });

    try {
      const result = await orchestrator.submitApproval({
        taskId,
        approvalId,
        human: parsedHuman,
        approved,
        decisionNote,
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
  });
};
