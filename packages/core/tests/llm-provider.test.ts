import { describe, it, expect, vi } from "vitest";
import { FakeLLMProvider } from "../src/llm/fake-llm-provider.js";
import { ConfigurableLLMProvider } from "../src/llm/configurable-llm-provider.js";

describe("Milestone 5: Vendor-Neutral LLM Provider (Unit)", () => {
  it("FakeLLMProvider should record requests and return queued responses", async () => {
    const fake = new FakeLLMProvider([
      {
        content: "First response",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
      {
        content: "Second response with tool call",
        toolCall: {
          name: "github:get_issue",
          input: { owner: "acme", repo: "backend", issueNumber: 42 },
        },
      },
    ]);

    expect(fake.providerName).toBe("fake");

    // Request 1
    const res1 = await fake.generate({
      messages: [{ role: "user", content: "Hello model" }],
    });
    expect(res1.content).toBe("First response");
    expect(res1.toolCall).toBeUndefined();

    // Request 2
    const res2 = await fake.generate({
      messages: [{ role: "user", content: "Please fetch issue 42" }],
      tools: [
        {
          name: "github:get_issue",
          description: "Get issue",
          parameters: {},
        },
      ],
    });
    expect(res2.toolCall?.name).toBe("github:get_issue");
    expect(res2.toolCall?.input).toEqual({ owner: "acme", repo: "backend", issueNumber: 42 });

    // Verify received requests
    const requests = fake.getReceivedRequests();
    expect(requests.length).toBe(2);
    expect(requests[0].messages[0].content).toBe("Hello model");
    expect(requests[1].tools?.length).toBe(1);
  });

  it("ConfigurableLLMProvider should generate chat completions with native fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl_123",
          choices: [
            {
              message: {
                role: "assistant",
                content: "Investigation analysis completed.",
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "linear:get_issue",
                      arguments: JSON.stringify({ issueId: "ENG-101" }),
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 35,
            total_tokens: 155,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const provider = new ConfigurableLLMProvider({
      apiKey: "test-sk-12345",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      providerName: "test-openai",
      fetchFn: mockFetch as typeof fetch,
    });

    expect(provider.providerName).toBe("test-openai");

    const response = await provider.generate({
      messages: [
        { role: "system", content: "You are an engineering coworker." },
        { role: "user", content: "Check ticket ENG-101" },
      ],
      tools: [
        {
          name: "linear:get_issue",
          description: "Get Linear issue",
          parameters: { type: "object" },
        },
      ],
    });

    expect(response.content).toBe("Investigation analysis completed.");
    expect(response.toolCall).toBeDefined();
    expect(response.toolCall?.name).toBe("linear:get_issue");
    expect(response.toolCall?.input).toEqual({ issueId: "ENG-101" });
    expect(response.usage?.totalTokens).toBe(155);

    // Verify fetch call headers & body
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(options.headers["Authorization"]).toBe("Bearer test-sk-12345");
  });

  it("ConfigurableLLMProvider should sanitize errors and avoid leaking API keys", async () => {
    const mockErrorFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response("Invalid token Bearer test-sk-super-secret-key-9999", {
          status: 401,
          statusText: "Unauthorized",
        })
      )
    );

    const provider = new ConfigurableLLMProvider({
      apiKey: "test-sk-super-secret-key-9999",
      baseUrl: "https://api.openai.com/v1",
      fetchFn: mockErrorFetch as typeof fetch,
    });

    await expect(
      provider.generate({
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("LLMProvider HTTP error (401)");

    try {
      await provider.generate({ messages: [{ role: "user", content: "Hello" }] });
    } catch (err: any) {
      expect(err.message).not.toContain("test-sk-super-secret-key-9999");
      expect(err.message).toContain("Bearer [REDACTED]");
    }
  });
});
