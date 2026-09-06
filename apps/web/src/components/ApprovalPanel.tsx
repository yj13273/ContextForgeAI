"use client";

import React, { useState } from "react";
import { RiskBadge } from "./RiskBadge";

export interface ApprovalPanelProps {
  taskId: string;
  approvalId?: string;
  toolName: string;
  parameters: Record<string, unknown>;
  onApprove: (decisionNote?: string) => Promise<void>;
  onReject: (decisionNote?: string) => Promise<void>;
  loading?: boolean;
}

export function ApprovalPanel({
  taskId,
  approvalId,
  toolName,
  parameters,
  onApprove,
  onReject,
  loading = false,
}: ApprovalPanelProps) {
  const [decisionNote, setDecisionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleApprove() {
    setIsSubmitting(true);
    try {
      await onApprove(decisionNote.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    setIsSubmitting(true);
    try {
      await onReject(decisionNote.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  }

  const issueId = (parameters?.issueId || parameters?.issueKey || "ENG-142") as string;
  const stateChange = (parameters?.state || parameters?.status || "In Review") as string;
  const comment = (parameters?.comment || parameters?.body || "Investigation completed. Root cause identified in src/auth/session.ts.") as string;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--state-approval-border)",
        borderRadius: "var(--radius-md)",
        padding: "18px 20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="cf-code"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--state-approval)",
              backgroundColor: "var(--state-approval-bg)",
              border: "1px solid var(--state-approval-border)",
              padding: "2px 6px",
              borderRadius: "2px",
              letterSpacing: "0.04em",
            }}
          >
            UPDATE LINEAR ISSUE [{issueId}]
          </span>
          <RiskBadge level="MEDIUM" showRequirement={false} />
        </div>

        {approvalId && (
          <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            ID: {approvalId.slice(-8)}
          </span>
        )}
      </div>

      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        DevBot is requesting authorization to execute <code className="cf-code" style={{ color: "var(--accent-emphasis)" }}>{toolName}</code>.
      </p>

      {/* Structured Parameters Display */}
      <div
        style={{
          backgroundColor: "var(--bg-canvas)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xs)",
          padding: "12px 14px",
          marginBottom: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <span style={{ color: "var(--text-muted)", width: "100px", flexShrink: 0 }}>Target Issue:</span>
          <span className="cf-code" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {issueId}
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <span style={{ color: "var(--text-muted)", width: "100px", flexShrink: 0 }}>Proposed State:</span>
          <span className="cf-code" style={{ color: "var(--state-approval)", fontWeight: 600 }}>
            → {stateChange}
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <span style={{ color: "var(--text-muted)", width: "100px", flexShrink: 0 }}>Risk:</span>
          <span className="cf-code" style={{ color: "var(--state-approval)", fontWeight: 600 }}>
            MEDIUM (This action modifies organizational state)
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
          <span style={{ color: "var(--text-muted)" }}>Proposed Comment:</span>
          <div
            style={{
              padding: "8px 10px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {comment}
          </div>
        </div>
      </div>

      {/* Decision Note Input */}
      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="decision-note" className="cf-label" style={{ marginBottom: "4px" }}>
          Optional Decision Note (recorded in immutable audit log)
        </label>
        <input
          id="decision-note"
          type="text"
          value={decisionNote}
          onChange={(e) => setDecisionNote(e.target.value)}
          placeholder="e.g. Verified root cause in staging, proceed with update"
          disabled={loading || isSubmitting}
          className="cf-input"
          style={{ fontSize: "12px" }}
        />
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "12px",
          borderTop: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          ContextForge will not execute this external write until approved.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={handleReject}
            disabled={loading || isSubmitting}
            className="cf-btn-danger"
          >
            Reject Action
          </button>
          <button
            onClick={handleApprove}
            disabled={loading || isSubmitting}
            className="cf-btn-primary"
            style={{ backgroundColor: "var(--state-approval)", color: "#090d14", fontWeight: 700 }}
          >
            {isSubmitting ? "Executing..." : "Approve Action"}
          </button>
        </div>
      </div>
    </div>
  );
}
