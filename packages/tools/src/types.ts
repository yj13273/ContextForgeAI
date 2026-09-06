import type { Tool, ToolType, ToolCallIntent, ToolResult, ToolExecutionContext } from "@contextforge/core";
import { z } from "zod";

export interface ContextForgeTool<TOutput = unknown> extends Tool {
  readonly requiredCapability: string;
  readonly inputSchema: z.ZodTypeAny;
  readonly outputSchema?: z.ZodTypeAny;
}

export type {
  Tool,
  ToolType,
  ToolCallIntent,
  ToolResult,
  ToolExecutionContext,
};
