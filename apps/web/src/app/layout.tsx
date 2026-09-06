import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { DemoProvider } from "../lib/demo-context";

export const metadata: Metadata = {
  title: "ContextForge AI — AI Coworker Platform",
  description: "Your software-engineering coworker that knows how you work. Grounded context, structured reasoning, and approval-gated write operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DemoProvider>
          <AppShell>{children}</AppShell>
        </DemoProvider>
      </body>
    </html>
  );
}

