import { notFound } from "next/navigation";
import { todayIso } from "@/domain/calendar";
import { AnalyticsReport } from "@/components/analytics-report";
import { parseViewQuery } from "@/server/view-request";
import { analyticsView } from "@/server/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnalyticsReportPage({ searchParams }: { searchParams: Promise<{ year?: string; customer?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams({
    ...(params.year ? { year: params.year } : {}),
    ...(params.customer ? { customer: params.customer } : {}),
  }), todayIso());
  const data = analyticsView(query.year, query.customer);
  if (query.customer !== null && data.customer === null) notFound();
  return <AnalyticsReport data={data} />;
}