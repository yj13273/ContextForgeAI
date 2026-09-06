import type { FastifyRequest } from "fastify";
import type { HumanEmployee, AICoworker } from "@contextforge/core";

export interface RequestIdentity {
  employee: HumanEmployee;
  coworker: AICoworker;
  organizationId: string;
}

/**
 * Default seeded developer identity for MVP local execution.
 * Clearly demarcated as development identity (not production auth).
 */
export const DEV_DEFAULT_EMPLOYEE: HumanEmployee = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Alice Engineer",
  email: "alice@acme.com",
  role: "Staff Engineer",
  organizationId: "00000000-0000-0000-0000-000000000010",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const DEV_DEFAULT_COWORKER: AICoworker = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "DevBot",
  persona: "Software Engineer",
  organizationId: "00000000-0000-0000-0000-000000000010",
  capabilities: ["github:read", "linear:read", "linear:write"],
  systemPrompt: "You are an automated engineering coworker. Analyze root causes systematically.",
  createdByHumanId: "00000000-0000-0000-0000-000000000001",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

/**
 * Resolves request identity server-side.
 * In development, reads internal service headers or defaults to seeded supervisor.
 * Client-supplied arbitrary IDs are never trusted outside development headers.
 */
export function resolveRequestIdentity(request: FastifyRequest): RequestIdentity {
  const headerOrgId = request.headers["x-organization-id"] as string | undefined;
  const headerEmpId = request.headers["x-employee-id"] as string | undefined;

  const organizationId = headerOrgId || DEV_DEFAULT_EMPLOYEE.organizationId;
  const employee: HumanEmployee = {
    ...DEV_DEFAULT_EMPLOYEE,
    id: headerEmpId || DEV_DEFAULT_EMPLOYEE.id,
    organizationId,
  };

  const coworker: AICoworker = {
    ...DEV_DEFAULT_COWORKER,
    organizationId,
    createdByHumanId: employee.id,
  };

  return { employee, coworker, organizationId };
}
