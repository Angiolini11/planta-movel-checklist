import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spInputToISO,productionShiftBounds,productionPeriodError,productionPeriodLabel,durationMins} from '../src/lib/time.ts';

test('produção diurna de hematitinha 07h às 10h dentro do turno',()=>{
 const shift={shift_date:'2026-11-03',kind:'diurno'};
 const start=spInputToISO('2026-11-03T07:00')!,end=spInputToISO('2026-11-03T10:00')!;
 assert.equal(productionPeriodError(start,end,shift),null);
 assert.equal(durationMins(start,end),180);
 assert.match(productionPeriodLabel(start,end),/07:00.*10:00/);
});
test('atividade noturna que atravessa meia-noite',()=>{
 const shift={shift_date:'2026-11-02',kind:'noturno'};
 const start=spInputToISO('2026-11-02T22:00')!,end=spInputToISO('2026-11-03T01:30')!;
 assert.equal(productionPeriodError(start,end,shift),null);
 assert.equal(durationMins(start,end),210);
 assert.match(productionPeriodLabel(start,end),/02\/11.*03\/11/);
});
test('aceita horários opcionais ou término adicionado depois',()=>{
 const shift={shift_date:'2026-11-02',kind:'diurno'};
 const start=spInputToISO('2026-11-02T09:00')!;
 assert.equal(productionPeriodError(null,null,shift),null);
 assert.equal(productionPeriodError(start,null,shift),null);
 assert.match(productionPeriodLabel(start,null),/não informado/);
});
test('rejeita horários fora do turno e término anterior ao início',()=>{
 const shift={shift_date:'2026-11-02',kind:'noturno'};
 const s=spInputToISO('2026-11-02T23:00')!,e=spInputToISO('2026-11-02T22:00')!;
 assert.match(productionPeriodError(s,e,shift)!,/anterior/);
 assert.match(productionPeriodError(spInputToISO('2026-11-02T18:59'),null,shift)!,/dentro do turno/);
 assert.match(productionPeriodError(null,spInputToISO('2026-11-03T07:01'),shift)!,/dentro do turno/);
 const bounds=productionShiftBounds(shift);
 assert.equal(bounds.start,spInputToISO('2026-11-02T19:00'));
 assert.equal(bounds.end,spInputToISO('2026-11-03T07:00'));
});
