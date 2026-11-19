import { headers } from "next/headers";
import { AssistantPageScreen } from "@/components/screens/assistant-page";
import { titled } from "@/server/locale";
import { enabledTools, needsApproval } from "@/server/tools";
import { webEnabled } from "@/server/web";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return titled("assistantPage.title");
}

export default async function AssistantPage() {
  const host = (await headers()).get("host") ?? "127.0.0.1:3000";
  const tools = enabledTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    write: needsApproval(tool.name),
  }));
  return <AssistantPageScreen web={webEnabled()} tools={tools} mcpUrl={`http://${host}/api/mcp`} />;
}