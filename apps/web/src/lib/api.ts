export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  status: "CREATED" | "GATHERING_CONTEXT" | "REASONING" | "AWAITING_APPROVAL" | "EXECUTING_ACTION" | "COMPLETED" | "REJECTED" | "FAILED";
  workflow: string;
  activeApprovalId?: string;
  resultSummary?: string;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStep {
  id?: string;
  stepIndex: number;
  stepType: "context" | "reasoning" | "tool_call" | "tool_result" | "approval" | "final" | "error";
  status: "success" | "pending" | "failed";
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  createdAt?: string;
}

export interface TaskDetailResponse {
  task: TaskSummary;
  auditEvents: Array<{
    id: string;
    timestamp: string;
    actorType: string;
    actorId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }>;
  steps: TaskStep[];
}

export interface ApprovalItem {
  id: string;
  taskId: string;
  organizationId: string;
  status: "pending" | "approved" | "rejected";
  toolCall: {
    toolName: string;
    action: string;
    parameters: Record<string, unknown>;
  };
  createdAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async listTasks(limit = 20): Promise<TaskSummary[]> {
    try {
      const res = await fetch(`${this.baseUrl}/tasks?limit=${limit}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.tasks || [];
    } catch {
      return [];
    }
  }

  async getTask(id: string): Promise<TaskDetailResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/tasks/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async createTask(params: {
    issueKey?: string;
    title?: string;
    description?: string;
  }): Promise<{ success: boolean; task?: TaskSummary; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error || "Failed to create task." };
      }
      return { success: true, task: data.task };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async listApprovals(): Promise<ApprovalItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/approvals`, {
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.approvals || [];
    } catch {
      return [];
    }
  }

  async approveTask(
    taskId: string,
    decisionNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/tasks/${taskId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error || "Approval failed." };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async rejectTask(
    taskId: string,
    decisionNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/tasks/${taskId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error || "Rejection failed." };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

export const api = new ApiClient();
