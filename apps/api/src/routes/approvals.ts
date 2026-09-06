import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { PipelineOrchestrator } from "@contextforge/core";
import { type HumanEmployee, HumanEmployeeSchema } from "@contextforge/core";

import { resolveRequestIdentity } from "../auth.js";

export interface ApprovalsPluginOptions {
  orchestrator: PipelineOrchestrator;
}

const SubmitApprovalBodySchema = z.object({
  taskId: z.string().optional(),
  approved: z.boolean().optional(),
  decisionNote: z.string().optional(),
  humanEmployee: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.string().default("Engineer"),
    organizationId: z.string().default("org_default"),
  }).optional(),
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

    const { employee } = resolveRequestIdentity(request);
    const { taskId, approved = true, decisionNote, humanEmployee } = parseResult.data;

    const parsedHuman: HumanEmployee = humanEmployee
      ? HumanEmployeeSchema.parse({ ...humanEmployee, createdAt: new Date() })
      : employee;

    // Resolve taskId from approval if not provided in body
    let targetTaskId = taskId;
    if (!targetTaskId) {
      const allPending = orchestrator.getPendingApprovals();
      const match = allPending.find((a) => a.id === approvalId);
      if (!match) {
        return reply.status(404).send({ error: `Approval '${approvalId}' not found.` });
      }
      targetTaskId = match.taskId;
    }

    try {
      const result = await orchestrator.submitApproval({
        taskId: targetTaskId,
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

  fastify.post<{ Params: { id: string }; Body: { decisionNote?: string } }>(
    "/approvals/:id/approve",
    async (request, reply) => {
      const { id: approvalId } = request.params;
      const { employee } = resolveRequestIdentity(request);

      const allPending = orchestrator.getPendingApprovals();
      const match = allPending.find((a) => a.id === approvalId);
      if (!match) {
        return reply.status(404).send({ error: `Approval '${approvalId}' not found.` });
      }

      try {
        const result = await orchestrator.submitApproval({
          taskId: match.taskId,
          approvalId,
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

  fastify.post<{ Params: { id: string }; Body: { decisionNote?: string } }>(
    "/approvals/:id/reject",
    async (request, reply) => {
      const { id: approvalId } = request.params;
      const { employee } = resolveRequestIdentity(request);

      const allPending = orchestrator.getPendingApprovals();
      const match = allPending.find((a) => a.id === approvalId);
      if (!match) {
        return reply.status(404).send({ error: `Approval '${approvalId}' not found.` });
      }

      try {
        const result = await orchestrator.submitApproval({
          taskId: match.taskId,
          approvalId,
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
