# Calendário — alternador de visão

**Planejado, não implementado.**

Quatro visões: **mensal**, **semanal**, **dia** e **multi-dia** com contagem
escolhida pelo usuário, de 2 a 6 dias.

## Isto reabre o D1, e vale dizer por quê

O [plano do Calendário](calendario.md) recusou a visão semanal no **D1**, com
este argumento:

> `t.time` e `t.dur` são opcionais, e na prática muita tarefa não tem hora — o
> próprio app escreve "Sem horário definido" nessas linhas. Numa grade de horas
> elas não têm onde morar, e a solução clássica é uma faixa "dia inteiro" acima
> da grade: mais uma estrutura, mais um caso de borda, para acomodar o caso que é
> o mais comum aqui.

A observação está certa; a **conclusão estava errada**. Eu tratei a faixa de dia
inteiro como um custo que desqualificava a visão, quando ela é simplesmente a
peça que faltava desenhar. A referência que motivou este pedido usa a faixa
intensamente — "Férias", "Casa", "Escritório", "Day Off" todos moram lá, acima da
grade — e é exatamente onde as tarefas sem hora do Daysk pertencem.

Então o D1 não é revertido por capricho: a objeção que ele levantou passa a ser
**resolvida** em vez de evitada, pelo **V6**.

## O que já existe e sustenta isto

O Calendário atual entrega mais da metade da fundação:

| Peça | Serve para |
|---|---|
| `calendarAnchor`, `calendarSelected` | estado de navegação; precisa generalizar (**V4**) |
| `buildMonthGrid()` | a visão mensal, intacta |
| `tasksByDate()` | índice `data → tarefas`, serve às quatro visões sem mudança |
| `renderCalendarDayPanel()` | o painel, que continua em todas (**V13**) |
| `selectCalendarDay()`, `goToCalendarToday()` | navegação; ganham a unidade da visão (**V5**) |
| `.cal-toolbar` | onde o alternador entra |
| `body.wide-content` | a largura inteira, que a grade de horas também quer |
| `.now-line`, `.now-dot`, `.now-label` | a linha do "agora", a reposicionar (**V11**) |
| `toMins()`, `padTime()`, `minsToHm()` | conversão de horário, incluindo transbordo de 24h |
| `.period-btn` | a linguagem de pílulas da casa (**V1**) |

**Um invariante do modelo que facilita tudo:** `saveTask()` e
`saveQuickSchedule()` fazem `dur = time ? (parseInt(...) || 60) : null`. Ou seja,
**toda tarefa com hora tem duração** — nunca há bloco sem altura. Ainda assim, o
render precisa de guarda: a sincronização não valida schema (documentado em
[modelo-de-dados.md](modelo-de-dados.md)), então um JSON editado à mão pode trazer
`time` sem `dur`.

---

## Decisões

### V1 — O alternador é de pílulas, não um menu suspenso

A referência usa menu suspenso. A casa usa pílulas: `.period-btn` nos Relatórios
(`hoje · semana · mês · tudo`), `.view-btn` na lista (`por horário · por
projeto`), `.nav-item` na navbar. Quatro opções cabem numa fileira e ficam
visíveis sem um clique extra — um menu suspenso esconde as opções e adiciona
estado de aberto/fechado para gerenciar.

`mês · semana · dia · multi-dia`, reusando `.period-btn` com `.active`.

### V2 — A contagem do multi-dia é um `<select>` nativo, de 2 a 6

Aparece **ao lado das pílulas, só quando `multi-dia` está ativa**. Nativo porque
a casa já usa `<select>` (`f-project`) e `<input type="date">`: vem com teclado,
leitor de tela e comportamento de toque de graça, sem uma linha de JS.

Descartei duas alternativas: uma pílula por contagem (`2 · 3 · 4 · 5 · 6`) daria
nove pílulas na fileira, e clicar na pílula para ciclar a contagem é invisível
para quem não adivinha.

### V3 — Duas famílias de render, não quatro

- **Mensal** → a grade de células que já existe.
- **Semanal, dia e multi-dia** → a mesma **grade de horas**, com 7, 1 ou N
  colunas.

Semanal é multi-dia de 7 começando na segunda; dia é multi-dia de 1. Escrever
três renderizadores para o que é um só, parametrizado pela quantidade de colunas,
seria três lugares para o mesmo bug aparecer.

### V4 — A âncora passa a ser "o primeiro dia visível"

Hoje `calendarAnchor` é sempre `'YYYY-MM-01'`, o que só faz sentido para a visão
mensal. Generaliza para **o primeiro dia do intervalo visível**, e cada visão
deriva o intervalo dele:

```js
// esboço, não código final
function calendarRange(view, anchor, n) {
  if (view === 'month') return buildMonthGrid(anchor).map(d => d.date);
  if (view === 'week')  return diasDe(mondayOf(anchor), 7);
  if (view === 'day')   return [anchor];
  return diasDe(anchor, n);                       // multi-dia
}
```

Duas consequências que precisam de cuidado:

- **A visão mensal continua normalizando a âncora** para o dia 1, senão trocar de
  mês a partir do dia 31 escorrega.
- **A semanal normaliza para a segunda-feira** da semana da âncora, mantendo a
  convenção do **D2** e de `getWeekRange()`.
- **Multi-dia começa na âncora**, sem normalizar — é o que a referência faz ao
  mostrar 18, 19, 20 a partir de hoje.

### V5 — `‹` e `›` andam na unidade da visão

| Visão | Passo |
|---|---|
| mensal | ±1 mês, por componentes (**D5**) |
| semanal | ±7 dias |
| dia | ±1 dia |
| multi-dia | ±N dias, a mesma N do `<select>` |

"hoje" leva a âncora para o intervalo que **contém** hoje: dia 1 do mês corrente
na mensal, segunda desta semana na semanal, hoje nas outras duas.

### V6 — Faixa de dia inteiro acima da grade de horas

É a resposta à objeção do **D1**, e não é acessório: é onde vive a tarefa que tem
data e **não** tem hora — o caso mais comum no app.

Uma faixa horizontal entre o cabeçalho das colunas e a grade, com um chip por
tarefa sem hora, na coluna do seu dia. Ela **cresce com o conteúdo** até um teto
(digamos 3 chips) e depois rola dentro de si, para não empurrar a grade de horas
para fora da tela num dia cheio.

Sem essa faixa a visão semanal simplesmente perde tarefas, o que seria pior que
não ter a visão.

### V7 — 24 horas renderizadas, com a rolagem posicionada

Renderizar as 24 horas e **posicionar a rolagem** na primeira hora relevante ao
abrir — a menor hora entre as tarefas visíveis, ou 07:00 se não houver nenhuma.

A alternativa, calcular a janela de horas a partir dos dados, faz a grade mudar
de forma conforme se navega: a mesma hora aparece em alturas diferentes em dias
diferentes, e o olho perde a referência. Vinte e quatro horas sempre iguais custam
rolagem e entregam previsibilidade.

O contêiner leva `max-height` e `overflow-y: auto`, então a grade rola **dentro
de si**, sem empurrar o painel do dia para longe.

### V8 — Altura por hora constante, com piso por bloco

Um token, `--cal-hour-h: 48px`, e a posição de cada bloco sai de
`toMins(t.time) / 60 * altura`. Vinte e quatro horas dão 1152px de grade rolável.

**Piso de altura por bloco.** A 48px/h, uma tarefa de 15 minutos tem 12px — menos
que uma linha de texto. Cada bloco recebe uma altura mínima (~18px) para o rótulo
caber. Isso faz o bloco *mentir* um pouco sobre a duração de tarefas muito
curtas; é uma troca deliberada, porque um bloco ilegível não informa nada. O
horário exato continua no rótulo e no `title`.

### V9 — Sobreposição resolvida por empacotamento em colunas

Duas tarefas às 10:00 não podem se desenhar uma sobre a outra. O algoritmo é o
clássico de coloração de intervalos:

1. Ordene por início.
2. Agrupe em **clusters** de tarefas que se sobrepõem transitivamente.
3. Dentro do cluster, atribua a cada tarefa a primeira coluna livre.
4. Largura de cada bloco = `1 / colunasDoCluster`, deslocamento = `coluna × largura`.

Esta é a parte mais algorítmica do trabalho, e por isso **tem de ser uma função
pura** — `packOverlaps(tarefas) → [{ t, col, cols }]` — testável no harness sem
navegador. É onde vou querer casos de borda: encaixe exato (uma termina 10:00,
outra começa 10:00, **não** se sobrepõem), contenção total, e cadeia de três em
que a primeira e a terceira não se tocam.

### V10 — Tarefa que atravessa a meia-noite é aparada no fim do dia

`padTime()` existe porque uma tarefa de 23:00 com 120 minutos termina às 00:30 —
o bug do PR #5. Na grade, o bloco é **aparado às 24:00** em vez de vazar para
fora do contêiner ou de aparecer duplicado no dia seguinte.

Vazar quebra o layout; duplicar exige decidir o que significa "a mesma tarefa em
dois dias" e mexeria no modelo. Aparar é honesto — e o rótulo, via `padTime()`,
continua dizendo `00:30`, então a informação não se perde.

### V11 — A linha do "agora" só na coluna de hoje

Reusa `.now-line` / `.now-dot` / `.now-label`, reposicionada: uma linha
horizontal em `getNowMins() / 60 * altura`, **dentro da coluna de hoje** e só
dela. Se hoje não está no intervalo visível, não há linha.

E ela se move sozinha: `renderCalendar()` é chamada de dentro do `render()`
(**D10**), que roda a cada 60 segundos.

### V12 — Clicar num vão vazio cria com data **e** hora

Na grade de horas, o clique tem uma coordenada que significa algo — dia e hora.
Desperdiçá-la seria perder o melhor gesto da tela. Clicar às 14h de quinta abre o
formulário com data e hora preenchidas.

Isso pede a segunda extensão de `openCreateForm()`, que já aceita data desde o
**D8**:

```js
// esboço, não código final
function openCreateForm(dateStr, timeStr) { ... }
```

Arredondar a hora do clique para o intervalo de 15 ou 30 minutos mais próximo —
clicar não é medir, e ninguém quer criar uma tarefa às 14:07.

### V13 — O painel do dia continua em todas as visões

Ele é o único lugar com os botões de iniciar, concluir, editar e excluir — os
`taskRowHtml()` completos. Na grade de horas, clicar num bloco **seleciona o dia
daquele bloco** e o painel mostra o dia inteiro.

Mantém um só modelo mental: *a grade mostra, o painel age*. É o mesmo que o
**D7**/**D8** decidiram para a visão mensal, e evita ter de embutir botões de ação
dentro de blocos que podem ter 18px de altura.

### V14 — No mobile, a grade de horas rola horizontalmente **dentro de si**

Sete colunas de horário em 375px são inúteis. Cada coluna ganha uma largura
mínima (~110px) e o contêiner recebe `overflow-x: auto`.

Isso **não** é o scroll horizontal que o PR #8 caçou: aquele era a *página*
inteira rolando, sintoma de estouro de grid. Este é contido, num contêiner que se
declara rolável — o mesmo padrão de `.report-table-wrap`, que já rola a tabela do
relatório sem contaminar a página. A verificação continua a mesma:
`documentElement.scrollWidth === innerWidth`.

Descartei degradar a visão semanal para a visão dia no mobile: seria decidir pelo
usuário que ele não pode ver a semana no celular, quando a rolagem resolve.

### V15 — A escolha da visão persiste

`daysk-cal-view` e `daysk-cal-days` no `localStorage`, junto de `daysk-theme` e
`daysk-sync-mode`, que já persistem. Quem trabalha em visão semanal não quer
voltar para a mensal a cada vez que abre o app.

---

## Casos de borda

| Caso | Comportamento |
|---|---|
| Tarefa com data, sem hora | faixa de dia inteiro (**V6**) |
| Tarefa sem data | não aparece em visão nenhuma; é da caixa de entrada |
| Tarefa com hora e `dur` nulo (JSON externo) | bloco com a altura mínima; não estoura |
| Tarefa de 15 min | bloco com o piso de altura; rótulo legível (**V8**) |
| 23:00 + 120 min | aparado às 24:00; rótulo diz `00:30` (**V10**) |
| Duas tarefas no mesmo horário | lado a lado, meia largura cada (**V9**) |
| Uma termina 10:00, outra começa 10:00 | **não** se sobrepõem; largura cheia |
| Dia sem nenhuma tarefa | grade de horas vazia, faixa de dia inteiro vazia |
| Hoje fora do intervalo visível | sem linha do "agora" (**V11**) |
| Concluída | mesmo tratamento da mensal: esmaecida e riscada (**D4**) |
| Multi-dia atravessando o fim do mês | sem tratamento especial; são só datas |
| Semana atravessando a virada do ano | idem; `addDays()` já atravessa |
| Trocar de visão | a âncora é normalizada para a nova unidade (**V4**) |

## Pontos de edição

| O quê | Onde |
|---|---|
| Pílulas + `<select>` da contagem | `.cal-toolbar` |
| Estado | `calendarView`, `calendarMultiDays`, e a semântica nova de `calendarAnchor` |
| Intervalo visível | `calendarRange(view, anchor, n)` — pura |
| Empacotamento | `packOverlaps(tarefas)` — pura, o coração do trabalho |
| Render da grade de horas | `renderTimeGrid(dias)` — nova, a maior peça |
| Render mensal | `renderCalendar()` passa a despachar entre as duas famílias |
| Navegação | `setCalendarStep(±1)` no lugar de `setCalendarMonth`, e `goToCalendarToday()` |
| Cabeçalho | ramo `calendar` do `updateHeader()`: o rótulo muda por visão |
| Criar com hora | `openCreateForm(dateStr, timeStr)` |
| CSS | grade de horas, régua, faixa de dia inteiro, bloco, alternador |

Nada muda em `matchesBucket()`, `taskRowHtml()` nem no modelo de dados.

## Ordem de implementação

O trabalho é maior que o da visão mensal, então a ordem importa. **Se você quiser
algo em `main` antes**, o corte natural é depois do passo 4: alternador
funcionando com mensal e dia, que já entrega valor e exercita toda a fundação.

1. **Generalizar a âncora e o intervalo.** `calendarRange()` + navegação por
   unidade, com a visão mensal como única consumidora. Nada muda na tela; a
   verificação é que a mensal continua idêntica.
2. **O alternador**, com só `mês` e `dia` ligados. `dia` renderiza provisoriamente
   pelo painel, sem grade.
3. **`packOverlaps()` isolada**, com o harness antes de qualquer pixel. É a peça
   que não se depura no olho.
4. **A grade de horas de uma coluna** (visão dia): régua, blocos, faixa de dia
   inteiro, linha do "agora".
5. **N colunas**: semanal e multi-dia caem quase de graça, mais o `<select>`.
6. **Mobile**: larguras mínimas e rolagem contida.
7. **Persistência** e as bordas da tabela acima.

## Verificação

**Harness em Node**, sobre as duas funções puras:

`calendarRange()` — 7 dias na semanal sempre começando na segunda; 1 na dia; N na
multi; 42 na mensal; virada de mês e de ano nos quatro modos; e a normalização da
âncora ao trocar de visão.

`packOverlaps()` — é aqui que mora o risco:

1. Duas idênticas → 2 colunas, meia largura cada.
2. Encaixe exato (10:00–11:00 e 11:00–12:00) → 1 coluna, largura cheia.
3. Contenção (09:00–17:00 e 10:00–11:00) → 2 colunas.
4. Cadeia A(9–10), B(9:30–10:30), C(10:15–11): A e C não se tocam, mas o cluster
   é um só — a largura tem de sair de 3 ou de 2, e o teste fixa qual.
5. Cinco simultâneas → 5 colunas, nenhuma com largura zero.
6. Uma tarefa só → largura cheia, sem deslocamento.
7. Tarefa sem hora → **não** entra no empacotamento; é da faixa.

**No navegador**, além do roteiro do [Calendário](calendario.md):

1. As quatro visões renderizam, e o alternador marca a ativa.
2. O `<select>` de 2 a 6 muda a contagem de colunas e o passo do `›`.
3. `‹`/`›` andam na unidade certa em cada visão; "hoje" volta nas quatro.
4. A faixa de dia inteiro recebe as tarefas sem hora, e some quando não há.
5. Sobreposição desenha lado a lado; encaixe exato usa largura cheia.
6. A tarefa de 23:00 com 2h é aparada e o rótulo diz `00:30`.
7. A linha do "agora" aparece só na coluna de hoje, e **sobrevive a mais de um
   minuto** na tela — a armadilha dos 60s, que já mordeu este projeto três vezes.
8. Clicar num vão cria com data e hora arredondadas.
9. Concluir pelo painel atualiza o bloco na grade sem recarregar.
10. **Zero scroll horizontal de página** em 480, 600, 768, 861, 1024, 1280 e
    1600px, nas quatro visões — a rolagem da grade é contida (**V14**).
11. Contraste dos elementos novos nos dois temas, com as transições desligadas.
    A régua de horas é o candidato a nascer em `--text3`; **texto pequeno usa
    `--text2`** nesta casa, e eu já errei isso duas vezes.

## Fora de escopo

- **Visão de ano e visão de agenda**, que a referência mostra. Não foram pedidas,
  e "agenda" é quase o que a aba Tasks já faz.
- **Arrastar para mover ou redimensionar** na grade de horas. Numa grade de horas
  a tentação é grande, mas é uma camada de interação inteira, com toque. O
  caminho de dois cliques (`openQuickScheduleModal`) continua valendo.
- **Multi-semana**, também na referência.
- **Fuso horário e eventos recorrentes.** O modelo não tem nem um nem outro.
