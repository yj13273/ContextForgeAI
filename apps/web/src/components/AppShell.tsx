"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-canvas)" }}>
      {/* Sidebar */}
      <Sidebar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Workspace Column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowX: "hidden" }}>
        {/* Top Operational Status Bar */}
        <header
          style={{
            height: "48px",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-canvas)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 40,
          }}
        >
          {/* Left: Mobile Nav Toggle & Breadcrumb / Coworker status */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              style={{
                display: "none",
                fontSize: "14px",
                color: "var(--text-secondary)",
                padding: "4px 8px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
              }}
              className="mobile-toggle"
            >
              ☰
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>DevBot</span>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--state-running)" }} />
                <span>Ready for work</span>
              </span>
            </div>
          </div>

          {/* Right: Environment & Quick Search */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-surface)",
                padding: "2px 8px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              API: 3001
            </div>

            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "var(--text-muted)",
                padding: "3px 8px",
                backgroundColor: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
              }}
            >
              <span>Search</span>
              <kbd style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main style={{ flex: 1, padding: "28px 32px", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>

      {/* Global Command Palette Overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Mobile Responsive Style Hook */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-toggle {
            display: inline-flex !important;
          }
          .app-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: -240px;
            transition: transform 0.2s ease;
          }
          .app-sidebar.mobile-open {
            transform: translateX(240px);
          }
        }
      `}</style>
    </div>
  );
}
