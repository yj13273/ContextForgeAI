"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api, type TaskSummary, type TaskDetailResponse, type TaskStep } from "../../lib/api";
import { useDemo } from "../../lib/demo-context";
import { StatusBadge } from "../../components/StatusBadge";
import { WorkTimeline } from "../../components/WorkTimeline";
import { ApprovalPanel } from "../../components/ApprovalPanel";
import { InvestigationReport, type EvidenceItem } from "../../components/InvestigationReport";
import { RiskBadge } from "../../components/RiskBadge";
import { VerificationPanel } from "../../components/VerificationPanel";
import { FeedbackLearningPanel } from "../../components/FeedbackLearningPanel";
import {
  COWORKER_INFO,
  SUPERVISOR_INFO,
  ORGANIZATION_INFO,
} from "../../lib/mock-data";

function CoworkerWorkspaceContent() {
  const searchParams = useSearchParams();
  const urlTaskId = searchParams.get("taskId");

  const demo = useDemo();

  const [prompt, setPrompt] = useState("Investigate ENG-142: Authentication session memory exhaustion");
  const [loading, setLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(urlTaskId);
  const [taskDetail, setTaskDetail] = useState<TaskDetailResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Load recent tasks for switcher
  useEffect(() => {
    async function fetchTasks() {
      try {
        const list = await api.listTasks(10);
        setRecentTasks(list);
      } catch {
        // Backend optional
      }
    }
    fetchTasks();
  }, []);

  // Sync if URL query param changes
  useEffect(() => {
    if (urlTaskId) {
      setActiveTaskId(urlTaskId);
      setIsDemoMode(false);
    }
  }, [urlTaskId]);

  // Load task detail when activeTaskId changes
  useEffect(() => {
    if (!activeTaskId || isDemoMode) return;

    let isMounted = true;
    async function loadDetail() {
      const detail = await api.getTask(activeTaskId!);
      if (isMounted && detail) {
        setTaskDetail(detail);
      }
    }

    loadDetail();

    const interval = setInterval(async () => {
      if (taskDetail?.task.status === "AWAITING_APPROVAL" || taskDetail?.task.status === "REASONING") {
        loadDetail();
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTaskId, taskDetail?.task.status, isDemoMode]);

  async function handleStartInvestigation(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsDemoMode(true);
    setLoading(true);
    setStatusMessage("DevBot is assembling organizational context & starting multi-tool investigation...");

    const issueKeyMatch = prompt.match(/[A-Z]+-\d+/i);
    const key = issueKeyMatch ? issueKeyMatch[0].toUpperCase() : "ENG-142";

    try {
      await demo.startInvestigation(key);
      setStatusMessage(`Investigation paused at Approval Gate for ${key}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(decisionNote?: string) {
    if (isDemoMode) {
      setStatusMessage("Executing approval transition and verifying outcomes...");
      await demo.approveAction(decisionNote || "Verified root cause in staging, proceed with Linear update");
      setStatusMessage("Outcome verified. Task successfully completed.");
    } else if (activeTaskId) {
      setStatusMessage("Submitting human approval to orchestrator...");
      const res = await api.approveTask(activeTaskId, decisionNote);
      if (res.success) {
        setStatusMessage("Action approved and executed by ToolExecutionService.");
        const updated = await api.getTask(activeTaskId);
        if (updated) setTaskDetail(updated);
      } else {
        setStatusMessage(`Approval error: ${res.error}`);
      }
    }
  }

  async function handleReject(decisionNote?: string) {
    if (isDemoMode) {
      setStatusMessage("Write action rejected. External mutation blocked.");
      await demo.rejectAction(decisionNote || "Findings require additional regression testing");
    } else if (activeTaskId) {
      setStatusMessage("Submitting rejection to orchestrator...");
      const res = await api.rejectTask(activeTaskId, decisionNote);
      if (res.success) {
        setStatusMessage("Action rejected. Write tool execution strictly blocked.");
        const updated = await api.getTask(activeTaskId);
        if (updated) setTaskDetail(updated);
      } else {
        setStatusMessage(`Rejection error: ${res.error}`);
      }
    }
  }

  async function handleFeedback(rating: "correct" | "needs_correction", comment: string) {
    await demo.submitFeedback(rating, comment);
    setStatusMessage("Feedback learned: Workflow confidence and organizational memory updated.");
  }

  // Determine active steps for timeline
  const timelineSteps: TaskStep[] = isDemoMode
    ? demo.steps.map((s) => ({
        id: s.id,
        taskId: "task-eng-142",
        stepIndex: s.stepIndex,
        stepType:
          s.phase === "TOOL_CALLING"
            ? "tool_call"
            : s.phase === "AWAITING_APPROVAL"
            ? "approval"
            : "reasoning",
        status: s.status === "running" ? "pending" : s.status,
        payload: {
          title: s.title,
          detail: s.detail,
          ...(s.payload || {}),
        },
        result: s.detail ? { summary: s.detail } : undefined,
        createdAt: s.timestamp,
      }))
    : taskDetail?.steps || [];

  const evidenceList: EvidenceItem[] = [
    { type: "file", label: "src/auth/session.ts:L42", detail: "Unbounded Map session cache without TTL expiration", source: "GitHub" },
    { type: "commit", label: "c8f2a1b", detail: "feat: add in-memory session caching", source: "GitHub" },
    { type: "memory", label: "ENG-118", detail: "Session memory exhaustion during token refresh bursts", source: "Memory" },
    { type: "issue", label: demo.issueKey || "ENG-142", detail: "Unbounded heap growth in auth worker", source: "Linear" },
  ];

  const currentStatusString = isDemoMode
    ? demo.phase === "IDLE"
      ? "QUEUED"
      : demo.phase === "AWAITING_APPROVAL"
      ? "AWAITING_APPROVAL"
      : demo.phase === "REJECTED"
      ? "REJECTED"
      : demo.isCompleted
      ? "COMPLETED"
      : "REASONING"
    : taskDetail?.task.status || "QUEUED";

  const workflowStages = [
    { id: "observe", label: "Observe" },
    { id: "context", label: "Context" },
    { id: "memory", label: "Memory" },
    { id: "workflow", label: "Workflow" },
    { id: "plan", label: "Plan" },
    { id: "risk", label: "Risk" },
    { id: "tools", label: "Tools" },
    { id: "approval", label: "Approval" },
    { id: "action", label: "Action" },
    { id: "verify", label: "Verify" },
    { id: "learn", label: "Learn" },
  ];

  function getActiveStageIndex(): number {
    switch (demo.phase) {
      case "IDLE": return -1;
      case "CONTEXT": return 1;
      case "MEMORY": return 2;
      case "WORKFLOW_DETECTED": return 3;
      case "PLANNING": return 4;
      case "TOOL_CALLING": return 6;
      case "RISK_CHECK": return 5;
      case "AWAITING_APPROVAL": return 7;
      case "REJECTED": return 7;
      case "EXECUTING": return 8;
      case "VERIFYING": return 9;
      case "COMPLETED": return 9;
      case "FEEDBACK_RECORDED": return 10;
      default: return 0;
    }
  }

  const activeStageIdx = getActiveStageIndex();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Workspace Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 className="cf-title" style={{ fontSize: "18px" }}>
              {COWORKER_INFO.name} Workspace
            </h1>
            <span
              className="cf-code"
              style={{
                fontSize: "10px",
                color: "var(--state-running)",
                backgroundColor: "var(--state-running-bg)",
                border: "1px solid var(--state-running-border)",
                padding: "1px 6px",
                borderRadius: "var(--radius-xs)",
                fontWeight: 600,
              }}
            >
              ACTIVE COWORKER
            </span>
          </div>
          <div className="cf-subtitle">
            {COWORKER_INFO.role} · Supervised by {SUPERVISOR_INFO.name} · {ORGANIZATION_INFO.name}
          </div>
        </div>

        {/* Action Controls: Reset & Quick Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {demo.phase !== "IDLE" && (
            <button onClick={() => demo.resetDemo()} className="cf-btn-secondary" style={{ fontSize: "11px", padding: "4px 10px" }}>
              Reset Simulation
            </button>
          )}

          {recentTasks.length > 0 && (
            <select
              value={activeTaskId || ""}
              onChange={(e) => {
                setActiveTaskId(e.target.value);
                setIsDemoMode(false);
              }}
              className="cf-input"
              style={{ width: "auto", fontSize: "11px", padding: "4px 8px" }}
            >
              <option value="">Backend Tasks...</option>
              {recentTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title.slice(0, 28)}... ({t.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Two-Column Coworker Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
        className="coworker-grid"
      >
        {/* Left Column: Coworker Identity, Responsibilities & Tools */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Identity Card */}
          <div className="cf-panel">
            <div className="cf-panel-header">
              <span className="cf-kicker">Coworker Identity</span>
            </div>
            <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>
                  {COWORKER_INFO.name}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "1px" }}>
                  {COWORKER_INFO.role}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <div className="cf-kicker" style={{ fontSize: "9px" }}>Supervised By</div>
                  <div style={{ color: "var(--text-primary)", fontSize: "12px", fontWeight: 500 }}>
                    {SUPERVISOR_INFO.name} (Staff Eng)
                  </div>
                </div>

                <div>
                  <div className="cf-kicker" style={{ fontSize: "9px" }}>Operational Persona</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                    {COWORKER_INFO.persona}
                  </div>
                </div>

                <div>
                  <div className="cf-kicker" style={{ fontSize: "9px" }}>Tenant Scope</div>
                  <div className="cf-code" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                    {ORGANIZATION_INFO.name} (Isolated)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Responsibilities */}
          <div className="cf-panel">
            <div className="cf-panel-header">
              <span className="cf-kicker">Core Responsibilities</span>
            </div>
            <div className="cf-panel-body" style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--accent-emphasis)" }}>—</span>
                <span>Investigate engineering issues</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--accent-emphasis)" }}>—</span>
                <span>Search and analyze repository code</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--accent-emphasis)" }}>—</span>
                <span>Analyze historical incidents</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--accent-emphasis)" }}>—</span>
                <span>Update project tracking (gated)</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "var(--accent-emphasis)" }}>—</span>
                <span>Learn recurring workflows from feedback</span>
              </div>
            </div>
          </div>

          {/* Connected Tool Matrix & RBAC */}
          <div className="cf-panel">
            <div className="cf-panel-header">
              <span className="cf-kicker">Tool Execution Boundary</span>
            </div>
            <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="cf-code">github:read</span>
                <span style={{ color: "var(--state-success)", fontFamily: "var(--font-mono)" }}>AUTONOMOUS</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="cf-code">linear:read</span>
                <span style={{ color: "var(--state-success)", fontFamily: "var(--font-mono)" }}>AUTONOMOUS</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 6px",
                  backgroundColor: "var(--state-approval-bg)",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--state-approval-border)",
                }}
              >
                <span className="cf-code" style={{ color: "var(--state-approval)", fontWeight: 600 }}>
                  linear:write
                </span>
                <span style={{ color: "var(--state-approval)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  GATED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Canvas, Centerpiece Workflow & Trace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Assignment Bar */}
          <div className="cf-panel">
            <div className="cf-panel-header">
              <span className="cf-kicker">Assign Work to DevBot</span>
              <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Centerpiece: ENG-142
              </span>
            </div>

            <div className="cf-panel-body">
              <form onSubmit={handleStartInvestigation} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Investigate ENG-142: Authentication session memory exhaustion"
                  disabled={loading}
                  className="cf-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="cf-btn-primary"
                >
                  {loading ? "Diagnosing..." : "Start Investigation"}
                </button>
              </form>

              {statusMessage && (
                <div className="cf-code" style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                  {statusMessage}
                </div>
              )}
            </div>
          </div>

          {/* Active Work Stream Display */}
          {(demo.phase !== "IDLE" || taskDetail) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Task Header Bar */}
              <div className="cf-panel">
                <div className="cf-panel-body" style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="cf-code" style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-emphasis)" }}>
                        {demo.issueKey || "ENG-142"}
                      </span>
                      <StatusBadge status={currentStatusString} size="sm" />
                      <RiskBadge level="MEDIUM" showRequirement={false} />
                    </div>

                    <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Phase: {demo.phase}
                    </span>
                  </div>

                  <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px 0" }}>
                    {demo.taskTitle || "Investigate ENG-142: Authentication session memory exhaustion"}
                  </h2>

                  {/* Work Timeline Stepper: Observe -> Context -> Memory -> Workflow -> Plan -> Risk -> Tools -> Approval -> Action -> Verify -> Learn */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      overflowX: "auto",
                      padding: "6px 8px",
                      backgroundColor: "var(--bg-canvas)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {workflowStages.map((stg, i) => {
                      const isPast = activeStageIdx > i;
                      const isCurrent = activeStageIdx === i;

                      return (
                        <React.Fragment key={stg.id}>
                          <div
                            style={{
                              padding: "2px 5px",
                              borderRadius: "2px",
                              color: isCurrent
                                ? "var(--state-running)"
                                : isPast
                                ? "var(--state-success)"
                                : "var(--text-muted)",
                              fontWeight: isCurrent || isPast ? 600 : 400,
                              backgroundColor: isCurrent ? "var(--state-running-bg)" : "transparent",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isPast ? "✓ " : ""}
                            {stg.label}
                          </div>
                          {i < workflowStages.length - 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "8px" }}>→</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Approval Gate Panel (Active when Linear write proposed) */}
              {(demo.isAwaitingApproval || (taskDetail?.task.status === "AWAITING_APPROVAL")) && (
                <ApprovalPanel
                  taskId="task-eng-142"
                  toolName="linear:update_issue"
                  parameters={{
                    issueId: demo.issueKey || "ENG-142",
                    state: "In Review",
                    comment: "Root cause identified: Unbounded Map in src/auth/session.ts line 42 lacks TTL expiration. Fix recommendation: implement Bounded LRUCache (max: 10,000 items, ttl: 3600s) matching pattern from ENG-118.",
                  }}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              )}

              {/* Outcome Verification Panel (Appears when verifying or completed) */}
              {(demo.phase === "VERIFYING" || demo.isCompleted) && (
                <VerificationPanel
                  checks={demo.verificationChecks}
                  isVerified={demo.isOutcomeVerified}
                  issueKey={demo.issueKey}
                />
              )}

              {/* Structured Investigation Report (Appears when completed) */}
              {(demo.isCompleted || (taskDetail?.task.status === "COMPLETED")) && (
                <InvestigationReport
                  issueKey={demo.issueKey || "ENG-142"}
                  title={demo.taskTitle}
                  summary="Diagnostic investigation confirmed unbounded session storage in src/auth/session.ts without TTL expiration under high auth token refresh load."
                  rootCause="Unbounded native JavaScript Map (sessionCache) instantiated at line 42 has no eviction policy or TTL expiration, causing heap memory exhaustion under high burst loads."
                  evidence={evidenceList}
                  recommendedFix="Replace native Map with LRUCache configured with max: 10,000 entries and ttl: 3600s, adhering to the historical pattern established in incident ENG-118."
                  confidence={demo.workflowConfidence}
                  sourcesCount={4}
                />
              )}

              {/* Feedback Loop & Learning Panel (Appears when task completed) */}
              {demo.isCompleted && (
                <FeedbackLearningPanel
                  onSubmitFeedback={handleFeedback}
                  isFeedbackRecorded={demo.feedbackGiven}
                  recordedComment={demo.feedbackComment}
                  workflowConfidence={demo.workflowConfidence}
                />
              )}

              {/* Execution Trace Timeline */}
              <div className="cf-panel">
                <div className="cf-panel-header">
                  <span className="cf-kicker">Observable Work Stream</span>
                  <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {timelineSteps.length} trace events
                  </span>
                </div>

                <div className="cf-panel-body">
                  <WorkTimeline steps={timelineSteps} currentStatus={currentStatusString} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoworkerWorkspacePage() {
  return (
    <React.Suspense
      fallback={
        <div className="cf-loading-state">
          Loading DevBot workspace...
        </div>
      }
    >
      <CoworkerWorkspaceContent />
    </React.Suspense>
  );
}
