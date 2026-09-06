"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDemo } from "../../lib/demo-context";

export default function MemoryPage() {
  const { memories } = useDemo();
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const memoryTypes = ["ALL", "SOLUTION", "INCIDENT", "PREFERENCE", "DECISION", "PROCEDURE", "LESSON", "FACT"];

  const filteredMemories = memories.filter((mem) => {
    if (selectedType !== "ALL" && mem.type.toUpperCase() !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        mem.title.toLowerCase().includes(q) ||
        mem.content.toLowerCase().includes(q) ||
        (mem.sourceTask && mem.sourceTask.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
          <h1 className="cf-title">Organizational Memory</h1>
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
            {memories.length} RECORDS
          </span>
        </div>
        <div className="cf-subtitle">
          Accumulated engineering intelligence, supervisor directives, and verified solutions retained by DevBot across investigations.
        </div>
      </div>

      {/* Distinction Note */}
      <div className="cf-alert-info" style={{ marginBottom: "16px" }}>
        <span className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 700, fontSize: "10px" }}>
          EMPIRICAL INTELLIGENCE
        </span>
        <span>
          <strong style={{ color: "var(--text-primary)" }}>Memory</strong> is what DevBot learns and preserves from ongoing engineering tasks and supervisor corrections. (For organization-provided specifications, visit Knowledge).
        </span>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          paddingBottom: "8px",
          borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
          {memoryTypes.map((typeKey) => {
            const isSelected = selectedType === typeKey;
            return (
              <button
                key={typeKey}
                onClick={() => setSelectedType(typeKey)}
                className={`cf-tab ${isSelected ? "cf-tab-active" : ""}`}
                style={{ fontSize: "11px", padding: "3px 8px" }}
              >
                {typeKey.charAt(0) + typeKey.slice(1).toLowerCase()}s
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search organizational memories..."
          className="cf-input"
          style={{ width: "240px", fontSize: "12px", padding: "5px 8px" }}
        />
      </div>

      {/* Memory Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filteredMemories.length === 0 ? (
          <div className="cf-empty-state">
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              No memories match your query
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Try searching for &quot;session&quot;, &quot;cache&quot;, &quot;incident&quot;, or reset the filter.
            </div>
          </div>
        ) : (
          filteredMemories.map((mem) => {
            let typeColor = "var(--accent-emphasis)";
            let typeBg = "var(--accent-subtle)";
            if (mem.type === "Solution") {
              typeColor = "var(--state-success)";
              typeBg = "var(--state-success-bg)";
            } else if (mem.type === "Incident") {
              typeColor = "var(--state-error)";
              typeBg = "var(--state-error-bg)";
            } else if (mem.type === "Decision") {
              typeColor = "var(--state-approval)";
              typeBg = "var(--state-approval-bg)";
            } else if (mem.type === "Preference") {
              typeColor = "var(--state-running)";
              typeBg = "var(--state-running-bg)";
            }

            return (
              <div key={mem.id} className="cf-panel">
                <div className="cf-panel-header" style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className="cf-code"
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: typeColor,
                        backgroundColor: typeBg,
                        padding: "1px 5px",
                        borderRadius: "2px",
                      }}
                    >
                      {mem.type.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {mem.title}
                    </span>
                  </div>

                  <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {mem.date}
                  </span>
                </div>

                <div className="cf-panel-body" style={{ padding: "12px 14px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {mem.content}
                </div>

                <div className="cf-panel-footer" style={{ padding: "8px 14px", fontSize: "11px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>
                      Source:{" "}
                      {mem.sourceTask ? (
                        <Link href="/coworker" className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 500 }}>
                          {mem.sourceTask}
                        </Link>
                      ) : (
                        "Direct resolution"
                      )}
                    </span>
                    <span>·</span>
                    <span className="cf-code">Confidence: {Math.round(mem.confidence * 100)}%</span>
                  </div>

                  <div>
                    Importance: <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{mem.importance}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
