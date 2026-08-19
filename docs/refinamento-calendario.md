# Calendário — refinamento: coluna, campo Final, redimensionar e contraste

Quatro ajustes sobre o que já está em `main` depois do PR #12. Nenhum é peça
nova: todos mexem em coisa implementada e verificada, e **dois deles revertem
decisões documentadas** — a A1 (o que entra na coluna de não planejadas) e o
"fora de escopo" do redimensionar. Revisão de decisão não é erro; o que seria
erro é revisar sem dizer.

Números de linha envelhecem — este documento cita nomes de função.

---

## Os quatro ajustes, e o que cada um custa

| # | Ajuste | Superfície | Risco |
|---|---|---|---|
| A | A coluna "Não planejadas" passa a listar também as tarefas com data e sem hora | 1 função + o render da coluna | baixo |
| B | "Duração (min)" vira "Final (opcional)" | 2 modais + 2 helpers novos | médio |
| C | Redimensionar o bloco arrastando a borda | camada de gesto | **alto** |
| D | Contraste do bloco e do chip no calendário | só CSS | baixo |

O risco de **C** não é a conta: é a camada de gesto, que é a única parte do
Calendário sem forma de testar fora do navegador. Por isso ele vai por último.

---

## O que já existe e sustenta isto

Vale ter na cabeça antes de ler as decisões:

- **`tasksByDate()`** — índice `data → tarefas`, montado numa passada por render.
- **`packOverlaps()`** — empacotamento por colunas, puro, com piso de desenho de
  `CAL_MIN_BLOCK_MIN` (~24min).
- **`aplicarSoltura(t, alvo)`** — a gravação do arraste, separada do gesto de
  propósito. Quatro alvos: `unplan`, `month`, `allday`, `time`.
- **`startDrag(id, ev, origem)`** — Pointer Events, listeners na `window`,
  limiar de 4px, `Escape` cancela, e o guard `if (dragState) return` no topo de
  `renderCalendar()` que impede o render de 60s de recriar os alvos debaixo do
  dedo.
- **`resolveTarget(x, y)`** — alvo por `elementFromPoint`, não por listener em
  cada célula.
- **Constantes:** `CAL_HOUR_H = 48`, `CAL_MIN_BLOCK_H = 19`,
  `CAL_MIN_BLOCK_MIN ≈ 24`, `CAL_SNAP = 15`.
- **Tema em três seletores:** `:root`, `:root:not([data-theme="light"])` dentro
  de `prefers-color-scheme: dark`, e `:root[data-theme="dark"]`. **Todo override
  de tema precisa ser escrito duas vezes** — é o modo de falha clássico deste
  arquivo.

---

## Grupo A — a coluna de não planejadas

### R1 — A A1 é revista, não apagada

A [A1](calendario-alternador-de-visao.md) decidiu que "não planejada" é `!t.date`
e nada mais, e rejeitou explicitamente incluir as tarefas com data e sem hora. O
argumento era concreto: a tarefa apareceria **duas vezes na mesma tela** — na
faixa de dia inteiro (V6) ou na célula do mês, *e* na coluna — e "uma tarefa em
dois lugares é convite para o usuário mover uma e estranhar que a outra não
mudou".

O argumento continua verdadeiro. O que muda é a leitura do problema: no uso real,
a tarefa com data e **sem hora** é exatamente a que ainda precisa de planejamento
— ela tem dia, não tem lugar no dia. Escondê-la da coluna de planejamento é
esconder o trabalho de quem está planejando.

A duplicação se resolve **rotulando**, não escondendo:

- A coluna passa a ter **dois grupos com subtítulo**: `sem prazo` e `sem hora`.
- O item do grupo `sem hora` **mostra a data**. Quem vê "19/08" na coluna entende
  que aquela tarefa já tem dia e que ela também está lá na grade.

E o medo específico da A1 — mover uma cópia e a outra não acompanhar — **não se
concretiza no código que existe**: as duas superfícies são derivadas de `tasks` a
cada `render()`, nunca guardadas. Mover em qualquer uma redesenha as duas. Isso
não era garantido quando a A1 foi escrita; hoje é, e é o que torna a revisão
segura.

### R2 — Os dois grupos excluem concluídas

Hoje `unplannedTasks()` é `tasks.filter(t => !t.date)`, e isso **inclui
concluídas**. Passa a excluir, nos dois grupos.

O motivo é o mesmo de
[ajuste-balde-hoje-concluidas.md](ajuste-balde-hoje-concluidas.md): a coluna é
fila de trabalho, não extrato. Arrastar uma tarefa concluída para as 14h não
significa nada, e o contador ao lado do título só quer dizer alguma coisa se for
"quanto falta planejar".

Isto **muda comportamento existente** (uma tarefa sem prazo e concluída some da
coluna). É deliberado e está registrado aqui por isso.

### R3 — A ordem, o selo de data e o atrasado

```js
function asideGroups() {
  const abertas = tasks.filter(t => t.status !== 'done');
  return {
    semPrazo: abertas.filter(t => !t.date),
    semHora:  abertas.filter(t => t.date && !t.time)
                     .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b))),
  };
}
```

- **`semPrazo` mantém a ordem do array**, como hoje. Sem data não há critério
  melhor, e reordenar sem motivo confunde quem já se acostumou com a posição.
- **`semHora` ordena por `taskSortKey`**, mais próximo primeiro. É fila de
  "planeje isto", e fila se lê de cima.
- **Selo de data** em `.cal-unplanned-date`: mono, 10px, `--text2`, no formato
  `dd/MM`. Hoje e amanhã viram `hoje` e `amanhã` — é o vocabulário que o resto do
  app já usa nos presets do formulário.
- **Atrasada** (`t.date < todayStr()`) pinta o selo com `--red`. É o sinal mais
  forte que a coluna pode dar, e é barato.

Sem limite de itens: `.cal-unplanned` já tem `max-height: 420px; overflow-y: auto`.

### R4 — O contador, os vazios e a dica

- **`#cal-unplanned-count`** passa a somar os dois grupos.
- **Grupo vazio some inteiro** — subtítulo incluído. Uma coluna com dois
  cabeçalhos e nada embaixo é pior que uma coluna com um.
- **Só quando os dois estão vazios** aparece a mensagem única, e o texto muda:
  `nada sem prazo` estava certo para um conjunto e é falso para dois. Passa a ser
  **`tudo planejado`** — que é, aliás, o estado de sucesso que a A1 queria
  celebrar.
- A `.cal-aside-hint` ("Arraste para o calendário — ou toque para escolher e
  toque num dia") continua válida para os dois grupos.

### R5 — O arraste não muda uma linha

Vale conferir alvo por alvo, porque a conclusão é boa demais para ficar
implícita:

| Gesto com um item de `sem hora` | O que `aplicarSoltura` já faz | Resultado |
|---|---|---|
| Soltar na grade de horas | `date` + `time` + `dur = 60` | sai da coluna, vira bloco |
| Soltar na faixa de dia inteiro de outro dia | troca `date`, zera `time`/`dur` | fica na coluna, selo novo |
| Soltar numa célula do mês | troca `date`, **preserva** `time` | fica na coluna, selo novo |
| Soltar de volta na coluna | `date = null` | migra de `sem hora` para `sem prazo` |

O guard do alvo `unplan` é `if (!t.date && !t.time) return false` — uma tarefa com
data e sem hora passa por ele e tem a data limpa, que é exatamente o desejado.
**Nenhuma mudança em `aplicarSoltura`, `resolveTarget` ou `startDrag`.**

---

## Grupo B — "Duração (min)" vira "Final (opcional)"

### R6 — `t.dur` continua sendo o campo persistido

O campo do formulário muda; **o modelo não**. `t.dur` é lido em nove pontos —
`getProgress()`, `packOverlaps()`, `taskRowHtml()`, a tabela do relatório,
`aplicarSoltura()`, `migrate()`, o cálculo de `elapsed` — e os três modos de
sincronização serializam o array **sem validar schema** (ver
[modelo-de-dados.md](modelo-de-dados.md)). Introduzir um `t.end` criaria duas
fontes de verdade para a mesma informação, num transporte que não detectaria a
divergência.

Então: **"Final" é superfície de entrada, e a conversão acontece nas bordas do
formulário.** Zero migração, dados antigos seguem funcionando, os três modos de
sync não são tocados.

### R7 — A conversão, escrita uma vez

Dois helpers, ao lado de `padTime()`/`toMins()`:

```js
/* Fim a partir da duração — para preencher o campo ao abrir a edição.
   padTime() já vira a meia-noite: 23:00 + 120min mostra 01:00. */
function endFromDur(time, dur) {
  return (time && dur) ? padTime(toMins(time) + dur) : '';
}

/* Duração a partir do fim. O +1440 é o que faz o ida-e-volta fechar: sem ele,
   reabrir a tarefa de 23:00 acima e salvar sem mexer daria duração negativa. */
function durFromEnd(time, end) {
  if (!time) return null;                    // fim sem início não significa nada
  if (!end) return 60;                       // a mesma regra de hoje
  return ((toMins(end) - toMins(time) + 1440) % 1440) || 60;
}
```

`|| 60` no fim cobre `fim === início`: zero minuto não é duração, e cair no
padrão é menos surpreendente que gravar um bloco de altura nula.

### R8 — Fim anterior ao início vira madrugada, com guarda visível

`(fim - início + 1440) % 1440` — a tarefa que começa às 23:00 e termina às 01:00
dura duas horas.

Isto **é necessário**, não é conveniência: `padTime()` já mostra o fim virando a
meia-noite, então sem o `+1440` a tarefa que atravessa o dia não sobreviveria a
um abrir-e-salvar sem mexer.

O preço é o erro de digitação: início `09:45`, fim `08:00` por engano vira um
bloco de 22h15 sem ninguém reclamar. A guarda é **visível, não bloqueante**:

- Uma linha de dica embaixo dos dois campos mostra sempre a duração calculada
  (`2h`, `45min`), atualizada no `change` dos dois inputs.
- **Acima de 12h a dica vira `--red`** e ganha o texto `— confere?`.

Nada de modal de confirmação: o app não tem validação bloqueante em lugar
nenhum, e introduzir a primeira aqui seria inventar um padrão para um caso de
borda. A dica também resolve a perda que o campo antigo não tinha — com
"Duração" o usuário via os minutos; com "Final" ele veria só o relógio.

### R9 — Sem início, o campo Final fica desabilitado

`dur` sem `time` já é `null` no modelo. O campo passa a refletir isso: `f-end`
nasce `disabled` e é habilitado no `change` de `f-time`. Ao limpar o início, o
fim é limpo junto.

É a mesma regra que já existe em `saveTask()` (`const dur = time ? ... : null`),
só que agora visível antes de salvar em vez de silenciosa depois.

### R10 — O modal de agendamento rápido muda junto

`sched-dur` vira `sched-end`, e `saveQuickSchedule()` chama os mesmos dois
helpers. Não é escopo esticado: são dois caminhos para a mesma gravação na mesma
tela, e deixar um pedindo minutos e o outro pedindo relógio é o app mentindo
sobre o próprio modelo.

De brinde, some a esquisitice cosmética do `.context-selector` naquele modal? Não
— essa é outra ([pendencias.md](pendencias.md)), e continua fora.

### R11 — O que **não** muda

`taskRowHtml()` já mostra `fim · duração` na coluna de horário. A tabela do
relatório já mostra duração. `packOverlaps()` e `getProgress()` leem `dur`.
Nenhum deles é tocado — e isso é o teste de que a R6 está certa.

---

## Grupo C — redimensionar arrastando a borda

Isto estava explicitamente em **"fora de escopo"** no plano anterior, com o
argumento de que "mudar duração continua pelo formulário". Com o Grupo B o
formulário fica melhor nisso, e o gesto direto passa a ser refinamento em cima de
um caminho que funciona — não a única forma de fazer a coisa. É essa a diferença
que justifica reabrir.

### R12 — Duas alças dentro do bloco, e nada de listener novo na window

```html
<button class="cal-block" ...>
  <span class="cal-resize" data-borda="ini"></span>
  <span class="cal-block-time">…</span>
  <span class="cal-block-name">…</span>
  <span class="cal-resize" data-borda="fim"></span>
</button>
```

- 6px de altura, `cursor: ns-resize`, `touch-action: none`.
- `onpointerdown` chama `startResize(id, event, borda)` e faz
  `event.stopPropagation()` — sem isso o `startDrag` do bloco dispara junto e o
  gesto vira mover.

### R13 — `startResize` copia a arquitetura de `startDrag`, não inventa outra

Mesmas cinco escolhas, pelos mesmos motivos (**A5** e **A6**): Pointer Events,
listeners na `window` e não no elemento, limiar de 4px, `Escape` cancela,
`engolirProximoClique()` no fim para o `pointerup` não abrir a edição.

E **o mesmo guard de render**: `startResize` seta `dragState = { id, tipo:
'resize' }`. O `if (dragState) return` no topo de `renderCalendar()` já cobre o
caso — um segundo guard seria um segundo lugar para esquecer de limpar.

### R14 — O que cada alça grava

| Alça | Grava | Piso | Teto |
|---|---|---|---|
| inferior | `dur = snap(y) - toMins(t.time)` | `CAL_SNAP` (15min) | `time + dur ≤ 1440` |
| superior | `time = padTime(snap(y))`, `dur = fimAntigo - novoInício` | `CAL_SNAP` | `novoInício ≥ 0` |

A alça superior **mantém o fim parado** — é o que todo calendário faz, e é o que
a pessoa espera ao puxar a borda de cima.

O passo é `CAL_SNAP = 15`, o mesmo da **A4**: soltar não é medir.

**Uma armadilha que vale escrever:** `CAL_MIN_BLOCK_MIN` (~24min) é piso de
**desenho**, não de dado — ele existe para o rótulo caber em 19px e para o
`packOverlaps` não deixar dois blocos curtos se sobreporem sem saber. O piso de
**dado** é `CAL_SNAP`, 15min. Usar `CAL_MIN_BLOCK_MIN` como mínimo de duração
faria o gesto recusar silenciosamente um valor perfeitamente válido.

### R15 — Feedback ao vivo sem `render()`

Durante o gesto, mexer direto no `style.top`/`style.height` do próprio bloco e
trocar o texto de `.cal-block-time` para `início–fim`. Nada de `render()` — pelo
mesmo motivo da **A6**.

Consequência aceita: **as sobreposições não são reempacotadas durante o
arraste**, então o bloco cresce por cima do vizinho em vez de dividir a coluna
com ele. O `render()` do `pointerup` acerta. Reempacotar a cada `pointermove`
seria rodar `packOverlaps()` a 60fps para melhorar meio segundo de desenho.

### R16 — No toque, pressionar e segurar entra no modo de redimensionar

O desktop tem hover e ponteiro fino: as alças aparecem no `:hover` e o gesto é
direto. O toque não tem nem uma coisa nem outra, e alça de 6px não se acerta com
o dedo. Então, **só quando `matchMedia('(pointer: coarse)')`**:

1. `pointerdown` no bloco arma um timer de **500ms**.
2. Mover mais de 4px antes disso → é arraste de mover; o timer é cancelado.
   (Esta é a ordem certa: mover continua sendo o gesto barato.)
3. O timer disparar → `resizeMode = id`, o bloco ganha `.resizing` com alças de
   **14px**, `navigator.vibrate?.(10)`, e o arraste daquele gesto é abortado.
4. Enquanto `resizeMode` estiver ativo naquele bloco, `startDrag` fica suspenso
   para ele — senão puxar o meio moveria a tarefa em vez de redimensionar.
5. Sai do modo: tocar fora, `Escape`, aplicar um redimensionamento, ou trocar de
   visão/dia.

**`contextmenu` precisa ser cancelado no bloco.** Pressionar e segurar é
exatamente o gesto do menu nativo de contexto no toque; sem `preventDefault` o
navegador abre o menu no meio da interação.

Mantendo o timer atrás de `pointer: coarse`, **o desktop não muda em nada** — o
que é o ponto: C é o ajuste arriscado, e limitar a superfície é o que o torna
revisável.

### R17 — Bloco de 19px não comporta duas alças

Um bloco no piso de desenho tem 19px. Duas alças de 6px deixam 7px para agarrar e
mover, e para acertar e abrir a edição — ou seja, deixam nada.

Regra: **abaixo de 28px de altura, só a alça inferior existe.** Classe própria
(`.cal-block.tiny`), não a `.compact` que já existe — aquela tem outro limiar (34px)
e outro propósito (empilhar hora e nome), e amarrar as duas faria uma mudança de
tipografia mexer no gesto.

A borda de cima do bloco curto continua sendo área de mover e de abrir. Quem
precisa esticar um bloco de 15min pelo topo usa o campo "Final" — que agora
existe.

### R18 — Um bug pré-existente que apareceu ao planejar isto

**Nem `.cal-block` nem `.cal-chip` têm `touch-action: none`.** Só
`.cal-unplanned-item` tem.

Os dois primeiros são origem de arraste (`startDrag(..., 'grid')`), e vivem dentro
de `.cal-scroll`, que rola na vertical. Sem `touch-action: none`, um arraste
vertical no toque tende a ser reivindicado pela rolagem do contêiner — e uma vez
reivindicado, `preventDefault()` no `pointermove` não desfaz: chega
`pointercancel` e o arraste morre.

Ou seja: **arrastar um bloco no celular provavelmente não funciona hoje**, e a
A9 não pegou porque ela tratou do gesto da *coluna* (que tem a declaração) e
resolveu o resto com dois toques.

Não estou afirmando o bug — estou afirmando a declaração que falta. **Confirmar
por medição antes de corrigir**, que é a lição que este projeto já aprendeu duas
vezes. A correção entra no PR de C, que é onde o toque no bloco passa a importar.

---

## Grupo D — contraste do bloco e do chip

### R19 — O que foi medido

Calculado sobre os tokens do arquivo, com a fórmula de luminância relativa da
WCAG:

| Onde | Cores | Razão |
|---|---|---|
| Bloco sobre a grade, **escuro** | `--surface2` #282D33 sobre `--surface` #1E2226 | **1.15:1** |
| Bloco sobre a grade, **claro** | `--surface2` #EEF0F3 sobre `--surface` #FFFFFF | **1.14:1** |
| Chip sobre a célula, **escuro** | #282D33 sobre `--bg` #15181B | **1.28:1** |
| Chip sobre a célula, **claro** | #EEF0F3 sobre `--bg` #F5F6F8 | **1.06:1** |

O relato está certo, e é pior no tema claro. Um chip a 1.06:1 é, para efeitos
práticos, invisível: o que se vê hoje é o texto, não o objeto.

A cor do projeto entra só como 3px de borda à esquerda — o bloco inteiro é
cinza, em qualquer projeto.

### R20 — Por que a meta **não** é "3:1 no preenchimento"

A WCAG 1.4.11 pede 3:1 para o **limite** do componente de interface, não para o
preenchimento contra o contêiner. E a distinção não é advocacia de regra: um
preenchimento escuro o bastante para bater 3:1 contra a grade vira um bloco
maciço de cor que come a régua de horas e a linha do "agora".

Então a divisão de trabalho é:

- **A borda carrega o 3:1** — ela é o limite do componente.
- **O preenchimento carrega a identidade** do projeto, e só precisa ser
  distinguível.
- **O texto carrega o 4.5:1** de texto normal.

### R21 — Tema claro: preenchimento `bg`, texto `fg`, borda `fg`

A `PALETTE` já tem o par certo para isto. Medido, os dez projetos:

| | Faixa medida | Meta |
|---|---|---|
| Borda `fg` sobre `--surface` | **5.02 – 7.58:1** | 3:1 ✅ |
| Texto `fg` sobre o preenchimento `bg` | **4.40 – 6.40:1** | 4.5:1 ⚠️ |

Dois projetos ficam a 4.40 e 4.41 (verde e laranja) — abaixo de 4.5 por uma
casa. Como o nome do bloco é 10.5px, não conta como texto grande, então: **o
texto do bloco usa `--text`, não `fg`**, e o `fg` fica na borda e no ponto. Sobre
`bg` (que é um tom claríssimo), `--text` #14171B dá acima de 15:1 nos dez.

A borda de 3px à esquerda continua, e as outras três ganham 1px da mesma cor.

### R22 — Tema escuro: `color-mix`, e os números

Não existe par escuro na `PALETTE`, e o `bg` claro sobre fundo escuro seria um
bloco fluorescente. O preenchimento é derivado:

```css
background: color-mix(in srgb, var(--bloco) 24%, var(--surface));
border-color: color-mix(in srgb, var(--bloco) 55%, var(--text));
color: var(--text);
```

Medido nos dez projetos:

| | Faixa medida | Meta |
|---|---|---|
| Borda sobre `--surface` | **5.43 – 6.59:1** | 3:1 ✅ |
| Borda sobre o próprio preenchimento | **4.75 – 5.23:1** | — |
| Texto `--text` sobre o preenchimento | **11.22 – 12.50:1** | 4.5:1 ✅ |

Os 24% saíram de medir 20/24/28: em 20% o preenchimento ainda some contra a
grade; em 28% os tons quentes (âmbar, laranja) começam a competir com a linha do
"agora", que é `--red`.

A borda **precisa** ser clareada com `--text` — o `fg` puro sobre `--surface` dá
**2.11 – 3.19:1** no escuro, e sete dos dez projetos reprovariam.

### R23 — `color-mix` é técnica nova neste arquivo, e por quê

Zero ocorrências hoje. A alternativa era precomputar os tons escuros como campos
novos na `PALETTE` e escolher em JS.

**Rejeitada**: o JS não re-renderiza ao alternar o tema, então o bloco ficaria com
o preenchimento do tema anterior até o próximo `render()` — até 60 segundos de
tela errada. Tematização mora no CSS; é lá que ela sobrevive ao toggle sem
ninguém combinar nada.

A linha de base de suporte é 2023 (Chrome/Edge 111, Safari 16.2, Firefox 113), e
este app já depende da File System Access API — que é Chrome/Edge e nada mais —
para um dos três modos de sync. `color-mix` não é a fronteira aqui.

**O bloco escuro precisa ser escrito duas vezes**, em
`:root:not([data-theme="light"])` sob `prefers-color-scheme` e em
`:root[data-theme="dark"]`. É a convenção do arquivo e é o erro mais fácil de
cometer neste grupo.

### R24 — O chip recebe o mesmo tratamento, e perde o ponto

Chips do mês e da faixa de dia inteiro usam os mesmos tokens, em escala menor:
preenchimento tingido, borda de 1px na cor do projeto, sem a borda de 3px (um
chip tem 10.5px de altura — 3px seria um terço dele).

**O `project-dot` sai de dentro do chip.** Com o chip tingido pelo projeto, o
ponto repete a informação e come ~10px do nome, que é justamente o que falta no
mês. Os pontos que aparecem **abaixo de 600px** são outros — construídos em
`renderMonthGrid()`, fora de `calChipHtml()` — e continuam.

### R25 — Concluída: borda colorida, preenchimento neutro

`opacity: .55` sobre preenchimento tingido lava o bloco de volta ao invisível de
onde ele veio. Então concluída troca de estratégia:

- Preenchimento volta ao neutro (`--surface2`) — concluído não precisa gritar o
  projeto.
- **Borda continua colorida**, então o limite continua passando o 3:1.
- `opacity` sobe de `.55` para `.7`, e o risco no nome continua fazendo o
  trabalho de dizer "feito".

### R26 — Uma coisa para olhar, não para decidir agora

`.cal-day-col.selected` usa `--accent-bg`, que no escuro é #2A2E33 — vizinho dos
preenchimentos novos. Pode ser que a coluna selecionada e os blocos se
aproximem demais. É julgamento de olho, não de medida: fica para a verificação
visual, e só vira ajuste se incomodar.

---

## Casos de borda

| Caso | Esperado |
|---|---|
| Tarefa com data, sem hora, concluída | não aparece na coluna (**R2**), continua no chip do dia |
| Tarefa sem prazo e concluída | **deixa de aparecer** na coluna — mudança deliberada (**R2**) |
| Coluna com os dois grupos vazios | mensagem única `tudo planejado` |
| Tarefa com data anterior a hoje, sem hora | grupo `sem hora`, selo em `--red` |
| Início 23:00, fim 01:00 | `dur = 120`; o bloco é aparado na meia-noite (**V10**, inalterado) |
| Início 09:45, fim 08:00 | `dur = 1335`, dica em vermelho com `— confere?` (**R8**) |
| Fim igual ao início | cai no padrão de 60min (**R7**) |
| Fim preenchido, início vazio | campo desabilitado; nada é gravado (**R9**) |
| Reabrir e salvar sem mexer, tarefa que atravessa a meia-noite | duração idêntica — é o que o `+1440` garante |
| Alça inferior arrastada acima do início | trava em 15min |
| Alça superior arrastada abaixo do fim | trava em 15min |
| Alça inferior puxada além da meia-noite | trava em `1440 - início` |
| Bloco de 19px | só alça inferior (**R17**) |
| Redimensionar sobre um vizinho | cresce por cima durante o gesto; reempacota no `pointerup` (**R15**) |
| Pressionar e segurar no desktop | nada — o timer só existe em `pointer: coarse` (**R16**) |
| Tarefa sem projeto | `--bloco` cai em `--accent`; o `color-mix` continua válido |

---

## Pontos de edição

| Grupo | O quê | Onde |
|---|---|---|
| A | `unplannedTasks()` → `asideGroups()` | perto de `tasksByDate()` |
| A | render dos dois grupos, selo, contador, vazio | `renderUnplannedList()` |
| A | `.cal-unplanned-group`, `.cal-unplanned-date` | CSS da coluna |
| B | `endFromDur()`, `durFromEnd()` | ao lado de `padTime()` |
| B | `f-dur` → `f-end`, rótulo, dica de duração | modal de atividade |
| B | `sched-dur` → `sched-end` | modal de agendamento |
| B | leitura e gravação | `openCreateForm()`, `openEditForm()`, `saveTask()`, `openQuickScheduleModal()`, `saveQuickSchedule()` |
| C | alças no HTML do bloco | `renderTimeGrid()` |
| C | `startResize()`, `resizeMode`, timer de pressionar-e-segurar | ao lado de `startDrag()` |
| C | `.cal-resize`, `.cal-block.tiny`, `.cal-block.resizing` | CSS do bloco |
| C | `touch-action: none` em `.cal-block` e `.cal-chip` (**R18**) | CSS do bloco e do chip |
| D | preenchimento, borda, texto, `.done` | `.cal-block` e `.cal-chip`, mais os **dois** blocos de tema escuro |
| D | `--bloco-bg` no inline style; ponto sai do chip | `renderTimeGrid()`, `calChipHtml()` |

---

## Ordem de implementação

Quatro PRs, um assunto cada — convenção do repositório. Ordem por risco
crescente:

1. **`fix/contraste-do-bloco-no-calendario`** (D) — só CSS, nenhuma lógica, e é o
   maior ganho visível por linha mexida. Primeiro porque valida os tokens novos
   antes de qualquer outra coisa depender deles.
2. **`feat/campo-final-no-lugar-da-duracao`** (B) — dois modais e dois helpers.
   Antes de C porque dá o caminho preciso de editar duração; com ele no lugar,
   as arestas do gesto deixam de ser bloqueantes.
3. **`feat/nao-planejadas-inclui-sem-hora`** (A) — isolado na coluna, não toca em
   gesto nem em modelo.
4. **`feat/redimensionar-bloco-arrastando`** (C) — o único que mexe na camada de
   gesto, e o que carrega a correção do **R18**. Por último, sozinho, para poder
   voltar atrás sem desfazer os outros três.

---

## Verificação

Sem suíte de testes; os dois tipos de sempre.

**Lógica pura, no Node.** As funções novas são puras de propósito e é aí que o
harness se paga:

- `durFromEnd()` / `endFromDur()`: ida-e-volta para 09:45+120, 23:00+120,
  00:15+30, fim igual ao início, fim vazio, início vazio, e o par 09:45→08:00.
- `asideGroups()`: sem prazo aberta, sem prazo concluída, com data e sem hora,
  com data e com hora, atrasada sem hora, e a ordenação por `taskSortKey`.
- A conta das alças: pisos, tetos e o `snap` de 15 nas quatro direções.

Vale commitar o harness desta vez — os três anteriores foram perdidos por viver
em diretório temporário ([pendencias.md](pendencias.md)).

**Interface, no navegador.** Semear `localStorage` cobrindo os casos da tabela e
percorrer:

- **Contraste:** medir com `getComputedStyle` o preenchimento e a borda
  resolvidos e recalcular as razões — **nos dois temas, alternando pelo toggle**,
  não só pelo `prefers-color-scheme`. É o teste que pega a regra escrita numa
  media query só.
- **Coluna:** os dois grupos, o selo de atrasada, o contador, os três estados de
  vazio, e arrastar um item de `sem hora` para os quatro alvos.
- **Campo Final:** os nove casos da tabela, incluindo o ida-e-volta da tarefa que
  atravessa a meia-noite, nos dois modais.
- **Redimensionar:** as duas alças, os pisos e tetos, `Escape` no meio,
  o bloco de 19px, o vizinho sobreposto, e o `pointerup` não abrindo a edição.
- **Toque:** pressionar e segurar entrando no modo, o menu de contexto **não**
  abrindo, mover continuando a funcionar antes dos 500ms, e o `touch-action`
  do **R18** medido antes e depois.

**Medir em vez de julgar pela captura de tela.** Duas vezes, na reestruturação,
uma screenshot sugeriu problema que a medição desmentiu. E vale lembrar a
armadilha inversa: com o pane do navegador oculto a página não produz frames, e
transições CSS não avançam — desligue a transição antes de medir a cascata.

---

## Fora de escopo

- **Redimensionar na visão de mês e na faixa de dia inteiro.** Não há eixo de
  tempo para arrastar contra.
- **Bloco que atravessa a meia-noite desenhado em duas colunas.** A **V10**
  continua aparando no fim do dia; o `+1440` do **R8** é sobre o dado, não sobre
  o desenho.
- **Passo menor que 15 minutos**, e passo configurável.
- **Mover um bloco arrastando dentro do mesmo dia** para outro horário — hoje já
  funciona pelo `startDrag`; o que não entra é refinar aquele gesto junto.
- **Editar duração por arraste na aba Tasks.**
- **Recorrência e fuso horário.** O modelo não tem nem um nem outro.
- **`reopenTask()` não limpar `completedAt`**, o escape de HTML nos nove pontos,
  e o contraste dos botões de ícone no app inteiro — três ressalvas de
  [pendencias.md](pendencias.md) que continuam abertas e não são consequência
  destes quatro ajustes.

---

## Riscos, nomeados

| Risco | Onde | Mitigação |
|---|---|---|
| O gesto de redimensionar brigar com o de mover | C | limiar de 4px antes do timer; `stopPropagation` nas alças |
| Menu de contexto nativo abrir no pressionar-e-segurar | C | `preventDefault` no `contextmenu` do bloco |
| Override de tema escrito num seletor só | D | a regra escura vale nos **dois** blocos; conferir pelo toggle |
| Ida-e-volta da duração quebrar na virada do dia | B | o `+1440`, com caso no harness |
| Erro de digitação virar bloco de 22h | B | dica de duração sempre visível, vermelha acima de 12h |
| Duplicação na coluna confundir | A | subtítulos e selo de data; as duas superfícies derivam de `tasks` |
| `touch-action` faltando quebrar o arraste no toque | C | medir antes de corrigir (**R18**) |
