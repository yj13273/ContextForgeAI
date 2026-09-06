"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDemo } from "../../lib/demo-context";
import { StatusBadge } from "../../components/StatusBadge";

export default function WorkflowsPage() {
  const { workflows } = useDemo();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.id || "wf-auth-incident");

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || workflows[0];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Learned Workflows
            </h1>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                padding: "2px 7px",
                borderRadius: "var(--radius-xs)",
              }}
            >
              AUTONOMOUS SYNTHESIS
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Organizational problem-solving patterns extracted from historical incident resolutions and supervisor feedback loops.
          </p>
        </div>

        <Link
          href="/coworker"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--text-primary)",
            textDecoration: "none",
          }}
        >
          <span>Run in Coworker Workspace</span>
          <span>→</span>
        </Link>
      </div>

      {/* Main Grid: Workflow Directory + Detail Inspector */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Workflows List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
              padding: "0 4px",
            }}
          >
            Synthesized Pipelines ({workflows.length})
          </div>

          {workflows.map((wf) => {
            const isSelected = wf.id === selectedWorkflowId;
            return (
              <div
                key={wf.id}
                onClick={() => setSelectedWorkflowId(wf.id)}
                style={{
                  padding: "14px",
                  backgroundColor: isSelected ? "var(--bg-surface)" : "var(--bg-canvas)",
                  border: `1px solid ${isSelected ? "var(--border-focus)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                    {wf.name}
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: wf.confidence >= 0.95 ? "var(--state-success)" : "var(--state-running)",
                      backgroundColor: wf.confidence >= 0.95 ? "var(--state-success-bg)" : "var(--state-running-bg)",
                      border: `1px solid ${
                        wf.confidence >= 0.95 ? "var(--state-success-border)" : "var(--state-running-border)"
                      }`,
                      padding: "2px 6px",
                      borderRadius: "var(--radius-xs)",
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(wf.confidence * 100)}% CONF
                  </span>
                </div>

                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    margin: "0 0 10px 0",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {wf.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: "8px",
                  }}
                >
                  <span>{wf.previousUses} executions</span>
                  <span>Gate: {wf.approvalRequirement}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Active Workflow Inspection */}
        {selectedWorkflow && (
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingBottom: "16px",
                borderBottom: "1px solid var(--border-subtle)",
                marginBottom: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  {selectedWorkflow.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {selectedWorkflow.description}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "18px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: "var(--state-success)",
                  }}
                >
                  {Math.round(selectedWorkflow.confidence * 100)}%
                </div>
                <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  CONFIDENCE SCORE
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  padding: "10px",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Trigger Pattern
                </div>
                <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginTop: "4px" }}>
                  {selectedWorkflow.trigger}
                </div>
              </div>

              <div
                style={{
                  padding: "10px",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Origin & Source
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-primary)", marginTop: "4px" }}>
                  {selectedWorkflow.source}
                </div>
              </div>

              <div
                style={{
                  padding: "10px",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Human Approval Gate
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-primary)", marginTop: "4px" }}>
                  {selectedWorkflow.approvalRequirement}
                </div>
              </div>
            </div>

            {/* Execution Sequence / Pipeline */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: "10px",
                }}
              >
                Execution Pipeline Sequence
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {selectedWorkflow.steps.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      backgroundColor: "var(--bg-canvas)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Required Tools */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Tools Bound to Workflow
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {selectedWorkflow.toolsRequired.map((tool) => (
                  <span
                    key={tool}
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-primary)",
                      backgroundColor: "var(--bg-canvas)",
                      border: "1px solid var(--border-subtle)",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-xs)",
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Verification Rule Invariant */}
            <div
              style={{
                padding: "12px 14px",
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Mandatory Verification Rule
              </div>
              <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                {selectedWorkflow.verificationRule}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
