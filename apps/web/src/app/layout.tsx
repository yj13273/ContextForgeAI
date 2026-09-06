import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextForge AI - Engineering Coworker",
  description: "AI Coworker with organizational context, memory, and approval-gated tool execution.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* Global Header */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 2rem",
              backgroundColor: "#1e293b",
              borderBottom: "1px solid #334155",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: "#ffffff",
                  fontSize: "1.1rem",
                }}
              >
                CF
              </div>
              <div>
                <h1 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                  ContextForge AI
                </h1>
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                  Engineering Coworker Platform
                </p>
              </div>
            </div>

            {/* Authenticated Human Employee & AI Coworker Badges */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                  }}
                />
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f8fafc" }}>
                    Alice Engineer
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Staff Engineer (Acme Corp)
                  </div>
                </div>
              </div>

              <div
                style={{
                  height: "28px",
                  width: "1px",
                  backgroundColor: "#334155",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.4rem 0.8rem",
                  backgroundColor: "#0f172a",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                }}
              >
                <span style={{ fontSize: "1rem" }}>🤖</span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#38bdf8" }}>
                    DevBot
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    AI Coworker (Software Engineer)
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
