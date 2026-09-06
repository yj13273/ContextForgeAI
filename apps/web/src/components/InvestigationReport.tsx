import React from "react";

export interface EvidenceItem {
  type: "file" | "commit" | "issue" | "memory";
  label: string;
  detail?: string;
  source?: string;
}

export interface InvestigationReportProps {
  issueKey?: string;
  title: string;
  summary: string;
  rootCause: string;
  evidence?: EvidenceItem[];
  recommendedFix: string;
  confidence?: number | string;
  sourcesCount?: number;
}

export function InvestigationReport({
  issueKey,
  title,
  summary,
  rootCause,
  evidence = [],
  recommendedFix,
  confidence = "High",
  sourcesCount = 3,
}: InvestigationReportProps) {
  const confidencePercent = typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : confidence;

  return (
    <div className="cf-panel">
      {/* Header */}
      <div className="cf-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {issueKey && (
            <span className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 700, fontSize: "12px" }}>
              {issueKey}
            </span>
          )}
          <span
            className="cf-code"
            style={{
              fontSize: "10px",
              color: "var(--state-success)",
              backgroundColor: "var(--state-success-bg)",
              border: "1px solid var(--state-success-border)",
              padding: "1px 6px",
              borderRadius: "2px",
              fontWeight: 600,
            }}
          >
            INVESTIGATION COMPLETED
          </span>
        </div>

        <div className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Confidence: <span style={{ color: "var(--state-success)", fontWeight: 700 }}>{confidencePercent}</span>
        </div>
      </div>

      <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            {title}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {summary}
          </p>
        </div>

        {/* Root Cause */}
        <div>
          <div className="cf-kicker" style={{ marginBottom: "6px" }}>
            Identified Root Cause
          </div>
          <div
            style={{
              padding: "10px 12px",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              fontSize: "12px",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {rootCause}
          </div>
        </div>

        {/* Evidence */}
        {evidence.length > 0 && (
          <div>
            <div className="cf-kicker" style={{ marginBottom: "6px" }}>
              Synthesized Evidence ({evidence.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {evidence.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 10px",
                    backgroundColor: "var(--bg-canvas)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-xs)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 600, fontSize: "11px" }}>
                      {ev.label}
                    </span>
                    <span className="cf-code" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {ev.source || ev.type}
                    </span>
                  </div>
                  {ev.detail && (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      {ev.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Fix */}
        <div>
          <div className="cf-kicker" style={{ marginBottom: "6px" }}>
            Recommended Resolution
          </div>
          <div
            style={{
              padding: "10px 12px",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              fontSize: "12px",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {recommendedFix}
          </div>
        </div>
      </div>

      <div className="cf-panel-footer">
        <span>Verified against {sourcesCount} organizational sources</span>
        <span>Retained by DevBot</span>
      </div>
    </div>
  );
}
