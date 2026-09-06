"use client";

import React, { useState } from "react";

export interface FeedbackLearningPanelProps {
  onSubmitFeedback: (rating: "correct" | "needs_correction", comment: string) => Promise<void>;
  isFeedbackRecorded: boolean;
  recordedComment?: string;
  workflowName?: string;
  workflowConfidence?: number;
}

export function FeedbackLearningPanel({
  onSubmitFeedback,
  isFeedbackRecorded,
  recordedComment = "",
  workflowName = "Authentication Incident Investigation",
  workflowConfidence = 0.98,
}: FeedbackLearningPanelProps) {
  const [rating, setRating] = useState<"correct" | "needs_correction">("correct");
  const [comment, setComment] = useState("Always check previous incidents before searching code");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitFeedback(rating, comment);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isFeedbackRecorded) {
    return (
      <div className="cf-panel">
        <div className="cf-panel-header">
          <span className="cf-kicker">Feedback Learning Loop</span>
          <span
            className="cf-code"
            style={{
              fontSize: "11px",
              color: "var(--state-success)",
              backgroundColor: "var(--state-success-bg)",
              border: "1px solid var(--state-success-border)",
              padding: "2px 6px",
              borderRadius: "2px",
              fontWeight: 600,
            }}
          >
            INTELLIGENCE UPDATED
          </span>
        </div>

        <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              padding: "10px 12px",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              fontSize: "12px",
            }}
          >
            <div style={{ color: "var(--text-muted)", fontSize: "11px", marginBottom: "3px" }}>
              Supervisor Directive Recorded:
            </div>
            <div className="cf-code" style={{ color: "var(--text-primary)" }}>
              &quot;{recordedComment || comment}&quot;
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
            <div
              style={{
                padding: "10px",
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              <div className="cf-kicker" style={{ fontSize: "9px" }}>Workflow Calibrated</div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                {workflowName}
              </div>
              <div className="cf-code" style={{ fontSize: "11px", color: "var(--state-success)", marginTop: "2px" }}>
                ✓ Confidence updated to {Math.round(workflowConfidence * 100)}%
              </div>
            </div>

            <div
              style={{
                padding: "10px",
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              <div className="cf-kicker" style={{ fontSize: "9px" }}>Organizational Memory</div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                New Preference Created
              </div>
              <div className="cf-code" style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                ✓ Visible in Memory repository
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cf-panel">
      <div className="cf-panel-header">
        <span className="cf-kicker">Feedback Learning</span>
        <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Supervisor: Alice Engineer
        </span>
      </div>

      <div className="cf-panel-body">
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0" }}>
          Was this workflow correct? DevBot calibrates organizational workflows and memory rules based on your evaluation.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label className="cf-label">Evaluation</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setRating("correct")}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  backgroundColor: rating === "correct" ? "var(--state-success-bg)" : "var(--bg-canvas)",
                  border: `1px solid ${
                    rating === "correct" ? "var(--state-success-border)" : "var(--border-default)"
                  }`,
                  borderRadius: "var(--radius-xs)",
                  color: rating === "correct" ? "var(--state-success)" : "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>✓</span>
                <span>Correct</span>
              </button>

              <button
                type="button"
                onClick={() => setRating("needs_correction")}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  backgroundColor: rating === "needs_correction" ? "var(--state-error-bg)" : "var(--bg-canvas)",
                  border: `1px solid ${
                    rating === "needs_correction" ? "var(--state-error-border)" : "var(--border-default)"
                  }`,
                  borderRadius: "var(--radius-xs)",
                  color: rating === "needs_correction" ? "var(--state-error)" : "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>✕</span>
                <span>Needs correction</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="feedback-comment" className="cf-label">
              Directive or Organizational Guidance
            </label>
            <input
              id="feedback-comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Always check previous incidents before searching code"
              className="cf-input"
              style={{ fontSize: "12px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cf-btn-primary"
            >
              {isSubmitting ? "Learning from feedback..." : "Submit Feedback & Learn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
