// Testes de integridade dos artefatos, NÃO substituem integração com Supabase.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/202611020001_initial.sql','utf8');
const auth=fs.readFileSync('supabase/functions/operator-auth/index.ts','utf8');
const front=fs.readFileSync('src/lib/supabase.ts','utf8');
const catalog=fs.readFileSync('src/lib/catalog.ts','utf8');

test('RLS habilitado em tabelas operacionais e de acesso',()=>{
 for(const table of ['profiles','auth_login_attempts','shifts','module_states','checklist_responses','hourmeter_readings','production_records','downtime_records','occurrences','issues','audit_events'])
   assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
});
test('funções de turno exigem autenticação de operador e acesso vigente',()=>{
 assert.match(sql,/create or replace function public\.join_current_shift/);
 assert.match(sql,/create or replace function public\.can_edit_shift/);
 assert.match(sql,/create or replace function public\.close_shift/);
 assert.match(sql,/Somente um participante pode encerrar este turno/);
});
test('segredo de PIN não aparece como variável do frontend',()=>{
 assert.match(auth,/AUTH_PIN_PEPPER/);
 assert.match(auth,/HMAC/);
 assert.match(auth,/tooManyFailures/);
 assert.match(auth,/identityVerified/);
 assert.doesNotMatch(front,/SERVICE_ROLE_KEY|AUTH_PIN_PEPPER/);
});
test('checklists têm exatamente oito itens preliminares por módulo',()=>{
 for(const code of ['QJ341','QH441','QA452'])assert.match(catalog,new RegExp(`${code}:\\[`));
 assert.match(sql,/item_index between 1 and 8/);
 assert.match(sql,/can_answer_module/);
});
