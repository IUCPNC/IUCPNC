import {exportPositionRegisters} from './position-sheets.js';
import {SHEET_ID,DATASETS,equal,normal} from './sheets-model.js';
import {TABLE_HEADERS} from './sheets-headers.js';
export const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const quoted=s=>"'"+s.replaceAll("'","''")+"'";
export class SheetsClient{
 // Workers' native fetch must retain its global receiver, not the SheetsClient instance.
 constructor(token,fetcher=(...args)=>globalThis.fetch(...args)){this.token=token;this.fetcher=fetcher;this.tables=new Map();}
 async api(path='',body){
  const response=await this.fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'Google authorisation failed; reconnect the HR account':response.status===429?'Google rate limit reached; the next scheduled run will retry':'Google Sheets request failed (HTTP '+response.status+')');
  return response.json();
 }
 async read(){
  const meta=await this.api('?fields=sheets(properties(sheetId,title,gridProperties),tables)');
  this.tables.clear();
  for(const s of meta.sheets||[]){
   for(const t of s.tables||[])if(DATASETS.some(d=>d.table===t.name))this.tables.set(t.name,{...t,title:s.properties.title,sheetId:s.properties.sheetId,start:t.range.startRowIndex||0,end:t.range.endRowIndex,width:t.range.endColumnIndex,headers:(t.columnProperties||[]).map(c=>c.columnName)});
   if(s.properties.title==='Documents')this.tables.set('Documents',{name:'Documents',title:'Documents',sheetId:s.properties.sheetId,start:0,end:s.properties.gridProperties.rowCount,width:7,headers:[]});
  }
  const tables=[...this.tables.values()];
  for(const ds of DATASETS)if(!this.tables.has(ds.table))throw new Error('Required workbook table is missing: '+ds.table);
  const ranges=tables.map(t=>quoted(t.title)+'!A'+(t.start+1)+':'+column(t.width-1)+t.end);
  const suffix=ranges.map(r=>'ranges='+encodeURIComponent(r)).join('&');
  const [values,formulas]=await Promise.all([this.api('/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&'+suffix),this.api('/values:batchGet?valueRenderOption=FORMULA&'+suffix)]);
  tables.forEach((t,i)=>{const rows=values.valueRanges[i]?.values||[];t.headers=rows[0]||[];t.rows=rows.slice(1);t.formulas=(formulas.valueRanges[i]?.values||[]).slice(1);});
  for(const ds of DATASETS){const t=this.tables.get(ds.table);if(t.headers[ds.employeeCol]!=='Employee ID')throw new Error('Employee ID column moved in '+ds.table);const expected=TABLE_HEADERS[ds.table];if(expected&&!equal(t.headers,expected))throw new Error('Field columns changed in '+ds.table+'; restore the expected headers before resuming');}
  return this.tables;
 }
 async syncPositions(registers){return exportPositionRegisters(this,registers);}
 async assignRecordIds(){
  const requests=[];
  for(const ds of DATASETS.filter(d=>d.collection)){
   const t=this.tables.get(ds.table);
   for(const [i,row] of t.rows.entries())if(normal(row[ds.employeeCol])&&!normal(row[ds.idCol])&&(!ds.kind||normal(row[ds.kindCol])===ds.kind)&&ds.fields.some(f=>normal(row[f.col],f.type)!=='')){
    const physical=t.start+i+1;
    requests.push({updateCells:{range:{sheetId:t.sheetId,startRowIndex:physical,endRowIndex:physical+1,startColumnIndex:ds.idCol,endColumnIndex:ds.idCol+1},rows:[{values:[{userEnteredValue:{stringValue:crypto.randomUUID()}}]}],fields:'userEnteredValue'}});
   }
  }
  if(!requests.length)return false;
  // Only ID cells are assigned. All employee fields remain intact for normal validation/review.
  await this.api(':batchUpdate',{requests:requests.slice(0,100)});return true;
 }
 async write(record,value,expected){
  // Refresh table positions and values immediately before every write. Never overwrite by a stale row number.
  const tables=await this.read(),t=tables.get(record.ds.table),ds=record.ds;
  const matches=t.rows.map((v,i)=>({v,i})).filter(({v})=>normal(v[ds.idCol])===record.id&&normal(v[ds.employeeCol])===record.employeeId&&(!ds.kind||normal(v[ds.kindCol])===ds.kind));
  if(matches.length>1)throw new Error('Duplicate row detected before writing');
  let index=matches[0]?.i;
  if(expected){if(index===undefined||!equal(Object.fromEntries(ds.fields.map(f=>[f.key,normal(t.rows[index][f.col],f.type)])),expected))throw new Error('The Sheet changed during synchronisation; retry required');}
  else if(index!==undefined&&ds.fields.some(f=>normal(t.rows[index][f.col],f.type)!==''))throw new Error('The Sheet gained a record during synchronisation; retry required');
  if(index===undefined){
   index=Array.from({length:t.end-t.start-1},(_,i)=>i).find(i=>!(t.rows[i]||[]).some((v,c)=>v!==''&&v!==null&&v!==undefined&&!String(t.formulas[i]?.[c]||'').startsWith('=')));
   if(index===undefined||index===t.end-t.start-2){
    if(t.name==='Documents'){await this.api(':batchUpdate',{requests:[{appendDimension:{sheetId:t.sheetId,dimension:'ROWS',length:20}}]});}
    else await this.api(':batchUpdate',{requests:[{insertDimension:{range:{sheetId:t.sheetId,dimension:'ROWS',startIndex:t.end-1,endIndex:t.end+19},inheritFromBefore:true}}]});
    throw new Error('Workbook table expanded; the next run will continue');
   }
  }
  const row=t.start+index+1,requests=[];
  const put=(c,v,date=false)=>{if(String(t.formulas[index]?.[c]||'').startsWith('='))throw new Error('A synced data column contains a formula; restore its expected value or move the formula outside synced fields');requests.push({updateCells:{range:{sheetId:t.sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:c,endColumnIndex:c+1},rows:[{values:[{userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v??'')},...(date?{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'yyyy-mm-dd'}}}:{})}]}],fields:date?'userEnteredValue,userEnteredFormat.numberFormat':'userEnteredValue'}});};
  put(ds.idCol,record.id);if(ds.employeeCol!==ds.idCol)put(ds.employeeCol,record.employeeId);if(ds.kind)put(ds.kindCol,ds.kind);
  for(const f of ds.fields){let v=value[f.key];if(f.type==='date'&&v!=='')v=(Date.parse(v+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;put(f.col,v,f.type==='date');}
  if(ds.table!=='PeopleCoreRecords'){
   const nameCol=ds.employeeCol===0?1:2;
   if(!String(t.formulas[index]?.[nameCol]||'').startsWith('='))put(nameCol,record.context?.employee.employee_name||'');
  }
  // Copy only formula cells into new rows; other columns and adjacent tables remain untouched.
  if(!expected){const source=t.formulas.findIndex(r=>r.some(v=>String(v).startsWith('=')));if(source>=0)for(const [c,v] of t.formulas[source].entries())if(String(v).startsWith('=')&&!ds.fields.some(f=>f.col===c)&&c!==ds.idCol&&c!==ds.employeeCol)requests.push({copyPaste:{source:{sheetId:t.sheetId,startRowIndex:t.start+source+1,endRowIndex:t.start+source+2,startColumnIndex:c,endColumnIndex:c+1},destination:{sheetId:t.sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:c,endColumnIndex:c+1},pasteType:'PASTE_FORMULA'}});}
  await this.api(':batchUpdate',{requests});
  const result=await this.api('/values/'+encodeURIComponent(quoted(t.title)+'!A'+(row+1)+':'+column(t.width-1)+(row+1))+'?valueRenderOption=UNFORMATTED_VALUE');
  if(!equal(Object.fromEntries(ds.fields.map(f=>[f.key,normal(result.values?.[0]?.[f.col],f.type)])),value))throw new Error('Sheet write could not be verified; review on the next run');
 }
}
