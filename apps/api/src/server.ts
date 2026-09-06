import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  PipelineOrchestrator,
  FakeContextEngine,
  FakeReasoner,
  FakeReadTool,
  FakeWriteTool,
  InMemoryAuditSink,
} from "@contextforge/core";

import { healthRoutes } from "./routes/health.js";
import { taskRoutes } from "./routes/tasks.js";
import { approvalRoutes } from "./routes/approvals.js";

export interface ServerOptions {
  orchestrator?: PipelineOrchestrator;
  auditSink?: InMemoryAuditSink;
}

export function createDefaultOrchestrator() {
  const auditSink = new InMemoryAuditSink();
  const contextEngine = new FakeContextEngine();
  const reasoner = new FakeReasoner("write_tool");
  const readTool = new FakeReadTool();
  const writeTool = new FakeWriteTool();

  const toolMap = new Map();
  toolMap.set(readTool.name, readTool);
  toolMap.set(writeTool.name, writeTool);

  const orchestrator = new PipelineOrchestrator(
    contextEngine,
    reasoner,
    toolMap,
    auditSink
  );

  return { orchestrator, auditSink };
}

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
  });

  await server.register(cors);
  await server.register(sensible);

  const { orchestrator, auditSink } = options.orchestrator
    ? { orchestrator: options.orchestrator, auditSink: options.auditSink }
    : createDefaultOrchestrator();

  await server.register(healthRoutes);
  await server.register(taskRoutes, { orchestrator, auditSink });
  await server.register(approvalRoutes, { orchestrator });

  return server;
}

// Direct execution entrypoint
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const server = await buildServer();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";

  server.listen({ port, host }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`ContextForge API server listening at ${address}`);
  });
}
