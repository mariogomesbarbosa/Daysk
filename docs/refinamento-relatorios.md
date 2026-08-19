# Relatórios — largura, registro de sessões e horas trabalhadas

Dois pedidos: a página não usa a largura disponível, e os gráficos medem quase
só contagem de cartões concluídos — faltam horas trabalhadas e a distribuição
delas por atividade e por projeto.

O segundo pedido **muda o modelo de dados**, que é a parte cara e a razão de
este documento existir antes do código.

Números de linha envelhecem — este documento cita nomes de função.

---

## O que já existe, e não precisa ser refeito

Vale começar por aqui porque metade do pedido já está na tela, só que escondida
ou medindo a coisa errada:

| O quê | Onde | Estado |
|---|---|---|
| Tempo total do período | `Visão Geral` → "Tempo Registrado" | existe, mas como **subtexto pequeno** |
| Média diária | `Visão Geral` → substat | idem |
| Horas por dia | `Curva de Desempenho`, alternador "Tempo" | existe, e **mente** — ver **S1** |
| Horas por projeto | seção "tempo por projeto / demanda" | existe, exato, em barras |
| Previsto e registrado por atividade | tabela "detalhamento" | existe, como texto, **nunca confrontados** |
| Contagem de concluídas por projeto | donut `Estatísticas por Projeto` | existe, mede contagem |

Ou seja: **horas por atividade e por projeto já são exatas hoje**, porque
`t.elapsed` é por tarefa e `t.projectId` não muda. O que não existe é
visualização — e o que não é derivável é **horas por dia**.

---

## Grupo L — a largura

### L1 — A causa é uma linha, e o desperdício são 300px

Medido no navegador, viewport de 1536px:

| | Largura |
|---|---|
| `.container` | 1180px |
| `.app-shell` (o elemento) | 1180px |
| **a coluna de conteúdo** | **880px** |
| sobra à direita | **300px** |

A regra é `body.no-sidebar .app-shell { grid-template-columns: minmax(0, 880px) }`,
criada no Bloco 3 para "proteger telas que ninguém havia desenhado". O
Calendário saiu desse teto no commit [`af1f156`](calendario.md) ganhando
`body.no-sidebar.wide-content`, e o `switchTab()` liga essa classe assim:

```js
document.body.classList.toggle('wide-content', tab === 'calendar');
```

**Relatórios nunca entrou na lista.** A correção é incluir `'report'`. Simulei a
mudança na página e os cartões vão de 432px para 582px cada.

Não é preguiça chamar isto de uma linha: a classe já existe, já tem
especificidade resolvida e já é usada. Inventar um mecanismo novo seria pior.

### L2 — Aos 1180px, três colunas em vez de duas mais largas

Com os cartões novos do grupo H chegando, dois cartões de 582px deixam ar demais
dentro de cada um — o donut e a Visão Geral já sobram em 432px.

```css
.report-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

@media (min-width: 1100px) {
  .report-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 860px) {
  .report-grid { grid-template-columns: minmax(0, 1fr); }
}
```

Três colunas a 1180px dão ~380px por cartão — mais que os 432px de hoje? Não:
**menos**. E é de propósito. O ganho não é cartão maior, é **mais cartão visível
sem rolar**, que é o que um painel quer. Os gráficos do Chart.js são
`responsive` e não têm largura mínima intrínseca depois do `minmax(0, 1fr)`, que
o PR #8 já resolveu.

`minmax(0, 1fr)` e não `1fr`: o comentário que já está no arquivo explica, e
continua valendo — o mínimo automático do `1fr` é o `min-content`, e canvas tem
largura intrínseca.

### L3 — Os breakpoints a conferir, e o que se espera em cada

O arquivo tem breakpoints em 860, 600 e 480. Somando o novo de 1100:

| Largura | `.report-grid` | O que verificar |
|---|---|---|
| 1440 | 3 colunas | sem faixa vazia à direita; `.container` e `.app-shell` com o mesmo `right` |
| 1180 | 3 colunas | o caso do relato |
| 1100 | 3 colunas | a fronteira: ~347px por cartão, o donut ainda cabe ao lado da legenda |
| 1099 | 2 colunas | não pode haver salto de layout feio na virada |
| 900 | 2 colunas | |
| 860 | 1 coluna | breakpoint existente |
| 600 | 1 coluna | `.cal-chip` some no Calendário; aqui só a tabela importa |
| 480 | 1 coluna | `.report-table` cai para `min-width: 420px` e rola dentro de `.report-table-wrap` |
| 375 | 1 coluna | **a faixa que `pendencias.md` diz nunca ter sido vista** |

**Zero scroll horizontal em todas.** A medida é `document.documentElement.scrollWidth`
contra `window.innerWidth`, e não o olho — foi assim que o falso positivo de
`devicePixelRatio` foi desmascarado na reestruturação.

### L4 — O `.donut-wrapper` é o que quebra primeiro

Ele é `display: flex` com o canvas de 140px fixo mais a legenda. A ~347px de
cartão (três colunas a 1100px), sobra ~180px para a legenda, que hoje mostra
nome do projeto e "N (P%)". É o item mais apertado do grupo L e o primeiro a
olhar na verificação visual; se não couber, a saída é empilhar a legenda abaixo
do donut abaixo de certa largura de **cartão** — o que exige container query ou
uma classe posta pelo JS, porque media query não conhece a largura do cartão.

Registrado como risco, não como decisão: só quem vê decide.

---

## Grupo S — o registro de sessões

### S1 — O que está errado hoje, e por quê

`t.elapsed` é um **acumulador único**. Não existe registro de quando o tempo foi
gasto. A consequência está viva na tela:

> A "Curva de Desempenho / Tempo" faz
> `filtered.filter(t => t.date === ds)` e soma `effectiveElapsed(t)`.

Isto atribui **todo** o tempo de uma tarefa à data **planejada** dela. Uma tarefa
marcada para segunda, trabalhada quarta e quinta, joga todas as horas na segunda
— num dia em que nada foi feito.

Não é um bug de implementação; é o modelo não tendo a informação. E a mesma falha
já está registrada em [modelo-de-dados.md](modelo-de-dados.md) para o gráfico de
conclusão, que agrupa por `t.date` em vez de data de conclusão.

### S2 — A decisão: sessões no modelo

Escolhida com o custo na mesa. Campo novo:

```js
t.sessions = [ { ini: <timestamp>, fim: <timestamp> }, ... ]
```

**`t.elapsed` continua sendo a fonte da verdade dos totais.** As sessões são
detalhamento aditivo, não substituição. O motivo é concreto: `elapsed` é lido
por `getProgress()`, pela `taskRowHtml()`, pela Visão Geral, pela tabela e pelas
barras por projeto, e os três modos de sincronização serializam o array **sem
validar schema**. Um dado vindo de uma versão antiga do app terá `elapsed` e não
terá `sessions` — e nesse caso os totais precisam continuar certos.

Regra, então: **total sai de `elapsed`; recorte por dia sai de `sessions`.**

### S3 — Um único lugar fecha sessão, e hoje ele está copiado três vezes

O fechamento de tempo aparece **três vezes idêntico** no arquivo:

- `startTask()`, ao pausar automaticamente a tarefa que estava rodando
- `pauseTask()`
- `completeTask()`

```js
t.elapsed = (t.elapsed || 0) + (agora - t.startedAt);
t.startedAt = null;
```

A extração vem antes da funcionalidade, e paga sozinha:

```js
/* Fecha a sessão em aberto. Único lugar que soma em elapsed — antes disto a
   mesma linha estava copiada em startTask, pauseTask e completeTask, e uma
   sessão gravada em dois dos três seria um bug invisível. */
function fecharSessao(t, agora) {
  if (!t.startedAt) return;
  const dur = agora - t.startedAt;
  t.elapsed = (t.elapsed || 0) + dur;
  if (dur > 0) (t.sessions = t.sessions || []).push({ ini: t.startedAt, fim: agora });
  t.startedAt = null;
}
```

`startTask()` continua sendo o único que **abre**, com `t.startedAt = agora`.

### S4 — A sessão em aberto conta, como `effectiveElapsed` já faz

Uma tarefa `active` tem tempo que ainda não virou sessão. O recorte por dia
precisa incluí-lo, ou o dia de hoje aparece menor do que é enquanto o cronômetro
roda. A função de agregação recebe as sessões **mais** a sessão virtual
`{ ini: t.startedAt, fim: Date.now() }` quando `status === 'active'`.

É a mesma regra de `effectiveElapsed()`, e por isso deve ser escrita ao lado
dela, não longe.

### S5 — Sessão que atravessa a meia-noite é **partida**, não atribuída

Uma sessão das 23:00 às 01:00 são duas horas de trabalho em **dois dias**.
Atribuir ao dia de início seria repetir, em escala menor, o erro que este grupo
existe para corrigir.

```js
/* Reparte uma sessão pelos dias que ela cobre. Pura, e é aqui que o harness
   aponta: virada de dia, virada de mês e horário de verão são exatamente os
   casos que não se conferem no olho. */
function msPorDia(sessoes) { /* Map<'YYYY-MM-DD', ms> */ }
```

Datas saem de `toDateStr(new Date(ts))`, que é horário local — coerente com o
resto do app, onde data é sempre string local.

### S6 — Tarefas antigas ganham uma sessão sintética, e ela se declara

Sem isto, **todo o histórico some do gráfico diário**: uma tarefa antiga tem
`elapsed` de 3h e nenhuma sessão, então o total diz 3h e o gráfico por dia diz
zero. Dois números na mesma tela discordando é pior que uma aproximação
assumida.

Em `migrate()`, que já roda a cada carregamento:

```js
if (!t.sessions && (t.elapsed || 0) > 0 && t.date) {
  t.sessions = [{ ini: <t.date às 12:00 local>, fim: <+elapsed>, sintetica: true }];
}
```

Meio-dia e não meia-noite de propósito: uma sessão sintética longa ancorada em
00:00 vazaria para o dia anterior se alguém mudar a regra de partição, e 12:00
mantém a maioria dos casos dentro do próprio dia.

**A flag `sintetica` não é decorativa.** Ela permite a interface dizer a verdade
— tooltip ou nota de rodapé no gráfico diário informando que parte do período é
estimada. Sem a flag, a aproximação vira mentira silenciosa, que é o que este
grupo existe para acabar.

Tarefas sem `t.date` e com `elapsed` ficam de fora: não há dia para ancorar.
Elas continuam contando no total e não aparecem no recorte diário — e essa é a
única inconsistência que sobra, pequena e explicável.

### S7 — O que isto obriga a testar nos três modos de sincronização

`modelo-de-dados.md` avisa: os três modos serializam com `JSON.stringify` **sem
validar schema**, e é isso que torna mudança de modelo transparente — e também
o que faz um campo malformado não ser detectado em lugar nenhum.

`sessions` é um array de objetos, o primeiro campo aninhado do modelo. Testar os
três (cache, pasta local, Drive) não é zelo: é o único lugar onde isso quebra.

---

## Grupo H — as horas na tela

### H1 — Horas viram KPI de destaque

A `Visão Geral` hoje tem dois números grandes (Concluídas, Taxa) e dois
subtextos (Tempo Registrado, Média Diária). **Horas trabalhadas sobem para
número grande**, ao lado de Concluídas, com a mesma comparação "vs anterior" que
os outros dois já têm — a máquina de tendência (`inPreviousPeriod`, os rótulos
`↑ ↓ =`) já existe e é reusada.

Com três números grandes, a `.overview-divider` precisa virar duas, ou o bloco
vira grade de três colunas. Decisão de quem implementa; o layout já é flex.

### H2 — Horas por atividade, top N, em barras horizontais

O pedido literal de "distribuição dessas horas nas atividades". Cartão novo.

- Ordena por `effectiveElapsed` decrescente.
- **Top 8**, mais uma linha "outras (N)" agregando o resto. Sem o agregado, um
  período de "tudo" viraria uma lista de cem barras de 1px.
- Reusa `.project-bars` — a estrutura de barra rotulada já existe e é boa; o que
  muda é o que alimenta.
- Cor da barra: a do **projeto** da atividade. Amarra os dois cartões visualmente
  sem inventar paleta.
- Rótulo: nome da atividade, tempo em `minsToHm()`, e o percentual do total.

**Nenhum limite silencioso.** Se houver corte, a linha "outras (N)" o declara —
regra que o projeto já segue nos planos anteriores.

### H3 — O donut ganha alternador Tarefas / Horas

Hoje `Estatísticas por Projeto` mede **contagem de concluídas**. Ganha um par de
pílulas igual ao da Curva de Desempenho (`.card-pills`, `pill-btn`) alternando
para **horas**.

Por que alternador e não um segundo donut: a pergunta "onde foi meu tempo" e
"onde saíram entregas" são a mesma forma com dois dados. Dois donuts lado a lado
seriam dois gráficos idênticos que o olho confunde.

O centro do donut e a legenda mudam junto: `1 Concluídas` vira `5h32min` e a
legenda troca `N (P%)` por `Xh (P%)`.

A preferência **não persiste** entre sessões — é leitura, não configuração, e o
alternador da curva também não persiste hoje. Coerência antes de opinião.

### H4 — Previsto vs registrado

Cartão novo, e é o único que responde uma pergunta nova: **"eu estimo bem?"**

- Barras agrupadas por projeto: `Σ t.dur` (previsto) contra `Σ elapsed` (real).
- Só entram tarefas com `t.dur` preenchido — sem previsão não há comparação, e
  contá-las como zero previsto faria toda estimativa parecer estourada.
- O cartão declara quantas tarefas ficaram de fora por não ter previsão.

Nota que vale ao implementar: `t.dur` passou a ser preenchido pelo campo "Final"
(PR #15), e o padrão de 60min entra quando há hora e não há fim. Uma tarefa que
nunca foi olhada carrega uma previsão que ninguém fez de verdade. Não muda o
gráfico, mas muda como se lê.

### H5 — Todo tempo registrado conta, concluída ou não

Hora trabalhada é hora trabalhada. É o que a Visão Geral e a seção "tempo por
projeto" **já fazem** hoje, então a escolha não é preferência: é não deixar dois
critérios de horas convivendo na mesma página.

Consequência a declarar na interface: os cartões de **conclusão** filtram por
`status === 'done'` e os de **horas** não. São perguntas diferentes, e o título
de cada cartão precisa deixar isso claro sem nota de rodapé.

### H6 — A curva diária passa a usar as sessões

É o que o grupo S habilita. `currentCurveMetric === 'time'` deixa de somar
`effectiveElapsed` por `t.date` e passa a ler `msPorDia()`.

Quando o período contiver sessão sintética (**S6**), o cartão exibe uma nota
discreta: parte destas horas é estimada a partir da data planejada.

---

## Casos de borda

| Caso | Esperado |
|---|---|
| Tarefa `active` durante a leitura | conta com a sessão virtual (**S4**); a curva do dia sobe a cada render de 60s |
| Sessão 23:00→01:00 | 1h em cada dia (**S5**) |
| Sessão inteira dentro de um dia | um único balde |
| Tarefa antiga com `elapsed` e sem `sessions` | sessão sintética ao meio-dia da data planejada, marcada (**S6**) |
| Tarefa antiga com `elapsed` e **sem data** | conta no total, some do recorte diário — inconsistência conhecida |
| `startTask` sobre outra tarefa ativa | fecha a sessão da anterior e abre a nova, no mesmo `agora` |
| `pauseTask` seguido de `startTask` | duas sessões, não uma |
| Duração de sessão zero ou negativa | não grava sessão (relógio do sistema pode andar para trás) |
| Período sem nenhuma tarefa | todos os cartões no estado vazio, sem `NaN` e sem divisão por zero |
| Todas as tarefas sem `t.dur` | o cartão Previsto vs Registrado se declara sem dados |
| Uma única atividade no período | top N com uma barra a 100% |
| Projeto excluído com tarefas antigas | cai no balde "Sem projeto", que o donut já trata |

---

## Pontos de edição

| Grupo | O quê | Onde |
|---|---|---|
| L | incluir `'report'` no toggle | `switchTab()` |
| L | breakpoint de 1100px | CSS de `.report-grid` |
| S | `fecharSessao()` extraída | ao lado de `effectiveElapsed()` |
| S | as três chamadas | `startTask()`, `pauseTask()`, `completeTask()` |
| S | `msPorDia()` pura | ao lado de `fecharSessao()` |
| S | sessão sintética | `migrate()` |
| H | KPI de horas | markup da `Visão Geral` + `renderReport()` |
| H | cartão de atividades | markup novo + função de render |
| H | alternador do donut | `.card-pills` no cartão + `updateCharts()` |
| H | cartão previsto vs registrado | markup novo + `updateCharts()` |
| H | curva por sessões | `updateCharts()`, ramo `currentCurveMetric === 'time'` |
| docs | modelo de dados | `modelo-de-dados.md` — `sessions` e a regra "total do `elapsed`" |

---

## Ordem de implementação

Quatro PRs, um assunto cada, por risco crescente:

1. **`fix/relatorios-usam-a-largura-inteira`** — grupo L. Só CSS e uma linha de
   JS. Entrega sozinho o primeiro pedido e não depende de nada.
2. **`refactor/extrair-fechar-sessao`** — só o **S3**, sem campo novo. Uma
   extração que remove duplicação existente e não muda comportamento nenhum.
   Separado de propósito: torna o PR seguinte legível, porque lá a mudança de
   modelo não vem misturada com uma refatoração.
3. **`feat/registro-de-sessoes`** — o resto do grupo S mais o **H6**. É o PR que
   mexe no modelo e o único que precisa dos três modos de sync testados.
4. **`feat/horas-nos-relatorios`** — grupo H (H1–H5). Só leitura, sobre um modelo
   que a essa altura já está estável.

O 1 e o 2 são independentes entre si e podem ir em qualquer ordem. O 3 depende
do 2. O 4 depende do 3 só para o H6, que já terá ido junto no 3.

---

## Verificação

**Lógica pura, no Node**, em `tests/funcoes-puras.mjs`, que já tem 60 casos:

- `msPorDia()`: sessão dentro do dia, atravessando a meia-noite, atravessando
  dois dias inteiros, virada de mês, virada de ano, duração zero, lista vazia,
  e a soma dos baldes batendo com a soma das durações.
- `fecharSessao()`: soma em `elapsed`, cria a sessão, zera `startedAt`, não grava
  duração não-positiva, e é idempotente com `startedAt` nulo.
- A sessão sintética de `migrate()`: cria só quando há `elapsed` e `date`, marca
  `sintetica`, e **não recria** numa segunda chamada.

**Interface, no navegador:**

- **Largura:** as nove faixas da tabela do **L3**, medindo `scrollWidth` contra
  `innerWidth`, e conferindo que `.container` e `.app-shell` terminam no mesmo
  `right`.
- **Sessões:** iniciar, pausar, reiniciar e concluir, conferindo o array
  crescendo com os limites certos; e a soma das sessões batendo com `elapsed`.
- **Os três modos de sincronização** (**S7**), gravando e relendo.
- **Gráficos:** os quatro períodos (hoje/semana/mês/tudo) contra dados semeados
  com valores conhecidos — incluindo uma sessão que atravessa a meia-noite, cujo
  resultado no gráfico é conferível à mão.
- **Contraste dos cartões novos nos dois temas**, alternando **pelo toggle** e
  com as transições desligadas antes de medir. Esta armadilha já custou uma
  rodada em cada um dos três PRs anteriores.

---

## Fora de escopo

- **Editar tempo à mão** — corrigir uma sessão esquecida rodando a noite toda.
  É a consequência natural de ter sessões, e é um pedido próprio.
- **Exportar relatório** (CSV, PDF).
- **Metas de horas** por dia, semana ou projeto.
- **Gráfico de conclusão por data de conclusão** em vez de data planejada. É a
  ressalva de `modelo-de-dados.md` sobre `completedAt`, e agora fica **mais**
  ao alcance — mas depende de `reopenTask()` parar de deixar `completedAt`
  mentindo, que é a pendência registrada.
- **Fuso horário e recorrência.** O modelo não tem nem um nem outro.
- **Reescrever o `README.md` da raiz.** Continua desatualizado por outras razões,
  e é decisão de quem mantém.

---

## Riscos, nomeados

| Risco | Onde | Mitigação |
|---|---|---|
| Sessões e `elapsed` divergirem | S | `elapsed` é a fonte dos totais; sessões só recortam |
| Dado antigo sem `sessions` sumir do gráfico diário | S6 | sessão sintética marcada, e a interface diz que é estimada |
| Campo aninhado quebrar num modo de sync | S7 | testar os três, gravando e relendo |
| Legenda do donut espremida em 3 colunas | L4 | é o primeiro item da verificação visual |
| Top N esconder dados sem avisar | H2 | linha "outras (N)" explícita |
| Duas semânticas de horas na página | H5 | um critério só, declarado no título dos cartões |
| Medir tema no meio da transição | verificação | desligar transições antes de medir — já mordeu três vezes |
