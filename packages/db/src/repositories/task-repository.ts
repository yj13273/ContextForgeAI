import { eq, and } from "drizzle-orm";
import type { ContextForgeDb } from "../client.js";
import { tasks, type TaskRecord } from "../schema/tasks.js";
import { taskSteps, type TaskStepRecord } from "../schema/task-steps.js";
import { employees } from "../schema/employees.js";
import { coworkers } from "../schema/coworkers.js";
import { TenantIsolationError, RecordNotFoundError } from "./errors.js";

export class TaskRepository {
  constructor(private readonly db: ContextForgeDb) {}

  async create(data: {
    organizationId: string;
    createdByEmployeeId: string;
    assignedToCoworkerId: string;
    title: string;
    description?: string;
    workflow?: string;
  }): Promise<TaskRecord> {
    // Validate human employee in organization
    const [employee] = await this.db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, data.createdByEmployeeId),
          eq(employees.organizationId, data.organizationId)
        )
      );

    if (!employee) {
      throw new TenantIsolationError(
        `Cannot create task: Employee '${data.createdByEmployeeId}' not found in organization '${data.organizationId}'.`
      );
    }

    // Validate coworker in organization
    const [coworker] = await this.db
      .select()
      .from(coworkers)
      .where(
        and(
          eq(coworkers.id, data.assignedToCoworkerId),
          eq(coworkers.organizationId, data.organizationId)
        )
      );

    if (!coworker) {
      throw new TenantIsolationError(
        `Cannot create task: AI Coworker '${data.assignedToCoworkerId}' not found in organization '${data.organizationId}'.`
      );
    }

    const [record] = await this.db
      .insert(tasks)
      .values({
        organizationId: data.organizationId,
        createdByEmployeeId: data.createdByEmployeeId,
        assignedToCoworkerId: data.assignedToCoworkerId,
        title: data.title,
        description: data.description ?? "",
        workflow: data.workflow ?? "investigate_issue",
        status: "CREATED",
      })
      .returning();

    return record;
  }

  async findById(organizationId: string, id: string): Promise<TaskRecord | null> {
    const [record] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)));
    return record || null;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: string,
    extra?: {
      activeApprovalId?: string | null;
      resultSummary?: string;
      resultData?: Record<string, unknown>;
      errorMessage?: string;
    }
  ): Promise<TaskRecord> {
    const [record] = await this.db
      .update(tasks)
      .set({
        status,
        activeApprovalId: extra?.activeApprovalId,
        resultSummary: extra?.resultSummary,
        resultData: extra?.resultData,
        errorMessage: extra?.errorMessage,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
      .returning();

    if (!record) {
      throw new RecordNotFoundError(
        `Task '${id}' not found in organization '${organizationId}'.`
      );
    }

    return record;
  }

  async createStep(
    taskId: string,
    stepIndex: number,
    stepType: string,
    status: string,
    payload: Record<string, unknown> = {},
    result?: Record<string, unknown>
  ): Promise<TaskStepRecord> {
    const [step] = await this.db
      .insert(taskSteps)
      .values({
        taskId,
        stepIndex,
        stepType,
        status,
        payload,
        result,
      })
      .returning();
    return step;
  }

  async listSteps(taskId: string): Promise<TaskStepRecord[]> {
    return this.db
      .select()
      .from(taskSteps)
      .where(eq(taskSteps.taskId, taskId))
      .orderBy(taskSteps.stepIndex);
  }
}
