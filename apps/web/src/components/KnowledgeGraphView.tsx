"use client";

import React, { useState } from "react";
import {
  SEEDED_GRAPH_NODES,
  SEEDED_GRAPH_EDGES,
  type SeededGraphNode,
  type SeededGraphEdge,
} from "../lib/mock-data";

export function KnowledgeGraphView() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("coworker-devbot");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodes = SEEDED_GRAPH_NODES;
  const edges = SEEDED_GRAPH_EDGES;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const nodeColorMap: Record<string, { bg: string; border: string; text: string }> = {
    coworker: { bg: "#152033", border: "#0284c7", text: "#38bdf8" },
    human: { bg: "#231e15", border: "#a16207", text: "#fde047" },
    task: { bg: "#15231c", border: "#15803d", text: "#86efac" },
    service: { bg: "#1e1828", border: "#7e22ce", text: "#d8b4fe" },
    code: { bg: "#171f2c", border: "#475569", text: "#cbd5e1" },
    incident: { bg: "#281717", border: "#b91c1c", text: "#fca5a5" },
    pattern: { bg: "#142524", border: "#0f766e", text: "#5eead4" },
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gap: "14px",
        height: "560px",
      }}
    >
      {/* SVG Graph Canvas */}
      <div
        className="cf-panel"
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Graph Header / HUD */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "12px",
            right: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            className="cf-code"
            style={{
              padding: "3px 8px",
              backgroundColor: "rgba(9, 13, 20, 0.85)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "2px",
              fontSize: "10px",
              color: "var(--text-muted)",
              backdropFilter: "blur(4px)",
            }}
          >
            ONTOLOGY · {nodes.length} ENTITIES · {edges.length} RELATIONS
          </div>

          <button
            onClick={() => setSelectedNodeId("coworker-devbot")}
            className="cf-btn-secondary"
            style={{
              pointerEvents: "auto",
              padding: "2px 8px",
              fontSize: "10px",
            }}
          >
            Center DevBot
          </button>
        </div>

        {/* SVG Drawing */}
        <svg
          viewBox="0 0 900 500"
          style={{
            width: "100%",
            height: "100%",
            userSelect: "none",
          }}
        >
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="0.5"
                strokeOpacity="0.4"
              />
            </pattern>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="16"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--border-default)" />
            </marker>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map((edge) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;

            const isConnectedToSelected =
              src.id === selectedNodeId || tgt.id === selectedNodeId;

            return (
              <g key={edge.id}>
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={
                    isConnectedToSelected
                      ? "var(--accent-emphasis)"
                      : "var(--border-subtle)"
                  }
                  strokeWidth={isConnectedToSelected ? "2" : "1"}
                  strokeDasharray={isConnectedToSelected ? undefined : "3,3"}
                  markerEnd="url(#arrow)"
                />
                <text
                  x={(src.x + tgt.x) / 2}
                  y={(src.y + tgt.y) / 2 - 4}
                  fill={isConnectedToSelected ? "var(--text-primary)" : "var(--text-muted)"}
                  fontSize="9px"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isHovered = node.id === hoveredNodeId;
            const colors = nodeColorMap[node.category] || nodeColorMap.code;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNodeId(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer halo when selected */}
                {isSelected && (
                  <circle
                    r="30"
                    fill="none"
                    stroke="var(--border-focus)"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                )}

                {/* Node Pill Background */}
                <rect
                  x="-70"
                  y="-20"
                  width="140"
                  height="40"
                  rx="4"
                  fill={colors.bg}
                  stroke={isSelected ? "var(--border-focus)" : colors.border}
                  strokeWidth={isSelected || isHovered ? "2" : "1"}
                />

                {/* Node Text */}
                <text
                  x="0"
                  y="-3"
                  fill={colors.text}
                  fontSize="11px"
                  fontFamily="var(--font-sans)"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
                <text
                  x="0"
                  y="11"
                  fill="var(--text-muted)"
                  fontSize="9px"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {node.sublabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Canvas Footer Legend */}
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface)",
            display: "flex",
            gap: "12px",
            alignItems: "center",
            fontSize: "10px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>Legend:</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "1px", backgroundColor: "#0284c7" }} />
            Coworker
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "1px", backgroundColor: "#a16207" }} />
            Human
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "1px", backgroundColor: "#15803d" }} />
            Task
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "1px", backgroundColor: "#b91c1c" }} />
            Incident
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "1px", backgroundColor: "#0f766e" }} />
            Pattern
          </span>
        </div>
      </div>

      {/* Entity Details Drawer */}
      <div className="cf-panel" style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div className="cf-panel-header">
          <div>
            <div className="cf-kicker" style={{ fontSize: "9px" }}>
              Entity Inspector
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
              {selectedNode.label}
            </div>
            <div className="cf-code" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {selectedNode.sublabel} · [{selectedNode.category}]
            </div>
          </div>
        </div>

        <div className="cf-panel-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Attributes */}
          <div>
            <div className="cf-kicker" style={{ marginBottom: "6px" }}>
              Attributes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Object.entries(selectedNode.properties).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    padding: "6px 8px",
                    backgroundColor: "var(--bg-canvas)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-xs)",
                    fontSize: "11px",
                  }}
                >
                  <div className="cf-code" style={{ color: "var(--text-muted)", fontSize: "9px" }}>
                    {key}
                  </div>
                  <div style={{ color: "var(--text-primary)", marginTop: "1px" }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connected Edges */}
          <div>
            <div className="cf-kicker" style={{ marginBottom: "6px" }}>
              Relations
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {edges
                .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                .map((edge) => {
                  const isSource = edge.source === selectedNode.id;
                  const otherId = isSource ? edge.target : edge.source;
                  const otherNode = nodes.find((n) => n.id === otherId);

                  return (
                    <button
                      key={edge.id}
                      onClick={() => setSelectedNodeId(otherId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        backgroundColor: "var(--bg-canvas)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-xs)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <div className="cf-code" style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                          {isSource ? `→ ${edge.label} →` : `← ${edge.label} ←`}
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>
                          {otherNode?.label || otherId}
                        </div>
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>›</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
