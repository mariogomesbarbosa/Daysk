/* Harness das funções puras do index.html.
 *
 * O projeto não tem build nem módulos: tudo vive num único index.html, e essa
 * decisão vale preservar. Então o caminho para testar lógica é extrair as
 * funções do fonte por casamento de chaves e avaliá-las num escopo isolado.
 *
 * Três harnesses assim já existiram e foram perdidos por morar em diretório
 * temporário (ver docs/pendencias.md). Este está commitado por isso.
 *
 * Uso:  node tests/funcoes-puras.mjs
 *
 * Limitação conhecida: o casamento de chaves é ingênuo — não pula chaves
 * dentro de strings, template literals ou comentários. Serve para as funções
 * pequenas e puras, que é o que se quer testar aqui. Uma função com template
 * literal (calChipHtml, taskRowHtml) não é extraível assim, e nem é o alvo.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = readFileSync(join(raiz, 'index.html'), 'utf8');

function extrair(nome) {
  const marca = `function ${nome}(`;
  const i = fonte.indexOf(marca);
  if (i === -1) throw new Error(`função não encontrada no index.html: ${nome}`);
  const abre = fonte.indexOf('{', i);
  let nivel = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === '{') nivel++;
    else if (fonte[j] === '}' && --nivel === 0) return fonte.slice(i, j + 1);
  }
  throw new Error(`chaves não fecharam para: ${nome}`);
}

const ALVOS = ['toMins', 'padTime', 'minsToHm', 'endFromDur', 'durFromEnd'];

/* As funcoes sao concatenadas e avaliadas juntas porque dependem umas das
   outras: durFromEnd chama toMins, endFromDur chama padTime. */
const { endFromDur, durFromEnd, padTime, minsToHm } = new Function(`
  ${ALVOS.map(extrair).join('\n')}
  return { ${ALVOS.join(', ')} };
`)();

let ok = 0, falhas = [];
const eq = (rotulo, obtido, esperado) => {
  if (Object.is(obtido, esperado)) ok++;
  else falhas.push(`${rotulo}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
};

/* ---------- endFromDur: duração → relógio ---------- */
eq('endFromDur 09:45 +120', endFromDur('09:45', 120), '11:45');
eq('endFromDur 00:15 +30', endFromDur('00:15', 30), '00:45');
eq('endFromDur 23:00 +120 vira a meia-noite', endFromDur('23:00', 120), '01:00');
eq('endFromDur 23:30 +30 cai exato em 00:00', endFromDur('23:30', 30), '00:00');
eq('endFromDur sem duração', endFromDur('09:45', null), '');
eq('endFromDur sem início', endFromDur(null, 120), '');
eq('endFromDur dos dois vazios', endFromDur(null, null), '');
eq('endFromDur com duração 0 é tratado como vazio', endFromDur('09:45', 0), '');

/* ---------- durFromEnd: relógio → duração ---------- */
eq('durFromEnd 09:45→11:45', durFromEnd('09:45', '11:45'), 120);
eq('durFromEnd 08:00→08:15 (piso do snap)', durFromEnd('08:00', '08:15'), 15);
eq('durFromEnd sem final cai no padrão', durFromEnd('09:45', null), 60);
eq('durFromEnd sem início não significa nada', durFromEnd(null, '11:45'), null);
eq('durFromEnd dos dois vazios', durFromEnd(null, null), null);
eq('durFromEnd final igual ao início cai no padrão', durFromEnd('09:45', '09:45'), 60);
eq('durFromEnd 23:00→01:00 atravessa a meia-noite', durFromEnd('23:00', '01:00'), 120);
eq('durFromEnd 23:30→00:00', durFromEnd('23:30', '00:00'), 30);
eq('durFromEnd 09:45→08:00 (o erro de digitação) vira 22h15', durFromEnd('09:45', '08:00'), 1335);
eq('durFromEnd 00:00→23:45 é o máximo representável', durFromEnd('00:00', '23:45'), 1425);

/* ---------- ida-e-volta: é o que o +1440 existe para garantir ---------- */
/* Reabrir a edição preenche "Final" com endFromDur; salvar sem mexer devolve
   durFromEnd. Se os dois não fecharem, editar uma tarefa muda a duração dela. */
const idaEVolta = [
  ['09:45', 120], ['00:15', 30], ['23:00', 120], ['23:30', 30],
  ['08:00', 15], ['12:00', 480], ['06:30', 45], ['22:15', 720],
];
idaEVolta.forEach(([time, dur]) => {
  eq(`ida-e-volta ${time} +${dur}min`, durFromEnd(time, endFromDur(time, dur)), dur);
});

/* ---------- a guarda de 12h ---------- */
eq('12h exatas não alertam', durFromEnd('08:00', '20:00') > 720, false);
eq('12h01 alerta', durFromEnd('08:00', '20:01') > 720, true);

/* ---------- padTime continua virando a meia-noite (não regrediu) ---------- */
eq('padTime 1470 vira 00:30 e não 24:30', padTime(1470), '00:30');
eq('padTime 1440 vira 00:00', padTime(1440), '00:00');

/* ---------- minsToHm, usado na dica ---------- */
eq('minsToHm 120', minsToHm(120), '2h');
eq('minsToHm 45', minsToHm(45), '45min');
eq('minsToHm 1335', minsToHm(1335), '22h15min');



/* ---------- asideGroups: os dois grupos da coluna do Calendário ---------- */
/* asideGroups() lê o global `tasks`, então o escopo isolado precisa declarar
   essa ligação e deixá-la substituível — é o preço de testar uma função que
   fecha sobre estado de módulo. */
const ALVOS_ASIDE = ['taskSortKey', 'asideGroups'];
const cal = new Function(`
  let tasks = [];
  ${ALVOS_ASIDE.map(extrair).join('\n')}
  return { asideGroups, semear: t => { tasks = t; } };
`)();

const tarefa = (id, campos) => ({ id, name: id, status: 'pending', ...campos });
cal.semear([
  tarefa('a', { date: null, time: null }),                        // sem prazo
  tarefa('b', { date: null, time: null, status: 'done' }),        // sem prazo, concluída
  tarefa('c', { date: '2026-08-25', time: null }),                // sem hora, futura
  tarefa('d', { date: '2026-08-19', time: null }),                // sem hora, mais próxima
  tarefa('e', { date: '2026-08-01', time: null }),                // sem hora, atrasada
  tarefa('f', { date: '2026-08-19', time: null, status: 'done' }),// sem hora, concluída
  tarefa('g', { date: '2026-08-19', time: '10:00' }),             // planejada: em nenhum grupo
  tarefa('h', { date: null, time: null, status: undefined }),     // registro antigo, sem status
  tarefa('i', { date: '2026-08-20', time: null, status: 'active' }),
]);
const g = cal.asideGroups();
const ids = l => l.map(t => t.id).join(',');

eq('semPrazo pega só o que não tem data', ids(g.semPrazo), 'a,h');
eq('semPrazo exclui concluída', g.semPrazo.some(t => t.id === 'b'), false);
eq('status ausente conta como aberta', g.semPrazo.some(t => t.id === 'h'), true);
eq('semHora pega data sem hora, ordenada por data', ids(g.semHora), 'e,d,i,c');
eq('semHora exclui concluída', g.semHora.some(t => t.id === 'f'), false);
eq('semHora mantém active (é pendência)', g.semHora.some(t => t.id === 'i'), true);
eq('tarefa com data E hora não entra em grupo nenhum',
   g.semPrazo.concat(g.semHora).some(t => t.id === 'g'), false);
eq('contador da coluna soma os dois', g.semPrazo.length + g.semHora.length, 6);

cal.semear([tarefa('x', { date: '2026-08-19', time: '09:00' })]);
const vazio = cal.asideGroups();
eq('tudo planejado zera os dois grupos', vazio.semPrazo.length + vazio.semHora.length, 0);

console.log(`\n${ok} passaram, ${falhas.length} falharam\n`);
if (falhas.length) {
  falhas.forEach(f => console.log('  ✗ ' + f + '\n'));
  process.exit(1);
}
