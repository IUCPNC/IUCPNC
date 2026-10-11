import fs from 'node:fs/promises';
import {generateSQLiteDrizzleJson,generateSQLiteMigration} from 'drizzle-kit/api';
import * as existing from '../db/schema.ts';
import * as profile from '../db/profile-schema.ts';
const before=await generateSQLiteDrizzleJson(existing);
const after=await generateSQLiteDrizzleJson({...existing,...profile},before.id);
const statements=await generateSQLiteMigration(before,after);
if(statements.some(s=>/DROP TABLE|ALTER TABLE|DELETE FROM/i.test(s)))throw new Error('Profile migration must only add new tables and indexes.');
await fs.writeFile('drizzle/0003_employee_profiles.sql',statements.join('\n--> statement-breakpoint\n')+'\n');
await fs.writeFile('drizzle/meta/0003_snapshot.json',JSON.stringify(after,null,2));
const journal=JSON.parse(await fs.readFile('drizzle/meta/_journal.json','utf8'));
if(!journal.entries.some(e=>e.idx===3)){journal.entries.push({idx:3,version:'6',when:1790676000000,tag:'0003_employee_profiles',breakpoints:true});await fs.writeFile('drizzle/meta/_journal.json',JSON.stringify(journal,null,2)+'\n')}
console.log(JSON.stringify({statements:statements.length,migration:'0003_employee_profiles',schemaOnly:true}));
