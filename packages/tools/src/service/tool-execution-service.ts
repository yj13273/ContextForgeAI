import type { ToolRegistry } from "../registry/tool-registry.js";
import type {
  ToolCallIntent,
  ToolResult,
  ToolExecutionContext,
  AICoworker,
  HumanEmployee,
} from "@contextforge/core";
import {
  NotFoundError,
  AuthorizationError,
  ProviderValidationError,
  TenantIsolationError,
  CoworkerPermissionError,
} from "../errors.js";

import type { IdempotencyService } from "./idempotency.js";

export interface ExecuteToolOptions {
  call: ToolCallIntent;
  context: ToolExecutionContext;
  coworker?: AICoworker;
  employee?: HumanEmployee;
  approved?: boolean;
  idempotencyKey?: string;
}

export class ToolExecutionService {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly idempotencyService?: IdempotencyService
  ) {}

  async execute(options: ExecuteToolOptions): Promise<ToolResult> {
    const { call, context, coworker, employee, approved } = options;

    // 1. Context validation
    if (
      !context ||
      !context.organizationId ||
      !context.taskId ||
      !context.employeeId ||
      !context.coworkerId
    ) {
      throw new ProviderValidationError("Valid ToolExecutionContext is required for tool execution.");
    }

    // 2. Tool existence
    const tool = this.registry.get(call.toolName);
    if (!tool) {
      throw new NotFoundError(`Tool '${call.toolName}' not found in registry.`);
    }

    // 3. Coworker and employee checks
    if (coworker) {
      // Cross-tenant isolation check
      if (coworker.organizationId !== context.organizationId) {
        throw new TenantIsolationError(
          `AI Coworker organization '${coworker.organizationId}' does not match execution context organization '${context.organizationId}'.`
        );
      }

      // Check coworker capability
      if (!coworker.capabilities.includes(tool.requiredCapability)) {
        throw new CoworkerPermissionError(
          `Coworker '${coworker.name}' lacks required capability '${tool.requiredCapability}' for tool '${tool.name}'.`
        );
      }
    }

    if (employee) {
      // Cross-tenant isolation check
      if (employee.organizationId !== context.organizationId) {
        throw new TenantIsolationError(
          `Human Employee organization '${employee.organizationId}' does not match execution context organization '${context.organizationId}'.`
        );
      }
    }

    if (coworker && employee) {
      // Domain separation
      if (coworker.id === employee.id) {
        throw new TenantIsolationError("HumanEmployee and AICoworker cannot share identical domain IDs.");
      }

      // Coworker ownership check
      if (coworker.createdByHumanId !== employee.id) {
        throw new CoworkerPermissionError(
          `AI Coworker '${coworker.name}' is owned by human '${coworker.createdByHumanId}', not employee '${employee.id}'.`
        );
      }
    }

    // 4. Permission / Approval Gate
    if (tool.type === "write" && !approved) {
      throw new AuthorizationError(
        `Tool '${tool.name}' is a write tool requiring explicit human approval before execution.`
      );
    }

    // 5. Input validation against schema
    const parseResult = tool.inputSchema.safeParse(call.parameters);
    if (!parseResult.success) {
      throw new ProviderValidationError(
        `Invalid input for tool '${tool.name}': ${parseResult.error.message}`
      );
    }

    // 6. Idempotency Check for Write Operations
    if (tool.type === "write" && options.idempotencyKey && this.idempotencyService) {
      const cached = this.idempotencyService.get(options.idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    // 7. Execute tool
    const result = await tool.execute(call, context);

    if (tool.type === "write" && options.idempotencyKey && this.idempotencyService) {
      this.idempotencyService.set(options.idempotencyKey, result);
    }

    return result;
  }
}
