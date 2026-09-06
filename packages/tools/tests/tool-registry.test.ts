import { describe, it, expect } from "vitest";
import { createDefaultToolRegistry, ToolRegistry } from "../src/registry/tool-registry.js";
import { ToolExecutionService } from "../src/service/tool-execution-service.js";
import { NotFoundError } from "../src/errors.js";
import { createMockGitHubClient, createMockLinearClient } from "./mocks/provider-mocks.js";

describe("Milestone 3: Tool Registry (Tests 1-3)", () => {
  const ghClient = createMockGitHubClient();
  const linClient = createMockLinearClient();
  const registry = createDefaultToolRegistry(ghClient, linClient);

  it("Test 1: should register all 9 tools with accurate names, types, and capabilities", () => {
    const tools = registry.listTools();
    expect(tools.length).toBe(9);

    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "github:get_file",
      "github:get_issue",
      "github:get_pull_request",
      "github:list_commits",
      "github:search_code",
      "linear:get_issue",
      "linear:list_comments",
      "linear:search_issues",
      "linear:update_issue",
    ]);

    // Check read tools
    const readTools = tools.filter((t) => t.type === "read");
    expect(readTools.length).toBe(8);

    // Check write tool
    const writeTools = tools.filter((t) => t.type === "write");
    expect(writeTools.length).toBe(1);
    expect(writeTools[0].name).toBe("linear:update_issue");
    expect(writeTools[0].requiredCapability).toBe("linear:write");
  });

  it("Test 2: should filter registered tools by capability", () => {
    const ghReadTools = registry.listByCapability("github:read");
    expect(ghReadTools.length).toBe(5);
    expect(ghReadTools.every((t) => t.type === "read")).toBe(true);

    const linReadTools = registry.listByCapability("linear:read");
    expect(linReadTools.length).toBe(3);
    expect(linReadTools.every((t) => t.type === "read")).toBe(true);

    const linWriteTools = registry.listByCapability("linear:write");
    expect(linWriteTools.length).toBe(1);
    expect(linWriteTools[0].name).toBe("linear:update_issue");

    const nonExistent = registry.listByCapability("slack:write");
    expect(nonExistent).toEqual([]);
  });

  it("Test 3: should handle unknown tools safely", async () => {
    expect(registry.has("unknown_tool")).toBe(false);
    expect(registry.get("unknown_tool")).toBeUndefined();

    const service = new ToolExecutionService(registry);
    await expect(
      service.execute({
        call: {
          toolName: "non_existent_tool",
          action: "read",
          parameters: {},
        },
        context: {
          organizationId: "org_1",
          taskId: "task_1",
          employeeId: "emp_1",
          coworkerId: "coworker_1",
        },
      })
    ).rejects.toThrow(NotFoundError);
  });
});
