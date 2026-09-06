import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  PipelineOrchestrator,
  FakeContextEngine,
  FakeReasoner,
  FakeReadTool,
  FakeWriteTool,
  InMemoryAuditSink,
} from "@contextforge/core";
import { buildServer } from "../src/server.js";

describe("ContextForge Fastify API", () => {
  let app: FastifyInstance;
  let auditSink: InMemoryAuditSink;
  let contextEngine: FakeContextEngine;
  let readTool: FakeReadTool;
  let writeTool: FakeWriteTool;
  let toolMap: Map<string, any>;

  beforeEach(async () => {
    auditSink = new InMemoryAuditSink();
    contextEngine = new FakeContextEngine();
    readTool = new FakeReadTool();
    writeTool = new FakeWriteTool();

    toolMap = new Map();
    toolMap.set(readTool.name, readTool);
    toolMap.set(writeTool.name, writeTool);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /health returns 200 with service status", async () => {
    app = await buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("contextforge-api");
    expect(body.timestamp).toBeDefined();
  });

  it("POST /tasks with read tool runs automatically to completion", async () => {
    const reasoner = new FakeReasoner("read_tool");
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasoner,
      toolMap,
      auditSink
    );
    app = await buildServer({ orchestrator, auditSink });

    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        title: "Investigate crash in session handler",
        description: "Null pointer error on edge router",
        workflow: "investigate_issue",
        organizationId: "org_test",
        humanEmployee: {
          id: "human_emp_10",
          email: "dev@acme.com",
          name: "Developer One",
          role: "Engineer",
        },
        coworker: {
          id: "coworker_ai_10",
          name: "SWE AI",
          persona: "Software Engineer",
          capabilities: ["investigate_issue"],
          systemPrompt: "Investigate issues autonomously.",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.status).toBe("COMPLETED");
    expect(body.toolResult?.success).toBe(true);
    expect(readTool.executionCount).toBe(1);

    // Fetch the task via GET /tasks/:id
    const getRes = await app.inject({
      method: "GET",
      url: `/tasks/${body.task.id}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.task.id).toBe(body.task.id);
    expect(getBody.auditEvents.length).toBeGreaterThan(0);
  });

  it("POST /tasks with write tool pauses at AWAITING_APPROVAL and resolves via POST /approvals/:id", async () => {
    const reasoner = new FakeReasoner("write_tool");
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasoner,
      toolMap,
      auditSink
    );
    app = await buildServer({ orchestrator, auditSink });

    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        title: "Investigate ticket and post comment",
        description: "Requires commenting on Linear",
        workflow: "investigate_issue",
        organizationId: "org_test",
        humanEmployee: {
          id: "human_emp_20",
          email: "dev2@acme.com",
          name: "Developer Two",
          role: "Senior Engineer",
        },
        coworker: {
          id: "coworker_ai_20",
          name: "SWE Coworker",
          persona: "Software Engineer",
          capabilities: ["investigate_issue"],
          systemPrompt: "Investigate issues.",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("AWAITING_APPROVAL");
    expect(body.approvalRequest).toBeDefined();
    expect(writeTool.executionCount).toBe(0);

    const approvalId = body.approvalRequest.id;
    const taskId = body.task.id;

    // Check GET /approvals
    const listApprovalsRes = await app.inject({
      method: "GET",
      url: "/approvals",
    });
    expect(listApprovalsRes.statusCode).toBe(200);
    const approvalsList = JSON.parse(listApprovalsRes.body);
    expect(approvalsList.count).toBe(1);
    expect(approvalsList.approvals[0].id).toBe(approvalId);

    // Human approves the action
    const approvalRes = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}`,
      payload: {
        taskId,
        approved: true,
        decisionNote: "Approved to post Linear comment.",
        humanEmployee: {
          id: "human_emp_20",
          email: "dev2@acme.com",
          name: "Developer Two",
          role: "Senior Engineer",
          organizationId: "org_test",
        },
      },
    });

    expect(approvalRes.statusCode).toBe(200);
    const approvalBody = JSON.parse(approvalRes.body);
    expect(approvalBody.status).toBe("COMPLETED");
    expect(approvalBody.toolResult?.success).toBe(true);
    expect(writeTool.executionCount).toBe(1);
  });

  it("rejects task when human denies approval, leaving write tool unexecuted", async () => {
    const reasoner = new FakeReasoner("write_tool");
    const orchestrator = new PipelineOrchestrator(
      contextEngine,
      reasoner,
      toolMap,
      auditSink
    );
    app = await buildServer({ orchestrator, auditSink });

    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        title: "Investigate and update",
        description: "Test rejection",
        workflow: "investigate_issue",
        organizationId: "org_test",
        humanEmployee: {
          id: "human_emp_30",
          email: "dev3@acme.com",
          name: "Developer Three",
          role: "Staff Engineer",
        },
        coworker: {
          id: "coworker_ai_30",
          name: "SWE Coworker",
          persona: "Software Engineer",
          capabilities: ["investigate_issue"],
          systemPrompt: "Investigate issues.",
        },
      },
    });

    const body = JSON.parse(res.body);
    const approvalId = body.approvalRequest.id;
    const taskId = body.task.id;

    // Human denies approval
    const denyRes = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}`,
      payload: {
        taskId,
        approved: false,
        decisionNote: "Findings are not validated yet.",
        humanEmployee: {
          id: "human_emp_30",
          email: "dev3@acme.com",
          name: "Developer Three",
          role: "Staff Engineer",
          organizationId: "org_test",
        },
      },
    });

    expect(denyRes.statusCode).toBe(200);
    const denyBody = JSON.parse(denyRes.body);
    expect(denyBody.status).toBe("REJECTED");
    expect(writeTool.executionCount).toBe(0);
  });
});
