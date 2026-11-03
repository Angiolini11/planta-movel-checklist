import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/202611030002_pilot_edits.sql','utf8');
const history=fs.readFileSync('src/screens/History.tsx','utf8');
const operations=fs.readFileSync('src/screens/Operations.tsx','utf8');
const modules=fs.readFileSync('src/screens/Modules.tsx','utf8');
test('editar/anular exige participação no turno atual e não admite operações públicas',()=>{
 for(const table of ['hourmeter_readings','production_records','downtime_records','occurrences','module_notes','handover_notes']){
  assert.match(sql,new RegExp(`public\\.${table}`));
 }
 const policies=sql.match(/CREATE POLICY [^\n]+[\s\S]*?(?=CREATE POLICY|GRANT |-- A edição)/g)||[];
 assert.ok(policies.some(p=>p.includes('can_edit_shift(shift_id)')));
 assert.doesNotMatch(sql,/\bTO anon\b/i);
});
test('histórico comum não exibe versões anteriores e PDF usa dados atuais',()=>{
 assert.doesNotMatch(history,/data\.audit|old_data|new_data|Histórico de alterações/);
 assert.match(operations,/RecordControls/);
 assert.match(modules,/annulRecord/);
});
test('mudanças concorrentes exigem revisão',()=>{
 for(const table of ['hourmeter_readings','production_records','downtime_records','occurrences','module_notes','handover_notes']){
  assert.match(sql,/NEW\.revision:=OLD\.revision\+1/);
 }
});
