import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('src/App.tsx','utf8');
const screens=fs.readFileSync('src/screens/Operations.tsx','utf8');
test('V3 mantém fotos dos equipamentos configuradas no Supabase',()=>{
 assert.match(app,/getImages\(\)/);
 assert.match(app,/<ModulesGrid data=\{data\} images=\{images\} onOpen=\{onOpen\}\/>/);
});
test('V3 navegação agrupa produção, paradas e ocorrências sem eliminar formulários',()=>{
 for(const x of ["['production','Registros'", "['production','Produção'", "['stops','Paradas'", "['occurrences','Ocorrências'"]){assert.ok(app.includes(x),x);}
 for(const x of ['export function ProductionScreen','export function StopsScreen','export function OccurrencesScreen'])assert.ok(screens.includes(x));
 assert.doesNotMatch(screens,/OperationsTabs/);
});
test('V3 mantém date/turno selecionáveis e PDF/Handover/History',()=>{
 for(const x of ['setShiftSelectorOpen','type="date"','<HandoverScreen','<HistoryScreen','<ModuleScreen','getShiftData'])assert.ok(app.includes(x),x);
});
