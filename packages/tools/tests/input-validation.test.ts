import { describe, it, expect } from "vitest";
import { createDefaultToolRegistry } from "../src/registry/tool-registry.js";
import { ToolExecutionService } from "../src/service/tool-execution-service.js";
import { ProviderValidationError } from "../src/errors.js";
import { createMockGitHubClient, createMockLinearClient } from "./mocks/provider-mocks.js";

describe("Milestone 3: Input Validation (Tests 4-5)", () => {
  const ghClient = createMockGitHubClient();
  const linClient = createMockLinearClient();
  const registry = createDefaultToolRegistry(ghClient, linClient);
  const service = new ToolExecutionService(registry);

  const context = {
    organizationId: "org_1",
    taskId: "task_1",
    employeeId: "emp_1",
    coworkerId: "coworker_1",
  };

  it("Test 4: should reject invalid input parameters for GitHub tools", async () => {
    // Missing owner & repo
    await expect(
      service.execute({
        call: {
          toolName: "github:get_issue",
          action: "get_issue",
          parameters: { issueNumber: 42 },
        },
        context,
      })
    ).rejects.toThrow(ProviderValidationError);

    // Negative issue number
    await expect(
      service.execute({
        call: {
          toolName: "github:get_issue",
          action: "get_issue",
          parameters: { owner: "acme", repo: "repo", issueNumber: -1 },
        },
        context,
      })
    ).rejects.toThrow(ProviderValidationError);

    // Empty search query
    await expect(
      service.execute({
        call: {
          toolName: "github:search_code",
          action: "search_code",
          parameters: { query: "" },
        },
        context,
      })
    ).rejects.toThrow(ProviderValidationError);

    // Missing path for get_file
    await expect(
      service.execute({
        call: {
          toolName: "github:get_file",
          action: "get_file",
          parameters: { owner: "acme", repo: "repo" },
        },
        context,
      })
    ).rejects.toThrow(ProviderValidationError);
  });

  it("Test 5: should reject invalid input parameters for Linear tools", async () => {
    // Missing issueId for get_issue
    await expect(
      service.execute({
        call: {
          toolName: "linear:get_issue",
          action: "get_issue",
          parameters: {},
        },
        context,
      })
    ).rejects.toThrow(ProviderValidationError);

    // Linear update_issue with no fields to update
    await expect(
      service.execute({
        call: {
          toolName: "linear:update_issue",
          action: "update_issue",
          parameters: { issueId: "lin_1" },
        },
        context,
        approved: true,
      })
    ).rejects.toThrow(ProviderValidationError);

    // Linear update_issue with invalid priority (> 4)
    await expect(
      service.execute({
        call: {
          toolName: "linear:update_issue",
          action: "update_issue",
          parameters: { issueId: "lin_1", priority: 10 },
        },
        context,
        approved: true,
      })
    ).rejects.toThrow(ProviderValidationError);
  });
});
