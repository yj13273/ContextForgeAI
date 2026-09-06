import type { ToolResult } from "@contextforge/core";

export interface IdempotencyService {
  get(key: string): ToolResult | undefined;
  set(key: string, result: ToolResult): void;
}

export class InMemoryIdempotencyService implements IdempotencyService {
  private cache = new Map<string, ToolResult>();

  get(key: string): ToolResult | undefined {
    return this.cache.get(key);
  }

  set(key: string, result: ToolResult): void {
    this.cache.set(key, result);
  }

  clear(): void {
    this.cache.clear();
  }
}
