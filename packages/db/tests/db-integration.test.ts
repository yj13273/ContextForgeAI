import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createDbClient,
  closeDbClient,
  type ContextForgeDb,
} from "../src/client.js";
import { runMigrations } from "../src/migrate.js";
import {
  OrganizationRepository,
  EmployeeRepository,
  CoworkerRepository,
  TaskRepository,
  ApprovalRepository,
  AuditRepository,
  TenantIsolationError,
  ConcurrencyConflictError,
  DatabaseValidationError,
} from "../src/repositories/index.js";
import { roles } from "../src/schema/roles.js";
import type pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("ContextForge PostgreSQL + Drizzle Persistence", () => {
  let db: ContextForgeDb;
  let pool: pg.Pool;

  let orgRepo: OrganizationRepository;
  let employeeRepo: EmployeeRepository;
  let coworkerRepo: CoworkerRepository;
  let taskRepo: TaskRepository;
  let approvalRepo: ApprovalRepository;
  let auditRepo: AuditRepository;

  beforeAll(async () => {
    const client = createDbClient();
    db = client.db;
    pool = client.pool;

    // Run migrations from empty database
    const migrationsFolder = path.resolve(__dirname, "../drizzle");
    await runMigrations(db, migrationsFolder);

    orgRepo = new OrganizationRepository(db);
    employeeRepo = new EmployeeRepository(db);
    coworkerRepo = new CoworkerRepository(db);
    taskRepo = new TaskRepository(db);
    approvalRepo = new ApprovalRepository(db);
    auditRepo = new AuditRepository(db);
  });

  afterAll(async () => {
    await closeDbClient(pool);
  });

  describe("1. Organization Creation", () => {
    it("creates an organization with UUID, timestamps, and unique slug", async () => {
      const slug = `acme-${Date.now()}`;
      const org = await orgRepo.create({
        name: "Acme Corporation",
        slug,
      });

      expect(org.id).toBeDefined();
      expect(org.name).toBe("Acme Corporation");
      expect(org.slug).toBe(slug);
      expect(org.createdAt).toBeInstanceOf(Date);
      expect(org.updatedAt).toBeInstanceOf(Date);

      const fetched = await orgRepo.findById(org.id);
      expect(fetched?.id).toBe(org.id);
    });
  });

  describe("2. Employee Creation", () => {
    it("creates a human employee scoped to an organization", async () => {
      const org = await orgRepo.create({
        name: "Engineering Corp",
        slug: `eng-corp-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Alice Engineer",
        email: "alice@engcorp.com",
        title: "Staff Software Engineer",
      });

      expect(emp.id).toBeDefined();
      expect(emp.organizationId).toBe(org.id);
      expect(emp.name).toBe("Alice Engineer");
      expect(emp.email).toBe("alice@engcorp.com");
      expect(emp.title).toBe("Staff Software Engineer");
      expect(emp.createdAt).toBeInstanceOf(Date);

      const fetched = await employeeRepo.findById(org.id, emp.id);
      expect(fetched?.id).toBe(emp.id);
    });
  });

  describe("3. Coworker Ownership", () => {
    it("creates an AI coworker owned by a HumanEmployee and enforces tenant boundaries", async () => {
      const org = await orgRepo.create({
        name: "AI Team Org",
        slug: `ai-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Bob Manager",
        email: "bob@aiorg.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "CodeReviewer AI",
        persona: "Software Engineer",
        systemPrompt: "You are an AI code reviewer.",
        capabilities: ["investigate_issue", "review_prs"],
      });

      expect(coworker.id).toBeDefined();
      expect(coworker.organizationId).toBe(org.id);
      expect(coworker.createdByEmployeeId).toBe(emp.id);
      expect(coworker.name).toBe("CodeReviewer AI");
      expect(coworker.capabilities).toContain("investigate_issue");

      // Attempting to create a coworker with an employee from another org must fail
      const otherOrg = await orgRepo.create({
        name: "Other Org",
        slug: `other-org-${Date.now()}`,
      });

      await expect(
        coworkerRepo.create({
          organizationId: otherOrg.id,
          createdByEmployeeId: emp.id, // belongs to org, not otherOrg!
          name: "Rogue AI",
          systemPrompt: "Invalid",
        })
      ).rejects.toThrow(TenantIsolationError);
    });
  });

  describe("4. Role Association", () => {
    it("associates organizational roles with employees and coworkers", async () => {
      const org = await orgRepo.create({
        name: "Role Org",
        slug: `role-org-${Date.now()}`,
      });

      const [leadRole] = await db
        .insert(roles)
        .values({
          organizationId: org.id,
          name: "Tech Lead",
          description: "Technical leader with approval privileges",
          permissions: ["tasks:create", "approvals:execute"],
        })
      .returning();

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Lead Engineer",
        email: "lead@roleorg.com",
        roleId: leadRole.id,
      });

      expect(emp.roleId).toBe(leadRole.id);

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "Junior SWE AI",
        systemPrompt: "Assist team",
        roleId: leadRole.id,
      });

      expect(coworker.roleId).toBe(leadRole.id);
    });
  });

  describe("5. Task Creation & Step Tracking", () => {
    it("creates a task with human creator and coworker assignee, and records chronological steps", async () => {
      const org = await orgRepo.create({
        name: "Task Org",
        slug: `task-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Creator Human",
        email: "creator@taskorg.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "Assignee Coworker",
        systemPrompt: "Investigate issues",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        assignedToCoworkerId: coworker.id,
        title: "Investigate high CPU usage in payment-service",
        description: "CPU hits 100% on worker nodes",
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe("CREATED");
      expect(task.createdByEmployeeId).toBe(emp.id);
      expect(task.assignedToCoworkerId).toBe(coworker.id);

      // Record steps
      const step1 = await taskRepo.createStep(
        task.id,
        1,
        "context_gathering",
        "COMPLETED",
        { query: "payment-service cpu spike" },
        { artifactCount: 3 }
      );

      const step2 = await taskRepo.createStep(
        task.id,
        2,
        "reasoning",
        "COMPLETED",
        { analysis: "Suspect infinite loop in retry policy" }
      );

      const steps = await taskRepo.listSteps(task.id);
      expect(steps.length).toBe(2);
      expect(steps[0].stepType).toBe("context_gathering");
      expect(steps[1].stepType).toBe("reasoning");
    });
  });

  describe("6. Approval Creation", () => {
    it("creates an approval request and links activeApprovalId on the task", async () => {
      const org = await orgRepo.create({
        name: "Approval Org",
        slug: `approval-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Dev Human",
        email: "dev@approvalorg.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "SWE AI",
        systemPrompt: "Investigate issues",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        assignedToCoworkerId: coworker.id,
        title: "Update ticket status on Linear",
      });

      const approval = await approvalRepo.create({
        organizationId: org.id,
        taskId: task.id,
        requestedByCoworkerId: coworker.id,
        toolCall: {
          toolName: "linear:update_state",
          action: "update_issue",
          parameters: { issueId: "ENG-123", state: "In Progress" },
        },
      });

      expect(approval.id).toBeDefined();
      expect(approval.status).toBe("pending");
      expect(approval.taskId).toBe(task.id);
      expect(approval.requestedByCoworkerId).toBe(coworker.id);

      // Verify task transitioned to AWAITING_APPROVAL and activeApprovalId is set
      const updatedTask = await taskRepo.findById(org.id, task.id);
      expect(updatedTask?.status).toBe("AWAITING_APPROVAL");
      expect(updatedTask?.activeApprovalId).toBe(approval.id);
    });
  });

  describe("7. Approval State Transition (Approved Flow)", () => {
    it("atomically transitions pending approval to approved and task to EXECUTING_ACTION", async () => {
      const org = await orgRepo.create({
        name: "Transition Org",
        slug: `trans-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Approver Human",
        email: "approver@transorg.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "SWE AI",
        systemPrompt: "Investigate issues",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        assignedToCoworkerId: coworker.id,
        title: "Post Linear comment",
      });

      const approval = await approvalRepo.create({
        organizationId: org.id,
        taskId: task.id,
        requestedByCoworkerId: coworker.id,
        toolCall: {
          toolName: "linear:post_comment",
          action: "comment",
          parameters: { body: "Fix validated" },
        },
      });

      const { approval: resolvedApproval, task: resolvedTask } =
        await approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp.id,
          approved: true,
          decisionNote: "Approved to comment on Linear ticket",
        });

      expect(resolvedApproval.status).toBe("approved");
      expect(resolvedApproval.reviewedByEmployeeId).toBe(emp.id);
      expect(resolvedApproval.decisionNote).toBe("Approved to comment on Linear ticket");
      expect(resolvedApproval.reviewedAt).toBeInstanceOf(Date);

      expect(resolvedTask.status).toBe("EXECUTING_ACTION");
    });
  });

  describe("8. Rejected Approval Flow", () => {
    it("atomically transitions pending approval to rejected and task to REJECTED", async () => {
      const org = await orgRepo.create({
        name: "Reject Org",
        slug: `reject-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Reviewer Human",
        email: "rev@rejectorg.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "SWE AI",
        systemPrompt: "Investigate issues",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        assignedToCoworkerId: coworker.id,
        title: "Delete test branch",
      });

      const approval = await approvalRepo.create({
        organizationId: org.id,
        taskId: task.id,
        requestedByCoworkerId: coworker.id,
        toolCall: {
          toolName: "github:delete_branch",
          action: "delete",
          parameters: { branch: "hotfix-test" },
        },
      });

      const { approval: rejectedApproval, task: rejectedTask } =
        await approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp.id,
          approved: false,
          decisionNote: "Do not delete branch, tests are still running",
        });

      expect(rejectedApproval.status).toBe("rejected");
      expect(rejectedApproval.reviewedByEmployeeId).toBe(emp.id);

      expect(rejectedTask.status).toBe("REJECTED");
      expect(rejectedTask.errorMessage).toContain("Do not delete branch");
    });
  });

  describe("9. Cross-Organization Approval Rejection", () => {
    it("strictly prevents human employee from Org B from approving an Org A task", async () => {
      const orgA = await orgRepo.create({
        name: "Org Alpha",
        slug: `alpha-${Date.now()}`,
      });

      const orgB = await orgRepo.create({
        name: "Org Beta",
        slug: `beta-${Date.now()}`,
      });

      const empA = await employeeRepo.create({
        organizationId: orgA.id,
        name: "Alpha Employee",
        email: "alpha@alpha.com",
      });

      const empB = await employeeRepo.create({
        organizationId: orgB.id,
        name: "Beta Employee",
        email: "beta@beta.com",
      });

      const coworkerA = await coworkerRepo.create({
        organizationId: orgA.id,
        createdByEmployeeId: empA.id,
        name: "Alpha AI",
        systemPrompt: "Investigate alpha",
      });

      const taskA = await taskRepo.create({
        organizationId: orgA.id,
        createdByEmployeeId: empA.id,
        assignedToCoworkerId: coworkerA.id,
        title: "Alpha sensitive task",
      });

      const approvalA = await approvalRepo.create({
        organizationId: orgA.id,
        taskId: taskA.id,
        requestedByCoworkerId: coworkerA.id,
        toolCall: {
          toolName: "github:post_comment",
          action: "post",
          parameters: { repo: "alpha/core", body: "Deploy approved" },
        },
      });

      // Employee B tries to approve task A under Org A's scope -> Rejected
      await expect(
        approvalRepo.resolveApprovalAtomic({
          organizationId: orgA.id,
          approvalId: approvalA.id,
          taskId: taskA.id,
          reviewerEmployeeId: empB.id, // Employee B is not in Org A!
          approved: true,
        })
      ).rejects.toThrow(TenantIsolationError);

      // Employee B tries to approve under Org B's scope -> Rejected (task is not in Org B)
      await expect(
        approvalRepo.resolveApprovalAtomic({
          organizationId: orgB.id,
          approvalId: approvalA.id,
          taskId: taskA.id,
          reviewerEmployeeId: empB.id,
          approved: true,
        })
      ).rejects.toThrow(TenantIsolationError);

      // Verify approval remains pending and unaffected
      const fetchedApproval = await approvalRepo.findById(orgA.id, approvalA.id);
      expect(fetchedApproval?.status).toBe("pending");
    });
  });

  describe("10. Approval Replay Rejection", () => {
    it("rejects replaying an already-approved or already-rejected approval request", async () => {
      const org = await orgRepo.create({
        name: "Replay Org",
        slug: `replay-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Replay Approver",
        email: "approver@replay.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "Replay AI",
        systemPrompt: "Investigate",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        assignedToCoworkerId: coworker.id,
        title: "Replay test task",
      });

      const approval = await approvalRepo.create({
        organizationId: org.id,
        taskId: task.id,
        requestedByCoworkerId: coworker.id,
        toolCall: {
          toolName: "linear:post_comment",
          action: "comment",
          parameters: { body: "First execution" },
        },
      });

      // First resolution succeeds
      await approvalRepo.resolveApprovalAtomic({
        organizationId: org.id,
        approvalId: approval.id,
        taskId: task.id,
        reviewerEmployeeId: emp.id,
        approved: true,
      });

      // Replay attempt must fail with ConcurrencyConflictError
      await expect(
        approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp.id,
          approved: true,
        })
      ).rejects.toThrow(ConcurrencyConflictError);
    });
  });

  describe("11. Concurrent Approval Protection", () => {
    it("guarantees that multiple concurrent approval attempts execute the write transition exactly once", async () => {
      const org = await orgRepo.create({
        name: "Concurrency Org",
        slug: `conc-org-${Date.now()}`,
      });

      const emp1 = await employeeRepo.create({
        organizationId: org.id,
        name: "Approver One",
        email: "one@conc.com",
      });

      const emp2 = await employeeRepo.create({
        organizationId: org.id,
        name: "Approver Two",
        email: "two@conc.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp1.id,
        name: "Concurrency AI",
        systemPrompt: "Investigate",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp1.id,
        assignedToCoworkerId: coworker.id,
        title: "High-concurrency payment refund approval",
      });

      const approval = await approvalRepo.create({
        organizationId: org.id,
        taskId: task.id,
        requestedByCoworkerId: coworker.id,
        toolCall: {
          toolName: "payment:refund",
          action: "execute_refund",
          parameters: { amount: 5000 },
        },
      });

      // Fire 4 concurrent approval requests racing simultaneously
      const results = await Promise.allSettled([
        approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp1.id,
          approved: true,
          decisionNote: "Concurrent approver 1",
        }),
        approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp2.id,
          approved: true,
          decisionNote: "Concurrent approver 2",
        }),
        approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp1.id,
          approved: false,
          decisionNote: "Concurrent rejector",
        }),
        approvalRepo.resolveApprovalAtomic({
          organizationId: org.id,
          approvalId: approval.id,
          taskId: task.id,
          reviewerEmployeeId: emp2.id,
          approved: true,
          decisionNote: "Concurrent approver 4",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // EXACTLY ONE concurrent request must win!
      expect(fulfilled.length).toBe(1);
      // The remaining 3 must be rejected with ConcurrencyConflictError
      expect(rejected.length).toBe(3);

      for (const rej of rejected) {
        if (rej.status === "rejected") {
          expect(rej.reason).toBeInstanceOf(ConcurrencyConflictError);
        }
      }

      // Verify the database state has a single final resolved status
      const finalApproval = await approvalRepo.findById(org.id, approval.id);
      expect(finalApproval?.status).not.toBe("pending");
    });
  });

  describe("12. Activity Event Persistence", () => {
    it("persists activity events into append-only activity_events table", async () => {
      const org = await orgRepo.create({
        name: "Audit Org",
        slug: `audit-org-${Date.now()}`,
      });

      const emp = await employeeRepo.create({
        organizationId: org.id,
        name: "Audited Human",
        email: "audit@audit.com",
      });

      const coworker = await coworkerRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        name: "Audited AI",
        systemPrompt: "Investigate",
      });

      const task = await taskRepo.create({
        organizationId: org.id,
        createdByEmployeeId: emp.id,
        assignedToCoworkerId: coworker.id,
        title: "Audit trail task",
      });

      // Record audit records
      await auditRepo.record({
        taskId: task.id,
        actorType: "human_employee",
        actorId: emp.id,
        eventType: "task_initiated",
        payload: { title: task.title },
      });

      await auditRepo.record({
        taskId: task.id,
        actorType: "ai_coworker",
        actorId: coworker.id,
        eventType: "context_gathering_started",
        payload: { source: "github" },
      });

      await auditRepo.record({
        taskId: task.id,
        actorType: "system",
        actorId: "permission_engine",
        eventType: "permission_evaluated",
        payload: { tool: "linear:post_comment", requiresApproval: true },
      });

      const events = await auditRepo.getEventsForTask(task.id);
      expect(events.length).toBe(3);

      expect(events[0].eventType).toBe("task_initiated");
      expect(events[0].actorType).toBe("human_employee");
      expect(events[0].actorId).toBe(emp.id);

      expect(events[1].eventType).toBe("context_gathering_started");
      expect(events[1].actorType).toBe("ai_coworker");
      expect(events[1].actorId).toBe(coworker.id);

      expect(events[2].eventType).toBe("permission_evaluated");
    });
  });
});
