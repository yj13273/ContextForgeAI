"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type DemoPhase =
  | "IDLE"
  | "CONTEXT"
  | "MEMORY"
  | "WORKFLOW_DETECTED"
  | "PLANNING"
  | "TOOL_CALLING"
  | "RISK_CHECK"
  | "AWAITING_APPROVAL"
  | "REJECTED"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FEEDBACK_RECORDED";

export interface DemoStep {
  id: string;
  stepIndex: number;
  phase: string;
  title: string;
  detail?: string;
  status: "pending" | "success" | "running" | "failed";
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface LearnedWorkflow {
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

export interface MemoryRecordItem {
  id: string;
  type: "Fact" | "Decision" | "Solution" | "Incident" | "Preference" | "Procedure" | "Lesson";
  title: string;
  content: string;
  sourceTask?: string;
  importance: "Low" | "Medium" | "High" | "Critical";
  confidence: number;
  date: string;
}

export interface AuditLogItem {
  id: string;
  timeDisplay: string;
  timestamp: string;
  actorType: "ai_coworker" | "human_employee" | "system";
  actorLabel: string;
  eventType: string;
  description: string;
  taskId?: string;
}

export interface DemoContextValue {
  phase: DemoPhase;
  issueKey: string;
  taskTitle: string;
  steps: DemoStep[];
  isAwaitingApproval: boolean;
  isCompleted: boolean;
  isRejected: boolean;
  approvalDecisionNote: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskReason: string;
  verificationChecks: Array<{ id: string; label: string; verified: boolean }>;
  isOutcomeVerified: boolean;
  feedbackGiven: boolean;
  feedbackComment: string;
  workflowConfidence: number;
  workflows: LearnedWorkflow[];
  memories: MemoryRecordItem[];
  auditLogs: AuditLogItem[];
  startInvestigation: (key?: string) => Promise<void>;
  approveAction: (decisionNote?: string) => Promise<void>;
  rejectAction: (decisionNote?: string) => Promise<void>;
  submitFeedback: (rating: "correct" | "needs_correction", comment: string) => Promise<void>;
  resetDemo: () => void;
}

import {
  SEEDED_WORKFLOWS,
  SEEDED_MEMORIES,
  SEEDED_AUDIT_LOGS,
  type SeededWorkflow,
  type SeededMemory,
  type SeededAuditLog,
} from "./mock-data";

const initialWorkflows: LearnedWorkflow[] = SEEDED_WORKFLOWS;
const initialMemories: MemoryRecordItem[] = SEEDED_MEMORIES;
const initialAuditLogs: AuditLogItem[] = SEEDED_AUDIT_LOGS;


const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<DemoPhase>("IDLE");
  const [issueKey, setIssueKey] = useState("ENG-142");
  const [taskTitle, setTaskTitle] = useState("Investigate ENG-142: Authentication session memory exhaustion");
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [approvalDecisionNote, setApprovalDecisionNote] = useState("");
  const [workflowConfidence, setWorkflowConfidence] = useState(0.94);
  const [workflows, setWorkflows] = useState<LearnedWorkflow[]>(initialWorkflows);
  const [memories, setMemories] = useState<MemoryRecordItem[]>(initialMemories);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");

  const riskLevel: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
  const riskReason = "Action mutates organizational issue tracker state in Linear. Explicit human authorization required.";

  const [verificationChecks, setVerificationChecks] = useState([
    { id: "check-state", label: "Linear issue state confirmed: 'In Review'", verified: false },
    { id: "check-assignee", label: "Assignee verified as Alice Engineer", verified: false },
    { id: "check-comment", label: "Diagnosis comment and root-cause analysis attached", verified: false },
    { id: "check-audit", label: "Immutable audit event recorded with actor signature", verified: false },
  ]);

  function appendStep(step: Omit<DemoStep, "timestamp">) {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setSteps((prev) => [...prev, { ...step, timestamp: timeStr }]);
  }

  function appendAuditLog(item: Omit<AuditLogItem, "id" | "timestamp" | "timeDisplay">) {
    const now = new Date();
    setAuditLogs((prev) => [
      {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: now.toISOString(),
        timeDisplay: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        ...item,
      },
      ...prev,
    ]);
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function startInvestigation(customKey = "ENG-142") {
    setIssueKey(customKey);
    setTaskTitle(`Investigate ${customKey}: Authentication session memory exhaustion`);
    setSteps([]);
    setFeedbackGiven(false);
    setFeedbackComment("");
    setVerificationChecks((prev) => prev.map((c) => ({ ...c, verified: false })));

    // Stage 1: Observe & Context
    setPhase("CONTEXT");
    appendAuditLog({
      actorType: "ai_coworker",
      actorLabel: "DevBot (Coworker)",
      eventType: "task_started",
      description: `Initiated root-cause investigation for ${customKey}`,
      taskId: "task-eng-142",
    });
    appendStep({
      id: "step-context",
      stepIndex: 1,
      phase: "CONTEXT",
      title: "Understanding organizational context & tenant boundary",
      detail: "Scoped to Acme Corp, assigned supervisor: Alice Engineer, role: Staff Engineer",
      status: "success",
    });

    await delay(700);

    // Stage 2: Memory Retrieval
    setPhase("MEMORY");
    appendStep({
      id: "step-memory",
      stepIndex: 2,
      phase: "MEMORY",
      title: "Retrieved 4 relevant organizational memories",
      detail: "Matched: 'Session Cache Eviction Pattern' (ENG-118), 'PostgreSQL Pool Leak', 'Linear Write Gate'",
      status: "success",
    });
    appendAuditLog({
      actorType: "ai_coworker",
      actorLabel: "DevBot (Coworker)",
      eventType: "memory_retrieved",
      description: "Retrieved previous incident solutions from organizational memory repository",
      taskId: "task-eng-142",
    });

    await delay(700);

    // Stage 3: Workflow Matching
    setPhase("WORKFLOW_DETECTED");
    appendStep({
      id: "step-workflow",
      stepIndex: 3,
      phase: "WORKFLOW_DETECTED",
      title: "Detected & applied learned workflow",
      detail: "Authentication Incident Investigation (Confidence: 94%, 14 prior successful runs)",
      status: "success",
    });

    await delay(600);

    // Stage 4: Planning Tree
    setPhase("PLANNING");
    appendStep({
      id: "step-planning",
      stepIndex: 4,
      phase: "PLANNING",
      title: "Formulated investigation plan",
      detail: "1. Query Linear issue specs → 2. Search GitHub auth paths → 3. Analyze session.ts diff → 4. Compare incident ENG-118",
      status: "success",
    });

    await delay(700);

    // Stage 5: Tool Invocations
    setPhase("TOOL_CALLING");
    appendStep({
      id: "step-tool-1",
      stepIndex: 5,
      phase: "TOOL_CALLING",
      title: "Invoked tool: linear:get_issue",
      detail: "Fetched issue specifications: High token refresh load leads to unbounded Heap memory growth",
      status: "success",
      payload: { issueId: customKey },
    });
    appendAuditLog({
      actorType: "ai_coworker",
      actorLabel: "DevBot (Coworker)",
      eventType: "tool_executed",
      description: `Executed linear:get_issue for ${customKey} (Success: true)`,
      taskId: "task-eng-142",
    });

    await delay(600);

    appendStep({
      id: "step-tool-2",
      stepIndex: 6,
      phase: "TOOL_CALLING",
      title: "Invoked tool: github:search_code",
      detail: "Searched for 'sessionCache' across repository. Match found in src/auth/session.ts",
      status: "success",
      payload: { query: "sessionCache" },
    });

    await delay(600);

    appendStep({
      id: "step-tool-3",
      stepIndex: 7,
      phase: "TOOL_CALLING",
      title: "Invoked tool: github:get_file & list_commits",
      detail: "Inspected src/auth/session.ts line 42: const sessionCache = new Map(). Unbounded Map without TTL.",
      status: "success",
      payload: { path: "src/auth/session.ts", commit: "c8f2a1b" },
    });

    await delay(600);

    // Stage 6: Risk Assessment
    setPhase("RISK_CHECK");
    appendStep({
      id: "step-risk",
      stepIndex: 8,
      phase: "RISK_CHECK",
      title: "Risk Engine Evaluated: MEDIUM RISK",
      detail: "Proposed write action modifies Linear issue state and posts diagnosis comment. Requires explicit human authorization.",
      status: "success",
    });
    appendAuditLog({
      actorType: "system",
      actorLabel: "Risk Engine",
      eventType: "risk_evaluated",
      description: "Classified linear:update_issue as MEDIUM RISK (Approval required)",
      taskId: "task-eng-142",
    });

    await delay(500);

    // Stage 7: Awaiting Human Approval
    setPhase("AWAITING_APPROVAL");
    appendStep({
      id: "step-approval-req",
      stepIndex: 9,
      phase: "AWAITING_APPROVAL",
      title: "Paused at Approval Gate: linear:update_issue",
      detail: "Awaiting human review by Alice Engineer. Proposed: State → In Review, Comment → Root cause identified in session.ts",
      status: "pending",
    });
    appendAuditLog({
      actorType: "system",
      actorLabel: "Approval Gate",
      eventType: "approval_requested",
      description: "Halted pipeline awaiting human authorization on linear:update_issue",
      taskId: "task-eng-142",
    });
  }

  async function approveAction(decisionNote = "Verified root cause in staging, proceed with Linear update") {
    setApprovalDecisionNote(decisionNote);
    setPhase("EXECUTING");

    appendAuditLog({
      actorType: "human_employee",
      actorLabel: "Alice (Human)",
      eventType: "approval_approved",
      description: `Action approved by supervisor: "${decisionNote}"`,
      taskId: "task-eng-142",
    });

    appendStep({
      id: "step-approved",
      stepIndex: 10,
      phase: "EXECUTING",
      title: "Approval granted by Alice Engineer",
      detail: `Decision note: "${decisionNote}"`,
      status: "success",
    });

    await delay(600);

    appendStep({
      id: "step-executed",
      stepIndex: 11,
      phase: "EXECUTING",
      title: "Executed write tool: linear:update_issue",
      detail: "State updated to 'In Review'. Diagnostic findings attached to issue ticket.",
      status: "success",
      payload: { issueId: issueKey, state: "In Review" },
    });
    appendAuditLog({
      actorType: "ai_coworker",
      actorLabel: "DevBot (Coworker)",
      eventType: "tool_executed",
      description: `Executed linear:update_issue for ${issueKey} (Success: true)`,
      taskId: "task-eng-142",
    });

    await delay(700);

    // Stage 8: Outcome Verification
    setPhase("VERIFYING");
    appendStep({
      id: "step-verify",
      stepIndex: 12,
      phase: "VERIFYING",
      title: "Verifying outcome & state integrity...",
      detail: "Checking Linear state, validating required triage fields, and confirming audit record",
      status: "running",
    });

    await delay(500);
    setVerificationChecks((prev) => prev.map((c, i) => (i === 0 ? { ...c, verified: true } : c)));
    await delay(400);
    setVerificationChecks((prev) => prev.map((c, i) => (i <= 1 ? { ...c, verified: true } : c)));
    await delay(400);
    setVerificationChecks((prev) => prev.map((c, i) => (i <= 2 ? { ...c, verified: true } : c)));
    await delay(400);
    setVerificationChecks((prev) => prev.map((c) => ({ ...c, verified: true })));

    appendStep({
      id: "step-verified-complete",
      stepIndex: 13,
      phase: "COMPLETED",
      title: "OUTCOME VERIFIED: State & requirements confirmed",
      detail: "Linear state verified, diagnosis attached, and audit trail sealed.",
      status: "success",
    });
    appendAuditLog({
      actorType: "system",
      actorLabel: "Verification Engine",
      eventType: "outcome_verified",
      description: "Confirmed outcome matches expected state across Linear and GitHub",
      taskId: "task-eng-142",
    });

    setPhase("COMPLETED");
  }

  async function rejectAction(decisionNote = "Findings need additional regression testing") {
    setApprovalDecisionNote(decisionNote);
    setPhase("REJECTED");

    appendStep({
      id: "step-rejected",
      stepIndex: 10,
      phase: "REJECTED",
      title: "Write action rejected by human supervisor",
      detail: `Reason: "${decisionNote}". External mutation strictly blocked.`,
      status: "failed",
    });
    appendAuditLog({
      actorType: "human_employee",
      actorLabel: "Alice (Human)",
      eventType: "approval_rejected",
      description: `Action rejected: "${decisionNote}" (Write blocked)`,
      taskId: "task-eng-142",
    });
  }

  async function submitFeedback(rating: "correct" | "needs_correction", comment: string) {
    setFeedbackGiven(true);
    setFeedbackComment(comment);
    setPhase("FEEDBACK_RECORDED");

    // Dynamic Learning: Boost workflow confidence and increment previous uses
    setWorkflowConfidence(0.98);
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id === "wf-auth-incident"
          ? {
              ...wf,
              confidence: 0.98,
              previousUses: wf.previousUses + 1,
            }
          : wf
      )
    );

    // Dynamic Learning: Add new memory to organizational repository
    const newMemory: MemoryRecordItem = {
      id: `mem-${Date.now()}`,
      type: "Preference",
      title: "Supervisor Investigation Preference (Auth Incidents)",
      content: comment || "Always compare similar historical incidents before executing deep code searches in session management.",
      sourceTask: issueKey,
      importance: "High",
      confidence: 0.99,
      date: "Just now",
    };
    setMemories((prev) => [newMemory, ...prev]);

    appendStep({
      id: "step-feedback",
      stepIndex: 14,
      phase: "FEEDBACK_RECORDED",
      title: "Human Feedback Learned & Organizational Intelligence Updated",
      detail: `Preference recorded · Workflow confidence increased to 98% · Retained in Organizational Memory`,
      status: "success",
    });

    appendAuditLog({
      actorType: "ai_coworker",
      actorLabel: "DevBot (Coworker)",
      eventType: "workflow_learned",
      description: `Updated workflow 'Authentication Incident Investigation' confidence to 98% based on human feedback: "${comment}"`,
      taskId: "task-eng-142",
    });
  }

  function resetDemo() {
    setPhase("IDLE");
    setSteps([]);
    setFeedbackGiven(false);
    setFeedbackComment("");
    setApprovalDecisionNote("");
    setVerificationChecks((prev) => prev.map((c) => ({ ...c, verified: false })));
  }

  const isAwaitingApproval = phase === "AWAITING_APPROVAL";
  const isCompleted = phase === "COMPLETED" || phase === "FEEDBACK_RECORDED";
  const isRejected = phase === "REJECTED";
  const isOutcomeVerified = verificationChecks.every((c) => c.verified);

  return (
    <DemoContext.Provider
      value={{
        phase,
        issueKey,
        taskTitle,
        steps,
        isAwaitingApproval,
        isCompleted,
        isRejected,
        approvalDecisionNote,
        riskLevel,
        riskReason,
        verificationChecks,
        isOutcomeVerified,
        feedbackGiven,
        feedbackComment,
        workflowConfidence,
        workflows,
        memories,
        auditLogs,
        startInvestigation,
        approveAction,
        rejectAction,
        submitFeedback,
        resetDemo,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
