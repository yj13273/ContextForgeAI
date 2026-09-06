export interface OrganizationInfo {
  id: string;
  name: string;
  domain: string;
  tier: string;
}

export interface SupervisorInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  approvalAuthority: string;
}

export interface CoworkerInfo {
  id: string;
  name: string;
  role: string;
  persona: string;
  assignedSupervisor: string;
  autonomyMode: string;
  systemPrompt: string;
}

export interface SeededTask {
  id: string;
  issueKey: string;
  title: string;
  description: string;
  status: "CREATED" | "GATHERING_CONTEXT" | "REASONING" | "AWAITING_APPROVAL" | "EXECUTING_ACTION" | "COMPLETED" | "REJECTED" | "FAILED";
  priority: "Low" | "Medium" | "High" | "Critical";
  workflow: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeededWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  source: string;
  previousUses: number;
  confidence: number;
  toolsRequired: string[];
  approvalRequirement: "Always" | "On Write" | "None";
  verificationRule: string;
  steps: string[];
}

export interface SeededMemory {
  id: string;
  type: "Fact" | "Decision" | "Solution" | "Incident" | "Preference" | "Procedure" | "Lesson";
  title: string;
  content: string;
  sourceTask?: string;
  importance: "Low" | "Medium" | "High" | "Critical";
  confidence: number;
  date: string;
}

export interface SeededKnowledgeDoc {
  id: string;
  category: "Architecture" | "Security" | "Engineering" | "Operations";
  title: string;
  description: string;
  updatedAt: string;
  author: string;
  content: string;
}

export interface SeededGraphNode {
  id: string;
  label: string;
  sublabel: string;
  category: "coworker" | "human" | "task" | "service" | "code" | "incident" | "pattern";
  x: number;
  y: number;
  properties: Record<string, string>;
}

export interface SeededGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface SeededAuditLog {
  id: string;
  timestamp: string;
  timeDisplay: string;
  actorType: "ai_coworker" | "human_employee" | "system";
  actorLabel: string;
  eventType: string;
  description: string;
  taskId?: string;
}

export const ORGANIZATION_INFO: OrganizationInfo = {
  id: "00000000-0000-0000-0000-000000000010",
  name: "Acme Corp",
  domain: "acme.com",
  tier: "Enterprise (Multi-Tenant Isolated)",
};

export const SUPERVISOR_INFO: SupervisorInfo = {
  id: "emp-alice-01",
  name: "Alice Engineer",
  email: "alice@acme.com",
  role: "Staff Software Engineer / Tech Lead",
  team: "Core Infrastructure & Auth",
  approvalAuthority: "Full (Level 3: Write Gating, PR Review, State Mutation)",
};

export const COWORKER_INFO: CoworkerInfo = {
  id: "coworker-devbot-01",
  name: "DevBot",
  role: "Software Engineering AI Coworker",
  persona: "Staff Systems Diagnostician & Reliability Analyst",
  assignedSupervisor: "Alice Engineer",
  autonomyMode: "Risk-Aware Semi-Autonomous (Approval Required for State Mutations)",
  systemPrompt:
    "You are DevBot, an automated engineering coworker. Ground your analysis in organizational specifications and historical incident memory. Autonomous read operations permitted. External write operations and state mutations require explicit human supervisor approval.",
};

export const PRIMARY_DEMO_TASK: SeededTask = {
  id: "task-eng-142",
  issueKey: "ENG-142",
  title: "Investigate ENG-142: Authentication session memory exhaustion",
  description:
    "Customer session cache memory leak in Auth Service under burst token refresh load. Unbounded heap growth diagnosed in src/auth/session.ts line 42.",
  status: "AWAITING_APPROVAL",
  priority: "High",
  workflow: "Authentication Incident Investigation",
  createdAt: new Date(Date.now() - 1800000).toISOString(),
  updatedAt: new Date(Date.now() - 300000).toISOString(),
};

export const SEEDED_TASKS: SeededTask[] = [
  PRIMARY_DEMO_TASK,
  {
    id: "task-eng-156",
    issueKey: "ENG-156",
    title: "Investigate ENG-156: PostgreSQL connection pool exhaustion",
    description: "Database connection leak in background event workers due to unhandled promise rejections.",
    status: "COMPLETED",
    priority: "Critical",
    workflow: "Database Migration Safety Check",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
  },
  {
    id: "task-eng-181",
    issueKey: "ENG-181",
    title: "Investigate ENG-181: Zero-downtime Drizzle schema migration",
    description: "Validate nullable constraints on new organization settings column before release deployment.",
    status: "COMPLETED",
    priority: "Medium",
    workflow: "Database Migration Safety Check",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4 + 7200000).toISOString(),
  },
  {
    id: "task-eng-200",
    issueKey: "ENG-200",
    title: "Investigate ENG-200: Linear write gate invariant verification",
    description: "Audit security boundaries on external write tool execution by AI coworker instances.",
    status: "COMPLETED",
    priority: "High",
    workflow: "Service Regression Triage",
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 6 + 1800000).toISOString(),
  },
];

export const SEEDED_WORKFLOWS: SeededWorkflow[] = [
  {
    id: "wf-auth-incident",
    name: "Authentication Incident Investigation",
    description:
      "Multi-stage diagnostic pattern for token expiration, session memory exhaustion, and auth middleware regressions.",
    trigger: "Linear issue matching 'auth', 'session', 'jwt', or 'login'",
    source: "Learned from Alice Engineer during ENG-118 post-mortem",
    previousUses: 14,
    confidence: 0.94,
    toolsRequired: [
      "linear:get_issue",
      "github:search_code",
      "github:get_file",
      "github:list_commits",
      "linear:update_issue",
    ],
    approvalRequirement: "On Write",
    verificationRule: "Verify Linear issue state matches proposed transition and cache TTL constraint in PR draft",
    steps: [
      "Retrieve and parse Linear issue specifications",
      "Query organizational memory for similar historical incidents",
      "Execute GitHub code search across auth and session paths",
      "Inspect recent commit diffs for caching regressions",
      "Synthesize root-cause hypothesis and recommended fix",
      "Evaluate risk matrix and request human approval for write",
      "Execute write action and verify external issue state",
    ],
  },
  {
    id: "wf-db-migration",
    name: "Database Migration Safety Check",
    description: "Verifies zero-downtime compatibility of Drizzle schema changes before deployment.",
    trigger: "PR altering packages/db/src/schema",
    source: "Learned from Infra Team Runbook",
    previousUses: 8,
    confidence: 0.96,
    toolsRequired: ["github:get_file", "github:list_commits"],
    approvalRequirement: "Always",
    verificationRule: "Confirm column additions are nullable or specify default values",
    steps: [
      "Inspect schema migration diff",
      "Check for destructive column deletions or non-null additions",
      "Verify connection pool concurrency parameters",
    ],
  },
  {
    id: "wf-service-regression",
    name: "Service Regression Triage",
    description: "Standard pipeline for customer-reported latency or error-rate regressions.",
    trigger: "Linear issue labeled 'p1' or 'regression'",
    source: "Learned from Weekly Ops Review",
    previousUses: 19,
    confidence: 0.91,
    toolsRequired: ["linear:get_issue", "github:search_code"],
    approvalRequirement: "On Write",
    verificationRule: "Confirm reproduce steps and attach commit SHA to issue comment",
    steps: [
      "Parse incident symptoms and error stack",
      "Identify recent repository commits touching error frames",
      "Generate diagnosis hypothesis and remediation plan",
    ],
  },
];

export const SEEDED_MEMORIES: SeededMemory[] = [
  {
    id: "mem-1",
    type: "Solution",
    title: "Session Cache Eviction Pattern",
    content:
      "Authentication session caches must be explicitly bounded with LRUCache (max: 10,000 items) and a strict 3600-second TTL to avoid unbounded Heap memory growth under token refresh bursts.",
    sourceTask: "ENG-118",
    importance: "High",
    confidence: 0.98,
    date: "Aug 14, 2026",
  },
  {
    id: "mem-2",
    type: "Incident",
    title: "PostgreSQL Connection Pool Exhaustion",
    content:
      "Database pool clients leaked in background workers due to missing error cleanup handlers. Pool limit fixed to 20 with 5000ms idle timeout.",
    sourceTask: "ENG-156",
    importance: "Critical",
    confidence: 0.95,
    date: "Aug 28, 2026",
  },
  {
    id: "mem-3",
    type: "Decision",
    title: "Linear Write Gate Invariant",
    content:
      "All Linear state mutations and issue comments initiated by AI coworkers require explicit human employee authorization before execution.",
    sourceTask: "ENG-200",
    importance: "High",
    confidence: 1.0,
    date: "Sep 2, 2026",
  },
  {
    id: "mem-4",
    type: "Procedure",
    title: "Zero-Downtime Schema Migrations",
    content:
      "Schema migrations adding NOT NULL columns must be deployed in two phases or provided with safe default values to prevent blocking production write traffic.",
    sourceTask: "ENG-181",
    importance: "Medium",
    confidence: 0.92,
    date: "Sep 4, 2026",
  },
  {
    id: "mem-5",
    type: "Lesson",
    title: "OAuth Token Refresh Race Conditions",
    content:
      "Concurrent HTTP requests sharing an expired JWT token trigger multiple refresh calls, invalidating the refresh token. Use single-flight mutex locking during token refresh.",
    sourceTask: "ENG-108",
    importance: "High",
    confidence: 0.96,
    date: "Aug 20, 2026",
  },
];

export const SEEDED_KNOWLEDGE_DOCS: SeededKnowledgeDoc[] = [
  {
    id: "doc-1",
    category: "Architecture",
    title: "Authentication Architecture & Session Spec",
    description: "Core JWT token validation, refresh tokens, and distributed session lifecycle specification.",
    updatedAt: "Sep 2, 2026",
    author: "Architecture Guild",
    content: `## Authentication Architecture Specification

### 1. Token Lifecycle
- Access tokens are short-lived JWTs (15 minute expiration).
- Refresh tokens are stored with sha256 hashing in the persistent database with rotation on every refresh.
- Token refresh must use a single-flight mutex lock to prevent concurrent race condition invalidations.

### 2. Session Caching Invariants
- Fastify middleware checks redis-backed session caches.
- Native in-memory Map instances MUST NOT be used for persistent session tracking without strict LRU capacity and TTL bounds.
- Session keys must follow the canonical format: \`session:{orgId}:{employeeId}\`.`,
  },
  {
    id: "doc-2",
    category: "Security",
    title: "Multi-Tenant Isolation Guidelines",
    description: "Mandatory tenant boundary enforcement and credential sanitization standards across all services.",
    updatedAt: "Aug 15, 2026",
    author: "Security Team",
    content: `## Multi-Tenant Isolation Guidelines

### 1. Mandatory Organization Scope
- Every database entity table must include \`organization_id\` foreign key references.
- All repository queries must explicitly filter with \`WHERE organization_id = $1\`.
- Cross-tenant references must be rejected at the repository boundary before query dispatch.

### 2. Secret Redaction Policy
- Bearer tokens, GitHub personal access tokens (\`ghp_*\`), Linear API keys (\`lin_api_*\`), and private SSH keys must never be logged or persisted in task context.
- Sanitizer utilities must replace matched patterns with \`[REDACTED]\`.`,
  },
  {
    id: "doc-3",
    category: "Engineering",
    title: "API Design & Error Handling Conventions",
    description: "Consistent Fastify routing, Zod boundary schema validation, and structured error responses.",
    updatedAt: "Aug 29, 2026",
    author: "Core Platform",
    content: `## API Design & Error Handling Conventions

### 1. Route Schemas
- Every HTTP request body, query parameter, and param payload must be validated via Zod schemas.
- Invalid requests must return HTTP 400 with flattened field validation details.

### 2. Error Classes
- Application services must throw normalized domain error classes:
  - \`TenantIsolationError\` (HTTP 403)
  - \`ConcurrencyConflictError\` (HTTP 409)
  - \`RecordNotFoundError\` (HTTP 404)
  - \`PermissionDeniedError\` (HTTP 403)`,
  },
  {
    id: "doc-4",
    category: "Operations",
    title: "PostgreSQL Migration & Concurrency Runbook",
    description: "Safe schema evolution guidelines using Drizzle ORM and atomic transaction locks.",
    updatedAt: "Sep 1, 2026",
    author: "Infra Ops",
    content: `## Database Runbook

### 1. Concurrency Handling
- Task approval resolution uses atomic conditional updates:
  \`UPDATE approvals SET status = $1 WHERE id = $2 AND organization_id = $3 AND status = 'pending' RETURNING *;\`
- Concurrency conflicts must abort the write action to guarantee idempotency.

### 2. Connection Pooling
- Pool limit configured to 20 connections max per API instance.
- Idle timeout set to 5000ms.`,
  },
];

export const SEEDED_GRAPH_NODES: SeededGraphNode[] = [
  {
    id: "coworker-devbot",
    label: "DevBot",
    sublabel: "AI Coworker",
    category: "coworker",
    x: 360,
    y: 190,
    properties: {
      Role: "Staff Software Engineer AI",
      Workspace: "Acme Corp (Multi-tenant isolated)",
      Permissions: "GitHub (Read/Write PR), Linear (Read/Write-Gated)",
      State: "Active",
    },
  },
  {
    id: "human-alice",
    label: "Alice Engineer",
    sublabel: "Staff Engineer / Supervisor",
    category: "human",
    x: 160,
    y: 90,
    properties: {
      Role: "Human Supervisor / Tech Lead",
      Team: "Core Infrastructure & Auth",
      Tenant: "Acme Corp",
      ApprovalAuthority: "Full (Level 3)",
    },
  },
  {
    id: "task-eng142",
    label: "ENG-142",
    sublabel: "Active Task (Linear)",
    category: "task",
    x: 580,
    y: 110,
    properties: {
      Title: "Authentication session memory exhaustion",
      Priority: "High (P1)",
      Status: "In Review (Gated write)",
      Service: "Auth Service",
    },
  },
  {
    id: "service-auth",
    label: "Auth Service",
    sublabel: "Core Domain",
    category: "service",
    x: 740,
    y: 220,
    properties: {
      Repository: "acme/auth-core",
      Runtime: "Node.js / TypeScript",
      Traffic: "24,000 req/min",
    },
  },
  {
    id: "file-session",
    label: "src/auth/session.ts",
    sublabel: "Source File",
    category: "code",
    x: 580,
    y: 330,
    properties: {
      Path: "packages/auth/src/session.ts",
      IssueLocation: "Line 42 (Unbounded Map)",
      LastCommit: "c8f2a1b",
    },
  },
  {
    id: "incident-eng118",
    label: "ENG-118",
    sublabel: "Historical Incident",
    category: "incident",
    x: 160,
    y: 290,
    properties: {
      Date: "Aug 14, 2026",
      RootCause: "Unbounded JWT session growth under burst load",
      Resolution: "Bounded LRUCache with 3600s TTL",
    },
  },
  {
    id: "pattern-lru",
    label: "Bounded LRU Cache",
    sublabel: "Architectural Pattern",
    category: "pattern",
    x: 360,
    y: 400,
    properties: {
      Constraint: "Max 10,000 items",
      EvictionStrategy: "Least Recently Used + TTL 3600s",
      SafetyGuarantee: "Heap bounded to < 128MB",
    },
  },
];

export const SEEDED_GRAPH_EDGES: SeededGraphEdge[] = [
  { id: "e1", source: "coworker-devbot", target: "human-alice", label: "supervised_by" },
  { id: "e2", source: "coworker-devbot", target: "task-eng142", label: "investigating" },
  { id: "e3", source: "task-eng142", target: "service-auth", label: "impacts" },
  { id: "e4", source: "service-auth", target: "file-session", label: "implemented_by" },
  { id: "e5", source: "coworker-devbot", target: "file-session", label: "analyzed" },
  { id: "e6", source: "coworker-devbot", target: "incident-eng118", label: "recalled_memory" },
  { id: "e7", source: "incident-eng118", target: "pattern-lru", label: "resolved_by" },
  { id: "e8", source: "file-session", target: "pattern-lru", label: "requires_fix" },
];

export const SEEDED_AUDIT_LOGS: SeededAuditLog[] = [
  {
    id: "audit-0",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    timeDisplay: "10:14",
    actorType: "system",
    actorLabel: "System",
    eventType: "system_ready",
    description: "ContextForge orchestrator initialized with isolated multi-tenant boundary for Acme Corp.",
    taskId: "task-system-init",
  },
];
