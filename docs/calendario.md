# Calendário

**Implementado.** As treze decisões entraram como planejadas. O que só apareceu
ao implementar está em [O que a implementação revelou](#o-que-a-implementação-revelou),
no fim.

Última peça pendente da reestruturação. O Calendário entrou no Bloco 0 apenas
como item de navegação e página vazia, de propósito: o conteúdo dependia de data
arbitrária, que só chegou no PR #3. A fundação existe desde então e nunca foi
usada.

## O que existe hoje

Praticamente nada, e isso é bom — é uma folha em branco sem dívida a desfazer.
São **quatro** as menções a `calendar` no arquivo:

| Onde | O quê |
|---|---|
| `#view-calendar` | `<div class="empty">o calendário chega em breve</div>` |
| `.nav-item[data-tab="calendar"]` | o item da navbar, já funcionando |
| `VIEWS` | `['today', 'calendar', 'report']`, usado por `switchTab()` |
| `updateHeader()` | ramo que escreve `calendário` / `em breve` |

Nenhuma linha de CSS. Nenhum estado. `switchTab('calendar')` já esconde o
sidebar (`body.no-sidebar`), esconde o botão "nova atividade" e chama `render()`.

### O que dá para reaproveitar

| Peça | Serve para |
|---|---|
| `toDateStr()`, `addDays()`, `todayStr()` | aritmética de dia, já à prova de fuso |
| `taskSortKey()` | ordenar as tarefas dentro de um dia |
| `formatDateShort()`, `days`, `months` | rótulos |
| `PALETTE` + `.project-dot` | identidade de projeto, como no sidebar |
| `taskRowHtml(t, opts)` | as linhas do painel de dia — **sem reescrever nada** |
| `openEditForm(id)` | clicar numa tarefa do calendário |
| `openCreateForm()` | criar tarefa; precisa aceitar uma data (ver **D8**) |
| `esc()` | nome de tarefa em `title`, para não repetir a dívida de escape |

## Escopo

**Entra:** grade mensal navegável, com as tarefas de cada dia, e um painel do dia
selecionado.

**Não entra:** visão semanal com grade de horas, arrastar para reagendar, e
navegação por teclado com setas. Cada uma tem sua razão, em
[Fora de escopo](#fora-de-escopo).

---

## Decisões

### D1 — Visão mensal, não semanal

A visão semanal que as pessoas esperam é a grade de horas do Google Calendar:
linhas de hora, blocos proporcionais à duração. **O modelo de dados não sustenta
isso bem.** `t.time` e `t.dur` são opcionais, e na prática muita tarefa não tem
hora — o próprio app escreve "Sem horário definido" nessas linhas. Numa grade de
horas elas não têm onde morar, e a solução clássica é uma faixa "dia inteiro"
acima da grade: mais uma estrutura, mais um caso de borda, para acomodar o caso
que é o mais comum aqui.

A visão mensal responde a pergunta que o app ainda não responde — *onde está meu
trabalho ao longo do mês* — e acomoda tarefa com e sem hora do mesmo jeito.

### D2 — A semana começa na segunda-feira

Não é preferência: `getWeekRange()`, que alimenta o relatório, já calcula a
semana de segunda a domingo (`diffToMonday`). Duas convenções de semana no mesmo
app é uma mentira para quem compara as duas telas.

**Cuidado ao montar o cabeçalho:** o array `days` começa em `domingo` (índice 0,
como `Date.getDay()`). A fileira de cabeçalho **não** é `days` na ordem — é
`[1,2,3,4,5,6,0]` mapeado sobre `days`.

### D3 — Grade de 6 linhas, sempre

Um mês cabe em 5 ou 6 linhas conforme o dia da semana em que começa. Deixar a
grade variar faz o conteúdo abaixo dela pular ao trocar de mês. Seis linhas
fixas, 42 células, com os dias vizinhos preenchendo as pontas — esmaecidos, e
clicáveis: clicar num dia de outro mês navega para aquele mês.

### D4 — O Calendário mostra concluídas; "Hoje" não

Parece contradizer o [ajuste do balde "Hoje"](ajuste-balde-hoje-concluidas.md),
que tirou toda concluída de lá. Não contradiz, e a distinção é o ponto:

- **"Hoje" é uma lista de pendências.** Responde *o que falta fazer*. Uma tarefa
  concluída não é trabalho a fazer, então sai.
- **O Calendário é um mapa do tempo.** Responde *o que tem neste dia*. Esconder
  as concluídas faria todo dia passado parecer vazio, o que é factualmente
  falso — e destruiria o principal valor de olhar para trás.

As concluídas aparecem esmaecidas e riscadas, como já aparecem na lista de
tarefas. Quem olha uma semana passada vê o que fez, não um deserto.

### D5 — Aritmética de mês por componentes, não por `addDays`

`addDays(ds, 30)` não significa "mês seguinte". Trocar de mês precisa de
`new Date(ano, mes + 1, 1)`.

Isso **não** viola a armadilha documentada em
[modelo-de-dados.md](modelo-de-dados.md). A armadilha é o *parse de string*:
`new Date('2026-08-14')` é interpretado como UTC e desloca o dia. Construir por
componentes — `new Date(2026, 7, 14)` — é horário local e é exatamente a
ferramenta correta para virar mês, ano e ano bissexto.

Dois idiomas que resolvem tudo:

```js
// esboço, não código final
const primeiroDoMes = (ano, mes) => toDateStr(new Date(ano, mes, 1));
const diasNoMes     = (ano, mes) => new Date(ano, mes + 1, 0).getDate(); // dia 0 = último do anterior
```

O estado fica como **string**, `calendarAnchor = 'YYYY-MM-01'`, para respeitar a
regra da casa de que datas são strings. Os componentes só aparecem dentro dessas
duas funções.

### D6 — Um índice por data, montado uma vez

O caminho ingênuo é `tasks.filter(...)` dentro de cada célula: 42 filtragens por
render, e o render roda a cada 60 segundos. Monte um `Map` de `data → tarefas`
numa passada, ordenando cada dia por `taskSortKey()`, e cada célula faz um
`get()`.

Tarefas sem data não entram no índice — não pertencem a dia nenhum.

### D7 — Chips no desktop, pontos no mobile, painel de dia sempre

Sete colunas em 375px dão ~50px por célula. Nome de tarefa não cabe em 50px, e
este app **já tem** um bug exatamente assim: `.task-name` chega a 0px de largura
abaixo de 480px (ver [pendencias.md](pendencias.md)). Repetir o padrão seria
repetir o erro conscientemente.

Então a célula tem dois estados:

- **Desktop:** número do dia + até 3 chips, cada um com ponto de cor do projeto,
  hora (se houver) e nome truncado com `text-overflow: ellipsis`.
- **Abaixo de ~600px:** número do dia + até 3 pontos coloridos, sem texto.

E o **painel do dia selecionado**, abaixo da grade, existe nos dois tamanhos:
lista as tarefas daquele dia com `taskRowHtml()` — as mesmas linhas da aba
Tasks, com os mesmos botões de iniciar, concluir, editar e excluir. É o que torna
o mobile utilizável, e no desktop é onde se age sobre a tarefa sem sair da tela.

### D8 — Clicar num dia seleciona; não abre modal

Abrir um modal de criação a cada clique perdido na grade é hostil. O clique
**seleciona** o dia e preenche o painel. O painel leva um botão
"+ nova atividade neste dia", que chama o formulário já existente com a data
pronta.

Isso pede uma mudança mínima em `openCreateForm()`: aceitar uma data opcional.

```js
// esboço, não código final
function openCreateForm(dateStr) {
  ...
  document.getElementById('f-date').value = dateStr || defaultDateForView();
  ...
}
```

Clicar num **chip** abre `openEditForm(id)`, que já existe e já funciona de
qualquer lugar. Nenhum formulário novo em nenhum dos dois caminhos — a mesma
disciplina do Bloco 4, em que o sidebar navega e o modal gerencia.

### D9 — Teto de 3 itens por célula, com "+N"

Sem teto, um dia cheio estica a linha inteira da grade e o mês fica irregular.
Três chips e um "+2" discreto; o painel do dia mostra todos.

### D10 — `renderCalendar()` é chamado de dentro do `render()`

Não em cada mutação. É a lição do Bloco 4 com `renderSidebarProjects()`: todo
caminho que mexe em dados já chama `render()`, então concluir, editar, excluir e
sincronizar refletem no calendário de graça.

Tem um segundo efeito, específico daqui: `render()` roda a cada 60 segundos, e
isso mantém o **destaque de "hoje" correto na virada da meia-noite** sem nenhum
código extra.

`render()` já tem o gancho pronto no fim — `if (currentTab === 'report')
renderReport();`. Acrescenta-se o par para `calendar`.

### D11 — As células são `<button>`

Focáveis, Enter funciona, leitor de tela anuncia. Não é grade ARIA completa com
navegação por setas — isso fica fora de escopo — mas nenhuma célula deixa de ser
alcançável por teclado.

### D12 — Sete colunas com `minmax(0, 1fr)`

Não é detalhe. `grid-template-columns: repeat(7, 1fr)` tem mínimo automático
igual ao `min-content` do conteúdo, e um chip com nome longo estoura a grade
inteira — **foi exatamente o bug que o PR #8 corrigiu no `.report-grid`**, onde
um cartão de 721px aparecia num viewport de 480. A célula também precisa de
`min-width: 0` para o `ellipsis` funcionar.

### D13 — O botão "nova atividade" do cabeçalho continua escondido

`switchTab()` já o esconde fora da aba Tasks. Mantém-se assim: um botão no
cabeçalho não tem dia nenhum como contexto, enquanto o botão do painel tem o dia
selecionado. Um caminho, sem ambiguidade.

---

## Anatomia da tela

```
cabeçalho:  calendário
            agosto de 2026                    [‹]  [hoje]  [›]

seg  ter  qua  qui  sex  sáb  dom
┌────┬────┬────┬────┬────┬────┬────┐
│ 28 │ 29 │ 30 │ 31 │  1 │  2 │  3 │   ← 28–31 esmaecidos (julho)
│    │    │    │    │ ●▪ │    │    │
├────┼────┼────┼────┼────┼────┼────┤
│  4 │  5 │  6 │  7 │  8 │  9 │ 10 │
…  6 linhas sempre  …
└────┴────┴────┴────┴────┴────┴────┘

painel:     terça-feira · 18/08                [+ nova atividade neste dia]
            <as linhas de taskRowHtml() daquele dia>
```

O mês e o ano vão no `date-label`, dentro de `updateHeader()` — **nunca** no
handler de clique. `render()` roda a cada 60s e sobrescreveria o título; é o erro
descrito no Bloco 0 do [roteiro](roteiro-reestruturacao.md) e repetido no Bloco 4.

**O Calendário abre mão do teto de 880px da coluna de conteúdo** e usa os 1180px
inteiros do container — ver
[a largura, revista depois de ver na tela](#a-largura-revista-depois-de-ver-na-tela).
As demais telas mantêm o teto do Bloco 3.

## Casos de borda

| Caso | Comportamento |
|---|---|
| Dia de hoje | destacado, e o destaque se corrige na virada da meia-noite (**D10**) |
| Dia de outro mês | esmaecido; clicar navega para aquele mês e o seleciona |
| Tarefa sem hora | chip sem hora; vem antes das com hora, por `taskSortKey()` |
| Tarefa concluída | chip esmaecido e riscado — **aparece** (**D4**) |
| Tarefa sem data | não aparece; é da caixa de entrada, na aba Tasks |
| Dia com mais de 3 tarefas | 3 chips + "+N"; o painel mostra todas |
| Dia sem tarefas | célula só com o número; painel com mensagem de vazio |
| Mês sem nenhuma tarefa | grade normal, sem mensagem — a grade é o conteúdo |
| Virada de ano (dez → jan) | `new Date(ano, 12, 1)` já rola para janeiro seguinte |
| Fevereiro de ano bissexto | `new Date(ano, 2, 0).getDate()` devolve 29 corretamente |
| Nome de tarefa longo | truncado por `ellipsis`, inteiro no `title` com `esc()` |
| Projeto removido | a tarefa mudou de projeto em `deleteProject()`; o chip segue o novo |

## Pontos de edição

| O quê | Onde |
|---|---|
| Markup da grade e do painel | `#view-calendar`, hoje um `div.empty` |
| CSS novo | grade de 7 colunas, célula, chip, painel — nada a reaproveitar |
| Estado | `calendarAnchor` e `calendarSelected`, duas strings `YYYY-MM-DD` |
| Render | `renderCalendar()`, chamada do fim do `render()` |
| Navegação | `setCalendarMonth(delta)`, `goToCalendarToday()`, `selectCalendarDay(ds)` |
| Cabeçalho | ramo `calendar` do `updateHeader()`: mês e ano em vez de "em breve" |
| Criar com data | `openCreateForm()` passa a aceitar uma data opcional (**D8**) |

Nenhuma mudança em `matchesBucket()`, em `taskRowHtml()` nem no modelo de dados.
O Calendário é leitura sobre o que já existe.

## Verificação

**Harness em Node.** A função que monta a grade é pura e é onde os erros de data
moram — vale extrair como `buildMonthGrid(anchor)` e testar sozinha:

1. Devolve 42 dias, sempre.
2. O primeiro é segunda-feira, para meses que começam em qualquer dia da semana.
3. Um mês que começa numa segunda não ganha uma semana inteira de sobra no
   início.
4. Fevereiro de 2028 (bissexto) tem 29 dias no conjunto do mês.
5. Dezembro → janeiro vira o ano; janeiro → dezembro volta o ano.
6. Fuso: nenhum dia aparece deslocado — o teste que pega o uso acidental de
   `new Date(string)`.

**No navegador**, com dados semeados cobrindo um mês inteiro:

1. Abre no mês corrente, com hoje destacado.
2. `‹` e `›` navegam; "hoje" volta. O título do cabeçalho acompanha, **e
   sobrevive a mais de um minuto na tela** — a verificação que pega o erro de
   escrever o título no handler.
3. Um dia com 5 tarefas mostra 3 chips e "+2"; a altura da linha não muda.
4. Uma concluída aparece riscada; concluir uma tarefa pelo painel a risca na
   grade sem recarregar (**D10**).
5. Clicar num dia de outro mês navega e mantém a seleção.
6. Criar pelo painel nasce com a data daquele dia.
7. Editar pelo chip abre o formulário com a tarefa certa.
8. **Sem scroll horizontal em 425, 480, 600, 768, 860 e 1024px** — a varredura
   que o PR #8 estabeleceu, aqui obrigatória por causa de **D12**.
9. Abaixo de 600px a célula mostra pontos, e o painel continua legível.
10. Os dois temas.

## Fora de escopo

- **Visão semanal com grade de horas.** Pede faixa de "dia inteiro" para as
  tarefas sem hora, blocos proporcionais a `dur` e tratamento de sobreposição. É
  um bloco próprio, e só se paga se o hábito de marcar horário se firmar.
- **Arrastar para reagendar.** É uma camada de interação inteira — alvos de
  soltura, feedback, e suporte a toque, que não sai de graça. O caminho existente
  (`openQuickScheduleModal`, o botão "Agendar") já reagenda em dois cliques.
- **Navegação por setas na grade.** As células são focáveis (**D11**); grade ARIA
  completa com `roving tabindex` é outro assunto.
- **Filtrar o Calendário por projeto.** Traria a seleção do sidebar para uma
  página que hoje não tem sidebar, e reabriria o produto cartesiano que o Bloco 4
  fechou de propósito.

---

## O que a implementação revelou

Três coisas que o plano não previu, nenhuma delas mudando o rumo.

**O número do dia dos meses vizinhos nasceu em `--text3`, com 2.46:1 no tema
claro.** Exatamente a armadilha que o Bloco 4 já tinha registrado: `--text3` é
token de **ícone** nesta casa, nunca de texto. A correção manteve a hierarquia
sem sacrificar contraste — o dia do mês visível passou a `--text` e o dia
vizinho a `--text2`, o que dá 17.98:1 e 5.53:1 no claro, ambos acima de AA e
visivelmente distintos entre si. O recuo dos dias vizinhos continua vindo
principalmente do fundo (`--bg` em vez de `--surface`).

**O título do mês usa a abreviação de `months`** — "ago de 2026", não "agosto de
2026". O array da casa é abreviado e o cabeçalho da aba Tasks já escreve
"18 de ago de 2026". Escrever o mês por extenso só no Calendário exigiria um
segundo array e deixaria as duas telas falando línguas diferentes.

**Clicar num chip seleciona o dia, não abre a edição — e isso desvia do D8.** O
plano dizia que o chip chamaria `openEditForm(id)`. Não dá: a célula inteira é um
`<button>` (**D11**, para ser focável por teclado), e botão dentro de botão é HTML
inválido, além de quebrar a navegação por Tab. O chip ficou `<span>`, e o clique
nele borbulha para a célula.

O desvio não custa nada porque o painel do dia abre no mesmo clique: a tarefa
fica a um clique de distância, com o botão de editar que já existe na linha. O
espírito do **D7** — o painel é onde se lê e se age — acabou valendo também para
a edição.

**O painel do dia herda a compressão da `.task-row` no mobile.** A 480px os nomes
das tarefas no painel ficam entre 39px e 168px de largura visível — legíveis, mas
apertados. Não é regressão do Calendário: é a pendência da `.task-row`
registrada em [pendencias.md](pendencias.md), que aparece aqui porque o painel
reusa a mesma linha. Corrigi-la conserta as duas telas de uma vez.

### Verificação executada

**Harness em Node, 60 casos** sobre `buildMonthGrid`, `firstOfMonth` e
`addMonths` — as funções puras onde os erros de data moram:

- 42 dias em qualquer mês, sempre começando numa segunda-feira, varrido nos
  **24 meses de 2026 e 2027**, o que cobre mês começando em todos os dias da
  semana.
- Fevereiro de 2028 com 29 dias; fevereiro de 2026 com 28.
- Grade inteira contígua, sem data repetida e sem salto nas pontas.
- Virada de ano nos dois sentidos, e `addMonths` sem o escorregão clássico de
  31/01 virar 03/03.
- Fuso: o número do dia bate com a string em todos os 42 dias, e outubro e
  fevereiro (as duas viradas de horário de verão no Brasil) seguem contíguos —
  é o teste que pegaria um `new Date(string)` acidental.

**No navegador**, com dados semeados cobrindo dia cheio, dia vazio, nome longo,
concluída, atrasada, tarefa sem hora e tarefa sem data:

| Verificação | Resultado |
|---|---|
| 42 células, semana em `seg…dom` | ✅ |
| Hoje destacado, dia selecionado marcado | ✅ |
| Tarefa sem data fora da grade | ✅ |
| Dia com 5 tarefas: 3 chips + "+2", altura da linha inalterada | ✅ |
| Concluída aparece riscada e esmaecida | ✅ |
| Concluir pelo painel risca o chip na grade sem recarregar | ✅ 1 → 2 chips `done` |
| `‹`, `›` e "hoje" navegam; título acompanha | ✅ |
| **Título sobrevive a um `render()` manual** (a armadilha dos 60s) | ✅ |
| Clicar dia do mês vizinho navega e mantém a seleção | ✅ |
| Criar pelo painel nasce com a data do dia | ✅ `2026-08-23` |
| Sem scroll horizontal em 480, 600, 860 e 1280px | ✅ |
| Troca chips → pontos exatamente em 600px | ✅ célula 92px → 58px |
| Contraste em ambos os temas, transições desligadas | ✅ tudo ≥ 4.5:1 |

O que **não** foi verificado: 375px de largura real, pelo mesmo motivo de sempre
— o ambiente não desce abaixo de 425px no Chrome nem de 480px no pane. Ver
[pendencias.md](pendencias.md).

### A largura, revista depois de ver na tela

O plano herdou sem questionar o teto de **880px** da coluna de conteúdo, que vem
do Bloco 3. Ao ver o Calendário renderizado ficou evidente que estava errado: a
grade parava em 880px enquanto o container tem 1180px, deixando **300px de
espaço vazio à direita**, desalinhada do cabeçalho e da marca.

Vale reler por que o teto existe, porque a razão original **não se aplica aqui**:

> Sem ele, Calendário e Relatórios — que não têm sidebar — esticariam até os
> 1180px do container, redesenhando na marra uma tela que ninguém pediu para
> mexer.

O teto era uma **proteção contra efeito colateral**: em 2026 ninguém havia
desenhado essas duas telas, e esticá-las sem querer seria pior que mantê-las
estreitas. O Calendário agora é uma tela desenhada de propósito, e uma grade de 7
colunas é justamente o tipo de conteúdo que ganha com cada coluna mais larga.

A mudança é uma classe no `<body>`, ligada só na aba Calendário:

```css
body.no-sidebar.wide-content .app-shell { grid-template-columns: minmax(0, 1fr); }
```

Duas classes no seletor de propósito: assim ele vence
`body.no-sidebar .app-shell` por **especificidade**, não por ordem no arquivo —
que é frágil a qualquer reorganização do CSS.

**Os Relatórios continuam em 880px**, porque ali a razão original segue válida:
ninguém desenhou aquela tela para 1180px, e o `minmax(0, 880px)` é o que mantém
o `.report-table-wrap` rolando no próprio contêiner em vez de esticar o grid.

Medido em seis larguras, nas três abas:

| Viewport | Tasks | Calendário | Relatórios | Célula |
|---|---|---|---|---|
| 480px | 448 | 448 | 448 | 61px (pontos) |
| 600px | 568 | 568 | 568 | 79px (pontos) |
| 768px | 260 + 461 | **721** | 721 | 100px |
| 861px | 260 + 526 | **814** | 814 | 113px |
| 1024px | 260 + 689 | **977** | 880 | 136px |
| 1280px | 260 + 880 | **1180** | 880 | 165px |
| 1600px | 260 + 880 | **1180** | 880 | 165px |

Zero scroll horizontal em todas, nas três abas. A célula passou de 122px para
**165px** no desktop — 35% mais largura para o nome no chip.

E a verificação que importava mais que a largura: a 1600px a grade alinha
**exatamente** com a `brand-bar`, delta de 0px nas duas bordas. É o princípio do
Bloco 3 — conteúdo e marca no mesmo eixo vertical — que teria sido quebrado se
eu tivesse deixado o Calendário passar dos 1180px do container.
