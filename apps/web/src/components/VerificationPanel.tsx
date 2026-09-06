"use client";

import React from "react";

export interface VerificationCheckItem {
  id: string;
  label: string;
  verified: boolean;
}

export interface VerificationPanelProps {
  checks: VerificationCheckItem[];
  isVerified: boolean;
  issueKey?: string;
}

export function VerificationPanel({
  checks,
  isVerified,
  issueKey = "ENG-142",
}: VerificationPanelProps) {
  return (
    <div className="cf-panel">
      <div className="cf-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="cf-kicker">Outcome Verification</span>
          <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            [{issueKey}]
          </span>
        </div>

        {isVerified ? (
          <div
            className="cf-code"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--state-success)",
              backgroundColor: "var(--state-success-bg)",
              border: "1px solid var(--state-success-border)",
              padding: "2px 7px",
              borderRadius: "2px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--state-success)",
              }}
            />
            OUTCOME VERIFIED
          </div>
        ) : (
          <div
            className="cf-code"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "var(--state-running)",
              backgroundColor: "var(--state-running-bg)",
              border: "1px solid var(--state-running-border)",
              padding: "2px 7px",
              borderRadius: "2px",
            }}
          >
            VERIFYING INTEGRITY...
          </div>
        )}
      </div>

      <div className="cf-panel-body" style={{ padding: "14px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: 1.45 }}>
          Automated post-execution verification checks confirm external system mutations adhere to organizational standards and state invariants before the task is marked complete.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {checks.map((check) => (
            <div
              key={check.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                backgroundColor: check.verified ? "var(--bg-canvas)" : "var(--bg-subtle)",
                border: `1px solid ${check.verified ? "var(--border-subtle)" : "var(--border-default)"}`,
                borderRadius: "var(--radius-xs)",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className="cf-code"
                  style={{
                    color: check.verified ? "var(--state-success)" : "var(--text-muted)",
                    fontWeight: 700,
                  }}
                >
                  {check.verified ? "✓" : "·"}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: check.verified ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {check.label}
                </span>
              </div>

              <span
                className="cf-code"
                style={{
                  fontSize: "11px",
                  color: check.verified ? "var(--state-success)" : "var(--text-muted)",
                }}
              >
                {check.verified ? "CONFIRMED" : "PENDING"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
