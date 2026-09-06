"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../lib/api";
import { useDemo } from "../lib/demo-context";
import { SUPERVISOR_INFO, ORGANIZATION_INFO } from "../lib/mock-data";

export interface SidebarProps {
  onOpenCommandPalette?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ onOpenCommandPalette, isOpenMobile, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { isAwaitingApproval } = useDemo();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    async function checkApprovals() {
      try {
        const approvals = await api.listApprovals();
        setPendingApprovalsCount(approvals.length);
      } catch {
        setPendingApprovalsCount(0);
      }
    }
    checkApprovals();
    const interval = setInterval(checkApprovals, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalApprovals = pendingApprovalsCount + (isAwaitingApproval ? 1 : 0);

  const navItems = [
    { label: "Home", href: "/", key: "home" },
    { label: "Coworker", href: "/coworker", key: "coworker" },
    { label: "Tasks", href: "/tasks", key: "tasks", badge: totalApprovals > 0 ? totalApprovals : null },
    { label: "Memory", href: "/memory", key: "memory" },
    { label: "Knowledge", href: "/knowledge", key: "knowledge" },
    { label: "Activity", href: "/activity", key: "activity" },
    { label: "Settings", href: "/settings", key: "settings" },
  ];

  return (
    <aside
      style={{
        width: "230px",
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100vh",
        zIndex: 50,
      }}
      className={`app-sidebar ${isOpenMobile ? "mobile-open" : ""}`}
    >
      {/* Brand & DevBot Identity */}
      <div>
        <div
          style={{
            padding: "16px 14px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--accent-emphasis)",
                flexShrink: 0,
              }}
            >
              CF
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                ContextForge AI
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "1px" }}>
                DevBot <span style={{ color: "var(--text-muted)" }}>· AI Coworker</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Search Shortcut Trigger */}
        <div style={{ padding: "10px 10px 6px 10px" }}>
          <button
            onClick={onOpenCommandPalette}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              color: "var(--text-muted)",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <span>Quick search...</span>
            <kbd
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-subtle)",
                padding: "1px 4px",
                borderRadius: "2px",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Primary Navigation (7 items) */}
        <nav style={{ padding: "8px 8px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
              padding: "4px 8px 6px 8px",
            }}
          >
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onCloseMobile}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 9px",
                  margin: "1px 0",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: isActive ? "var(--bg-subtle)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--border-focus)" : "2px solid transparent",
                  transition: "background-color 0.1s ease, color 0.1s ease",
                }}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      backgroundColor: "var(--state-approval-bg)",
                      color: "var(--state-approval)",
                      border: "1px solid var(--state-approval-border)",
                      padding: "1px 5px",
                      borderRadius: "var(--radius-xs)",
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer: Human Supervisor & Tenant Boundary */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 8px",
            backgroundColor: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--state-success)",
              flexShrink: 0,
            }}
          />
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {SUPERVISOR_INFO.name}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Staff Eng · {ORGANIZATION_INFO.name}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
