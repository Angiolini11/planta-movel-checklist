import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {durationMins,formatDate,getCurrentShiftKey,isShiftEnded,nextDate,previousDate,spInputToISO} from '../src/lib/time.ts';

test('turno diurno - horário de São Paulo',()=>{
 assert.deepEqual(getCurrentShiftKey(new Date('2026-11-02T13:00:00Z')),{date:'2026-11-02',kind:'diurno'});
});
test('turno noturno começa às 19h em São Paulo',()=>{
 assert.deepEqual(getCurrentShiftKey(new Date('2026-11-02T22:00:00Z')),{date:'2026-11-02',kind:'noturno'});
});
test('turno noturno após meia-noite usa data do início',()=>{
 assert.deepEqual(getCurrentShiftKey(new Date('2026-11-03T03:30:00Z')),{date:'2026-11-02',kind:'noturno'});
});
test('transição das 07h no Brasil',()=>{
 assert.deepEqual(getCurrentShiftKey(new Date('2026-11-03T09:59:59Z')),{date:'2026-11-02',kind:'noturno'});
 assert.deepEqual(getCurrentShiftKey(new Date('2026-11-03T10:00:00Z')),{date:'2026-11-03',kind:'diurno'});
});
test('datas na virada de mês e ano',()=>{
 assert.equal(previousDate('2026-03-01'),'2026-02-28');
 assert.equal(nextDate('2026-12-31'),'2027-01-01');
 assert.equal(formatDate('2026-11-02'),'02/11/2026');
});
test('duração de parada atravessando meia-noite',()=>{
 assert.equal(durationMins('2026-11-03T02:30:00Z','2026-11-03T04:00:00Z'),90);
 assert.equal(durationMins('2026-11-03T04:00:00Z','2026-11-03T02:30:00Z'),null);
 assert.equal(durationMins(null,null),null);
});
test('entrada de horário no fuso São Paulo para registro UTC',()=>{
 assert.equal(spInputToISO('2026-11-02T19:00'),'2026-11-02T22:00:00.000Z');
 assert.equal(spInputToISO(''),null);
});
test('encerramento pendente após a transição',()=>{
 const daytime={shift_date:'2026-11-02',kind:'diurno'};
 assert.equal(isShiftEnded(daytime,new Date('2026-11-02T20:30:00Z')),false);
 assert.equal(isShiftEnded(daytime,new Date('2026-11-02T23:30:00Z')),true);
});
