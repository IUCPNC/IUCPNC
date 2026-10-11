import { getEmployeeForUser } from "@/db/repository";
import { requestUser } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = requestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const employee = await getEmployeeForUser(user);
    if (!employee) return Response.json({ error: "Your email is not in the authorised employee directory. Contact People & Culture." }, { status: 403 });
    return Response.json({ user: { email: user.email, fullName: user.fullName }, employee });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Your employee record could not be loaded." }, { status: 403 });
  }
}
