import fs from 'node:fs/promises';
import {generateSQLiteDrizzleJson,generateSQLiteMigration} from 'drizzle-kit/api';
import * as auth from '../db/nadi-auth-schema.ts';
const previous=JSON.parse(await fs.readFile('drizzle/meta/0020_snapshot.json','utf8'));
// Preserve every unrelated table from the last applied snapshot.
const generated=await generateSQLiteDrizzleJson(auth,previous.id);
const current={...previous,id:generated.id,prevId:previous.id,tables:{...previous.tables,...generated.tables}};
const sql=await generateSQLiteMigration(previous,current);
if(!sql.length||sql.some(s=>!(/^(CREATE (TABLE|(?:UNIQUE )?INDEX) `nadi_auth_hr_mail|ALTER TABLE `nadi_auth_invitations` ADD)/.test(s))))throw Error('Unexpected reset schema delta');
const journal=JSON.parse(await fs.readFile('drizzle/meta/_journal.json','utf8'));
if(journal.entries.length!==21)throw Error('Unexpected migration journal');
await fs.writeFile('drizzle/0021_secure_account_mail.sql',sql.join('\n--> statement-breakpoint\n')+'\n');
await fs.writeFile('drizzle/meta/0021_snapshot.json',JSON.stringify(current,null,2)+'\n');
journal.entries.push({idx:21,version:'6',when:Date.now(),tag:'0021_secure_account_mail',breakpoints:true});
await fs.writeFile('drizzle/meta/_journal.json',JSON.stringify(journal,null,2)+'\n');
console.log(JSON.stringify({migration:'0021_secure_account_mail',statements:sql.length}));
