import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const ToolsConfigSchema = z.object({
  GITHUB_TOKEN: z.string().default(""),
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  LINEAR_API_KEY: z.string().default(""),
  LINEAR_API_URL: z.string().url().default("https://api.linear.app/graphql"),
});

export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

export function loadToolsConfig(overrides?: Partial<Record<keyof ToolsConfig, string>>): ToolsConfig {
  const env = {
    GITHUB_TOKEN: overrides?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? "",
    GITHUB_API_URL: overrides?.GITHUB_API_URL ?? process.env.GITHUB_API_URL ?? "https://api.github.com",
    LINEAR_API_KEY: overrides?.LINEAR_API_KEY ?? process.env.LINEAR_API_KEY ?? "",
    LINEAR_API_URL: overrides?.LINEAR_API_URL ?? process.env.LINEAR_API_URL ?? "https://api.linear.app/graphql",
  };
  return ToolsConfigSchema.parse(env);
}
