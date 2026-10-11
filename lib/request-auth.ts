export type RequestUser = { userId: string; email: string; fullName: string | null };

export function requestUser(request: Request): RequestUser | null {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!userId || !email) return null;
  const rawName = request.headers.get("oai-authenticated-user-full-name");
  let fullName: string | null = rawName;
  if (rawName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { fullName = decodeURIComponent(rawName); } catch { fullName = null; }
  }
  return { userId, email: email.toLowerCase(), fullName };
}

export function isPeopleCulture(email: string) {
  const allow = (env.PC_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
import { env } from "cloudflare:workers";
