import { describe, it, expect } from "vitest";
import { createDefaultToolRegistry } from "../src/registry/tool-registry.js";
import { ToolExecutionService } from "../src/service/tool-execution-service.js";
import {
  AuthorizationError,
  TenantIsolationError,
  CoworkerPermissionError,
} from "../src/errors.js";
import type { HumanEmployee, AICoworker } from "@contextforge/core";
import { createMockGitHubClient, createMockLinearClient } from "./mocks/provider-mocks.js";

describe("Milestone 3: Permissions & Boundaries (Tests 6-10)", () => {
  const ghClient = createMockGitHubClient();
  const linClient = createMockLinearClient();
  const registry = createDefaultToolRegistry(ghClient, linClient);
  const service = new ToolExecutionService(registry);

  const humanEmployee: HumanEmployee = {
    id: "emp_human_01",
    email: "alice@acme.com",
    name: "Alice Engineer",
    role: "Staff Engineer",
    organizationId: "org_acme_prod",
    createdAt: new Date(),
  };

  const aiCoworker: AICoworker = {
    id: "coworker_ai_01",
    name: "DevBot",
    persona: "Software Engineer",
    organizationId: "org_acme_prod",
    capabilities: ["github:read", "linear:read"],
    systemPrompt: "Investigate issues thoroughly.",
    createdByHumanId: "emp_human_01",
    createdAt: new Date(),
  };

  const validContext = {
    organizationId: "org_acme_prod",
    taskId: "task_investigate_01",
    employeeId: "emp_human_01",
    coworkerId: "coworker_ai_01",
  };

  it("Test 6: should execute READ tool automatically when coworker has capability", async () => {
    const result = await service.execute({
      call: {
        toolName: "github:get_issue",
        action: "get_issue",
        parameters: { owner: "acme", repo: "repo", issueNumber: 42 },
      },
      context: validContext,
      coworker: aiCoworker,
      employee: humanEmployee,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as any).number).toBe(42);
  });

  it("Test 7: should reject execution if coworker lacks required capability", async () => {
    // Coworker only has github:read and linear:read, lacking linear:write
    await expect(
      service.execute({
        call: {
          toolName: "linear:update_issue",
          action: "update_issue",
          parameters: { issueId: "ENG-404", title: "New Title" },
        },
        context: validContext,
        coworker: aiCoworker,
        employee: humanEmployee,
        approved: true, // Even with approval, coworker lacks capability
      })
    ).rejects.toThrow(CoworkerPermissionError);
  });

  it("Test 8: should reject execution across tenant boundaries (organization mismatch)", async () => {
    const foreignCoworker: AICoworker = {
      ...aiCoworker,
      id: "coworker_ai_other",
      organizationId: "org_competitor_corp",
    };

    await expect(
      service.execute({
        call: {
          toolName: "github:get_issue",
          action: "get_issue",
          parameters: { owner: "acme", repo: "repo", issueNumber: 42 },
        },
        context: validContext,
        coworker: foreignCoworker,
        employee: humanEmployee,
      })
    ).rejects.toThrow(TenantIsolationError);
  });

  it("Test 9: should reject coworker ownership violation", async () => {
    const unownedCoworker: AICoworker = {
      ...aiCoworker,
      createdByHumanId: "emp_someone_else",
    };

    await expect(
      service.execute({
        call: {
          toolName: "github:get_issue",
          action: "get_issue",
          parameters: { owner: "acme", repo: "repo", issueNumber: 42 },
        },
        context: validContext,
        coworker: unownedCoworker,
        employee: humanEmployee,
      })
    ).rejects.toThrow(CoworkerPermissionError);
  });

  it("Test 10: should strictly block unapproved WRITE tools from direct execution", async () => {
    const coworkerWithWrite: AICoworker = {
      ...aiCoworker,
      capabilities: ["github:read", "linear:read", "linear:write"],
    };

    // Attempting to execute write tool without approved: true
    await expect(
      service.execute({
        call: {
          toolName: "linear:update_issue",
          action: "update_issue",
          parameters: { issueId: "ENG-404", title: "Unauthorized title change" },
        },
        context: validContext,
        coworker: coworkerWithWrite,
        employee: humanEmployee,
        approved: false,
      })
    ).rejects.toThrow(AuthorizationError);
  });
});
