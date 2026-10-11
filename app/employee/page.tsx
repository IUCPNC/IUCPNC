import { requireChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function EmployeePortal() {
  await requireChatGPTUser("/employee");
  return <iframe className="employee-workspace-frame" src="/mpc/" title="My IUC Monthly Performance Check-In" />;
}
