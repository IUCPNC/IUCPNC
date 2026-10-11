import fs from 'node:fs/promises';
import {generateSQLiteDrizzleJson,generateSQLiteMigration} from 'drizzle-kit/api';
const schema={};for(const file of ['schema','profile-schema','management-schema','people-hub-schema','sheets-sync-schema','cpd-schema','attendance-schema','hr-service-schema','connect-schema','position-schema','nadi-auth-schema','nadi-notification-schema','leave-schema'])Object.assign(schema,await import('../db/'+file+'.ts'));
const previous=JSON.parse(await fs.readFile('drizzle/meta/0019_snapshot.json','utf8'));
const current=await generateSQLiteDrizzleJson(schema,previous.id),statements=await generateSQLiteMigration(previous,current);
if(!statements.length||statements.some(s=>!/^CREATE (TABLE `leave_|(?:UNIQUE )?INDEX `leave_)/.test(s)))throw Error('Unexpected leave migration delta');
const journal=JSON.parse(await fs.readFile('drizzle/meta/_journal.json','utf8'));if(journal.entries.at(-1)?.tag==='0020_smart_leave')journal.entries.pop();if(journal.entries.length!==20)throw Error('Unexpected migration journal');
await fs.writeFile('drizzle/0020_smart_leave.sql',statements.join('\n--> statement-breakpoint\n')+'\n');await fs.writeFile('drizzle/meta/0020_snapshot.json',JSON.stringify(current,null,2)+'\n');journal.entries.push({idx:20,version:'6',when:Date.now(),tag:'0020_smart_leave',breakpoints:true});await fs.writeFile('drizzle/meta/_journal.json',JSON.stringify(journal,null,2)+'\n');console.log(JSON.stringify({migration:'0020_smart_leave',statements:statements.length,existingTablesChanged:0}));
