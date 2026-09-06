import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "../src/lib/api.js";

describe("Web UI: ApiClient (Unit)", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://localhost:3000");
  });

  it("listTasks handles API responses correctly", async () => {
    const mockTasks = [
      { id: "task_1", title: "Investigate ENG-142", status: "COMPLETED" },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: mockTasks }),
    } as Response);

    const result = await client.listTasks(10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task_1");
  });

  it("approveTask invokes /tasks/:id/approve with decisionNote", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "COMPLETED" }),
    } as Response);
    globalThis.fetch = mockFetch;

    const result = await client.approveTask("task_1", "Looks good to me");
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/tasks/task_1/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decisionNote: "Looks good to me" }),
      })
    );
  });

  it("rejectTask invokes /tasks/:id/reject with decisionNote", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "REJECTED" }),
    } as Response);
    globalThis.fetch = mockFetch;

    const result = await client.rejectTask("task_1", "Need more information");
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/tasks/task_1/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decisionNote: "Need more information" }),
      })
    );
  });
});
