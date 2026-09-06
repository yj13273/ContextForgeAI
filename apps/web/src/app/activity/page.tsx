"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useDemo } from "../../lib/demo-context";

interface ActivityItem {
  id: string;
  timestamp: string;
  timeDisplay: string;
  dateGroup: "Today" | "Earlier";
  actorType: "ai_coworker" | "human_employee" | "system";
  actorLabel: string;
  eventType: string;
  description: string;
  taskId?: string;
}

export default function ActivityPage() {
  const { auditLogs } = useDemo();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadActivity() {
      try {
        const tasks = await api.listTasks(5);
        const collected: ActivityItem[] = [];

        // Convert demo audit logs first
        for (const log of auditLogs) {
          collected.push({
            id: log.id,
            timestamp: log.timestamp,
            timeDisplay: log.timeDisplay,
            dateGroup: "Today",
            actorType: log.actorType,
            actorLabel: log.actorLabel,
            eventType: log.eventType,
            description: log.description,
            taskId: log.taskId,
          });
        }

        // Fetch backend audit events if available
        for (const task of tasks.slice(0, 3)) {
          try {
            const detail = await api.getTask(task.id);
            if (detail?.auditEvents && detail.auditEvents.length > 0) {
              for (const ev of detail.auditEvents) {
                const date = new Date(ev.timestamp);
                const isToday = new Date().toDateString() === date.toDateString();
                const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                collected.push({
                  id: ev.id,
                  timestamp: ev.timestamp,
                  timeDisplay: timeStr,
                  dateGroup: isToday ? "Today" : "Earlier",
                  actorType: (ev.actorType as any) || "system",
                  actorLabel:
                    ev.actorType === "human_employee"
                      ? "Alice (Human)"
                      : ev.actorType === "ai_coworker"
                      ? "DevBot (Coworker)"
                      : "System",
                  eventType: ev.eventType,
                  description: formatEventDescription(ev.eventType, ev.payload, task.title),
                  taskId: task.id,
                });
              }
            }
          } catch {
            // Optional
          }
        }

        // Deduplicate & sort descending
        const unique = Array.from(new Map(collected.map((item) => [item.id, item])).values());
        unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivities(unique);
      } catch {
        // Fall back to demo logs only
        const demoItems: ActivityItem[] = auditLogs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          timeDisplay: log.timeDisplay,
          dateGroup: "Today",
          actorType: log.actorType,
          actorLabel: log.actorLabel,
          eventType: log.eventType,
          description: log.description,
          taskId: log.taskId,
        }));
        setActivities(demoItems);
      }
    }

    loadActivity();
  }, [auditLogs]);

  const todayItems = activities.filter((a) => a.dateGroup === "Today");
  const earlierItems = activities.filter((a) => a.dateGroup !== "Today");

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
          <h1 className="cf-title">Activity Stream</h1>
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
            IMMUTABLE AUDIT LOG
          </span>
        </div>
        <div className="cf-subtitle">
          Chronological audit trail of actions, tool invocations, approval decisions, and learning events executed by DevBot.
        </div>
      </div>

      {loading ? (
        <div className="cf-loading-state">
          Loading audit activity stream...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Today Section */}
          {todayItems.length > 0 && (
            <div>
              <div className="cf-kicker" style={{ marginBottom: "8px" }}>
                Today ({todayItems.length})
              </div>
              <div className="cf-panel">
                {todayItems.map((item, idx) => (
                  <ActivityRow key={item.id || idx} item={item} isLast={idx === todayItems.length - 1} />
                ))}
              </div>
            </div>
          )}

          {/* Earlier Section */}
          {earlierItems.length > 0 && (
            <div>
              <div className="cf-kicker" style={{ marginBottom: "8px" }}>
                Earlier
              </div>
              <div className="cf-panel">
                {earlierItems.map((item, idx) => (
                  <ActivityRow key={item.id || idx} item={item} isLast={idx === earlierItems.length - 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ item, isLast }: { item: ActivityItem; isLast: boolean }) {
  let actorColor = "var(--text-muted)";
  if (item.actorType === "human_employee") actorColor = "var(--state-success)";
  if (item.actorType === "ai_coworker") actorColor = "var(--accent-emphasis)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <span
          className="cf-code"
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            width: "44px",
            flexShrink: 0,
            paddingTop: "2px",
          }}
        >
          {item.timeDisplay}
        </span>

        <div>
          <div style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.45 }}>
            {item.description}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
            <span style={{ fontSize: "11px", color: actorColor, fontWeight: 600 }}>
              {item.actorLabel}
            </span>
            {item.taskId && (
              <>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>·</span>
                <Link
                  href="/coworker"
                  className="cf-code"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  {item.taskId}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <span
        className="cf-code"
        style={{
          fontSize: "10px",
          color: "var(--text-muted)",
          backgroundColor: "var(--bg-canvas)",
          padding: "2px 5px",
          borderRadius: "2px",
          border: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {item.eventType}
      </span>
    </div>
  );
}

function formatEventDescription(eventType: string, payload: any, defaultTitle?: string): string {
  switch (eventType) {
    case "task_started":
      return `Initiated investigation: ${defaultTitle || "Task"}`;
    case "context_assembled":
    case "context_built":
      return `Assembled context (${payload?.memoriesCount || 0} memories, ${payload?.toolsCount || 0} tools)`;
    case "tool_requested":
      return `Requested execution of tool '${payload?.toolName || "tool"}'`;
    case "tool_executed":
      return `Executed tool '${payload?.toolName || "tool"}' (success: ${payload?.success ?? true})`;
    case "approval_requested":
      return `Paused at Approval Gate for write tool '${payload?.toolName || "tool"}'`;
    case "approval_approved":
      return `Action approved by supervisor${payload?.decisionNote ? `: "${payload.decisionNote}"` : ""}`;
    case "approval_rejected":
      return `Action rejected by supervisor${payload?.decisionNote ? `: "${payload.decisionNote}"` : ""}`;
    case "memory_created":
      return `Persisted learning in organizational memory for ${payload?.issueKey || "investigation"}`;
    case "task_completed":
      return `Completed task '${defaultTitle || "Task"}'`;
    default:
      return `Event: ${eventType}`;
  }
}
