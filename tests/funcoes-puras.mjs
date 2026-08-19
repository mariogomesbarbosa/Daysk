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

/* ---------- aplicarAlca: a conta das alcas de redimensionar ---------- */
/* aplicarAlca() le a constante CAL_SNAP, que vive fora dela — o escopo isolado
   declara a constante junto, como faz o proprio index.html. */
const { aplicarAlca } = new Function(`
  const CAL_SNAP = 15;
  ${extrair('aplicarAlca')}
  return { aplicarAlca };
`)();

const alca = (borda, ini, fim, mins) => {
  const r = aplicarAlca(borda, ini, fim, mins);
  return `${r.ini}-${r.fim}`;
};

/* alca de baixo: move o fim, mantem o inicio */
eq('baixo estica 09:00-10:00 ate 11:00', alca('fim', 540, 600, 660), '540-660');
eq('baixo encolhe 09:00-11:00 para 09:30', alca('fim', 540, 660, 570), '540-570');
eq('baixo no piso de 15min', alca('fim', 540, 600, 545), '540-555');
eq('baixo puxado para ANTES do inicio trava no piso', alca('fim', 540, 600, 360), '540-555');
eq('baixo exatamente no inicio trava no piso', alca('fim', 540, 600, 540), '540-555');
eq('baixo alem da meia-noite trava em 1440', alca('fim', 1380, 1410, 1800), '1380-1440');
eq('baixo exatamente na meia-noite', alca('fim', 1380, 1410, 1440), '1380-1440');

/* alca de cima: move o inicio, mantem o FIM */
eq('cima sobe 10:00-11:00 para 09:00', alca('ini', 600, 660, 540), '540-660');
eq('cima desce 09:00-11:00 para 10:00', alca('ini', 540, 660, 600), '600-660');
eq('cima no piso de 15min', alca('ini', 540, 600, 590), '585-600');
eq('cima puxada para DEPOIS do fim trava no piso', alca('ini', 540, 600, 1320), '585-600');
eq('cima exatamente no fim trava no piso', alca('ini', 540, 600, 600), '585-600');
eq('cima antes de 00:00 trava em 0', alca('ini', 15, 45, -300), '0-45');
eq('cima exatamente em 00:00', alca('ini', 15, 45, 0), '0-45');

/* a duracao resultante nunca fica abaixo do passo, nas quatro direcoes */
[['fim',540,600,0],['fim',540,600,2000],['ini',540,600,0],['ini',540,600,2000]].forEach(([b,i,f,m]) => {
  const r = aplicarAlca(b, i, f, m);
  eq(`duracao >= CAL_SNAP para ${b} em ${m}`, r.fim - r.ini >= 15, true);
});

/* ---------- fecharSessao: o unico lugar que soma em elapsed ---------- */
/* Muta o objeto recebido e nao le global nenhum, entao extrai sozinha. */
const { fecharSessao } = new Function(`
  ${extrair('fecharSessao')}
  return { fecharSessao };
`)();

const T0 = 1_700_000_000_000;

let t1 = { elapsed: 0, startedAt: T0 };
fecharSessao(t1, T0 + 90_000);
eq('soma o trecho em elapsed', t1.elapsed, 90_000);
eq('zera startedAt', t1.startedAt, null);

let t2 = { elapsed: 300_000, startedAt: T0 };
fecharSessao(t2, T0 + 60_000);
eq('acumula sobre o elapsed que ja existia', t2.elapsed, 360_000);

let t3 = { elapsed: 500, startedAt: null };
fecharSessao(t3, T0);
eq('sem cronometro aberto nao mexe em elapsed', t3.elapsed, 500);
eq('sem cronometro aberto startedAt segue nulo', t3.startedAt, null);

let t4 = { startedAt: T0 };                     // registro sem o campo elapsed
fecharSessao(t4, T0 + 1000);
eq('elapsed ausente conta como zero', t4.elapsed, 1000);

let t5 = { elapsed: 10, startedAt: T0 };
fecharSessao(t5, T0 + 5000);
fecharSessao(t5, T0 + 99_000);                  // segunda chamada, ja fechado
eq('chamar duas vezes nao soma de novo', t5.elapsed, 5010);

/* O NaN que a duplicacao antiga permitia: status 'active' com startedAt nulo
   fazia (Date.now() - null) contaminar elapsed para sempre. Nao era alcancavel
   pela interface, mas dado sincronizado de fora nao passa por ela. */
let t6 = { elapsed: 1234, startedAt: null, status: 'active' };
fecharSessao(t6, T0);
eq('status active com startedAt nulo nao vira NaN', Number.isNaN(t6.elapsed), false);
eq('e nao altera o valor', t6.elapsed, 1234);

eq('tarefa inexistente nao explode', (() => { fecharSessao(undefined, T0); return 'ok'; })(), 'ok');

/* ---------- msPorDia / sessoesDe: o recorte diario das sessoes ---------- */
/* msPorDia usa toDateStr, entao as duas saem juntas no mesmo escopo. */
const sess = new Function(`
  ${['toDateStr', 'msPorDia', 'sessoesDe'].map(extrair).join('\n')}
  return { toDateStr, msPorDia, sessoesDe };
`)();

const H = 3600000, M = 60000;
/* Datas construidas por componentes = horario local, igual ao app. */
const em = (y, mes, d, h, mi = 0) => new Date(y, mes - 1, d, h, mi).getTime();
const mapa = o => Object.fromEntries([...o.entries()].sort());

eq('sessao dentro de um dia cai num balde so',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2026,8,19,9), fim: em(2026,8,19,11,30) }]))),
   JSON.stringify({ '2026-08-19': 2.5 * H }));

eq('sessao que atravessa a meia-noite parte em dois',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2026,8,19,23), fim: em(2026,8,20,1) }]))),
   JSON.stringify({ '2026-08-19': 1 * H, '2026-08-20': 1 * H }));

eq('sessao de mais de 24h cobre tres dias',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2026,8,19,22), fim: em(2026,8,21,2) }]))),
   JSON.stringify({ '2026-08-19': 2 * H, '2026-08-20': 24 * H, '2026-08-21': 2 * H }));

eq('virada de mes',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2026,8,31,23), fim: em(2026,9,1,1) }]))),
   JSON.stringify({ '2026-08-31': 1 * H, '2026-09-01': 1 * H }));

eq('virada de ano',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2026,12,31,23), fim: em(2027,1,1,1) }]))),
   JSON.stringify({ '2026-12-31': 1 * H, '2027-01-01': 1 * H }));

eq('ano bissexto: 28/02 para 29/02',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2028,2,28,23), fim: em(2028,2,29,1) }]))),
   JSON.stringify({ '2028-02-28': 1 * H, '2028-02-29': 1 * H }));

eq('sessao terminando exatamente na meia-noite nao cria dia vazio',
   JSON.stringify(mapa(sess.msPorDia([{ ini: em(2026,8,19,23), fim: em(2026,8,20,0) }]))),
   JSON.stringify({ '2026-08-19': 1 * H }));

eq('duracao zero e ignorada',
   sess.msPorDia([{ ini: em(2026,8,19,9), fim: em(2026,8,19,9) }]).size, 0);
eq('duracao negativa e ignorada',
   sess.msPorDia([{ ini: em(2026,8,19,11), fim: em(2026,8,19,9) }]).size, 0);
eq('lista vazia', sess.msPorDia([]).size, 0);
eq('lista ausente', sess.msPorDia(undefined).size, 0);

eq('varias sessoes no mesmo dia somam',
   sess.msPorDia([{ ini: em(2026,8,19,9), fim: em(2026,8,19,10) },
                  { ini: em(2026,8,19,14), fim: em(2026,8,19,15,30) }]).get('2026-08-19'),
   2.5 * H);

/* A invariante que importa: nada se perde e nada se inventa na reparticao. */
const amostra = [
  { ini: em(2026,8,19,23,15), fim: em(2026,8,20,2,45) },
  { ini: em(2026,8,20,9), fim: em(2026,8,20,9,30) },
  { ini: em(2026,8,31,22), fim: em(2026,9,2,3) },
];
const somaBaldes = [...sess.msPorDia(amostra).values()].reduce((a, b) => a + b, 0);
const somaReal = amostra.reduce((a, s) => a + (s.fim - s.ini), 0);
eq('a soma dos baldes bate com a soma das duracoes', somaBaldes, somaReal);

/* sessoesDe: a sessao aberta entra, e so quando ha uma. */
const AGORA = em(2026,8,19,15);
eq('tarefa parada devolve so as fechadas',
   sess.sessoesDe({ sessions: [{ ini: 1, fim: 2 }], status: 'paused', startedAt: null }, AGORA).length, 1);
eq('tarefa ativa ganha a sessao aberta',
   sess.sessoesDe({ sessions: [{ ini: 1, fim: 2 }], status: 'active', startedAt: em(2026,8,19,14) }, AGORA).length, 2);
eq('a sessao aberta termina em agora',
   sess.sessoesDe({ status: 'active', startedAt: em(2026,8,19,14) }, AGORA)[0].fim, AGORA);
eq('active sem startedAt nao inventa sessao',
   sess.sessoesDe({ status: 'active', startedAt: null }, AGORA).length, 0);
eq('tarefa sem o campo sessions devolve lista vazia',
   sess.sessoesDe({ status: 'pending', startedAt: null }, AGORA).length, 0);
eq('sessoesDe nao muta a tarefa', (() => {
  const t = { sessions: [{ ini: 1, fim: 2 }], status: 'active', startedAt: 5 };
  sess.sessoesDe(t, AGORA);
  return t.sessions.length;
})(), 1);

/* fecharSessao agora grava a sessao — reusa a extracao ja feita acima. */
const { fecharSessao: fs2 } = new Function(`
  ${extrair('fecharSessao')}
  return { fecharSessao };
`)();
const tg = { elapsed: 0, startedAt: 1000 };
fs2(tg, 4000);
eq('grava a sessao com os limites certos', JSON.stringify(tg.sessions), JSON.stringify([{ ini: 1000, fim: 4000 }]));
eq('e soma o mesmo valor em elapsed', tg.elapsed, 3000);
fs2(tg, 9000);
eq('segunda chamada sem cronometro nao grava sessao', tg.sessions.length, 1);
const tneg = { elapsed: 500, startedAt: 9000, sessions: [] };
fs2(tneg, 1000);
eq('duracao negativa nao grava sessao', tneg.sessions.length, 0);
eq('duracao negativa nao mexe em elapsed', tneg.elapsed, 500);
eq('mas fecha o cronometro mesmo assim', tneg.startedAt, null);

/* ---------- hmCompacto: o formato do numero grande da Visao Geral ---------- */
const { hmCompacto } = new Function(`
  ${extrair('hmCompacto')}
  return { hmCompacto };
`)();

eq('horas redondas nao levam minutos', hmCompacto(120), '2h');
eq('horas com minutos vem coladas e com zero a esquerda', hmCompacto(125), '2h05');
eq('o caso do relato', hmCompacto(630), '10h30');
eq('menos de uma hora mantem min', hmCompacto(45), '45min');
eq('zero', hmCompacto(0), '0min');
eq('uma hora cravada', hmCompacto(60), '1h');
eq('negativo usa o valor absoluto (o sinal vem do selo)', hmCompacto(-90), '1h30');
eq('dois digitos de minuto', hmCompacto(659), '10h59');
/* O ponto do formato: e mais curto que minsToHm, que transbordava o cartao. */
eq('e mais curto que minsToHm', hmCompacto(630).length < minsToHm(630).length, true);

console.log(`\n${ok} passaram, ${falhas.length} falharam\n`);
if (falhas.length) {
  falhas.forEach(f => console.log('  ✗ ' + f + '\n'));
  process.exit(1);
}
