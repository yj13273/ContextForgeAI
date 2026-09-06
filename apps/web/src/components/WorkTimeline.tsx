"use client";

import React, { useState } from "react";
import type { TaskStep } from "../lib/api";

export interface WorkTimelineProps {
  steps: TaskStep[];
  currentStatus?: string;
}

export function WorkTimeline({ steps, currentStatus }: WorkTimelineProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!steps || steps.length === 0) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "var(--text-muted)",
          backgroundColor: "var(--bg-canvas)",
          border: "1px dashed var(--border-default)",
          borderRadius: "var(--radius-sm)",
          fontSize: "13px",
        }}
      >
        No work stream steps recorded yet. Start an investigation to observe DevBot's execution trace.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: "24px" }}>
      {/* Vertical timeline rule */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          bottom: "12px",
          left: "9px",
          width: "1px",
          backgroundColor: "var(--border-subtle)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {steps.map((step, idx) => {
          const isExpanded = expandedIndex === idx;
          const isTool = step.stepType === "tool_call" || step.stepType === "tool_result";
          const isApproval = step.stepType === "approval";
          const isError = step.status === "failed" || step.stepType === "error";

          let dotColor = "var(--border-focus)";
          if (isError) dotColor = "var(--state-error)";
          else if (isApproval) dotColor = "var(--state-approval)";
          else if (step.status === "success") dotColor = "var(--state-success)";

          const title = getStepTitle(step);
          const subtitle = getStepSubtitle(step);

          return (
            <div key={step.id || idx} style={{ position: "relative" }}>
              {/* Step indicator dot */}
              <div
                style={{
                  position: "absolute",
                  left: "-20px",
                  top: "6px",
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-canvas)",
                  border: `2px solid ${dotColor}`,
                }}
              />

              {/* Step Content Card */}
              <div
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      #{String(step.stepIndex ?? idx).padStart(2, "0")}
                    </span>

                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {title}
                    </span>

                    {subtitle && (
                      <span
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                          backgroundColor: "var(--bg-canvas)",
                          padding: "1px 6px",
                          borderRadius: "var(--radius-xs)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {subtitle}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: step.status === "success" ? "var(--state-success)" : step.status === "failed" ? "var(--state-error)" : "var(--text-muted)",
                      }}
                    >
                      {step.status}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expandable Step Details */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderTop: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      fontSize: "12px",
                    }}
                  >
                    {step.payload && Object.keys(step.payload).length > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                          Payload / Parameters
                        </div>
                        <pre
                          style={{
                            padding: "8px 10px",
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-xs)",
                            color: "var(--text-secondary)",
                            overflowX: "auto",
                          }}
                        >
                          {JSON.stringify(step.payload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {step.result && Object.keys(step.result).length > 0 && (
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                          Execution Output
                        </div>
                        <pre
                          style={{
                            padding: "8px 10px",
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-xs)",
                            color: "var(--text-primary)",
                            overflowX: "auto",
                          }}
                        >
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStepTitle(step: TaskStep): string {
  if (step.payload?.title) {
    return String(step.payload.title);
  }
  switch (step.stepType) {
    case "context":
      return "Assembled organizational context & memory";
    case "reasoning":
      return (step.payload?.summary as string) || "Hypothesis formation & analysis";
    case "tool_call":
      return `Invoked tool: ${step.payload?.toolName || "external_tool"}`;
    case "tool_result":
      return `Evaluated result from: ${step.payload?.toolName || "tool"}`;
    case "approval":
      return "Paused for human employee approval";
    case "final":
      return "Completed investigation report";
    case "error":
      return "Handled isolated failure";
    default:
      return `Step: ${step.stepType}`;
  }
}


function getStepSubtitle(step: TaskStep): string | null {
  if (step.stepType === "tool_call" || step.stepType === "tool_result") {
    const params = (step.payload?.parameters || step.payload) as any;
    if (params?.issueId) return `issue:${params.issueId}`;
    if (params?.path) return params.path;
    if (params?.query) return `"${params.query}"`;
  }
  if (step.stepType === "context") {
    const p = step.payload as any;
    if (p?.memoriesCount !== undefined) return `${p.memoriesCount} memories`;
  }
  return null;
}
