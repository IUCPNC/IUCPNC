"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
type Row = Record<string, any>;
type Tab = "status" | "actions" | "history" | "processing";
const score = (value: any) => value == null ? "—" : Number(value).toFixed(2);
const badgeClass = (value: string) => {
  const text = value.toLowerCase();
  if (text.includes("complete") || text.includes("acknowledged") || text.includes("compliant")) return "pc-badge pc-good";
  if (text.includes("pending") || text.includes("average")) return "pc-badge pc-warn";
  if (text.includes("not") || text.includes("below") || text.includes("missing")) return "pc-badge pc-bad";
  return "pc-badge";
};
function actionFor(row: Row) {
  const actions: string[] = [];
  if (row.check_in_status !== "Completed") actions.push("Complete monthly check-in");
  if (Number(row.number_missing)) actions.push("Complete missing component score(s)");
  if (!Number(row.social_links_compliant)) actions.push("Complete minimum 15 social media links");
  if (!Number(row.employee_acknowledged)) actions.push("Complete employee acknowledgment");
  return actions.join("; ") || "No action required";
}

export default function Dashboard({ signedInAs }: { signedInAs: string }) {
  const [records, setRecords] = useState<Row[]>([]), [events, setEvents] = useState<Row[]>([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [refreshedAt, setRefreshedAt] = useState("");
  const [tab, setTab] = useState<Tab>("status"), [query, setQuery] = useState(""), [year, setYear] = useState("all"), [month, setMonth] = useState("all"), [department, setDepartment] = useState("all"), [status, setStatus] = useState("all");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/people-culture", { cache: "no-store" }), body = await response.json();
      if (!response.ok) throw new Error(body.error || "Dashboard data could not be loaded.");
      setRecords(body.records || []); setEvents(body.events || []); setRefreshedAt(body.refreshedAt); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Dashboard data could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, [load]);
  const options = useMemo(() => ({ years: [...new Set(records.map((row) => String(row.reporting_year)))].sort().reverse(), departments: [...new Set(records.map((row) => String(row.department || "Unspecified")))].sort() }), [records]);
  const filtered = useMemo(() => records.filter((row) => {
    const haystack = `${row.employee_id} ${row.employee_name} ${row.employee_email} ${row.appraiser}`.toLowerCase();
    return (year === "all" || String(row.reporting_year) === year) && (month === "all" || String(row.month) === month) && (department === "all" || String(row.department || "Unspecified") === department) && (status === "all" || row.check_in_status === status) && haystack.includes(query.toLowerCase());
  }), [records, year, month, department, status, query]);
  const metrics = useMemo(() => {
    const total = filtered.length, count = (fn: (row: Row) => boolean) => filtered.filter(fn).length;
    const average = (key: string) => { const vals = filtered.map((row) => row[key]).filter((v) => v != null).map(Number).filter(Number.isFinite); return vals.length ? vals.reduce((a,b) => a+b,0) / vals.length : null; };
    const completed = count((r) => r.check_in_status === "Completed");
    return { total, completed, pending: count((r) => r.check_in_status === "Pending"), notStarted: count((r) => r.check_in_status === "Not Started"), completionRate: total ? completed / total * 100 : 0, lowScore: count((r) => Number(r.score_below_299) === 1), acknowledged: count((r) => Number(r.employee_acknowledged) === 1), kpi: count((r) => r.kpi_score != null), values: count((r) => r.values_rating != null), cpd: count((r) => r.cpd_rating != null), social: count((r) => r.social_rating != null), allFour: count((r) => Number(r.number_missing) === 0), socialCompliant: count((r) => Number(r.social_links_compliant) === 1), avgOverall: average("overall_score"), avgCpd: average("cpd_hours") };
  }, [filtered]);

  return <main className="pc-page">
    <header className="pc-topbar"><div className="pc-brand"><img src="/iuc-logo.png" alt="IUC"/><div><b>People & Culture</b><span>MPC live tracker</span></div></div><div className="pc-top-actions"><a href="/employee/">Employee portal</a><button onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button></div></header>
    <section className="pc-hero"><div><p className="pc-eyebrow">MONTHLY PERFORMANCE CHECK-IN</p><h1>Submission command centre</h1><p>One live view of completion, component readiness, acknowledgments and follow-up actions.</p></div><div className="pc-live"><i/><span>Live database</span><small>{refreshedAt ? `Updated ${new Date(refreshedAt).toLocaleTimeString()}` : "Awaiting first refresh"}</small></div></section>
    {error && <div className="pc-alert"><strong>Protected P&C view</strong><span>{error}</span><small>Signed in as {signedInAs}. An authorised email must be added to the P&C allowlist.</small></div>}
    <section className="pc-filters"><label><span>Search employee</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Name, ID, email or appraiser"/></label><label><span>Reporting year</span><select value={year} onChange={(e)=>setYear(e.target.value)}><option value="all">All years</option>{options.years.map((x)=><option key={x}>{x}</option>)}</select></label><label><span>Month</span><select value={month} onChange={(e)=>setMonth(e.target.value)}><option value="all">All months</option>{MONTHS.map((x,i)=><option value={i+1} key={x}>{x}</option>)}</select></label><label><span>Department</span><select value={department} onChange={(e)=>setDepartment(e.target.value)}><option value="all">All departments</option>{options.departments.map((x)=><option key={x}>{x}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">All statuses</option><option>Completed</option><option>Pending</option><option>Not Started</option></select></label></section>
    <section className="pc-metrics"><Metric label="Employee MPC records" value={metrics.total}/><Metric label="Completed" value={metrics.completed} tone="good"/><Metric label="Pending" value={metrics.pending} tone="warn"/><Metric label="Not started" value={metrics.notStarted} tone="bad"/><Metric label="Completion rate" value={`${metrics.completionRate.toFixed(1)}%`} tone="purple"/></section>
    <section className="pc-grid"><article className="pc-panel"><div className="pc-panel-title"><div><p className="pc-eyebrow">COMPONENT AVAILABILITY</p><h2>Score readiness</h2></div><span>{metrics.allFour} with all 4</span></div><div className="pc-component-grid"><Component label="KPI score" value={metrics.kpi} total={metrics.total}/><Component label="Values rating" value={metrics.values} total={metrics.total}/><Component label="CPD rating" value={metrics.cpd} total={metrics.total}/><Component label="Social rating" value={metrics.social} total={metrics.total}/><Component label="Social links ≥15" value={metrics.socialCompliant} total={metrics.total}/><Component label="Employee acknowledged" value={metrics.acknowledged} total={metrics.total}/></div></article><article className="pc-panel pc-attention"><div className="pc-panel-title"><div><p className="pc-eyebrow">MANAGEMENT ATTENTION</p><h2>Follow-up queue</h2></div></div><Attention label="Missing any component" value={Math.max(0, metrics.total-metrics.allFour)}/><Attention label="Social below 15 links" value={Math.max(0, metrics.total-metrics.socialCompliant)}/><Attention label="Acknowledgment missing" value={Math.max(0, metrics.total-metrics.acknowledged)}/><Attention label="Score ≤ 2.99" value={metrics.lowScore}/></article></section>
    <section className="pc-panel pc-table-panel"><div className="pc-tabs"><button className={tab==="status"?"active":""} onClick={()=>setTab("status")}>MPC Status</button><button className={tab==="actions"?"active":""} onClick={()=>setTab("actions")}>Action List</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Monthly History</button><button className={tab==="processing"?"active":""} onClick={()=>setTab("processing")}>Processing Log</button></div>{loading && !records.length ? <div className="pc-empty">Loading live submissions…</div> : tab === "processing" ? <Processing rows={events}/> : <Records rows={filtered} tab={tab}/>}</section>
    <footer className="pc-footer"><span>Deterministic scoring rules · Version 2026.1</span><span>Access is restricted to authorised People & Culture accounts.</span></footer>
  </main>;
}

function Metric({label,value,tone=""}:{label:string;value:string|number;tone?:string}) { return <article className={`pc-metric ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }
function Component({label,value,total}:{label:string;value:number;total:number}) { const pct=total?value/total*100:0; return <div className="pc-component"><div><span>{label}</span><b>{value} / {total}</b></div><i><em style={{width:`${pct}%`}}/></i></div>; }
function Attention({label,value}:{label:string;value:number}) { return <div className="pc-attention-row"><span>{label}</span><b>{value}</b></div>; }

function Records({rows,tab}:{rows:Row[];tab:Exclude<Tab,"processing">}) {
  if (!rows.length) return <div className="pc-empty"><b>No submissions in this view</b><span>Records will appear as employees submit their monthly check-ins.</span></div>;
  return <div className="pc-table-wrap"><table><thead><tr>{tab==="actions" ? <><th>Employee</th><th>Department</th><th>Period</th><th>Status</th><th>Missing components</th><th>Overall</th><th>Social links</th><th>Acknowledgment</th><th>Action required</th></> : <><th>Employee</th><th>Position / department</th><th>Appraiser</th><th>Period</th><th>KPI</th><th>Values</th><th>CPD</th><th>Social</th><th>Overall</th><th>Band</th><th>Status</th><th>CPD hours</th><th>Social links</th><th>Acknowledgment</th></>}</tr></thead><tbody>{rows.map((row)=><tr key={`${row.id}-${tab}`}>{tab==="actions" ? <><td><b>{row.employee_name}</b><small>{row.employee_id}</small></td><td>{row.department||"—"}</td><td>{MONTHS[Number(row.month)-1]} {row.reporting_year}</td><td><span className={badgeClass(row.check_in_status)}>{row.check_in_status}</span></td><td>{row.missing_components||"None"}</td><td>{score(row.overall_score)}</td><td>{row.social_links}</td><td>{row.employee_acknowledgment}</td><td className="pc-action-text">{actionFor(row)}</td></> : <><td><b>{row.employee_name}</b><small>{row.employee_id} · {row.employee_email}</small></td><td>{row.position||"—"}<small>{row.department||"—"}</small></td><td>{row.appraiser||"—"}</td><td>{MONTHS[Number(row.month)-1]} {row.reporting_year}</td><td>{score(row.kpi_score)}</td><td>{score(row.values_rating)}</td><td>{score(row.cpd_rating)}</td><td>{score(row.social_rating)}</td><td><b>{score(row.overall_score)}</b></td><td>{row.performance_band}</td><td><span className={badgeClass(row.check_in_status)}>{row.check_in_status}</span></td><td>{score(row.cpd_hours)}</td><td>{row.social_links}</td><td>{row.employee_acknowledgment}</td></>}</tr>)}</tbody></table></div>;
}
function Processing({rows}:{rows:Row[]}) {
  if (!rows.length) return <div className="pc-empty"><b>No processing activity yet</b><span>Created and updated submissions will be recorded here.</span></div>;
  return <div className="pc-table-wrap"><table><thead><tr><th>Processed at</th><th>Employee</th><th>Period</th><th>Processing status</th><th>Source control</th><th>Actor</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td><b>{row.employee_name}</b><small>{row.employee_id}</small></td><td>{MONTHS[Number(row.month)-1]} {row.reporting_year}</td><td><span className="pc-badge pc-good">Accepted</span></td><td>Employee portal · server validated</td><td>{row.actor_email}</td></tr>)}</tbody></table></div>;
}
