import { z } from "zod";
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from "../domain/llm.js";

export const ConfigurableLLMOptionsSchema = z.object({
  apiKey: z.string().default(""),
  baseUrl: z.string().url().default("https://api.openai.com/v1"),
  model: z.string().default("gpt-4o-mini"),
  providerName: z.string().default("openai-compatible"),
});

export type ConfigurableLLMOptions = z.infer<typeof ConfigurableLLMOptionsSchema> & {
  fetchFn?: typeof fetch;
};

/**
 * Sanitizes strings to prevent credential leaks in logs and traces.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return "";
  return msg
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(token=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(key=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(apiKey=)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]");
}

/**
 * Vendor-neutral production LLM provider abstraction.
 * Interacts with OpenAI/GLM/vLLM/Ollama compatible endpoints via standard HTTP.
 */
export class ConfigurableLLMProvider implements LLMProvider {
  readonly providerName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: Partial<ConfigurableLLMOptions> = {}) {
    const validated = ConfigurableLLMOptionsSchema.parse({
      apiKey: options.apiKey ?? process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
      baseUrl: options.baseUrl ?? process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: options.model ?? process.env.LLM_MODEL ?? "gpt-4o-mini",
      providerName: options.providerName ?? "openai-compatible",
    });

    this.providerName = validated.providerName;
    this.apiKey = validated.apiKey;
    this.baseUrl = validated.baseUrl.replace(/\/$/, "");
    this.model = validated.model;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const payload: Record<string, unknown> = {
      model: this.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.temperature !== undefined) {
      payload.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      payload.max_tokens = request.maxTokens;
    }

    if (request.tools && request.tools.length > 0) {
      payload.tools = request.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const endpoint = `${this.baseUrl}/chat/completions`;

    let response: Response;
    try {
      response = await this.fetchFn(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`LLMProvider network error: ${sanitizeErrorMessage(msg)}`);
    }

    if (!response.ok) {
      let errBody = "";
      try {
        errBody = await response.text();
      } catch {
        // ignore
      }
      throw new Error(
        `LLMProvider HTTP error (${response.status}): ${sanitizeErrorMessage(errBody || response.statusText)}`
      );
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new Error("LLMProvider returned invalid JSON response.");
    }

    const choice = json.choices?.[0];
    if (!choice || !choice.message) {
      throw new Error("LLMProvider returned response with no choices.");
    }

    const message = choice.message;
    const content = message.content ?? "";

    let toolCall: { name: string; input: Record<string, unknown> } | undefined = undefined;

    if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      const firstCall = message.tool_calls[0];
      const fnName = firstCall.function?.name ?? "";
      let fnArgs: Record<string, unknown> = {};
      try {
        fnArgs = JSON.parse(firstCall.function?.arguments || "{}");
      } catch {
        fnArgs = {};
      }
      toolCall = {
        name: fnName,
        input: fnArgs,
      };
    }

    const usage = json.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
          totalTokens: json.usage.total_tokens ?? 0,
        }
      : undefined;

    return {
      content,
      toolCall,
      usage,
    };
  }
}
