import { requireChatGPTUser } from "@/app/chatgpt-auth";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function PeopleCulturePage() {
  const user = await requireChatGPTUser("/people-culture");
  return <Dashboard signedInAs={user.email} />;
}
