"use client";

import React, { useState } from "react";
import { KnowledgeGraphView } from "../../components/KnowledgeGraphView";
import { SEEDED_KNOWLEDGE_DOCS, type SeededKnowledgeDoc } from "../../lib/mock-data";

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<"GRAPH" | "DOCS">("GRAPH");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeDoc, setActiveDoc] = useState<SeededKnowledgeDoc | null>(null);

  const categories = ["ALL", "ARCHITECTURE", "SECURITY", "ENGINEERING", "OPERATIONS"];

  const filteredDocs = SEEDED_KNOWLEDGE_DOCS.filter((doc) => {
    if (selectedCategory !== "ALL" && doc.category.toUpperCase() !== selectedCategory) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: "1160px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
          paddingBottom: "14px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <h1 className="cf-title">Organizational Knowledge</h1>
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
              ACME CORP SPECIFICATIONS
            </span>
          </div>
          <div className="cf-subtitle">
            Curated architectural specifications, runbooks, and ontology provided directly by the organization.
          </div>
        </div>

        {/* View Switcher */}
        <div style={{ display: "flex", gap: "3px" }}>
          <button
            onClick={() => setActiveTab("GRAPH")}
            className={`cf-tab ${activeTab === "GRAPH" ? "cf-tab-active" : ""}`}
            style={{ fontSize: "11px", padding: "4px 10px" }}
          >
            Knowledge Graph
          </button>
          <button
            onClick={() => setActiveTab("DOCS")}
            className={`cf-tab ${activeTab === "DOCS" ? "cf-tab-active" : ""}`}
            style={{ fontSize: "11px", padding: "4px 10px" }}
          >
            Specifications & Runbooks
          </button>
        </div>
      </div>

      {/* Explicit Distinction Banner */}
      <div className="cf-alert-info" style={{ marginBottom: "18px" }}>
        <span className="cf-code" style={{ color: "var(--accent-emphasis)", fontWeight: 700, fontSize: "10px" }}>
          ORGANIZATIONAL CONTEXT
        </span>
        <span>
          <strong style={{ color: "var(--text-primary)" }}>Knowledge</strong> is intentionally provided specifications and architectural boundaries.{" "}
          <strong style={{ color: "var(--text-primary)" }}>Memory</strong> is empirical intelligence DevBot extracts from completed engineering tasks.
        </span>
      </div>

      {/* Tab Content */}
      {activeTab === "GRAPH" ? (
        <KnowledgeGraphView />
      ) : (
        <div>
          {/* Category Filter */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`cf-tab ${isSelected ? "cf-tab-active" : ""}`}
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                >
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>

          {/* Documents Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setActiveDoc(doc)}
                className="cf-panel"
                style={{ cursor: "pointer", transition: "border-color 0.15s ease" }}
              >
                <div className="cf-panel-header" style={{ padding: "10px 14px" }}>
                  <span
                    className="cf-code"
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--accent-emphasis)",
                      backgroundColor: "var(--accent-subtle)",
                      padding: "1px 5px",
                      borderRadius: "2px",
                    }}
                  >
                    {doc.category.toUpperCase()}
                  </span>
                  <span className="cf-code" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {doc.updatedAt}
                  </span>
                </div>

                <div className="cf-panel-body" style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    {doc.description}
                  </div>
                </div>

                <div className="cf-panel-footer" style={{ padding: "8px 14px", fontSize: "11px" }}>
                  <span>Author: {doc.author}</span>
                  <span style={{ color: "var(--accent-emphasis)" }}>View Specification →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specification Detail Modal */}
      {activeDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(5, 8, 14, 0.75)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 999,
          }}
          onClick={() => setActiveDoc(null)}
        >
          <div
            className="cf-panel"
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cf-panel-header">
              <div>
                <span className="cf-kicker" style={{ fontSize: "9px" }}>
                  {activeDoc.category.toUpperCase()}
                </span>
                <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                  {activeDoc.title}
                </h2>
              </div>

              <button
                onClick={() => setActiveDoc(null)}
                className="cf-btn-ghost"
                style={{ fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "18px", overflowY: "auto", fontSize: "13px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {activeDoc.content}
              </pre>
            </div>

            <div className="cf-panel-footer">
              <span>Author: {activeDoc.author}</span>
              <span>Updated: {activeDoc.updatedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
