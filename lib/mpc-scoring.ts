const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COMPONENT_WEIGHTS = { kpi: 50, values: 20, cpd: 15, social: 15 } as const;
const n = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const round = (value: number) => Math.round(value * 100) / 100;
const average = (values: unknown[]) => { const nums = values.map(n).filter((value) => value > 0); return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null; };

export type CalculatedSubmission = ReturnType<typeof calculateSubmission>;

export function calculateSubmission(payload: any, identity?: { employeeId: string; employeeName: string; email: string; position: string; department: string; appraiser: string }) {
  const selectedMonth = Math.min(11, Math.max(0, n(payload?.selectedMonth)));
  const month = payload?.months?.[selectedMonth] ?? {};
  const employee = payload?.employee ?? {};
  const kpis = Array.isArray(month.kpis) ? month.kpis : [];
  const ratedKpis = kpis.filter((k: any) => n(k?.rating) > 0 && n(k?.weight) > 0);
  const kpiWeight = kpis.reduce((sum: number, k: any) => sum + n(k?.weight), 0);
  const kpiScore = ratedKpis.length && Math.abs(kpiWeight - 100) < 0.01 ? ratedKpis.reduce((sum: number, k: any) => sum + n(k.rating) * n(k.weight) / 100, 0) : null;
  const valueRows = Object.values(month.values ?? {}) as any[];
  const valuesRating = average(valueRows.map((row) => row?.rating));
  const cpdRows = Array.isArray(month.cpd) ? month.cpd : [];
  const structuredHours = cpdRows.reduce((sum: number, row: any) => sum + n(row?.structuredHours), 0);
  const nonStructuredHours = cpdRows.reduce((sum: number, row: any) => sum + n(row?.nonStructuredHours), 0);
  const cpdHours = structuredHours + nonStructuredHours;
  const cpdRating = !cpdHours ? null : structuredHours >= 10 && nonStructuredHours >= 10 ? 5 : structuredHours >= 9 && nonStructuredHours >= 9 ? 4 : structuredHours >= 8 && nonStructuredHours >= 8 ? 3 : cpdHours >= 12 ? 2 : 1;
  const socialLinks = (Array.isArray(month.social) ? month.social : []).filter((row: any) => String(row?.link ?? "").trim()).length;
  const socialRating = !socialLinks ? null : socialLinks >= 20 ? 5 : socialLinks >= 17 ? 4 : socialLinks >= 15 ? 3 : socialLinks >= 10 ? 2 : 1;
  const missing: string[] = [];
  if (kpiScore === null) missing.push("KPI Score");
  if (valuesRating === null) missing.push("Values Rating");
  if (cpdRating === null) missing.push("CPD Rating");
  if (socialRating === null) missing.push("Social Media Rating");
  const allScores = missing.length === 0;
  const overallScore = allScores ? round(kpiScore! * .5 + valuesRating! * .2 + cpdRating! * .15 + socialRating! * .15) : null;
  const performanceBand = overallScore === null ? "Not Available" : overallScore >= 4.5 ? "Excellent" : overallScore >= 3.75 ? "Commendable" : overallScore >= 3 ? "Average" : overallScore >= 2 ? "Below Average" : "Unsatisfactory";
  const employeeAcknowledgment = String(month?.ack?.employee ?? "Not Yet Acknowledged");
  const appraiserConfirmation = String(month?.ack?.appraiser ?? "Pending");
  const employeeAcknowledged = employeeAcknowledgment === "Acknowledged";
  const checkInStatus = allScores && employeeAcknowledged && appraiserConfirmation === "Confirmed" ? "Completed" : ratedKpis.length || valuesRating || cpdRating || socialRating || employeeAcknowledged ? "Pending" : "Not Started";
  const employeeId = String(identity?.employeeId ?? employee.id ?? "").trim();
  const employeeEmail = String(identity?.email ?? employee.email ?? "").trim().toLowerCase();
  const employeeName = String(identity?.employeeName ?? employee.name ?? "").trim();
  const reportingYear = Math.trunc(n(employee.year));
  if (!employeeId || !employeeEmail || !employeeName || reportingYear < 2020 || reportingYear > 2100) throw new Error("Employee ID, name, email, and a valid reporting year are required.");
  return { employeeId, employeeEmail, employeeName, position: String(identity?.position ?? employee.position ?? "").trim(), department: String(identity?.department ?? employee.department ?? "").trim(), appraiser: String(identity?.appraiser ?? employee.appraiser ?? "").trim(), reportingYear, month: selectedMonth + 1, monthName: MONTHS[selectedMonth], kpiScore: kpiScore === null ? null : round(kpiScore), valuesRating: valuesRating === null ? null : round(valuesRating), cpdRating, socialRating, overallScore, performanceBand, checkInStatus, cpdHours: round(cpdHours), socialLinks, employeeAcknowledgment, appraiserConfirmation, missingComponents: missing.join(", "), numberMissing: missing.length, scoreBelow299: overallScore !== null && overallScore <= 2.99, socialLinksCompliant: socialLinks >= 15, employeeAcknowledged, ruleVersion: "2026.1", payloadJson: JSON.stringify({ ...payload, employee: { ...(payload.employee ?? {}), id: employeeId, email: employeeEmail, name: employeeName, position: identity?.position ?? employee.position ?? "", department: identity?.department ?? employee.department ?? "", appraiser: identity?.appraiser ?? employee.appraiser ?? "" } }) };
}
