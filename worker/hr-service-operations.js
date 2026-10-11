import {businessDate} from './profile-schema.js';

export const OPEN_REQUEST_STATUSES=['Submitted','In Review','Needs Information','Approved'];
export const OPEN_REQUEST_SQL="('Submitted','In Review','Needs Information','Approved')";
export const FOLLOW_UP_EVENT='Follow-up requested';
export const FOLLOW_UP_ACK_EVENT='Follow-up acknowledged';

// Versions order these append-only events even when two actions share a timestamp.
const signalVersion=type=>`COALESCE((SELECT MAX(CASE WHEN json_valid(h.message) THEN CASE WHEN json_type(h.message,'$.version')='integer' THEN json_extract(h.message,'$.version') END END) FROM hr_service_events h WHERE h.request_id=r.id AND h.event_type='${type}'),0)`;
export const FOLLOW_UP_VERSION_SQL=signalVersion(FOLLOW_UP_EVENT);
export const FOLLOW_UP_ACK_SQL=signalVersion(FOLLOW_UP_ACK_EVENT);
export const FOLLOW_UP_PENDING_SQL=`r.status IN ${OPEN_REQUEST_SQL} AND ${FOLLOW_UP_VERSION_SQL}>${FOLLOW_UP_ACK_SQL}`;
export const REQUESTED_DATE_SQL=`r.status IN ${OPEN_REQUEST_SQL} AND date(r.needed_by)=r.needed_by`;

export function serviceOperations(r,day=businessDate()){
 const open=OPEN_REQUEST_STATUSES.includes(r.status);
 const validDate=typeof r.needed_by==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.needed_by)&&Number.isFinite(Date.parse(r.needed_by))&&new Date(r.needed_by).toISOString().slice(0,10)===r.needed_by;
 const deadlineState=!open?'closed':!validDate?'no-date':r.needed_by<day?'past-requested-date':r.needed_by===day?'due-today':'upcoming';
 const followUpPending=open&&Number(r.follow_up_version||0)>Number(r.follow_up_ack_version||0);
 return {deadlineState,followUpPending,canFollowUp:deadlineState==='past-requested-date'&&!followUpPending};
}

export function serviceEventView(e){
 if(![FOLLOW_UP_EVENT,FOLLOW_UP_ACK_EVENT].includes(e.event_type))return e;
 try{const record=JSON.parse(e.message);return {...e,message:typeof record.message==='string'?record.message:'Request follow-up recorded.'};}
 catch{return {...e,message:'Request follow-up recorded.'};}
}
