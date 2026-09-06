"use client";

import React from "react";
import { RiskBadge } from "../../components/RiskBadge";
import {
  ORGANIZATION_INFO,
  SUPERVISOR_INFO,
  COWORKER_INFO,
} from "../../lib/mock-data";

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
          <h1 className="cf-title">Settings & Governance</h1>
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
            RBAC & RISK CONTROLS
          </span>
        </div>
        <div className="cf-subtitle">
          Organization specifications, authenticated profile, DevBot boundaries, and tool permissions.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* 1. Organization & Profile Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Organization */}
          <div className="cf-panel">
            <div className="cf-panel-header">
              <span className="cf-kicker">Organization</span>
              <span className="cf-code" style={{ fontSize: "10px", color: "var(--state-success)" }}>
                ISOLATED TENANT
              </span>
            </div>
            <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Name:</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{ORGANIZATION_INFO.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Domain:</span>
                <span className="cf-code">{ORGANIZATION_INFO.domain}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Tenant ID:</span>
                <span className="cf-code" style={{ color: "var(--text-muted)", fontSize: "11px" }}>{ORGANIZATION_INFO.id}</span>
              </div>
            </div>
          </div>

          {/* Supervisor Profile */}
          <div className="cf-panel">
            <div className="cf-panel-header">
              <span className="cf-kicker">Authenticated Employee</span>
              <span className="cf-code" style={{ fontSize: "10px", color: "var(--state-success)" }}>
                ACTIVE SESSION
              </span>
            </div>
            <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Name:</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{SUPERVISOR_INFO.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Role:</span>
                <span style={{ color: "var(--text-secondary)" }}>{SUPERVISOR_INFO.role}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Email:</span>
                <span className="cf-code">{SUPERVISOR_INFO.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. AI Coworker Configuration */}
        <div className="cf-panel">
          <div className="cf-panel-header">
            <span className="cf-kicker">AI Coworker Specification</span>
            <span className="cf-code" style={{ fontSize: "10px", color: "var(--state-running)" }}>
              SUPERVISED
            </span>
          </div>

          <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px" }}>
              <span style={{ color: "var(--text-muted)" }}>Coworker Name:</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{COWORKER_INFO.name}</span>

              <span style={{ color: "var(--text-muted)" }}>Role & Scope:</span>
              <span style={{ color: "var(--text-secondary)" }}>{COWORKER_INFO.role}</span>

              <span style={{ color: "var(--text-muted)" }}>Autonomy Mode:</span>
              <div>
                <span style={{ color: "var(--state-approval)", fontWeight: 600 }}>Semi-Autonomous</span>
                <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
                  (Autonomous read queries, explicit approval for state mutations)
                </span>
              </div>

              <span style={{ color: "var(--text-muted)" }}>Operational Directive:</span>
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xs)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {COWORKER_INFO.systemPrompt}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Connected Tools & Permissions Matrix */}
        <div className="cf-panel">
          <div className="cf-panel-header">
            <span className="cf-kicker">Connected Tools & Permissions</span>
          </div>

          <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* GitHub */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>GitHub Integration</span>
                <span className="cf-code" style={{ fontSize: "10px", color: "var(--state-success)" }}>CONNECTED</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", fontSize: "11px" }}>
                <div style={{ padding: "8px", backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Read Issues</div>
                  <div style={{ color: "var(--state-success)", fontWeight: 600, marginTop: "2px" }}>✓ Autonomous</div>
                </div>
                <div style={{ padding: "8px", backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Search Code</div>
                  <div style={{ color: "var(--state-success)", fontWeight: 600, marginTop: "2px" }}>✓ Autonomous</div>
                </div>
                <div style={{ padding: "8px", backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Read Commits</div>
                  <div style={{ color: "var(--state-success)", fontWeight: 600, marginTop: "2px" }}>✓ Autonomous</div>
                </div>
                <div style={{ padding: "8px", backgroundColor: "var(--state-approval-bg)", border: "1px solid var(--state-approval-border)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--state-approval)" }}>Write / Create PR</div>
                  <div style={{ color: "var(--state-approval)", fontWeight: 700, marginTop: "2px" }}>Approval Required</div>
                </div>
              </div>
            </div>

            {/* Linear */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>Linear Integration</span>
                <span className="cf-code" style={{ fontSize: "10px", color: "var(--state-success)" }}>CONNECTED</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "11px" }}>
                <div style={{ padding: "8px", backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Read Issues</div>
                  <div style={{ color: "var(--state-success)", fontWeight: 600, marginTop: "2px" }}>✓ Autonomous</div>
                </div>
                <div style={{ padding: "8px", backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Read Comments</div>
                  <div style={{ color: "var(--state-success)", fontWeight: 600, marginTop: "2px" }}>✓ Autonomous</div>
                </div>
                <div style={{ padding: "8px", backgroundColor: "var(--state-approval-bg)", border: "1px solid var(--state-approval-border)", borderRadius: "var(--radius-xs)" }}>
                  <div style={{ color: "var(--state-approval)" }}>Update Issues / State</div>
                  <div style={{ color: "var(--state-approval)", fontWeight: 700, marginTop: "2px" }}>Approval Required</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Risk Engine Classification Tiers */}
        <div className="cf-panel">
          <div className="cf-panel-header">
            <span className="cf-kicker">Risk Engine Autonomy Tiers</span>
          </div>

          <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <RiskBadge level="LOW" showRequirement={false} />
                <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                  Read GitHub issues, search code repository, query memory records
                </span>
              </div>
              <span className="cf-code" style={{ fontSize: "11px", color: "var(--state-success)", fontWeight: 600 }}>
                → AUTOMATIC
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                backgroundColor: "var(--state-approval-bg)",
                border: "1px solid var(--state-approval-border)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <RiskBadge level="MEDIUM" showRequirement={false} />
                <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                  Update Linear issues, state transitions, attach diagnostic findings
                </span>
              </div>
              <span className="cf-code" style={{ fontSize: "11px", color: "var(--state-approval)", fontWeight: 700 }}>
                → APPROVAL REQUIRED
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <RiskBadge level="HIGH" showRequirement={false} />
                <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                  Production deployment, database schema evolution, credentials
                </span>
              </div>
              <span className="cf-code" style={{ fontSize: "11px", color: "var(--state-error)", fontWeight: 600 }}>
                → BLOCKED / ESCALATE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
