import type {
  Reasoner,
  ReasoningResult,
  FinalReasoningResult,
  ToolCallReasoningResult,
} from "../domain/reasoner.js";
import type { Task } from "../domain/task.js";
import type { AICoworker } from "../domain/entities.js";
import type { ContextBundle, Context } from "../domain/context.js";
import type { ToolResult } from "../domain/tools.js";
import type {
  LLMProvider,
  LLMMessage,
  LLMRequest,
  LLMToolDefinition,
} from "../domain/llm.js";

export class LLMReasoner implements Reasoner {
  constructor(private readonly llm: LLMProvider) {}

  async reason(
    taskOrContext: Task | Context,
    coworker?: AICoworker,
    contextBundle?: ContextBundle,
    previousToolResult?: ToolResult
  ): Promise<ReasoningResult> {
    // 1. Resolve normalized Context
    let context: Context;

    if ("employee" in taskOrContext && "coworker" in taskOrContext && "task" in taskOrContext) {
      context = taskOrContext;
    } else {
      // Legacy fallback: convert Task + Coworker + ContextBundle to Context
      const task = taskOrContext as Task;
      const cw = coworker!;
      const bundle = contextBundle;

      context = {
        employee: {
          id: task.createdByHumanId,
          name: "Supervisor",
          email: "supervisor@acme.com",
          role: "Engineer",
        },
        organization: {
          id: task.organizationId,
          name: "Organization",
          slug: "org",
        },
        role: {
          name: "Engineer",
          permissions: ["task:read", "task:execute"],
        },
        coworker: {
          id: cw.id,
          name: cw.name,
          persona: cw.persona,
          capabilities: cw.capabilities,
          systemPrompt: cw.systemPrompt,
        },
        memories: (bundle?.artifacts ?? [])
          .filter((a) => a.source === "memory")
          .map((a) => ({
            id: a.id,
            organizationId: task.organizationId,
            type: "fact" as const,
            title: a.title,
            content: a.content,
            sourceType: "memory",
            importance: 3,
            confidence: 1.0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        knowledge: (bundle?.artifacts ?? [])
          .filter((a) => a.source === "documentation")
          .map((a) => ({
            id: a.id,
            organizationId: task.organizationId,
            title: a.title,
            content: a.content,
            category: "documentation" as const,
            tags: [],
            createdAt: new Date(),
          })),
        conversation: {
          taskId: task.id,
          steps: [],
        },
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          workflow: task.workflow,
          status: task.status,
        },
        tools: [],
        permissions: {
          allowedToolNames: [],
          requiresApprovalToolNames: [],
        },
      };
    }

    // 2. Construct LLM Request Messages
    const systemPromptParts: string[] = [
      `You are ${context.coworker.name}, an AI coworker with persona "${context.coworker.persona}".`,
      context.coworker.systemPrompt,
      "",
      `Organization: ${context.organization.name}`,
      `Assigned Employee: ${context.employee.name} (${context.employee.email})`,
      "",
      "IMPORTANT RULES:",
      "1. You are a reasoning component. You do NOT execute tools directly.",
      "2. If an action is required, request the appropriate tool call.",
      "3. Read tools run automatically. Write tools strictly require human employee approval.",
      "4. Do not invent or assume tools not available in your tool definition list.",
    ];

    if (context.memories.length > 0) {
      systemPromptParts.push("", "Relevant Organizational Memories from Past Work:");
      for (const m of context.memories) {
        systemPromptParts.push(`- [${m.type.toUpperCase()}] ${m.title}: ${m.content}`);
      }
    }

    if (context.knowledge.length > 0) {
      systemPromptParts.push("", "Relevant Organizational Documentation:");
      for (const k of context.knowledge) {
        systemPromptParts.push(`- [${k.category.toUpperCase()}] ${k.title}: ${k.content}`);
      }
    }

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: systemPromptParts.join("\n"),
      },
      {
        role: "user",
        content: `Task: ${context.task.title}\nDescription: ${context.task.description}${
          previousToolResult
            ? `\n\nPrevious Tool Execution Result:\nSuccess: ${previousToolResult.success}\nData: ${JSON.stringify(previousToolResult.data)}\nError: ${previousToolResult.error || "None"}`
            : ""
        }`,
      },
    ];

    // Build available tool definitions
    const toolDefs: LLMToolDefinition[] = context.tools
      .filter((t) => context.permissions.allowedToolNames.includes(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "object",
          properties: {},
        },
      }));

    const llmRequest: LLMRequest = {
      messages,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      temperature: 0.2,
    };

    // 3. Prompt LLM
    const llmResponse = await this.llm.generate(llmRequest);

    // 4. Handle Tool Call from LLM
    if (llmResponse.toolCall) {
      const { name, input } = llmResponse.toolCall;

      const toolResult: ToolCallReasoningResult = {
        type: "tool_call",
        toolName: name,
        input,
        reasoning: llmResponse.content || `Requesting tool '${name}' execution.`,
        analysis: llmResponse.content || `Requesting tool '${name}' execution.`,
        recommendations: [],
        isComplete: false,
        summary: `Requesting tool execution: ${name}`,
        toolIntent: {
          toolName: name,
          action: name,
          parameters: input,
        },
      };

      return toolResult;
    }

    // Check if response content contains embedded JSON tool call (for models without native tool call API)
    const content = llmResponse.content.trim();
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.toolName || parsed.tool) {
          const toolName = parsed.toolName || parsed.tool;
          const input = parsed.input || parsed.parameters || {};

          const toolResult: ToolCallReasoningResult = {
            type: "tool_call",
            toolName,
            input,
            reasoning: parsed.reasoning || `Requesting tool '${toolName}' execution.`,
            analysis: parsed.reasoning || `Requesting tool '${toolName}' execution.`,
            recommendations: [],
            isComplete: false,
            summary: `Requesting tool execution: ${toolName}`,
            toolIntent: {
              toolName,
              action: toolName,
              parameters: input,
            },
          };
          return toolResult;
        }
      } catch {
        // Not JSON, treat as text
      }
    }

    // 5. Final Answer
    const finalResult: FinalReasoningResult = {
      type: "final",
      content: llmResponse.content,
      reasoning: llmResponse.content,
      analysis: llmResponse.content,
      recommendations: [],
      isComplete: true,
      summary: llmResponse.content,
      toolIntent: undefined,
    };

    return finalResult;
  }
}
