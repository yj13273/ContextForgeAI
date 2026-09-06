import React from "react";

export interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  let label = norm;
  let bg = "var(--bg-subtle)";
  let color = "var(--text-secondary)";
  let dotColor = "var(--text-muted)";
  let border = "var(--border-subtle)";

  if (norm === "CREATED" || norm === "PENDING") {
    label = "Queued";
    dotColor = "var(--text-muted)";
  } else if (norm === "REASONING" || norm === "GATHERING_CONTEXT" || norm === "EXECUTING_ACTION" || norm === "RUNNING") {
    label = norm === "REASONING" ? "Reasoning" : "Running";
    bg = "var(--state-running-bg)";
    color = "var(--state-running)";
    dotColor = "var(--state-running)";
    border = "var(--state-running-border)";
  } else if (norm === "AWAITING_APPROVAL") {
    label = "Approval Required";
    bg = "var(--state-approval-bg)";
    color = "var(--state-approval)";
    dotColor = "var(--state-approval)";
    border = "var(--state-approval-border)";
  } else if (norm === "COMPLETED") {
    label = "Completed";
    bg = "var(--state-success-bg)";
    color = "var(--state-success)";
    dotColor = "var(--state-success)";
    border = "var(--state-success-border)";
  } else if (norm === "REJECTED") {
    label = "Rejected";
    bg = "var(--state-error-bg)";
    color = "var(--state-error)";
    dotColor = "var(--state-error)";
    border = "var(--state-error-border)";
  } else if (norm === "FAILED") {
    label = "Failed";
    bg = "var(--state-error-bg)";
    color = "var(--state-error)";
    dotColor = "var(--state-error)";
    border = "var(--state-error-border)";
  }

  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? "4px" : "6px",
        padding: isSmall ? "2px 6px" : "3px 8px",
        borderRadius: "var(--radius-xs)",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: color,
        fontSize: isSmall ? "11px" : "12px",
        fontWeight: 500,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.02em",
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          width: isSmall ? "5px" : "6px",
          height: isSmall ? "5px" : "6px",
          borderRadius: "50%",
          backgroundColor: dotColor,
        }}
      />
      {label}
    </span>
  );
}
