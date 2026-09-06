import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from "../domain/llm.js";

export class FakeLLMProvider implements LLMProvider {
  readonly providerName = "fake";
  private responseQueue: LLMResponse[] = [];
  private fixedResponse: LLMResponse | null = null;
  private receivedRequests: LLMRequest[] = [];

  constructor(initialResponses?: LLMResponse[]) {
    if (initialResponses) {
      this.responseQueue.push(...initialResponses);
    }
  }

  enqueueResponse(response: LLMResponse): void {
    this.responseQueue.push(response);
  }

  setFixedResponse(response: LLMResponse | null): void {
    this.fixedResponse = response;
  }

  getReceivedRequests(): readonly LLMRequest[] {
    return [...this.receivedRequests];
  }

  clearReceivedRequests(): void {
    this.receivedRequests = [];
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.receivedRequests.push(request);

    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!;
    }

    if (this.fixedResponse) {
      return this.fixedResponse;
    }

    // Default fallback response
    const lastUserMsg = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");

    const userText = lastUserMsg?.content || "";

    return {
      content: `Deterministic response for: ${userText.slice(0, 100)}`,
      usage: {
        promptTokens: 50,
        completionTokens: 20,
        totalTokens: 70,
      },
    };
  }
}
