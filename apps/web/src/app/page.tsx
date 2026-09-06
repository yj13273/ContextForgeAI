"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, type TaskSummary } from "../lib/api";
import { useDemo } from "../lib/demo-context";
import { StatusBadge } from "../components/StatusBadge";
import { RiskBadge } from "../components/RiskBadge";
import {
  COWORKER_INFO,
  SUPERVISOR_INFO,
  ORGANIZATION_INFO,
  SEEDED_TASKS,
} from "../lib/mock-data";

export default function HomePage() {
  const demo = useDemo();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await api.listTasks(10);
        setTasks(list);
      } catch {
        // Backend optional
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isDemoActive = demo.phase !== "IDLE";
  const showApprovalBanner = demo.isAwaitingApproval || tasks.some((t) => t.status === "AWAITING_APPROVAL");

  const demoStatusString = demo.isAwaitingApproval
    ? "AWAITING_APPROVAL"
    : demo.isRejected
    ? "REJECTED"
    : demo.isCompleted
    ? "COMPLETED"
    : "REASONING";

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* 1. DevBot Status Banner */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="cf-kicker">AI Software Engineering Coworker</span>
              <span style={{ color: "var(--text-muted)" }}>·</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {ORGANIZATION_INFO.name}
              </span>
            </div>
            <h1 className="cf-title" style={{ fontSize: "24px" }}>
              {COWORKER_INFO.name}
            </h1>
            <div className="cf-subtitle">
              Supervised by {SUPERVISOR_INFO.name} ·{" "}
              <span style={{ color: "var(--state-running)" }}>● Active in workspace</span>
            </div>
          </div>

          <Link href="/coworker" className="cf-btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
            Investigate an Issue →
          </Link>
        </div>
      </div>

      {/* 2. Pending Approval Alert Banner */}
      {showApprovalBanner && (
        <div className="cf-alert-approval" style={{ marginBottom: "28px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--state-approval)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Action Requires Human Approval
              </span>
              <RiskBadge level="MEDIUM" showRequirement={false} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              {isDemoActive ? demo.taskTitle : tasks.find((t) => t.status === "AWAITING_APPROVAL")?.title}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              DevBot proposed an external write mutation in Linear. Halted at Approval Gate awaiting {SUPERVISOR_INFO.name}.
            </div>
          </div>

          <Link href="/coworker" className="cf-btn-primary" style={{ backgroundColor: "var(--state-approval)", color: "#090d14", fontWeight: 600 }}>
            Review & Decide
          </Link>
        </div>
      )}

      {/* 3. CURRENT WORK */}
      <div style={{ marginBottom: "36px" }}>
        <div className="cf-kicker" style={{ marginBottom: "10px" }}>
          Current Work
        </div>

        {isDemoActive ? (
          <div className="cf-panel">
            <div className="cf-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 600 }}>
                  {demo.issueKey}
                </span>
                <StatusBadge status={demoStatusString} size="sm" />
                <RiskBadge level={demo.riskLevel} showRequirement={false} />
              </div>
              <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Phase: {demo.phase}
              </span>
            </div>

            <div className="cf-panel-body">
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
                {demo.taskTitle}
              </h3>

              {/* Progress Stepper */}
              <div
                style={{
                  padding: "10px 12px",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xs)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--state-success)" }}>✓</span>
                  <span>Linear issue specifications fetched</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--state-success)" }}>✓</span>
                  <span>Organizational memory retrieved (Session Cache Eviction Pattern)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--state-success)" }}>✓</span>
                  <span>GitHub repository analyzed (src/auth/session.ts)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontWeight: 500 }}>
                  <span style={{ color: demo.isCompleted ? "var(--state-success)" : "var(--state-running)" }}>
                    {demo.isCompleted ? "✓" : "●"}
                  </span>
                  <span>
                    {demo.isCompleted
                      ? "Outcome verified and organizational memory updated"
                      : demo.isAwaitingApproval
                      ? "Approval Gate: Linear issue update queued"
                      : "Executing multi-tool diagnosis"}
                  </span>
                </div>
              </div>
            </div>

            <div className="cf-panel-footer">
              <span>Supervised by {SUPERVISOR_INFO.name}</span>
              <Link href="/coworker" className="cf-btn-ghost">
                Open Workspace Stream →
              </Link>
            </div>
          </div>
        ) : (
          <div className="cf-empty-state">
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              DevBot is idle and ready for assignment
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
              Primary demo target: ENG-142 (Authentication session memory exhaustion)
            </div>
            <Link href="/coworker" className="cf-btn-primary">
              Launch ENG-142 Investigation
            </Link>
          </div>
        )}
      </div>

      {/* 4. RECENT TASKS */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div className="cf-kicker">Recent Tasks</div>
          <Link href="/tasks" style={{ fontSize: "12px", color: "var(--accent-emphasis)" }}>
            View all tasks →
          </Link>
        </div>

        <div className="cf-panel">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="cf-th" style={{ width: "90px" }}>Issue</th>
                <th className="cf-th">Title</th>
                <th className="cf-th" style={{ width: "130px" }}>Status</th>
                <th className="cf-th" style={{ width: "80px", textAlign: "right" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {isDemoActive && (
                <tr className="cf-tr" style={{ cursor: "pointer" }}>
                  <td className="cf-td">
                    <Link href="/coworker" className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 600 }}>
                      {demo.issueKey}
                    </Link>
                  </td>
                  <td className="cf-td">
                    <Link href="/coworker" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      Authentication session memory exhaustion
                    </Link>
                  </td>
                  <td className="cf-td">
                    <StatusBadge status={demoStatusString} size="sm" />
                  </td>
                  <td className="cf-td" style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "11px" }}>
                    Just now
                  </td>
                </tr>
              )}

              {SEEDED_TASKS.slice(1, 4).map((task) => (
                <tr key={task.id} className="cf-tr" style={{ cursor: "pointer" }}>
                  <td className="cf-td">
                    <Link href={`/coworker?taskId=${task.id}`} className="cf-code" style={{ color: "var(--text-secondary)" }}>
                      {task.issueKey}
                    </Link>
                  </td>
                  <td className="cf-td">
                    <Link href={`/coworker?taskId=${task.id}`} style={{ color: "var(--text-primary)" }}>
                      {task.title.replace(/^[A-Z]+-\d+\s*[:-]?\s*/, "")}
                    </Link>
                  </td>
                  <td className="cf-td">
                    <StatusBadge status={task.status} size="sm" />
                  </td>
                  <td className="cf-td" style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "11px" }}>
                    {new Date(task.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. RECENT ORGANIZATIONAL LEARNING & MEMORY */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div className="cf-kicker">Recent Organizational Learning</div>
          <Link href="/memory" style={{ fontSize: "12px", color: "var(--accent-emphasis)" }}>
            Browse memory ({demo.memories.length}) →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {demo.memories.slice(0, 2).map((mem) => (
            <div
              key={mem.id}
              style={{
                padding: "12px 14px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                  <span
                    className="cf-code"
                    style={{
                      fontSize: "10px",
                      color: "var(--state-success)",
                      backgroundColor: "var(--state-success-bg)",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      fontWeight: 600,
                    }}
                  >
                    {mem.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {mem.title}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  {mem.content}
                </div>
              </div>

              <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                {mem.date}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
