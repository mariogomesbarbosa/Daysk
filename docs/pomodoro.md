# Pomodoro

**Plano, não implementado.**

> Referências a linhas valem para `207369c` (`main` depois do PR #38). Se não
> baterem mais, busque pelo nome da função ou da classe.
>
> O plano foi escrito contra `ce1e9fb` e reconferido contra `207369c` antes de
> ser mergeado, porque o shell de painéis de
> [conteudo-em-largura-total.md](conteudo-em-largura-total.md) entrou no meio.
> Nenhuma decisão caiu; o que mudou está em **D11**, **D13** e **D21**.
>
> Este documento é o plano. Quando a implementação desmentir alguma decisão, a
> correção entra **em citação dentro da própria decisão**, e o resumo vai para
> uma seção *Desvios* no fim — a mesma convenção de
> [menu-lateral-no-desktop.md](menu-lateral-no-desktop.md).

## Objetivo

Substituir o controle de tempo manual (play/pause livre na linha da tarefa) por
um **Pomodoro** no modelo do TickTick: blocos de foco de duração fixa, pausas
curtas e longas, transições automáticas opcionais, uma tela própria com métricas
e histórico, e um **widget flutuante arrastável** que mantém o cronômetro à vista
em qualquer tela do app.

## O que se transporta do TickTick, e o que não

| No TickTick | Aqui | Por quê |
|---|---|---|
| Rail com área "Foco" própria | Quarta aba no rail | Ver **D11** |
| Abas "Pomo" e "Cronômetro" | Só Pomo | O cronômetro livre é o que está sendo aposentado — ver **D17** |
| Tela ociosa: métricas + "Foco em Registrar" | Igual | É o print |
| Tela em execução: calendário do dia com planejado × focado | Igual, com grade própria | Ver **D12** |
| Mini flutuante sobre outras janelas | Flutuante **dentro da página** | Navegador não deixa; ver **D13** |
| Sons de fundo (chuva, ruído branco) | Fora | Exige assets de áudio e cache offline — ver [O que fica de fora](#o-que-fica-de-fora) |
| Foco vinculado a hábito | Fora | Não existe hábito no Daysk |

## O estado do código hoje

Tudo verificado no fonte, não suposto.

| Peça | Onde | O que significa para este plano |
|---|---|---|
| `fecharSessao(t, agora)` | [l. 4799](../index.html:4799) | **O único lugar do arquivo** que soma em `elapsed` e grava sessão. É o ponto único de mudança do registro |
| `effectiveElapsed(t)` | [l. 4779](../index.html:4779) | Soma `elapsed` + o trecho aberto quando `active` |
| `sessoesDe(t, agora)` / `msPorDia(sessoes)` | [l. 4815](../index.html:4815) e [l. 4835](../index.html:4835) | Os leitores do recorte por dia. `msPorDia` reparte trechos que atravessam a meia-noite |
| `startTask` / `pauseTask` / `completeTask` | [l. 5397](../index.html:5397) | O ciclo manual. `startTask` já garante **uma tarefa ativa por vez** |
| `actionButtons(t)` | [l. 5444](../index.html:5444) | Monta os botões da linha por `status`. É onde o `play` vira cronômetro |
| `tick()` | [l. 7492](../index.html:7492) | `setInterval` de 1s que atualiza **só nós pontuais**. Nunca re-renderiza — a disciplina a manter |
| `render()` | [l. 5692](../index.html:5692) | Roda a cada 60s (`setInterval(render, 60000)`) |
| `VIEWS` / `switchTab` | [l. 5353](../index.html:5353) e [l. 5355](../index.html:5355) | Três abas hoje; alterna `.nav-item`, `no-sidebar` e `wide-content`, e chama `voltarAoTopo()` |
| `voltarAoTopo()` / `travarRolagem(travar)` | [l. 5162](../index.html:5162) e [l. 5176](../index.html:5176) | **Vieram com o PR #38.** No desktop quem rola é o painel, não o `<body>` — ver **D21** |
| `<nav class="app-nav">` | [l. 3393](../index.html:3393) | Rail no desktop (PR #36), barra de borda a borda abaixo de 860px, `z-index: 93` ([l. 1333](../index.html:1333)) |
| `ICON_PATHS` / `icon(name, size)` | [l. 3624](../index.html:3624) | Sete ícones hoje. Novos entram aqui |
| `.form-overlay` | [l. 1815](../index.html:1815), usos em [3415](../index.html:3415), [3466](../index.html:3466), [3501](../index.html:3501), [3519](../index.html:3519) | O padrão de modal do app, `z-index: 100`. O de Configurações de foco é o quinto |
| `startDrag(id, ev, origem)` | [l. 6488](../index.html:6488) | O arraste do Calendário: pointer capture, auto-rolagem, engolir o clique seguinte. **Referência de padrão, não de reuso** |
| `renderTimeGrid` / `CAL_HOUR_H` | [l. 6042](../index.html:6042) e [l. 5751](../index.html:5751) | A grade de horas do Calendário, com ids fixos (`cal-cols`, `cal-ruler`, `cal-allday`) |
| `mergeSyncData(tasksJson, projectsJson)` | [l. 3830](../index.html:3830) | Dois arquivos, fusão por id, **remoto vence menos em `sessions`** |
| `writeToFolder` / `loadFromFolder` | [l. 3810](../index.html:3810) e [l. 3884](../index.html:3884) | Gravam e leem `tasks.json` e `projects.json` |
| `writeToGoogleDrive` / `loadFromGoogleDrive` / `enviarAgora` | [l. 4189](../index.html:4189), [l. 4287](../index.html:4287), [l. 4224](../index.html:4224) | Idem, via `writeGDriveFile` / `readGDriveFile` |
| `migrate()` | [l. 4866](../index.html:4866) | Cria sessões **sintéticas** (`sintetica: true`) ancoradas ao meio-dia para tarefas antigas |
| Shell de painéis, ≥1025px | [l. 1370](../index.html:1370) em diante | `<body>` com `height: 100vh; overflow: hidden`; quem rola é `.sidebar` e `.content`. `.page-header` é `sticky` dentro do painel, `z-index: 10` |

### A consequência boa disso

O registro de tempo tem **um único escritor** (`fecharSessao`) e **dois
leitores** (`effectiveElapsed` para totais, `sessoesDe`/`msPorDia` para o recorte
por dia). Trocar o motor do cronômetro é trocar quem *chama* o escritor — não
reescrever o registro.

## A decisão central

**O Pomodoro não substitui o registro de tempo. Ele passa a ser quem o dirige.**

Um pomo concluído fecha um trecho de tempo exatamente como o play/pause fazia
hoje: soma em `t.elapsed` e grava o trecho. O que morre é o **controle manual de
duração aberta**, não a camada de dados.

Se os pomos virassem o único registro, os cinco gráficos dos Relatórios (Visão
Geral, Distribuição de Conclusão, Curva de Desempenho, Horas por Atividade,
Estimativa) perderiam a base — todos leem `elapsed` ou `msPorDia`. Isso foi
levantado e descartado.

## Modelo de dados

### Store novo: `daysk-pomos`

Array JSON em `localStorage`. **Passa a ser o único destino de escrita** de
trechos de tempo; `t.sessions` deixa de receber gravação (ver **D2**).

| Campo | Valores | Significado |
|---|---|---|
| `id` | string | `Date.now().toString()` + sufixo, como o resto do app |
| `taskId` | string ou `null` | **`null` = pomo solto**, sem tarefa vinculada |
| `rotulo` | string ou `null` | Nome do foco quando `taskId` é `null` |
| `ini` | timestamp | Início do foco |
| `fim` | timestamp | Fim do foco |
| `planejado` | minutos | A duração configurada quando o pomo começou. Guardada porque a configuração muda e o histórico não pode mudar junto |
| `completo` | boolean | `true` se chegou ao fim previsto; `false` se foi interrompido |
| `nota` | string ou `null` | O campo "Foco em Notas" do print |

### Estado corrente: `daysk-pomo-atual`

Um objeto, ou `null` quando não há nada correndo.

| Campo | Significado |
|---|---|
| `fase` | `'foco'` \| `'pausa'` \| `'pausaLonga'` |
| `taskId` / `rotulo` | Como acima |
| `iniciadoEm` | timestamp do início da fase |
| `terminaEm` | **timestamp absoluto do fim previsto** — ver **D4** |
| `pausadoEm` | timestamp, ou `null` quando correndo |
| `ciclo` | Pomos completos desde a última pausa longa |
| `nota` | Texto em edição, salvo no registro ao fechar |

### Configuração: `daysk-pomo-config`

```
{ foco: 30, pausa: 5, pausaLonga: 15, ciclo: 4, autoPomo: false, autoPausa: false }
```

### Campo novo na tarefa

Um só, em `daily-tasks`:

| Campo | Valores | Significado |
|---|---|---|
| `pomosEstimados` | inteiro ou `null` | Quantos pomos a tarefa deve levar. `null` = sem estimativa — ver **D22** |

### Posição do widget: `daysk-pomo-widget`

`{ x, y }` em pixels a partir do canto inferior direito. Guardar a partir do
canto — e não do topo-esquerda — é o que faz a posição sobreviver a
redimensionar a janela sem o widget sair da tela.

## Decisões

### D1 — O Pomodoro dirige o registro; `elapsed` continua sendo o total

`fecharSessao(t, agora)` continua sendo o único escritor e continua somando em
`t.elapsed`. Muda **onde** ele grava o trecho: em `daysk-pomos`, não em
`t.sessions`.

`elapsed` continua sendo a fonte da verdade dos totais porque é o único campo
que dados vindos de versões anteriores do app têm garantidamente.

### D2 — `t.sessions` vira legado somente-leitura

Nada mais escreve em `t.sessions`. **Nada apaga o que já está lá, e não há
migração retroativa** — foi o pedido explícito.

Mas os leitores do recorte por dia leem **a união dos dois**:

```
focosDe(t, agora) = registros de daysk-pomos com taskId === t.id
                  ∪ (t.sessions || [])           // legado, só leitura
                  ∪ o pomo aberto, se houver
```

Sem a união, o histórico de tempo por dia que já está gravado zeraria
silenciosamente na primeira abertura do app depois do deploy: os totais
continuariam certos (vêm de `elapsed`) e só a Curva de Desempenho iria a zero —
exatamente o modo de falha que o comentário de `mergeSyncData`
([l. 3630](../index.html:3630)) já descreve para outro caso.

**Sessões sintéticas do `migrate()` continuam fora da linha do tempo de foco.**
Elas vivem em `t.sessions`, e a timeline "Foco em Registrar" lê **só**
`daysk-pomos`. Nenhum trabalho extra: cai fora por construção.

### D3 — `pomos.json` entra na sincronização no primeiro bloco, não depois

Os três modos de sincronização carregam dois arquivos. Um store novo que não
viaja significa que o foco registrado no celular nunca chega ao desktop — e,
como `t.sessions` não é mais escrito, esse tempo simplesmente não existe no
outro aparelho. Isso é perda de dados na percepção de quem usa, e não pode ficar
para um bloco posterior.

Alcance da mudança: `writeToFolder`, `loadFromFolder`, `writeToGoogleDrive`,
`loadFromGoogleDrive`, `enviarAgora` e `mergeSyncData` (que ganha um terceiro
parâmetro).

**Fusão por união de `id`.** Registros de pomo são append-only enquanto não
existir edição — mesmo raciocínio que já protege `sessions` hoje: preservar é
seguro por construção. Quando o bloco B5 trouxer apagar um registro, essa
garantia cai; ver [Riscos](#riscos-e-armadilhas).

### D4 — O timer é um carimbo de tempo, nunca um contador decrementado

`terminaEm` é absoluto. O restante é sempre `terminaEm - Date.now()`.

O motivo é concreto: o Chrome estrangula `setInterval` em aba de fundo para uma
vez por minuto. Um contador decrementado a cada tique faria um pomo de 30
minutos terminar depois de quase uma hora de relógio. Com carimbo absoluto, o
estrangulamento não afeta a **correção** — só atrasa a **detecção** do fim, que
é o que **D5** e **D16** resolvem.

Pausar guarda `pausadoEm`. Retomar empurra `terminaEm` pelo tempo parado.

### D5 — Ao voltar, a fase fecha em `terminaEm` — não em `agora`

Reconciliação em dois pontos: no `load` da página e no `visibilitychange`.

Se `Date.now() > terminaEm`, a fase é fechada **com carimbo `terminaEm`**. Um
pomo de 30 minutos esquecido numa aba de fundo por três horas grava 30 minutos,
não três horas.

Este é o bug mais perigoso da funcionalidade inteira, e é silencioso: o número
sai errado, não sai quebrado.

**Não há reconstrução de cadeia.** Se o início automático estava ligado e o app
ficou fechado por duas horas, fecha-se **uma** fase e para. Fabricar quatro
pomos que ninguém trabalhou seria pior que perder o encadeamento.

### D6 — Pausas não geram registro

Só o foco vira registro em `daysk-pomos`. Pausa não é tempo de trabalho, e a
timeline do print chama-se "Foco em Registrar" — só há foco nela. Contar pausa
inflaria "Foco de hoje" com descanso.

### D7 — Pomo interrompido conta tempo, não conta pomo

Parar aos 12 minutos de 30 grava um registro com `completo: false`. Esses 12
minutos entram em `elapsed`, em "Foco de hoje" e nos Relatórios. **Não** entram
em "Pomos de hoje" nem em "Pomos totais".

É o comportamento do TickTick e é o único honesto: o tempo foi trabalhado, o
bloco não foi cumprido.

### D8 — Abaixo de 60 segundos, descarta

Um pomo iniciado por engano e parado em seguida não deixa rastro. Sem esse piso,
a timeline enche de registros de 4 segundos.

Ao parar abaixo do piso, o app avisa que nada foi registrado — descarte
silencioso é o defeito que [enviar-agora-e-o-descarte-silencioso.md](enviar-agora-e-o-descarte-silencioso.md)
já custou uma vez.

### D9 — Configuração é global, com os defaults do print

`30 / 5 / 15 / 4`, os dois automáticos desligados. Não há configuração por
tarefa: ela existe no TickTick e é a origem da maior parte da confusão de "por
que este pomo tem outra duração".

**Validação obrigatória**, porque nenhum dos três modos de sincronização valida
schema: duração entre 1 e 180 minutos, ciclo entre 1 e 12, qualquer coisa fora
disso volta ao default. Campo numérico com `type="number"`, `min` e `max` — e
checagem no JS também, porque `min`/`max` no HTML não impedem valor colado.

### D10 — Pomo solto tem `taskId: null` e um rótulo

Começar um foco sem tarefa é permitido pelo botão **Começar** da tela do
Pomodoro. O rótulo default é `"Foco"`, editável.

Consequência: um pomo solto não tem tarefa onde ancorar, então **não aparece em
"Horas por Atividade"** nos Relatórios sem uma linha "Sem atividade". Isso entra
em **B5**; até lá é uma ressalva conhecida.

### D11 — Quarta aba no rail, entre Calendário e Relatórios

`VIEWS = ['today', 'calendar', 'pomodoro', 'report']`. Ícone: Phosphor `timer`.
A ordem espelha o rail do TickTick (tarefas → calendário → foco → estatísticas) e
põe o Pomodoro adjacente ao Calendário, que é o que a tela em execução mostra.

`switchTab` liga `no-sidebar` (a aba não usa os baldes) e `wide-content`, os
mesmos dois que o Calendário e os Relatórios já ligam. `updateHeader()`
([l. 5488](../index.html:5488)) ganha o ramo `'pomodoro'`.

> Desde o PR #38, `wide-content` **não faz mais diferença no desktop**:
> `body.no-sidebar .app-shell` e `body.no-sidebar.wide-content .app-shell`
> convergem para uma coluna ([l. 1424](../index.html:1424)). A classe continua
> valendo abaixo de 1025px, e ligá-la mantém a aba coerente com as outras duas —
> mas não espere efeito visual no desktop ao ligá-la.

E `voltarAoTopo()`, não `window.scrollTo` — ver **D21**.

### D12 — A grade do dia é nova, não é `renderTimeGrid` parametrizada

`renderTimeGrid` ([l. 5801](../index.html:5801)) escreve em ids fixos
(`cal-col-heads`, `cal-allday`, `cal-ruler`, `cal-cols`) e carrega arraste,
redimensionamento, empacotamento de sobreposição e auto-rolagem — nada disso
existe na tela do Pomodoro, e nada disso deve existir: arrastar uma tarefa
durante um pomo é o oposto de foco.

O que se reusa é a **matemática e a constante**: `CAL_HOUR_H = 48` e o
posicionamento `top = ini / 60 * CAL_HOUR_H`. Copiar 15 linhas de aritmética é
mais barato e mais seguro que parametrizar 90 linhas de interação.

A grade nova tem duas faixas lado a lado no mesmo eixo de horas:

| Faixa | O que mostra |
|---|---|
| Esquerda | O **planejado**: tarefas de hoje com `time` e `dur`, em bloco esmaecido |
| Direita | O **realizado**: registros de `daysk-pomos` de hoje, mais o pomo em curso |

Mais a linha do "agora", que já é `nowM / 60 * CAL_HOUR_H`.

### D13 — O widget aparece em qualquer aba; no mobile ele encosta, não flutua

Enquanto houver pomo (correndo ou pausado), o widget aparece — inclusive na
própria tela do Pomodoro, que é o que o print mostra. Tem botão de fechar, que
o esconde até a próxima troca de fase.

**Abaixo de 860px o widget não é arrastável.** Ele vira uma barra encostada
logo acima da `.app-nav`, que ali é de borda a borda com `z-index: 93`. Um
retângulo arrastável competindo com a navbar, com a bandeja do Calendário e com
a `.cal-tap-bar` na menor tela é onde os bugs de `z-index` moram — e
[pendencias.md](pendencias.md) já registra duas ocorrências de regra base
vazando para caixa `fixed`.

Clique no widget leva para a aba Pomodoro.

**A faixa de `z-index` está ocupada, e o inventário é este:**

| Valor | Quem |
|---|---|
| 200 | `.cal-ghost` ([l. 1248](../index.html:1248)) |
| 100 | `.form-overlay` ([l. 1822](../index.html:1822)) |
| 95, 94, 93, 92, 91 | Caixas `fixed` do mobile — a `.app-nav` de borda a borda é a 93 |
| 90 | `.app-nav` base, o rail |
| 10 | `.page-header` sticky dentro do painel |

O widget fica **acima de 90** (senão o rail o encobre) e **abaixo de 100** (um
modal aberto tem prioridade sobre o cronômetro). No mobile ele encosta acima da
barra e não precisa disputar nada.

O `<body>` com `overflow: hidden` do shell de painéis não afeta o widget:
`position: fixed` se resolve contra a viewport, não contra o contêiner de
rolagem. Vale confirmar na verificação mesmo assim — foi medindo que as duas
suspeitas anteriores de `z-index` caíram.

### D14 — `touch-action: none` só na alça de arraste

O PR #17 colocou `touch-action: none` largo demais e roubou a rolagem da página;
está em [pendencias.md](pendencias.md). Aqui a propriedade vai **só na alça**, e
o corpo do widget continua rolando/clicando normalmente.

Pointer capture no `pointerdown`, como `startDrag` já faz.

**Clamp obrigatório** na soltura e no `resize` da janela: um widget solto fora
da viewport não tem como voltar.

### D15 — O som do fim é sintetizado, sem arquivo

Dois tons curtos via `OscillatorNode` da WebAudio API. Zero bytes, nenhuma CDN,
funciona offline, nada a acrescentar no `sw.js`.

O contexto de áudio precisa ser criado **dentro do gesto de clique** em
"Começar" — navegador não deixa tocar som sem interação prévia. Criar no load e
guardar não funciona; ele nasce `suspended`.

Silenciar é um botão no widget e na tela, guardado em `daysk-pomo-config`.

### D16 — Permissão de notificação é pedida no primeiro "Começar"

Nunca no load da página. Pedir permissão sem contexto é o padrão que os
navegadores penalizam e que as pessoas negam por reflexo — e, negada, não há
segunda chance.

A notificação é o que faz o fim do pomo chegar com a aba em segundo plano, onde
o `setInterval` está estrangulado. Sem ela sobra o `visibilitychange` de **D5**,
que só avisa quando a pessoa volta.

O título da aba mostra o tempo restante enquanto corre (`document.title`).
Barato e resolve o caso de estar em outra aba do mesmo navegador.

### D17 — O botão da linha da tarefa vira cronômetro; o play livre sai

Em `actionButtons(t)`:

| `status` | Hoje | Depois |
|---|---|---|
| `pending` / `paused` | `play` → `startTask` | `timer` → `iniciarPomo(id)` |
| `active` | `pause` + `check` | `pause` (pausa o pomo) + `check` |
| `done` | `counterClockwise` | igual |

`startTask` e `pauseTask` não são apagados — passam a ser chamados **por dentro**
do motor do pomo, que é quem garante "uma tarefa ativa por vez" (a regra já está
em `startTask`, [l. 5158](../index.html:5158)).

Iniciar um pomo numa tarefa **enquanto outra tem pomo correndo** fecha o pomo
anterior como interrompido e abre o novo. Sem confirmação: é o mesmo contrato
que `startTask` já tem hoje.

### D18 — "Pomos totais" e "Duração Total Focada" leem só o store novo

Os dois começam do zero. Não há pomo retroativo, e derivar "534 pomos" dividindo
o histórico pela duração atual inventaria um número que nunca aconteceu.

O corolário é que essas duas métricas **não batem** com "Horas Trabalhadas" dos
Relatórios enquanto houver histórico legado — e está certo assim: elas medem
coisas diferentes. A tela do Pomodoro mede foco em pomos; os Relatórios medem
tempo trabalhado, de qualquer origem.

### D19 — O ciclo da pausa longa zera em três situações

Ao completar uma pausa longa, ao parar manualmente a sequência, e na virada do
dia. Sem a virada do dia, três pomos de ontem fazem o primeiro de hoje disparar
pausa longa.

### D20 — Nada disso re-renderiza

A atualização por segundo entra em `tick()` ([l. 7238](../index.html:7238)) e
toca **só** os nós do timer, do widget e do bloco em curso na grade — pelos ids,
como o código já faz com `bar-${id}` e `barlbl-${id}`.

O comentário que já está lá vale palavra por palavra: chamar `renderReport()`
destruiria e recriaria cinco gráficos por segundo. Vale igual para `render()`.

### D21 — No desktop quem rola é o painel: usar `travarRolagem()` e `voltarAoTopo()`

Trazido pelo PR #38, e é a única coisa que este plano teria errado se não fosse
reconferido. Desde os painéis, o `<body>` no desktop é
`height: 100vh; overflow: hidden` ([l. 1393](../index.html:1393)), e quem rola é
`.sidebar` e `.content`.

Duas consequências diretas:

- **O modal de Configurações de foco chama `travarRolagem(true)` ao abrir e
  `travarRolagem(false)` ao fechar** ([l. 5176](../index.html:5176)), como os
  quatro modais existentes já fazem. Esconder o `overflow` do `<body>` não diz
  nada aos painéis — foi medido: o painel rolava 600px com a trava ativa.
- **A entrada na aba usa `voltarAoTopo()`** ([l. 5162](../index.html:5162)), não
  `window.scrollTo`, que no desktop rolaria um elemento que não rola.

### D22 — Estimativa de pomos: campo próprio, default derivado, e o caso sem duração

A tarefa ganha `pomosEstimados` (inteiro ou `null`) e a linha mostra
`2/4 pomos` — feitos sobre estimados.

O default sai de graça de `t.dur`: `Math.ceil(dur / config.foco)`. É sugestão,
não amarra — mudar a configuração depois **não** reescreve estimativas já
gravadas, pela mesma razão que o registro guarda `planejado` (ver o modelo de
dados). Por isso o campo é gravado, e não calculado na hora de exibir.

**O caso que precisa de resposta explícita: `t.dur` é `null` na maioria das
tarefas** — toda tarefa sem horário, que é o caso mais comum do app. Aí não há
de onde derivar nada, e a regra é: sem estimativa, a linha mostra só os pomos
feitos (`3 pomos`), nunca `3/0` nem `3/—`.

O campo viaja em `tasks.json`, que já é sincronizado. Nenhum custo de
transporte.

## A divisão em blocos

Cada bloco é um PR e entrega algo utilizável e verificável sozinho.

| Bloco | O quê | Depende de |
|---|---|---|
| **B1** | Motor, configurações e widget fixo | — |
| **B2** | Tela do Pomodoro, estado ocioso | B1 |
| **B3** | Tela do Pomodoro, estado em execução | B2 |
| **B4** | Arrastar o widget | B1 |
| **B5** | Fechar o ciclo | B2, B3 |

B4 é paralelo a B2/B3 — toca só o widget.

### B1 — Motor, configurações e widget fixo

O bloco grande, e o único que não dá para fatiar mais sem entregar algo que não
funciona.

- Os quatro stores e a leitura/gravação deles.
- Máquina de estados das fases, com carimbo absoluto (**D4**), pausar/retomar,
  transição automática opcional.
- Reconciliação no load e no `visibilitychange` (**D5**).
- `fecharSessao` redirecionado para `daysk-pomos` (**D1**, **D2**); `focosDe()`
  lendo a união com o legado.
- `pomos.json` nos três modos de sincronização (**D3**).
- Modal "Configurações de foco", com validação (**D9**).
- Botão da linha da tarefa trocado para cronômetro (**D17**).
- Widget flutuante **no canto inferior direito, posição fixa**: tempo restante,
  nome da tarefa, pausar/retomar, parar, silenciar, fechar.
- Som (**D15**), notificação (**D16**), título da aba.
- **Confirmação ao desistir**, com o tempo já registrado no texto: *"Descartar
  este pomo? 12 min já registrados."* Abaixo do piso de **D8** o texto muda para
  dizer que nada será registrado — é a mesma confirmação, não uma segunda.

Verificável: iniciar um pomo pela lista, acompanhar no widget, **recarregar a
página no meio** e ver o tempo continuar certo, deixar terminar e conferir que
`elapsed` cresceu exatamente a duração do pomo. Nos Relatórios, os números do
histórico legado não podem mudar em nada.

### B2 — Tela do Pomodoro, estado ocioso

- Quarta aba no rail (**D11**), `VIEWS`, `switchTab`, `updateHeader`.
- Coluna esquerda: mostrador com a duração configurada, seletor de tarefa,
  botão **Começar**, acesso a Configurações.
- Coluna direita: **Visão geral** com os quatro cartões do print (Pomos de hoje,
  Foco de hoje, Pomos totais, Duração Total Focada) e **Foco em Registrar** —
  a timeline agrupada por dia, com hora de início, fim, duração e nome.
- Pomo solto (**D10**) — depende do seletor de tarefa, por isso mora aqui.
- **Estimativa de pomos por tarefa** (**D22**): o campo no formulário e o rótulo
  `2/4 pomos` na linha da tarefa.

Reuso: os cartões são o mesmo padrão de `.overview-stats` /
`.report-card` que os Relatórios já usam; o agrupamento por dia é o mesmo
`groupByDay`/`formatDayHeader` da lista de tarefas.

### B3 — Tela do Pomodoro, estado em execução

- A coluna direita troca de conteúdo: grade do dia (**D12**), planejado à
  esquerda, focado à direita, linha do agora.
- "Foco em Notas" abaixo, gravado em `nota` ao fechar o pomo.
- A coluna esquerda passa a contagem regressiva, com Pausar e Parar.
- **Modo foco**: uma classe no `<body>` que esconde tudo menos o mostrador.
  Não é tela cheia do navegador — `requestFullscreen` exige gesto, some com a
  barra do sistema e não volta sozinho ao trocar de aba.
- **Atalhos**: Espaço pausa/retoma, Esc sai do modo foco. Entram no handler de
  `keydown` que já existe. Duas ressalvas: Espaço **não** pode disparar com o
  foco num campo de texto (o "Foco em Notas" está logo ali), e Esc já fecha
  formulário, gerenciador de projetos, sincronização e gaveta — o modo foco
  entra nessa cadeia, e sai **por último**.

### B4 — Arrastar o widget

- Arraste com pointer capture, `touch-action: none` só na alça (**D14**).
- Clamp na soltura e no `resize`.
- Posição persistida a partir do canto (`daysk-pomo-widget`).
- Variante encostada abaixo de 860px (**D13**).

### B5 — Fechar o ciclo

- Botão **+** para registrar um foco manualmente, e editar/apagar um registro.
- Relatórios: pomos soltos entram na Curva de Desempenho e ganham a linha "Sem
  atividade" em Horas por Atividade (**D10**).
- Atualizar `README.md`, este documento (seção *Desvios*) e
  [pendencias.md](pendencias.md).

## Riscos e armadilhas

**Aba em segundo plano.** O risco número um, e silencioso. Está em **D4**,
**D5** e **D16**. Se só uma coisa deste documento sobreviver, que seja esta.

**Tempo contado duas vezes.** Se o motor do pomo somar em `elapsed` *e* chamar
`fecharSessao`, todo tempo dobra. `fecharSessao` continua sendo o único escritor
— o motor chama, não replica a conta. É o mesmo erro que o código já corrigiu
uma vez: havia três cópias da mesma soma antes de `fecharSessao` existir.

**Apagar registro versus fusão por união.** A fusão de **D3** é união por `id`,
segura enquanto os registros forem append-only. Quando **B5** trouxer apagar, um
registro apagado num aparelho **ressuscita** vindo do outro. As saídas são
lápide (`removidoEm`) ou remoto-vence-inteiro. Decidir em B5, não antes — e não
deixar passar em silêncio.

**Aparelho com versão anterior do app.** Ele não conhece `pomos.json`, não grava
lá, e continua gravando em `t.sessions`. A união de **D2** cobre isso: o que ele
gravar aparece como legado. Nada se perde, e nada precisa ser feito.

**`z-index` do widget.** O inventário completo está em **D13**: acima de 90,
abaixo de 100. E `position: fixed` continua se resolvendo contra a viewport
mesmo com o `<body>` sem rolagem do shell de painéis.

**`min`/`max` no HTML não validam nada.** Valor colado passa. Ver **D9**.

## Verificação

Os dois tipos que o projeto já usa, e nesta ordem.

**Lógica pura, no Node** (`tests/funcoes-puras.mjs`). Alvos:

- `restanteDe(estado, agora)` — correndo, pausado, e com `agora > terminaEm`.
- `proximaFase(estado, config)` — a sequência foco → pausa → foco →
  … → pausa longa, para `ciclo` de 1 a 5, e o zeramento de **D19**.
- `focosDe(t, agora)` — a união de **D2**, incluindo o caso de `t.sessions`
  ausente e o de `daysk-pomos` vazio.
- `msPorDia` sobre registros de pomo que **atravessam a meia-noite** — a função
  já reparte por dia, mas nunca recebeu um pomo antes.
- Validação da configuração (**D9**), com entrada `0`, `999`, `''` e `null`.

**Interface, no navegador.** Semear `localStorage` e percorrer:

1. Pomo completo numa tarefa; conferir `elapsed`, "Pomos de hoje" e a timeline.
2. Pomo interrompido aos ~2 min (**D7**) e aos ~10 s (**D8**).
3. **Recarregar a página no meio de um pomo** e no meio de uma pausa.
4. **Deixar a aba em segundo plano além do fim do pomo** e voltar — o registro
   tem de terminar em `terminaEm` (**D5**). Este é o teste que não pode faltar.
5. Iniciar pomo na tarefa B com pomo correndo na tarefa A.
6. Os dois automáticos ligados, ciclo completo até a pausa longa.
7. Widget: arrastar para os quatro cantos, redimensionar a janela, recarregar.
8. Abaixo de 860px: widget encostado, sem sobrepor a navbar nem a bandeja.
9. Os dois temas, e os Relatórios com histórico legado — números inalterados.
10. Estimativa (**D22**): tarefa com `dur`, tarefa **sem** `dur`, e mudar a
    duração do pomo nas configurações depois de gravar uma estimativa.
11. Modo foco e atalhos: Espaço com o cursor **dentro** do "Foco em Notas" tem
    de digitar um espaço, não pausar. Esc com modal aberto fecha o modal, não o
    modo foco.
12. Desistir: confirmação com o tempo certo no texto, e o texto alternativo
    abaixo do piso de 60s.

Lembrando o aprendizado que já se repetiu duas vezes aqui: **medir em vez de
julgar pela captura de tela** (`elementFromPoint` para sobreposição,
`scrollWidth` contra `innerWidth` para transbordo).

## Sugestões: o que entrou e o que não

Nenhuma delas estava no pedido original. Foram propostas, decididas, e as
aceitas **estão no escopo dos blocos acima** — não são opcionais de
implementação.

| Ideia | O que é | Custo | Decisão |
|---|---|---|---|
| **Estimativa de pomos** | A tarefa mostra `2/4 pomos`. O default sai de graça de `dur`: `Math.ceil(dur / config.foco)` | Baixo — um campo e um rótulo | **Entra no B2** — ver **D22** |
| **Confirmar ao desistir** | "Descartar este pomo? 12 min já registrados" | Baixo | **Entra no B1** |
| **Modo foco** | Esconde tudo menos o mostrador | Baixo — uma classe no `<body>` | **Entra no B3** |
| **Atalhos** | Espaço pausa/retoma, Esc sai do modo foco | Baixo — já existe handler de Escape | **Entra no B3** |
| **Meta diária** | Anel "5/8 pomos" na Visão geral | Médio | Em aberto. Não está em bloco nenhum; se entrar, é no B5 |
| **Sons de fundo** | Chuva, ruído branco | Alto — assets de áudio, cache no `sw.js`, licença | **Fora** |
| **Contagem no favicon** | Desenhar o favicon por `canvas` a cada segundo | Médio, e o título já resolve | **Fora** |

## O que fica de fora

- Cronômetro livre como segundo modo (a aba "Cronômetro" do TickTick).
- Sons de fundo.
- Contagem regressiva no favicon — o título da aba já resolve.
- Configuração de pomodoro por tarefa.
- Picture-in-Picture — o widget flutua dentro da página, não sobre outras
  janelas. É o limite do navegador, e vale dizer em voz alta para não virar
  expectativa frustrada.
- Migração retroativa de `t.sessions` para `daysk-pomos`.
- Estatísticas de foco nos Relatórios além do que **B5** traz.
