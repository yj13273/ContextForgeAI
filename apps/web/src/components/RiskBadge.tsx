import React from "react";

export interface RiskBadgeProps {
  level: "LOW" | "MEDIUM" | "HIGH";
  showRequirement?: boolean;
}

export function RiskBadge({ level, showRequirement = true }: RiskBadgeProps) {
  let color = "var(--state-success)";
  let bg = "var(--state-success-bg)";
  let border = "var(--state-success-border)";
  let reqText = "Autonomous";

  if (level === "MEDIUM") {
    color = "var(--state-approval)";
    bg = "var(--state-approval-bg)";
    border = "var(--state-approval-border)";
    reqText = "Human Approval Required";
  } else if (level === "HIGH") {
    color = "var(--state-error)";
    bg = "var(--state-error-bg)";
    border = "var(--state-error-border)";
    reqText = "Blocked / Escalate";
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          color,
          backgroundColor: bg,
          border: `1px solid ${border}`,
          padding: "2px 6px",
          borderRadius: "var(--radius-xs)",
          letterSpacing: "0.04em",
        }}
      >
        {level} RISK
      </span>
      {showRequirement && (
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          → {reqText}
        </span>
      )}
    </div>
  );
}
