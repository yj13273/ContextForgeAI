"use client";

import React, { useState, useEffect } from "react";
import { api, type TaskSummary, type TaskDetailResponse } from "../lib/api";

export default function WorkspacePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskDetailResponse | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Initial load: Fetch tasks
  useEffect(() => {
    loadTasks();
  }, []);

  // When activeTaskId changes, fetch details
  useEffect(() => {
    if (activeTaskId) {
      loadTaskDetail(activeTaskId);
    }
  }, [activeTaskId]);

  async function loadTasks() {
    const list = await api.listTasks(20);
    setTasks(list);
    if (!activeTaskId && list.length > 0) {
      setActiveTaskId(list[0].id);
    }
  }

  async function loadTaskDetail(id: string) {
    const detail = await api.getTask(id);
    if (detail) {
      setActiveTaskDetail(detail);
    }
  }

  async function handleStartInvestigation(customPrompt?: string) {
    const query = customPrompt || prompt;
    if (!query.trim()) return;

    setLoading(true);
    setFeedbackMessage(null);

    const issueKeyMatch = query.match(/[A-Z]+-\d+/i);
    const issueKey = issueKeyMatch ? issueKeyMatch[0].toUpperCase() : undefined;

    const res = await api.createTask({
      title: query,
      issueKey,
      description: `User requested: ${query}`,
    });

    setLoading(false);

    if (res.success && res.task) {
      setPrompt("");
      setFeedbackMessage(`Investigation started for ${res.task.title}`);
      await loadTasks();
      setActiveTaskId(res.task.id);
    } else {
      setFeedbackMessage(`Error: ${res.error || "Failed to start investigation."}`);
    }
  }

  async function handleApprove() {
    if (!activeTaskId) return;
    setActionLoading(true);
    const res = await api.approveTask(activeTaskId, decisionNote || "Approved by Alice");
    setActionLoading(false);

    if (res.success) {
      setDecisionNote("");
      setFeedbackMessage("Write action approved and executed successfully.");
      await loadTaskDetail(activeTaskId);
      await loadTasks();
    } else {
      setFeedbackMessage(`Approval failed: ${res.error}`);
    }
  }

  async function handleReject() {
    if (!activeTaskId) return;
    setActionLoading(true);
    const res = await api.rejectTask(activeTaskId, decisionNote || "Rejected by Alice");
    setActionLoading(false);

    if (res.success) {
      setDecisionNote("");
      setFeedbackMessage("Write action was rejected. Task marked as REJECTED.");
      await loadTaskDetail(activeTaskId);
      await loadTasks();
    } else {
      setFeedbackMessage(`Rejection failed: ${res.error}`);
    }
  }

  const activeTask = activeTaskDetail?.task;
  const isAwaitingApproval = activeTask?.status === "AWAITING_APPROVAL";

  return (
    <div style={{ display: "flex", flex: 1, width: "100%", height: "calc(100vh - 65px)" }}>
      {/* 1. Sidebar: Investigation History */}
      <aside
        style={{
          width: "320px",
          borderRight: "1px solid #334155",
          backgroundColor: "#1e293b",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1rem", borderBottom: "1px solid #334155" }}>
          <h2 style={{ fontSize: "0.9rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
            Recent Investigations
          </h2>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
          {tasks.length === 0 ? (
            <div style={{ padding: "1.5rem 0.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
              No investigations yet.
            </div>
          ) : (
            tasks.map((t) => {
              const isSelected = t.id === activeTaskId;
              let statusBg = "#334155";
              let statusColor = "#f8fafc";
              if (t.status === "COMPLETED") {
                statusBg = "#065f46";
                statusColor = "#34d399";
              } else if (t.status === "AWAITING_APPROVAL") {
                statusBg = "#78350f";
                statusColor = "#fbbf24";
              } else if (t.status === "REJECTED") {
                statusBg = "#881337";
                statusColor = "#fb7185";
              }

              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTaskId(t.id)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "6px",
                    marginBottom: "0.5rem",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#334155" : "transparent",
                    border: isSelected ? "1px solid #475569" : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: "600", fontSize: "0.85rem", color: isSelected ? "#ffffff" : "#f1f5f9" }}>
                      {t.title}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "4px",
                        backgroundColor: statusBg,
                        color: statusColor,
                        fontWeight: "700",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                    {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. Main Workspace: Chat Launcher & Active Investigation */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#0f172a", overflowY: "auto" }}>
        {/* Top Launcher & Chat Input */}
        <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid #334155", backgroundColor: "#1e293b" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "0.5rem", color: "#f8fafc" }}>
            Investigate with AI Coworker
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "1rem" }}>
            Ask DevBot to investigate an issue, search repositories, inspect commits, and draft a resolution.
          </p>

          {/* Prompt Input Box */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <input
              type="text"
              placeholder="e.g. Investigate ENG-142 (session leak in auth service)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStartInvestigation()}
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
            <button
              onClick={() => handleStartInvestigation()}
              disabled={loading}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                backgroundColor: loading ? "#475569" : "#3b82f6",
                color: "#ffffff",
                border: "none",
                fontWeight: "600",
                fontSize: "0.9rem",
              }}
            >
              {loading ? "Analyzing..." : "Investigate"}
            </button>
          </div>

          {/* Quick Suggestions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Quick prompt:</span>
            <button
              onClick={() => handleStartInvestigation("Investigate ENG-142")}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                backgroundColor: "#334155",
                color: "#38bdf8",
                border: "1px solid #475569",
              }}
            >
              Investigate ENG-142
            </button>
            <button
              onClick={() => handleStartInvestigation("Investigate ENG-205")}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                backgroundColor: "#334155",
                color: "#38bdf8",
                border: "1px solid #475569",
              }}
            >
              Investigate ENG-205
            </button>
          </div>

          {feedbackMessage && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                backgroundColor: feedbackMessage.startsWith("Error") ? "#881337" : "#065f46",
                color: "#f8fafc",
                fontSize: "0.8rem",
              }}
            >
              {feedbackMessage}
            </div>
          )}
        </div>

        {/* 3. Active Investigation Detail View */}
        <div style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
          {!activeTask ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#64748b" }}>
              <h3>No investigation selected</h3>
              <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Start a new investigation above or choose one from the sidebar.
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Task Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid #334155",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: "700", color: "#f8fafc" }}>
                    {activeTask.title}
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                    Task ID: <code>{activeTask.id}</code> • Workflow: <code>{activeTask.workflow}</code>
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.35rem 0.8rem",
                    borderRadius: "999px",
                    fontWeight: "700",
                    fontSize: "0.8rem",
                    backgroundColor:
                      activeTask.status === "COMPLETED"
                        ? "#065f46"
                        : activeTask.status === "AWAITING_APPROVAL"
                        ? "#78350f"
                        : activeTask.status === "REJECTED"
                        ? "#881337"
                        : "#334155",
                    color:
                      activeTask.status === "COMPLETED"
                        ? "#34d399"
                        : activeTask.status === "AWAITING_APPROVAL"
                        ? "#fbbf24"
                        : activeTask.status === "REJECTED"
                        ? "#fb7185"
                        : "#94a3b8",
                  }}
                >
                  {activeTask.status}
                </span>
              </div>

              {/* 4. Approval Gate Banner (when awaiting human approval) */}
              {isAwaitingApproval && (
                <div
                  style={{
                    padding: "1.25rem",
                    borderRadius: "8px",
                    backgroundColor: "#451a03",
                    border: "1px solid #b45309",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "#fef3c7" }}>
                      Write Action Requires Human Approval
                    </h4>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "#fed7aa" }}>
                    The AI Coworker has finished diagnosis and requests permission to execute a write action:
                    <strong> linear:update_issue</strong>. The action will NOT execute until you approve.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <input
                      type="text"
                      placeholder="Optional decision note (e.g. 'Approved, fix verified on staging')"
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        backgroundColor: "#1c1917",
                        border: "1px solid #78350f",
                        color: "#f8fafc",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: "0.6rem 1rem",
                          borderRadius: "6px",
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: "700",
                          fontSize: "0.85rem",
                        }}
                      >
                        {actionLoading ? "Processing..." : "✓ Approve Action"}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: "0.6rem 1rem",
                          borderRadius: "6px",
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: "700",
                          fontSize: "0.85rem",
                        }}
                      >
                        {actionLoading ? "Processing..." : "✕ Reject Action"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Findings & Evidence Section */}
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "8px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#f8fafc", marginBottom: "0.75rem" }}>
                  Investigation Findings & Evidence
                </h3>

                {activeTask.resultSummary ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ padding: "0.75rem", borderRadius: "6px", backgroundColor: "#0f172a" }}>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Summary</div>
                      <div style={{ fontSize: "0.9rem", color: "#f8fafc", marginTop: "0.25rem" }}>
                        {activeTask.resultSummary}
                      </div>
                    </div>

                    {activeTask.resultData && (
                      <div style={{ padding: "0.75rem", borderRadius: "6px", backgroundColor: "#0f172a" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Result Details</div>
                        <pre style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: "0.25rem", overflowX: "auto" }}>
                          {JSON.stringify(activeTask.resultData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                    {activeTask.description || "Investigation in progress. Evidence is being gathered."}
                  </p>
                )}
              </div>

              {/* 6. Execution Progress Timeline */}
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "8px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#f8fafc", marginBottom: "0.75rem" }}>
                  Task Execution Activity & Audit Steps
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {activeTaskDetail.auditEvents.length === 0 ? (
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>No audit steps recorded yet.</div>
                  ) : (
                    activeTaskDetail.auditEvents.map((event, idx) => (
                      <div
                        key={event.id || idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "6px",
                          backgroundColor: "#0f172a",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ color: "#38bdf8", fontWeight: "700" }}>#{idx + 1}</span>
                          <span style={{ color: "#f8fafc" }}>{event.eventType}</span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>({event.actorType})</span>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
