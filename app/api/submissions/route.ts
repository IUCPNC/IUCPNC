import { calculateSubmission } from "@/lib/mpc-scoring";
import { requestUser } from "@/lib/request-auth";
import { getEmployeeForUser, listOwnSubmissions, upsertSubmission } from "@/db/repository";

export async function GET(request: Request) {
  const user = requestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const employee = await getEmployeeForUser(user);
    if (!employee) return Response.json({ error: "Your email is not in the authorised employee directory. Contact People & Culture." }, { status: 403 });
    return Response.json({ employee, submissions: await listOwnSubmissions(user.userId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Your employee record could not be loaded." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const user = requestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const employee = await getEmployeeForUser(user);
    if (!employee) return Response.json({ error: "Your email is not in the authorised employee directory. Contact People & Culture." }, { status: 403 });
    const payload = await request.json();
    const calculated = calculateSubmission(payload, employee);
    const saved = await upsertSubmission(calculated, user);
    return Response.json({ submission: saved }, { status: saved.updated ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The submission could not be saved." }, { status: 400 });
  }
}
