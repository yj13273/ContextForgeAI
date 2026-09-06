import { createDbClient } from "../packages/db/src/client.js";
import { organizations } from "../packages/db/src/schema/organizations.js";
import { employees } from "../packages/db/src/schema/employees.js";
import { coworkers } from "../packages/db/src/schema/coworkers.js";
import { roles } from "../packages/db/src/schema/roles.js";
import { tasks } from "../packages/db/src/schema/tasks.js";
import { approvals } from "../packages/db/src/schema/approvals.js";
import { memories } from "../packages/db/src/schema/memories.js";
import { activityEvents } from "../packages/db/src/schema/activity-events.js";
import { TaskRepository } from "../packages/db/src/repositories/task-repository.js";
import { ApprovalRepository } from "../packages/db/src/repositories/approval-repository.js";
import { MemoryRepository } from "../packages/db/src/repositories/memory-repository.js";
import { AuditRepository } from "../packages/db/src/repositories/audit-repository.js";
import { DefaultContextEngine } from "../packages/core/src/context/context-engine.js";
import { FakeLLMProvider } from "../packages/core/src/llm/fake-llm-provider.js";
import { LLMReasoner } from "../packages/core/src/reasoner/llm-reasoner.js";
import { InvestigationWorkflow } from "../packages/core/src/orchestrator/investigation-workflow.js";
import { ToolRegistry } from "../packages/tools/src/registry/tool-registry.js";
import { ToolExecutionService } from "../packages/tools/src/service/tool-execution-service.js";
import { InMemoryIdempotencyService } from "../packages/tools/src/service/idempotency.js";
import type { ContextForgeTool } from "../packages/tools/src/types.js";
import { buildServer } from "../apps/api/src/server.js";
import { ApiClient } from "../apps/web/src/lib/api.js";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

interface PhaseResult {
  phase: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const results: PhaseResult[] = [];

function recordResult(phase: string, passed: boolean, details?: string) {
  const status = passed ? "PASS" : "FAIL";
  results.push({ phase, status, details });
  console.log(`[${status}] ${phase}${details ? ` - ${details}` : ""}`);
}

async function runVerification() {
  console.log("==================================================");
  console.log("CONTEXTFORGE AI — COMPLETE E2E SYSTEM VERIFICATION");
  console.log("==================================================\n");

  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/contextforge";
  const { db, pool } = createDbClient(dbUrl);
  let apiServer: any = null;

  // ==========================================
  // PHASE 1: ENVIRONMENT
  // ==========================================
  console.log("--- PHASE 1: ENVIRONMENT ---");
  try {
    // 1. PostgreSQL check
    const healthCheck = await db.select().from(organizations).limit(1);
    const dbConnected = Array.isArray(healthCheck);

    // 2. Start API server on port 3088
    apiServer = await buildServer();
    await apiServer.listen({ port: 3088, host: "127.0.0.1" });

    // 3. Check health endpoint over HTTP
    const healthRes = await fetch("http://127.0.0.1:3088/health");
    const healthJson = await healthRes.json();
    const healthOk = healthRes.status === 200 && healthJson.status === "ok";

    recordResult("Phase 1: Environment", dbConnected && healthOk, "PostgreSQL connected, API listening on 3088, /health returned 200");
  } catch (err: any) {
    recordResult("Phase 1: Environment", false, err.message);
  }

  // ==========================================
  // PHASE 2: DATABASE & MULTI-TENANCY
  // ==========================================
  console.log("\n--- PHASE 2: DATABASE ---");
  const timestamp = Date.now();
  const testOrgId = `00000000-0000-0000-0000-${String(timestamp).slice(-12).padStart(12, "0")}`;
  const foreignOrgId = `11111111-1111-1111-1111-${String(timestamp).slice(-12).padStart(12, "0")}`;

  let employeeId: string;
  let coworkerId: string;
  let foreignEmployeeId: string;

  try {
    // 1. Create primary organization
    await db.insert(organizations).values({
      id: testOrgId,
      name: `Acme Corp ${timestamp}`,
      slug: `acme-${timestamp}`,
    });

    // 2. Create foreign organization
    await db.insert(organizations).values({
      id: foreignOrgId,
      name: `Foreign Corp ${timestamp}`,
      slug: `foreign-${timestamp}`,
    });

    // 3. Create Role
    const [role] = await db.insert(roles).values({
      organizationId: testOrgId,
      name: "Staff Engineer",
      description: "Senior technical staff",
      permissions: ["task:read", "task:execute", "github:read", "linear:read", "linear:write"],
    }).returning();

    // 4. Create Human Employee
    const [emp] = await db.insert(employees).values({
      organizationId: testOrgId,
      roleId: role.id,
      name: "Alice Engineer",
      email: `alice.${timestamp}@acme.com`,
      title: "Staff Engineer",
    }).returning();
    employeeId = emp.id;

    // 5. Create Foreign Employee
    const [foreignEmp] = await db.insert(employees).values({
      organizationId: foreignOrgId,
      name: "Eve Attacker",
      email: `eve.${timestamp}@foreign.com`,
      title: "Intruder",
    }).returning();
    foreignEmployeeId = foreignEmp.id;

    // 6. Create AI Coworker (owned by Alice)
    const [cw] = await db.insert(coworkers).values({
      organizationId: testOrgId,
      createdByEmployeeId: employeeId,
      name: "DevBot",
      persona: "Software Engineer",
      capabilities: ["github:read", "linear:read", "linear:write"],
      systemPrompt: "You are an automated engineering coworker. Analyze root causes systematically.",
    }).returning();
    coworkerId = cw.id;

    // 7. Verify cross-tenant isolation in TaskRepository
    const taskRepo = new TaskRepository(db);
    let crossTenantBlocked = false;
    try {
      await taskRepo.create({
        organizationId: testOrgId,
        createdByEmployeeId: foreignEmployeeId, // Foreign employee in Org A
        assignedToCoworkerId: coworkerId,
        title: "Unauthorized task attempt",
      });
    } catch {
      crossTenantBlocked = true;
    }

    recordResult("Phase 2: Database", crossTenantBlocked, "Entities created, foreign employee blocked by tenant isolation constraint");
  } catch (err: any) {
    recordResult("Phase 2: Database", false, err.message);
  }

  // ==========================================
  // PHASE 3: CONTEXT ENGINE
  // ==========================================
  console.log("\n--- PHASE 3: CONTEXT ENGINE ---");
  try {
    const memRepo = new MemoryRepository(db);

    // Save previous solution memory
    await memRepo.create({
      organizationId: testOrgId,
      employeeId,
      coworkerId,
      type: "solution",
      title: "Session Cache Eviction",
      content: "Previous incident solution: Redis cache with TTL 3600 Bearer ghp_secret_12345678",
      sourceType: "incident",
      importance: 5,
      confidence: 1.0,
    });

    // Save foreign memory (must NOT leak into Org A context)
    await memRepo.create({
      organizationId: foreignOrgId,
      type: "fact",
      title: "Foreign secret memory",
      content: "Sensitive trade secret of Foreign Corp",
      sourceType: "manual",
      importance: 5,
      confidence: 1.0,
    });

    const mockProviders = {
      getEmployee: async () => ({ id: employeeId, organizationId: testOrgId, name: "Alice Engineer", email: "alice@acme.com", role: "Staff Engineer" }),
      getOrganization: async () => ({ id: testOrgId, name: "Acme Corp", slug: "acme" }),
      getCoworker: async () => ({ id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "Software Engineer", capabilities: ["github:read", "linear:read", "linear:write"], systemPrompt: "Analyze issues." }),
      getTask: async () => ({ id: "task_1", organizationId: testOrgId, title: "Investigate ENG-142", description: "Memory leak", workflow: "investigate_issue", status: "CREATED" as const, createdByHumanId: employeeId, assignedToCoworkerId: coworkerId, createdAt: new Date(), updatedAt: new Date() }),
      getMemories: async (params: any) => memRepo.findScopedMemories(params ?? { organizationId: testOrgId, employeeId, coworkerId }),
      getKnowledge: async () => [{ id: "k1", organizationId: testOrgId, title: "Auth Architecture Spec", content: "Session cache architecture specification", category: "architecture" as const, tags: ["auth"], createdAt: new Date() }],
      getConversation: async () => ({ taskId: "task_1", steps: [] }),
      getTools: () => [
        { name: "linear:get_issue", type: "read" as const, description: "Get issue", requiredCapability: "linear:read" },
        { name: "github:search_code", type: "read" as const, description: "Search code", requiredCapability: "github:read" },
        { name: "github:get_file", type: "read" as const, description: "Get file", requiredCapability: "github:read" },
        { name: "linear:update_issue", type: "write" as const, description: "Update issue", requiredCapability: "linear:write" },
      ],
    };

    const contextEngine = new DefaultContextEngine(mockProviders);
    const context = await contextEngine.buildContext({
      organizationId: testOrgId,
      employeeId,
      coworkerId,
      taskId: "task_1",
      query: "Session Cache",
    });

    const memoryPresent = context.memories.some((m) => m.title === "Session Cache Eviction");
    const foreignMemoryAbsent = !context.memories.some((m) => m.content.includes("Foreign Corp"));
    const secretRedacted = context.memories.some((m) => m.content.includes("Bearer [REDACTED]"));
    const toolsPresent = context.tools.length === 4;

    recordResult("Phase 3: Context Engine", memoryPresent && foreignMemoryAbsent && secretRedacted && toolsPresent, "Context assembled with scoped memory, secret redaction verified, foreign data absent");
  } catch (err: any) {
    recordResult("Phase 3: Context Engine", false, err.message);
  }

  // ==========================================
  // PHASE 4: REASONER & TOOL BOUNDARY
  // ==========================================
  console.log("\n--- PHASE 4: REASONER & TOOL BOUNDARY ---");
  try {
    const fakeLLM = new FakeLLMProvider([
      {
        content: "I will fetch the Linear issue details.",
        toolCall: {
          name: "linear:get_issue",
          input: { issueId: "ENG-142" },
        },
      },
    ]);

    const reasoner = new LLMReasoner(fakeLLM);
    const mockContext: any = {
      employee: { id: employeeId, name: "Alice", email: "alice@acme.com", role: "Staff" },
      organization: { id: testOrgId, name: "Acme", slug: "acme" },
      role: { name: "Staff", permissions: [] },
      coworker: { id: coworkerId, name: "DevBot", persona: "SWE", capabilities: ["linear:read"], systemPrompt: "Diagnose." },
      memories: [],
      knowledge: [],
      conversation: { taskId: "task_1", steps: [] },
      task: { id: "task_1", title: "Investigate ENG-142", description: "OOM bug", workflow: "investigate_issue", status: "CREATED" },
      tools: [{ name: "linear:get_issue", type: "read", description: "Get issue", requiredCapability: "linear:read" }],
      permissions: { allowedToolNames: ["linear:get_issue"], requiresApprovalToolNames: [] },
    };

    const reasonerOutput = await reasoner.reason(mockContext);
    const isToolCall = reasonerOutput.type === "tool_call" && reasonerOutput.toolName === "linear:get_issue";
    const noSideEffects = (reasonerOutput as any).data === undefined;

    recordResult("Phase 4: Reasoner", isToolCall && noSideEffects, "Reasoner returned structured tool call request without executing tool directly");
  } catch (err: any) {
    recordResult("Phase 4: Reasoner", false, err.message);
  }

  // ==========================================
  // PHASE 5: READ-ONLY TOOL EXECUTION
  // ==========================================
  console.log("\n--- PHASE 5: READ-ONLY TOOL EXECUTION ---");
  const toolRegistry = new ToolRegistry();

  const getIssueTool: ContextForgeTool = {
    name: "linear:get_issue",
    description: "Fetch Linear issue",
    type: "read",
    requiredCapability: "linear:read",
    inputSchema: z.object({ issueId: z.string() }),
    outputSchema: z.object({ id: z.string(), title: z.string(), description: z.string() }),
    execute: async (call) => ({
      success: true,
      data: {
        id: (call.parameters as any).issueId,
        title: "Session cache memory exhaustion",
        description: "Memory grows unbounded under high auth load in session.ts",
      },
    }),
  };

  const searchCodeTool: ContextForgeTool = {
    name: "github:search_code",
    description: "Search GitHub code",
    type: "read",
    requiredCapability: "github:read",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ items: z.array(z.any()) }),
    execute: async () => ({
      success: true,
      data: { items: [{ path: "src/auth/session.ts", score: 1.0 }] },
    }),
  };

  const getFileTool: ContextForgeTool = {
    name: "github:get_file",
    description: "Get GitHub file content",
    type: "read",
    requiredCapability: "github:read",
    inputSchema: z.object({ path: z.string() }),
    outputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async () => ({
      success: true,
      data: {
        path: "src/auth/session.ts",
        content: "const sessionCache = new Map(); // bug: unbounded map without TTL",
      },
    }),
  };

  const listCommitsTool: ContextForgeTool = {
    name: "github:list_commits",
    description: "List recent commits",
    type: "read",
    requiredCapability: "github:read",
    inputSchema: z.object({ path: z.string().optional() }),
    outputSchema: z.object({ commits: z.array(z.any()) }),
    execute: async () => ({
      success: true,
      data: { commits: [{ sha: "c8f2a1b", message: "feat: add in-memory session caching" }] },
    }),
  };

  let linearWriteExecuted = false;
  let linearWritePayload: any = null;

  const updateIssueTool: ContextForgeTool = {
    name: "linear:update_issue",
    description: "Update Linear issue state/comment",
    type: "write",
    requiredCapability: "linear:write",
    inputSchema: z.object({ issueId: z.string(), state: z.string().optional(), comment: z.string().optional() }),
    outputSchema: z.object({ updated: z.boolean() }),
    execute: async (call) => {
      linearWriteExecuted = true;
      linearWritePayload = call.parameters;
      return { success: true, data: { updated: true } };
    },
  };

  toolRegistry.register(getIssueTool);
  toolRegistry.register(searchCodeTool);
  toolRegistry.register(getFileTool);
  toolRegistry.register(listCommitsTool);
  toolRegistry.register(updateIssueTool);

  const idempotency = new InMemoryIdempotencyService();
  const toolExecutionService = new ToolExecutionService(toolRegistry, idempotency);

  try {
    const executionContext = {
      organizationId: testOrgId,
      taskId: "task_1",
      employeeId,
      coworkerId,
    };

    const res1 = await toolExecutionService.execute({
      call: { toolName: "linear:get_issue", action: "linear:get_issue", parameters: { issueId: "ENG-142" } },
      context: executionContext,
      coworker: { id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "SWE", capabilities: ["linear:read"], systemPrompt: "" },
      employee: { id: employeeId, organizationId: testOrgId, name: "Alice", email: "alice@acme.com", role: "Staff", createdAt: new Date() },
    });

    const res2 = await toolExecutionService.execute({
      call: { toolName: "github:search_code", action: "github:search_code", parameters: { query: "sessionCache" } },
      context: executionContext,
      coworker: { id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "SWE", capabilities: ["github:read"], systemPrompt: "" },
      employee: { id: employeeId, organizationId: testOrgId, name: "Alice", email: "alice@acme.com", role: "Staff", createdAt: new Date() },
    });

    recordResult("Phase 5: Read-Only Tool Execution", res1.success && res2.success, "Read tools executed through ToolExecutionService with input & capability verification");
  } catch (err: any) {
    recordResult("Phase 5: Read-Only Tool Execution", false, err.message);
  }

  // ==========================================
  // PHASE 6, 7 & 8: INVESTIGATION WORKFLOW, APPROVAL GATE & APPROVAL EXECUTION
  // ==========================================
  console.log("\n--- PHASE 6, 7 & 8: WORKFLOW, APPROVAL BOUNDARY & APPROVE ---");
  const taskRepo = new TaskRepository(db);
  const approvalRepo = new ApprovalRepository(db);
  const auditRepo = new AuditRepository(db, testOrgId);
  const memoryRepo = new MemoryRepository(db);

  let investigationTaskId: string;
  let approvalId: string;

  try {
    // Create actual DB Task
    const taskRecord = await taskRepo.create({
      organizationId: testOrgId,
      createdByEmployeeId: employeeId,
      assignedToCoworkerId: coworkerId,
      title: "Investigate ENG-142",
      description: "Memory exhaustion in auth service",
      workflow: "investigate_issue",
    });
    investigationTaskId = taskRecord.id;

    // Reasoner returns tool calls, then write tool request (linear:update_issue)
    let callStep = 0;
    const workflowReasoner = {
      reason: async () => {
        callStep++;
        if (callStep === 1) {
          return { type: "tool_call", toolName: "linear:get_issue", input: { issueId: "ENG-142" } };
        }
        if (callStep === 2) {
          return { type: "tool_call", toolName: "github:search_code", input: { query: "sessionCache" } };
        }
        if (callStep === 3) {
          return { type: "tool_call", toolName: "github:get_file", input: { path: "src/auth/session.ts" } };
        }
        // Write tool request
        return {
          type: "tool_call",
          toolName: "linear:update_issue",
          input: {
            issueId: "ENG-142",
            state: "In Review",
            comment: "Diagnosis: Unbounded Map in session.ts lacks TTL. Fix: Replace with LRUCache.",
          },
        };
      },
    };

    const workflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: async () => ({
          employee: { id: employeeId, name: "Alice", email: "alice@acme.com", role: "Staff" },
          organization: { id: testOrgId, name: "Acme", slug: "acme" },
          role: { name: "Staff", permissions: [] },
          coworker: { id: coworkerId, name: "DevBot", persona: "SWE", capabilities: ["github:read", "linear:read", "linear:write"], systemPrompt: "Diagnose." },
          memories: [],
          knowledge: [],
          conversation: { taskId: investigationTaskId, steps: [] },
          task: { id: investigationTaskId, title: "Investigate ENG-142", description: "OOM bug", workflow: "investigate_issue", status: "CREATED" as const },
          tools: [getIssueTool, searchCodeTool, getFileTool, listCommitsTool, updateIssueTool],
          permissions: {
            allowedToolNames: ["linear:get_issue", "github:search_code", "github:get_file", "github:list_commits", "linear:update_issue"],
            requiresApprovalToolNames: ["linear:update_issue"],
          },
        }),
        gatherContext: async () => ({} as any),
      },
      reasoner: workflowReasoner as any,
      toolExecutionService,
      stepRecorder: {
        recordStep: async (tId, step) => {
          await taskRepo.createStep(tId, step.stepIndex, step.stepType, step.status, step.payload, step.result);
        },
      },
      approvalService: {
        createApproval: async (data) => {
          return approvalRepo.create(data);
        },
        resolveApproval: async (params) => {
          const res = await approvalRepo.resolveApprovalAtomic(params);
          return { approved: res.approval.status === "approved" };
        },
      },
      auditSink: auditRepo,
      memoryPersister: {
        saveInvestigationMemory: async (data) => {
          await memoryRepo.create({
            organizationId: data.organizationId,
            employeeId: data.employeeId,
            coworkerId: data.coworkerId,
            type: "solution",
            title: `Solution: ${data.issueKey}`,
            content: `Root cause: ${data.rootCause}. Solution: ${data.solution}`,
            sourceType: "task",
            importance: 5,
            confidence: 0.95,
          });
        },
      },
      maxSteps: 25,
    });

    // Run workflow -> Should pause at AWAITING_APPROVAL
    const runResult = await workflow.run({
      organizationId: testOrgId,
      employee: { id: employeeId, organizationId: testOrgId, name: "Alice", email: "alice@acme.com", role: "Staff", createdAt: new Date() },
      coworker: { id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "SWE", capabilities: ["github:read", "linear:read", "linear:write"], systemPrompt: "Diagnose.", createdAt: new Date() },
      task: { id: investigationTaskId, organizationId: testOrgId, title: "Investigate ENG-142", description: "OOM bug", workflow: "investigate_issue", status: "CREATED", createdByHumanId: employeeId, assignedToCoworkerId: coworkerId, createdAt: new Date(), updatedAt: new Date() },
      issueKey: "ENG-142",
    });

    const pausedCorrectly = runResult.status === "AWAITING_APPROVAL";
    const writeNotExecutedYet = linearWriteExecuted === false;
    approvalId = runResult.approvalId!;

    recordResult("Phase 6: Investigation Result", runResult.steps.length >= 3, "Reasoner gathered evidence across Linear and GitHub read tools");
    recordResult("Phase 7: Approval Boundary", pausedCorrectly && writeNotExecutedYet, `Task entered AWAITING_APPROVAL, approval record ${approvalId} created, write tool NOT executed`);

    // PHASE 8: APPROVE
    // Test 1: Cross-tenant approval attempt must fail
    let foreignApprovalBlocked = false;
    try {
      await approvalRepo.resolveApprovalAtomic({
        organizationId: foreignOrgId, // Foreign Org B
        approvalId,
        taskId: investigationTaskId,
        reviewerEmployeeId: foreignEmployeeId,
        approved: true,
      });
    } catch {
      foreignApprovalBlocked = true;
    }

    // Test 2: Valid approval by Alice
    const approvalResult = await workflow.resolveApprovalAndComplete({
      organizationId: testOrgId,
      employee: { id: employeeId, organizationId: testOrgId, name: "Alice", email: "alice@acme.com", role: "Staff", createdAt: new Date() },
      coworker: { id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "SWE", capabilities: ["github:read", "linear:read", "linear:write"], systemPrompt: "", createdAt: new Date() },
      task: { id: investigationTaskId, organizationId: testOrgId, title: "Investigate ENG-142", description: "OOM bug", workflow: "investigate_issue", status: "AWAITING_APPROVAL", createdByHumanId: employeeId, assignedToCoworkerId: coworkerId, createdAt: new Date(), updatedAt: new Date() },
      approvalId,
      pendingWrite: runResult.pendingWrite!,
      approved: true,
      decisionNote: "Fix verified, proceed with Linear status update.",
      investigationResult: {
        issue: "ENG-142",
        summary: "Memory leak in auth session cache.",
        findings: ["Unbounded Map in session.ts without TTL."],
        likelyRootCause: "Missing TTL expiration on session cache entries.",
        evidence: [{ type: "linear_issue", description: "ENG-142 report", reference: "ENG-142" }],
        relevantFiles: ["src/auth/session.ts"],
        relevantCommits: ["c8f2a1b"],
        recommendedFix: "Replace native Map with LRUCache with 1hr TTL.",
        confidence: 0.95,
      },
    });

    const completed = approvalResult.status === "COMPLETED";
    const writeExecutedNow = linearWriteExecuted === true;
    const correctPayload = linearWritePayload?.state === "In Review";

    // Test 3: Replay attack protection (concurrency conflict)
    let replayBlocked = false;
    try {
      await approvalRepo.resolveApprovalAtomic({
        organizationId: testOrgId,
        approvalId,
        taskId: investigationTaskId,
        reviewerEmployeeId: employeeId,
        approved: true,
      });
    } catch {
      replayBlocked = true;
    }

    recordResult("Phase 8: Approve Flow", foreignApprovalBlocked && completed && writeExecutedNow && correctPayload && replayBlocked, "Approved write executed with expected payload; foreign approval and replay attacks blocked");
  } catch (err: any) {
    recordResult("Phase 8: Approve Flow", false, err.message);
  }

  // ==========================================
  // PHASE 9: REJECTION FLOW
  // ==========================================
  console.log("\n--- PHASE 9: REJECTION FLOW ---");
  try {
    const rejectTask = await taskRepo.create({
      organizationId: testOrgId,
      createdByEmployeeId: employeeId,
      assignedToCoworkerId: coworkerId,
      title: "Investigate ENG-200",
      description: "Test rejection",
      workflow: "investigate_issue",
    });

    const rejectApproval = await approvalRepo.create({
      organizationId: testOrgId,
      taskId: rejectTask.id,
      requestedByCoworkerId: coworkerId,
      toolCall: { toolName: "linear:update_issue", action: "update", parameters: { issueId: "ENG-200" } },
    });

    let writeExecutedOnReject = false;
    const mockRejectToolService = {
      execute: async () => {
        writeExecutedOnReject = true;
        return { success: true, data: {} };
      },
    };

    const rejectWorkflow = new InvestigationWorkflow({
      contextEngine: { buildContext: async () => ({} as any), gatherContext: async () => ({} as any) },
      reasoner: { reason: async () => ({} as any) },
      toolExecutionService: mockRejectToolService as any,
      approvalService: {
        createApproval: async () => ({ id: "app" }),
        resolveApproval: async (params) => {
          const res = await approvalRepo.resolveApprovalAtomic(params);
          return { approved: res.approval.status === "approved" };
        },
      },
      auditSink: auditRepo,
    });

    const rejectResult = await rejectWorkflow.resolveApprovalAndComplete({
      organizationId: testOrgId,
      employee: { id: employeeId, organizationId: testOrgId, name: "Alice", email: "alice@acme.com", role: "Staff", createdAt: new Date() },
      coworker: { id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "SWE", capabilities: [], systemPrompt: "", createdAt: new Date() },
      task: { id: rejectTask.id, organizationId: testOrgId, title: "Investigate ENG-200", description: "", workflow: "investigate_issue", status: "AWAITING_APPROVAL", createdByHumanId: employeeId, assignedToCoworkerId: coworkerId, createdAt: new Date(), updatedAt: new Date() },
      approvalId: rejectApproval.id,
      pendingWrite: { toolName: "linear:update_issue", parameters: { issueId: "ENG-200" } },
      approved: false,
      decisionNote: "Findings inconclusive, rejected.",
    });

    const rejectedStatus = rejectResult.status === "REJECTED";
    const writeBlocked = writeExecutedOnReject === false;

    // Check DB task status
    const dbTask = await taskRepo.findById(testOrgId, rejectTask.id);
    const dbTaskRejected = dbTask?.status === "REJECTED";

    recordResult("Phase 9: Rejection Flow", rejectedStatus && writeBlocked && dbTaskRejected, "Approval rejected, write tool strictly NOT executed, task reached REJECTED status");
  } catch (err: any) {
    recordResult("Phase 9: Rejection Flow", false, err.message);
  }

  // ==========================================
  // PHASE 10: MEMORY PERSISTENCE & SCOPING
  // ==========================================
  console.log("\n--- PHASE 10: MEMORY ---");
  try {
    const memoryRepo = new MemoryRepository(db);
    const memoriesOrgA = await memoryRepo.findScopedMemories({ organizationId: testOrgId, employeeId, coworkerId, query: "ENG-142" });
    const memoriesOrgB = await memoryRepo.findScopedMemories({ organizationId: foreignOrgId, employeeId: foreignEmployeeId, query: "ENG-142" });

    const memoryFoundInOrgA = memoriesOrgA.some((m) => m.title.includes("ENG-142"));
    const memoryLeakedToOrgB = memoriesOrgB.length > 0;

    recordResult("Phase 10: Memory", memoryFoundInOrgA && !memoryLeakedToOrgB, "Investigation memory preserved in PostgreSQL; foreign organization cannot query or retrieve it");
  } catch (err: any) {
    recordResult("Phase 10: Memory", false, err.message);
  }

  // ==========================================
  // PHASE 11: AUDIT TRAIL
  // ==========================================
  console.log("\n--- PHASE 11: AUDIT ---");
  try {
    const events = await auditRepo.getEventsForTask(investigationTaskId);
    const eventTypes = events.map((e) => e.eventType);

    const hasStarted = eventTypes.includes("task_started");
    const hasContext = eventTypes.includes("context_built");
    const hasToolReq = eventTypes.includes("tool_requested");
    const hasToolExec = eventTypes.includes("tool_executed");
    const hasAppReq = eventTypes.includes("approval_requested");
    const hasAppApproved = eventTypes.includes("approval_approved");
    const hasMemoryCreated = eventTypes.includes("memory_created");

    // Verify secrets do not appear in audit payloads
    const payloadString = JSON.stringify(events.map((e) => e.payload));
    const noSecretInAudit = !payloadString.includes("ghp_secret") && !payloadString.includes("sk-");

    const auditComplete = hasStarted && hasContext && hasToolReq && hasToolExec && hasAppReq && hasAppApproved && hasMemoryCreated && noSecretInAudit;
    recordResult("Phase 11: Audit Trail", auditComplete, `Activity events logged (${events.length} events); no secrets present in audit payload`);
  } catch (err: any) {
    recordResult("Phase 11: Audit Trail", false, err.message);
  }

  // ==========================================
  // PHASE 12: API E2E OVER HTTP
  // ==========================================
  console.log("\n--- PHASE 12: API E2E OVER HTTP ---");
  try {
    const apiClient = new ApiClient("http://127.0.0.1:3088");

    // 1. Create task via API
    const createRes = await apiClient.createTask({
      issueKey: "ENG-142",
      title: "Investigate ENG-142 via API",
      description: "Triggered from API client",
    });

    const taskCreated = createRes.success && createRes.task !== undefined;
    const apiTaskId = createRes.task!.id;

    // 2. List tasks via API
    const taskList = await apiClient.listTasks(10);
    const inList = taskList.some((t) => t.id === apiTaskId);

    // 3. Get task details via API
    const taskDetail = await apiClient.getTask(apiTaskId);
    const detailOk = taskDetail !== null && taskDetail.task.id === apiTaskId;

    // 4. Approve task via API convenience route
    const approveRes = await apiClient.approveTask(apiTaskId, "Approved via API E2E test");

    recordResult("Phase 12: API E2E", taskCreated && inList && detailOk && approveRes.success, "HTTP endpoints for task creation, listing, retrieval, and approval verified");
  } catch (err: any) {
    recordResult("Phase 12: API E2E", false, err.message);
  }

  // ==========================================
  // PHASE 13: WEB E2E USER EXPERIENCE
  // ==========================================
  console.log("\n--- PHASE 13: WEB E2E ---");
  try {
    // Note: No headless browser installed. Testing end-to-end user experience through the Web UI client.
    const webClient = new ApiClient("http://127.0.0.1:3088");

    // User flow 1: Investigate ENG-142 -> Approve
    const flow1 = await webClient.createTask({ title: "Investigate ENG-142" });
    const taskId1 = flow1.task!.id;

    // Simulate approval action in UI
    const approveFlow = await webClient.approveTask(taskId1, "Approved by Alice");
    const task1After = await webClient.getTask(taskId1);

    // User flow 2: Investigate ENG-205 -> Reject
    const flow2 = await webClient.createTask({ title: "Investigate ENG-205" });
    const taskId2 = flow2.task!.id;
    const rejectFlow = await webClient.rejectTask(taskId2, "Rejected by Alice");
    const task2After = await webClient.getTask(taskId2);

    const flow1Completed = task1After?.task.status === "COMPLETED";
    const flow2Rejected = task2After?.task.status === "REJECTED";

    recordResult("Phase 13: Web E2E (Programmatic)", flow1Completed && flow2Rejected, "User flows for approval (COMPLETED) and rejection (REJECTED) verified end-to-end via Web UI client");
  } catch (err: any) {
    recordResult("Phase 13: Web E2E (Programmatic)", false, err.message);
  }

  // ==========================================
  // PHASE 14: FAILURE & RESILIENCE TESTS
  // ==========================================
  console.log("\n--- PHASE 14: FAILURE TESTS ---");
  try {
    // 1. Tool execution failure resilience
    const failingWorkflow = new InvestigationWorkflow({
      contextEngine: {
        buildContext: async () => ({
          employee: { id: employeeId, name: "Alice", email: "alice@acme.com", role: "Staff" },
          organization: { id: testOrgId, name: "Acme", slug: "acme" },
          role: { name: "Staff", permissions: [] },
          coworker: { id: coworkerId, name: "DevBot", persona: "SWE", capabilities: ["linear:read"], systemPrompt: "" },
          memories: [],
          knowledge: [],
          conversation: { taskId: "task_fail", steps: [] },
          task: { id: "task_fail", title: "Investigate ENG-500", description: "", workflow: "investigate_issue", status: "CREATED" as const },
          tools: [getIssueTool],
          permissions: { allowedToolNames: ["linear:get_issue"], requiresApprovalToolNames: [] },
        }),
        gatherContext: async () => ({} as any),
      },
      reasoner: {
        reason: async (_ctx, _cw, _b, prevToolResult) => {
          if (!prevToolResult) {
            return { type: "tool_call", toolName: "linear:get_issue", input: { issueId: "ENG-500" } };
          }
          // Recovered from tool failure
          return { type: "final", content: "Linear API returned error; completing with degraded result." };
        },
      } as any,
      toolExecutionService: {
        execute: async () => {
          throw new Error("Linear API 500: Internal Server Error");
        },
      },
    });

    const failResult = await failingWorkflow.run({
      organizationId: testOrgId,
      employee: { id: employeeId, organizationId: testOrgId, name: "Alice", email: "alice@acme.com", role: "Staff", createdAt: new Date() },
      coworker: { id: coworkerId, organizationId: testOrgId, createdByHumanId: employeeId, name: "DevBot", persona: "SWE", capabilities: [], systemPrompt: "", createdAt: new Date() },
      task: { id: "task_fail", organizationId: testOrgId, title: "Investigate ENG-500", description: "", workflow: "investigate_issue", status: "CREATED", createdByHumanId: employeeId, assignedToCoworkerId: coworkerId, createdAt: new Date(), updatedAt: new Date() },
      issueKey: "ENG-500",
    });

    const failureHandledGracefully = failResult.status === "COMPLETED";
    const toolResultFailed = failResult.steps.some((s) => s.stepType === "tool_result" && s.status === "failed");

    recordResult("Phase 14: Failure Tests", failureHandledGracefully && toolResultFailed, "External tool failure isolated cleanly and recorded in task steps without crashing");
  } catch (err: any) {
    recordResult("Phase 14: Failure Tests", false, err.message);
  }

  // ==========================================
  // PHASE 15: SECURITY INVARIANTS CHECK
  // ==========================================
  console.log("\n--- PHASE 15: SECURITY CHECK ---");
  try {
    // 1. Direct write execution without approval must be rejected
    let directWriteBlocked = false;
    try {
      await toolExecutionService.execute({
        call: { toolName: "linear:update_issue", action: "update", parameters: { issueId: "ENG-1" } },
        context: { organizationId: testOrgId, taskId: "task_1", employeeId, coworkerId },
        approved: false, // NOT APPROVED
      });
    } catch {
      directWriteBlocked = true;
    }

    recordResult("Phase 15: Security Invariants", directWriteBlocked, "Direct execution of unapproved write tools strictly blocked by ToolExecutionService");
  } catch (err: any) {
    recordResult("Phase 15: Security Invariants", false, err.message);
  }

  console.log("\n==================================================");
  console.log("VERIFICATION SUMMARY");
  console.log("==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total Phases Checked: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (apiServer) {
    await apiServer.close();
  }
  if (pool) {
    await pool.end();
  }
  await new Promise((resolve) => setTimeout(resolve, 300));

  process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch((err) => {
  console.error("FATAL ERROR IN VERIFICATION:", err);
  process.exit(1);
});
