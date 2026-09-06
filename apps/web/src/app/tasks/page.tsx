"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api, type TaskSummary } from "../../lib/api";
import { useDemo } from "../../lib/demo-context";
import { StatusBadge } from "../../components/StatusBadge";
import { RiskBadge } from "../../components/RiskBadge";
import { SEEDED_TASKS } from "../../lib/mock-data";

export default function TasksPage() {
  const demo = useDemo();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await api.listTasks(50);
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
  const demoStatusString: TaskSummary["status"] = demo.isAwaitingApproval
    ? "AWAITING_APPROVAL"
    : demo.isRejected
    ? "REJECTED"
    : demo.isCompleted
    ? "COMPLETED"
    : "REASONING";

  // Build combined task list: active demo task at top, then other seeded tasks, then any backend tasks
  const combinedTasks: TaskSummary[] = [
    ...(isDemoActive
      ? [
          {
            id: "task-eng-142",
            title: demo.taskTitle,
            description: "Session cache memory exhaustion in src/auth/session.ts",
            status: demoStatusString,
            workflow: "Authentication Incident Investigation",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]
      : [
          {
            id: "task-eng-142-idle",
            title: "Investigate ENG-142: Authentication session memory exhaustion",
            description: "Session cache memory leak in Auth Service under burst token refresh load",
            status: "AWAITING_APPROVAL" as const,
            workflow: "Authentication Incident Investigation",
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
    ...SEEDED_TASKS.slice(1).map((st) => ({
      id: st.id,
      title: st.title,
      description: st.description,
      status: st.status,
      workflow: st.workflow,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
    })),
    ...tasks.filter((t) => !t.title.includes("ENG-142") && !t.title.includes("ENG-156")),
  ];

  const filteredTasks = combinedTasks.filter((t) => {
    if (filter === "RUNNING") {
      if (t.status !== "REASONING" && t.status !== "GATHERING_CONTEXT" && t.status !== "EXECUTING_ACTION") return false;
    } else if (filter === "APPROVAL") {
      if (t.status !== "AWAITING_APPROVAL") return false;
    } else if (filter === "COMPLETED") {
      if (t.status !== "COMPLETED") return false;
    } else if (filter === "FAILED") {
      if (t.status !== "REJECTED" && t.status !== "FAILED") return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
    }

    return true;
  });

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <h1 className="cf-title">Tasks Inbox</h1>
            <span
              className="cf-code"
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                padding: "1px 6px",
                borderRadius: "2px",
              }}
            >
              {filteredTasks.length} ITEMS
            </span>
          </div>
          <div className="cf-subtitle">
            Operational engineering tasks and autonomous investigations handled by DevBot.
          </div>
        </div>

        <Link href="/coworker" className="cf-btn-primary">
          + New Investigation
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "8px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { key: "ALL", label: "All Tasks" },
            { key: "RUNNING", label: "Running" },
            { key: "APPROVAL", label: "Awaiting Approval" },
            { key: "COMPLETED", label: "Completed" },
            { key: "FAILED", label: "Failed" },
          ].map((tab) => {
            const isSelected = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`cf-tab ${isSelected ? "cf-tab-active" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter tasks by key or keyword..."
          className="cf-input"
          style={{ width: "240px", fontSize: "12px", padding: "5px 8px" }}
        />
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="cf-empty-state">
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            No investigations match criteria
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
            When DevBot executes engineering investigations, they will appear here.
          </div>
          <Link href="/coworker" className="cf-btn-secondary">
            Start an investigation
          </Link>
        </div>
      ) : (
        <div className="cf-panel">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="cf-th" style={{ width: "90px" }}>Issue</th>
                <th className="cf-th">Task Description</th>
                <th className="cf-th" style={{ width: "180px" }}>Workflow</th>
                <th className="cf-th" style={{ width: "130px" }}>Status</th>
                <th className="cf-th" style={{ width: "80px", textAlign: "right" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const issueKey = task.title.match(/[A-Z]+-\d+/)?.[0] || "TASK";

                return (
                  <tr
                    key={task.id}
                    className="cf-tr"
                    style={{ cursor: "pointer" }}
                  >
                    <td className="cf-td">
                      <Link href="/coworker" className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 600 }}>
                        {issueKey}
                      </Link>
                    </td>

                    <td className="cf-td">
                      <Link href="/coworker" style={{ color: "var(--text-primary)", fontWeight: 500, display: "block" }}>
                        {task.title.replace(/^[A-Z]+-\d+\s*[:-]?\s*/, "")}
                      </Link>
                      {task.description && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {task.description}
                        </div>
                      )}
                    </td>

                    <td className="cf-td">
                      <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {task.workflow}
                      </span>
                    </td>

                    <td className="cf-td">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {task.status === "AWAITING_APPROVAL" && <RiskBadge level="MEDIUM" showRequirement={false} />}
                        <StatusBadge status={task.status} size="sm" />
                      </div>
                    </td>

                    <td className="cf-td" style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "11px" }}>
                      {new Date(task.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
