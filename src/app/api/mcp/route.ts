import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { enabledTools, runTool } from "@/server/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION = "1.0.0";

function buildServer() {
  const server = new McpServer({ name: "managr", version: VERSION }, { capabilities: { tools: {} } });
  for (const tool of enabledTools()) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema.shape },
      async (input) => {
        const result = await runTool(tool.name, input);
        if (!result.ok) {
          return { isError: true, content: [{ type: "text", text: result.error }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      },
    );
  }
  return server;
}

/** Stateless Streamable HTTP: every POST is its own session, answered with JSON. */
export async function POST(request: Request) {
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return response;
}

function methodNotAllowed(allow: string) {
  return new Response("This MCP endpoint accepts POST from a local client.", {
    status: 405,
    headers: { Allow: allow, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function GET() {
  return methodNotAllowed("POST");
}

export function DELETE() {
  return methodNotAllowed("POST");
}