import fs from 'node:fs/promises';
import {generateSQLiteDrizzleJson,generateSQLiteMigration} from 'drizzle-kit/api';
const schema={};for(const file of ['schema','profile-schema','management-schema','people-hub-schema','sheets-sync-schema','cpd-schema','attendance-schema','hr-service-schema','connect-schema','position-schema','nadi-auth-schema','nadi-notification-schema','leave-schema','payroll-schema'])Object.assign(schema,await import('../db/'+file+'.ts'));
const previous=JSON.parse(await fs.readFile('drizzle/meta/0021_snapshot.json','utf8'));
const current=await generateSQLiteDrizzleJson(schema,previous.id),statements=await generateSQLiteMigration(previous,current);
if(!statements.length||statements.some(s=>!/^CREATE (TABLE `payroll_|(?:UNIQUE )?INDEX `payroll_)/.test(s)))throw Error('Unexpected payroll migration delta');
const journal=JSON.parse(await fs.readFile('drizzle/meta/_journal.json','utf8'));if(journal.entries.length!==22)throw Error('Unexpected migration journal');
await fs.writeFile('drizzle/0022_payroll.sql',statements.join('\n--> statement-breakpoint\n')+'\n');await fs.writeFile('drizzle/meta/0022_snapshot.json',JSON.stringify(current,null,2)+'\n');journal.entries.push({idx:22,version:'6',when:Date.now(),tag:'0022_payroll',breakpoints:true});await fs.writeFile('drizzle/meta/_journal.json',JSON.stringify(journal,null,2)+'\n');console.log(JSON.stringify({migration:'0022_payroll',statements:statements.length,existingTablesChanged:0}));
