import { env } from "cloudflare:workers";
import type { CalculatedSubmission } from "@/lib/mpc-scoring";
import type { RequestUser } from "@/lib/request-auth";
import { EMPLOYEE_SEED } from "@/lib/employee-seed";

function database() {
  if (!env.DB) throw new Error("The MPC database is unavailable.");
  return env.DB;
}

let directoryReady: Promise<void> | null = null;
async function ensureEmployeeDirectory() {
  if (directoryReady) return directoryReady;
  directoryReady = (async () => {
    const db = database();
    const count = await db.prepare("SELECT COUNT(*) AS count FROM employees").first<{ count: number }>();
    if (Number(count?.count) >= EMPLOYEE_SEED.length) return;
    const statements = EMPLOYEE_SEED.map((employee) => db.prepare(`INSERT INTO employees (employee_id, email, employee_name, position, department, appraiser, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(employee_id) DO UPDATE SET email=excluded.email, employee_name=excluded.employee_name, position=excluded.position, department=excluded.department, appraiser=excluded.appraiser, active=1, updated_at=CURRENT_TIMESTAMP`).bind(employee.employeeId, employee.email, employee.employeeName, employee.position, employee.department, employee.appraiser));
    await db.batch(statements);
  })().catch((error) => { directoryReady = null; throw error; });
  return directoryReady;
}

export async function getEmployeeForUser(user: RequestUser) {
  await ensureEmployeeDirectory();
  const db = database();
  const row = await db.prepare("SELECT employee_id, account_user_id, email, employee_name, position, department, appraiser, active FROM employees WHERE lower(email) = lower(?)").bind(user.email).first<Record<string, any>>();
  if (!row || !Number(row.active)) return null;
  if (row.account_user_id && row.account_user_id !== user.userId) throw new Error("This employee record is already linked to another account. Contact People & Culture.");
  if (!row.account_user_id) await db.prepare("UPDATE employees SET account_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND account_user_id IS NULL").bind(user.userId, row.employee_id).run();
  return { employeeId: String(row.employee_id), employeeName: String(row.employee_name), email: String(row.email), position: String(row.position ?? ""), department: String(row.department ?? ""), appraiser: String(row.appraiser ?? "") };
}

export async function upsertSubmission(record: CalculatedSubmission, actor: RequestUser) {
  const db = database();
  const existing = await db.prepare("SELECT id FROM mpc_submissions WHERE employee_id = ? AND reporting_year = ? AND month = ?").bind(record.employeeId, record.reportingYear, record.month).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const values = [id, actor.userId, actor.email, record.employeeId, record.employeeName, record.employeeEmail, record.position, record.department, record.appraiser, record.reportingYear, record.month, record.kpiScore, record.valuesRating, record.cpdRating, record.socialRating, record.overallScore, record.performanceBand, record.checkInStatus, record.cpdHours, record.socialLinks, record.employeeAcknowledgment, record.appraiserConfirmation, record.missingComponents, record.numberMissing, record.scoreBelow299 ? 1 : 0, record.socialLinksCompliant ? 1 : 0, record.employeeAcknowledged ? 1 : 0, record.ruleVersion, record.payloadJson, now, now];
  await db.batch([
    db.prepare(`INSERT INTO mpc_submissions (id, authenticated_user_id, authenticated_email, employee_id, employee_name, employee_email, position, department, appraiser, reporting_year, month, kpi_score, values_rating, cpd_rating, social_rating, overall_score, performance_band, check_in_status, cpd_hours, social_links, employee_acknowledgment, appraiser_confirmation, missing_components, number_missing, score_below_299, social_links_compliant, employee_acknowledged, rule_version, payload_json, updated_at, submitted_at)
      VALUES (${values.map(() => "?").join(",")})
      ON CONFLICT(employee_id, reporting_year, month) DO UPDATE SET authenticated_user_id=excluded.authenticated_user_id, authenticated_email=excluded.authenticated_email, employee_name=excluded.employee_name, employee_email=excluded.employee_email, position=excluded.position, department=excluded.department, appraiser=excluded.appraiser, kpi_score=excluded.kpi_score, values_rating=excluded.values_rating, cpd_rating=excluded.cpd_rating, social_rating=excluded.social_rating, overall_score=excluded.overall_score, performance_band=excluded.performance_band, check_in_status=excluded.check_in_status, cpd_hours=excluded.cpd_hours, social_links=excluded.social_links, employee_acknowledgment=excluded.employee_acknowledgment, appraiser_confirmation=excluded.appraiser_confirmation, missing_components=excluded.missing_components, number_missing=excluded.number_missing, score_below_299=excluded.score_below_299, social_links_compliant=excluded.social_links_compliant, employee_acknowledged=excluded.employee_acknowledged, rule_version=excluded.rule_version, payload_json=excluded.payload_json, updated_at=excluded.updated_at, submitted_at=excluded.submitted_at`).bind(...values),
    db.prepare("INSERT INTO mpc_submission_events (id, submission_id, actor_user_id, actor_email, event_type, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, actor.userId, actor.email, existing ? "updated" : "created", JSON.stringify({ ...record, payloadJson: undefined }), now),
  ]);
  return { id, updated: Boolean(existing), submittedAt: now, summary: { ...record, payloadJson: undefined } };
}

export async function listOwnSubmissions(userId: string) {
  return (await database().prepare("SELECT id, employee_id, employee_name, reporting_year, month, overall_score, performance_band, check_in_status, payload_json, updated_at, submitted_at FROM mpc_submissions WHERE authenticated_user_id = ? ORDER BY reporting_year DESC, month DESC").bind(userId).all()).results;
}

export async function listDashboardRecords() {
  return (await database().prepare("SELECT id, employee_id, employee_name, employee_email, position, department, appraiser, reporting_year, month, kpi_score, values_rating, cpd_rating, social_rating, overall_score, performance_band, check_in_status, cpd_hours, social_links, employee_acknowledgment, appraiser_confirmation, missing_components, number_missing, score_below_299, social_links_compliant, employee_acknowledged, rule_version, updated_at, submitted_at FROM mpc_submissions ORDER BY reporting_year DESC, month DESC, employee_name ASC LIMIT 5000").all()).results;
}

export async function listProcessingEvents() {
  return (await database().prepare("SELECT e.id, e.submission_id, e.actor_email, e.event_type, e.created_at, s.employee_id, s.employee_name, s.reporting_year, s.month FROM mpc_submission_events e JOIN mpc_submissions s ON s.id = e.submission_id ORDER BY e.created_at DESC LIMIT 250").all()).results;
}
