import { describe, it, expect, vi } from "vitest";
import { ToolExecutionService } from "../src/service/tool-execution-service.js";
import { InMemoryIdempotencyService } from "../src/service/idempotency.js";
import { ToolRegistry } from "../src/registry/tool-registry.js";
import type { ContextForgeTool } from "../src/types.js";
import { z } from "zod";

describe("Milestone 8: Idempotency Service (Unit)", () => {
  it("prevents duplicate execution of write tools when using idempotencyKey", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      success: true,
      data: { updated: true, revision: 1 },
    });

    const writeTool: ContextForgeTool = {
      name: "linear:update_issue",
      description: "Update Linear issue",
      type: "write",
      requiredCapability: "linear:write",
      inputSchema: z.object({ issueId: z.string() }),
      outputSchema: z.object({ updated: z.boolean() }),
      execute: mockExecute,
    };

    const registry = new ToolRegistry();
    registry.register(writeTool);

    const idempotency = new InMemoryIdempotencyService();
    const service = new ToolExecutionService(registry, idempotency);

    const context = {
      organizationId: "org_1",
      taskId: "task_1",
      employeeId: "emp_1",
      coworkerId: "coworker_1",
    };

    // Execution 1: First call executes the tool
    const res1 = await service.execute({
      call: {
        toolName: "linear:update_issue",
        action: "linear:update_issue",
        parameters: { issueId: "ENG-142" },
      },
      context,
      approved: true,
      idempotencyKey: "task_1:app_1:linear:update_issue",
    });

    expect(res1.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Execution 2: Replay with same idempotencyKey returns cached result WITHOUT executing tool again
    const res2 = await service.execute({
      call: {
        toolName: "linear:update_issue",
        action: "linear:update_issue",
        parameters: { issueId: "ENG-142" },
      },
      context,
      approved: true,
      idempotencyKey: "task_1:app_1:linear:update_issue",
    });

    expect(res2.success).toBe(true);
    expect(res2.data).toEqual({ updated: true, revision: 1 });
    expect(mockExecute).toHaveBeenCalledTimes(1); // STILL 1 call! No duplicate side effect!
  });
});
