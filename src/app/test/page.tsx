import type { Metadata } from "next";
import { AssistantTestScreen } from "@/components/screens/assistant-test-screen";

export const metadata: Metadata = {
  title: "UI-Test",
  robots: { index: false, follow: false },
};

export default function AssistantTestPage() {
  return <AssistantTestScreen />;
}