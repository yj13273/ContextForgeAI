import { eq, and } from "drizzle-orm";
import type { ContextForgeDb } from "../client.js";
import { approvals, type ApprovalRecord } from "../schema/approvals.js";
import { tasks, type TaskRecord } from "../schema/tasks.js";
import { employees } from "../schema/employees.js";
import {
  TenantIsolationError,
  ConcurrencyConflictError,
  RecordNotFoundError,
  DatabaseValidationError,
} from "./errors.js";

export class ApprovalRepository {
  constructor(private readonly db: ContextForgeDb) {}

  async create(data: {
    organizationId: string;
    taskId: string;
    requestedByCoworkerId: string;
    toolCall: {
      toolName: string;
      action: string;
      parameters: Record<string, unknown>;
    };
  }): Promise<ApprovalRecord> {
    const [record] = await this.db
      .insert(approvals)
      .values({
        organizationId: data.organizationId,
        taskId: data.taskId,
        requestedByCoworkerId: data.requestedByCoworkerId,
        toolCall: data.toolCall,
        status: "pending",
      })
      .returning();

    // Link active approval on task
    await this.db
      .update(tasks)
      .set({
        activeApprovalId: record.id,
        status: "AWAITING_APPROVAL",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, data.taskId),
          eq(tasks.organizationId, data.organizationId)
        )
      );

    return record;
  }

  async findById(organizationId: string, id: string): Promise<ApprovalRecord | null> {
    const [record] = await this.db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, id), eq(approvals.organizationId, organizationId)));
    return record || null;
  }

  async listPendingByOrg(organizationId: string): Promise<ApprovalRecord[]> {
    return this.db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, organizationId),
          eq(approvals.status, "pending")
        )
      );
  }

  /**
   * Atomically resolves an approval with strict tenant isolation and concurrency safety.
   * Uses an atomic conditional update inside a database transaction:
   * Only transitions when approval status is STILL 'pending'.
   */
  async resolveApprovalAtomic(params: {
    organizationId: string;
    approvalId: string;
    taskId: string;
    reviewerEmployeeId: string;
    approved: boolean;
    decisionNote?: string;
  }): Promise<{ approval: ApprovalRecord; task: TaskRecord }> {
    return await this.db.transaction(async (tx) => {
      // 1. Enforce tenant boundary: Reviewer must be in this organization
      const [employee] = await tx
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.id, params.reviewerEmployeeId),
            eq(employees.organizationId, params.organizationId)
          )
        );

      if (!employee) {
        throw new TenantIsolationError(
          `Human employee '${params.reviewerEmployeeId}' does not belong to organization '${params.organizationId}'.`
        );
      }

      // 2. Enforce tenant boundary: Task must belong to this organization
      const [task] = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, params.taskId),
            eq(tasks.organizationId, params.organizationId)
          )
        );

      if (!task) {
        throw new TenantIsolationError(
          `Task '${params.taskId}' not found in organization '${params.organizationId}'.`
        );
      }

      // 3. Verify approval exists and belongs to the task & organization
      const [approval] = await tx
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.id, params.approvalId),
            eq(approvals.organizationId, params.organizationId)
          )
        );

      if (!approval) {
        throw new RecordNotFoundError(
          `Approval request '${params.approvalId}' not found in organization '${params.organizationId}'.`
        );
      }

      if (approval.taskId !== params.taskId) {
        throw new DatabaseValidationError(
          `Approval request '${params.approvalId}' belongs to task '${approval.taskId}', not task '${params.taskId}'.`
        );
      }

      if (approval.requestedByCoworkerId === params.reviewerEmployeeId) {
        throw new DatabaseValidationError(
          "An AI Coworker cannot approve its own request; approval must come from a separate HumanEmployee."
        );
      }

      // 4. ATOMIC CONDITIONAL UPDATE:
      // Only transition when status === 'pending'
      const targetStatus = params.approved ? "approved" : "rejected";
      const [updatedApproval] = await tx
        .update(approvals)
        .set({
          status: targetStatus,
          reviewedByEmployeeId: params.reviewerEmployeeId,
          decisionNote: params.decisionNote,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(approvals.id, params.approvalId),
            eq(approvals.organizationId, params.organizationId),
            eq(approvals.taskId, params.taskId),
            eq(approvals.status, "pending")
          )
        )
        .returning();

      if (!updatedApproval) {
        throw new ConcurrencyConflictError(
          `Approval request '${params.approvalId}' has already been resolved or is no longer pending.`
        );
      }

      // 5. Update task status inside the transaction
      const nextTaskStatus = params.approved ? "EXECUTING_ACTION" : "REJECTED";
      const [updatedTask] = await tx
        .update(tasks)
        .set({
          status: nextTaskStatus,
          updatedAt: new Date(),
          errorMessage: params.approved
            ? undefined
            : `Rejected by human employee: ${params.decisionNote ?? "No reason provided"}`,
        })
        .where(
          and(
            eq(tasks.id, params.taskId),
            eq(tasks.organizationId, params.organizationId)
          )
        )
        .returning();

      return { approval: updatedApproval, task: updatedTask };
    });
  }
}
