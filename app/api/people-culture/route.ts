import { listDashboardRecords, listProcessingEvents } from "@/db/repository";
import { isPeopleCulture, requestUser } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = requestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isPeopleCulture(user.email)) return Response.json({ error: "People & Culture access has not been granted to this account." }, { status: 403 });
  const [records, events] = await Promise.all([listDashboardRecords(), listProcessingEvents()]);
  return Response.json({ records, events, refreshedAt: new Date().toISOString(), ruleVersion: "2026.1" });
}
