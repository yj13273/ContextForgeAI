"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  category: "Navigation" | "Action";
  title: string;
  description?: string;
  href?: string;
  shortcut?: string;
  action?: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = [
    {
      id: "nav-home",
      category: "Navigation",
      title: "Home",
      description: "Overview of your coworker and recent work",
      href: "/",
      shortcut: "G H",
    },
    {
      id: "nav-coworker",
      category: "Navigation",
      title: "Coworker Workspace",
      description: "Collaborate directly with DevBot on tasks",
      href: "/coworker",
      shortcut: "G C",
    },
    {
      id: "nav-tasks",
      category: "Navigation",
      title: "Tasks Directory",
      description: "View all running, approved, and completed investigations",
      href: "/tasks",
      shortcut: "G T",
    },
    {
      id: "nav-memory",
      category: "Navigation",
      title: "Organizational Memory",
      description: "Search what DevBot has learned and preserved",
      href: "/memory",
      shortcut: "G M",
    },
    {
      id: "nav-knowledge",
      category: "Navigation",
      title: "Knowledge Base",
      description: "Organization-provided architecture specs and runbooks",
      href: "/knowledge",
      shortcut: "G K",
    },
    {
      id: "nav-activity",
      category: "Navigation",
      title: "Activity Audit Stream",
      description: "Chronological trace of coworker actions and approvals",
      href: "/activity",
      shortcut: "G A",
    },
    {
      id: "nav-settings",
      category: "Navigation",
      title: "Settings & Identities",
      description: "Manage employee profile and coworker permissions",
      href: "/settings",
      shortcut: "G S",
    },
    {
      id: "act-investigate",
      category: "Action",
      title: "Investigate an Issue...",
      description: "Start a new root-cause analysis with DevBot",
      href: "/coworker?action=new",
      shortcut: "↵",
    },
    {
      id: "act-approvals",
      category: "Action",
      title: "View Pending Approvals",
      description: "Inspect actions awaiting human sign-off",
      href: "/tasks?filter=AWAITING_APPROVAL",
      shortcut: "↵",
    },
  ];

  const filteredItems = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q));
  });

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          executeItem(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems]);

  function executeItem(item: CommandItem) {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(5, 8, 14, 0.75)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "10px",
          }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: "14px", fontFamily: "var(--font-mono)" }}>
            ⌘
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search or jump to workspace..."
            style={{
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              padding: 0,
              fontSize: "14px",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <kbd
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              backgroundColor: "var(--bg-subtle)",
              padding: "2px 6px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* List of results */}
        <div style={{ maxHeight: "340px", overflowY: "auto", padding: "6px" }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No matches found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--bg-subtle)" : "transparent",
                    borderLeft: isSelected ? "2px solid var(--border-focus)" : "2px solid transparent",
                    transition: "background-color 0.1s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                  {item.shortcut && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "var(--bg-canvas)",
                        padding: "2px 5px",
                        borderRadius: "var(--radius-xs)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-canvas)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>Use ↑ ↓ to navigate</span>
          <span>↵ to select</span>
        </div>
      </div>
    </div>
  );
}
