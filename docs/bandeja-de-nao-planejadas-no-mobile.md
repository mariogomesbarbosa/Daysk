# Calendário no mobile — a bandeja de não planejadas

O relato: no mobile e no tablet a lista de atividades não planejadas não aparece,
e o botão que deveria mostrá-la não faz nada.

Números de linha envelhecem — este documento cita nomes de função.

---

## O diagnóstico, medido

**O botão não está quebrado.** Ele alterna `display` e a classe `aside-closed`
exatamente como no desktop. O que acontece é que ele governa um elemento **fora
da tela**.

Medido a 375×812, na visão de dia:

| | Valor |
|---|---|
| Topo do botão na página | **297px** |
| Topo do `.cal-aside` na página | **1212px** |
| Altura do viewport | 812px |
| `.cal-aside` visível sem rolar | **não** |
| O clique muda `display`? | **sim** (`block` ↔ `none`) |
| Altura da página com/sem | 1647px ↔ 1353px |

Ou seja: o usuário toca num botão a 297px e o efeito acontece a 1212px, **400px
abaixo da dobra**. O único sintoma visível é a página ficar mais curta. "Não
acontece nada" é uma leitura correta do que se vê.

A causa é a regra de ≤860px:

```css
@media (max-width: 860px) {
  .cal-layout { grid-template-columns: minmax(0, 1fr); }
  .cal-aside { position: static; }
}
```

Com uma coluna só, o `<aside>` — que vem **depois** do `.cal-main` no DOM — cai
abaixo da grade de horas (520px de rolagem) e abaixo do painel do dia. A A9 dizia
"no mobile a coluna vai para baixo", e ela vai; o que não foi previsto é que
"para baixo" significa fora do alcance.

**A faixa quebrada é ≤860px, e só ela.** Verificado a 1024px: o aside é coluna
fixa de 260px a 192px do topo, visível sem rolar. A 768px cai em 1131px num
viewport de 1024px. Mexer acima de 860 seria risco sem ganho.

---

## Duas coisas que mudam o desenho, e que o diagnóstico revelou

### O caminho de dois toques já existe, e nunca foi usado

A **A9** implementou: tocar num item seleciona (`tapSelected`), tocar num dia
coloca — reusando `aplicarSoltura()`, sem arraste nenhum. Está lá, funciona, e
**nunca foi exercitado por ninguém porque a lista é invisível**.

Isso muda a ordem de prioridade: tornar a lista visível não é o primeiro passo
para o arraste, é a entrega principal. O arraste vem depois, como refinamento.

### O arraste no toque agora exige pressionar e segurar

Desde o PR #19, arrastar no toque passa por um destravamento de 500ms. Somado à
bandeja, o fluxo de arraste tem **cinco etapas**: abrir a bandeja, segurar
500ms, a bandeja retrai, arrastar, soltar. Se qualquer uma falhar no dedo, o
usuário precisa de um plano B — que é justamente o de dois toques.

---

## Grupo B — a bandeja

### B1 — Bandeja inferior, não gaveta lateral

O `<aside>` vira uma bandeja que sobe de baixo, ocupando ~42vh, com o
**calendário continuando visível acima**.

Por que não a gaveta pela direita, que espelharia o desktop:

- **A gaveta cobre o calendário por completo**, o que torna a retração no
  arraste obrigatória em vez de refinamento — e amarra a entrega principal ao
  gesto mais difícil de acertar.
- **A borda direita é onde o Android escuta "voltar".** Um arraste que nasce ali
  disputa com o gesto do sistema.
- **Arrastar para cima**, de uma bandeja para o calendário, é o gesto natural e é
  o que os calendários nativos fazem.

### B2 — A bandeja não é modal, e essa é a diferença que importa

O app já tem uma gaveta: o sidebar da aba Tasks a ≤860px, com `position: fixed`,
`translateX(-100%)`, backdrop e trava de `overflow` no `body`. **A bandeja reusa
a mecânica e rejeita a modalidade.**

Sem backdrop e sem trava de rolagem, porque **o calendário acima precisa
continuar tocável** — é nele que acontece o segundo toque. Um backdrop mataria
justamente a interação que a bandeja existe para permitir.

Isto é divergência deliberada de um padrão da casa, e é o tipo de coisa que se
copia sem pensar. Fica escrito para não ser "corrigido" depois.

### B3 — Ela não cobre a navbar

Medido a 375×812: a navbar é `position: fixed`, **56px** de altura, **24px** do
fundo, topo em 732px, `z-index: 90`. O `body` já reserva
`padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px))`.

A bandeja ancora **no mesmo 96px**, e não em `bottom: 0`:

```css
bottom: calc(96px + env(safe-area-inset-bottom, 0px));
```

Cobrir a navbar prenderia o usuário na página — ela é o único caminho para sair
do Calendário, e ele teria de fechar a bandeja primeiro para navegar. Reusar a
expressão do `body` mantém **um número só** no arquivo.

**Escada de z-index**, com os valores que já existem: navbar 90, backdrop 94,
sidebar 95. A bandeja fica em **93** — acima do conteúdo e da navbar, abaixo da
gaveta modal da aba Tasks, que é a única coisa que pode legitimamente cobri-la.

### B4 — `position: fixed` funciona, e isso foi verificado

Percorrida a cadeia de ancestrais do `#cal-aside` procurando `transform`,
`filter`, `perspective`, `contain` e `container-type` — qualquer um deles cria
bloco de contenção e faria a bandeja se ancorar no ancestral em vez do viewport.
**Nenhum.**

Vale ter medido: o PR #21 introduziu `container-type: inline-size` no
`.report-card`, e é exatamente o tipo de propriedade que quebraria isto se
estivesse na árvore do calendário.

### B5 — O estado da bandeja é separado do estado da coluna

`calendarAsideOpen` persiste em `daysk-cal-aside` e nasce **aberto**. No desktop
está certo. No mobile, nascer aberto significa a bandeja cobrindo 42% da tela na
chegada, sem ninguém pedir.

Então: `calendarAsideOpen` continua significando **"a coluna do desktop está
expandida"**, e a bandeja ganha estado próprio, **não persistido**, nascendo
fechada. O botão despacha para um ou para outro conforme o breakpoint.

Consequência no CSS: a regra `.cal-layout.aside-closed .cal-aside { display: none }`
é de desktop e precisa ser **anulada** dentro da media query, senão o estado do
desktop esconde a bandeja. Quem manda no mobile é a classe da bandeja.

### B6 — Selecionar um item retrai a bandeja

Aqui a mecânica que você pediu para o arraste serve ao caminho de dois toques, e
resolve o aperto de espaço:

1. Toque num item → ele fica selecionado, **a bandeja retrai**, e aparece uma
   faixa fina: `toque num dia para colocar «Rever proposta» · cancelar`.
2. Toque num dia (célula do mês, coluna da faixa de dia inteiro, ou vão da grade
   de horas) → aplica e a faixa sai.

Sem a retração, o usuário selecionaria um item e teria 42% da tela ocupada
justamente pela lista de onde ele já escolheu. A faixa de confirmação é o que
substitui a bandeja como âncora visual — sem ela, o modo de "tarefa na mão"
fica invisível, que é o problema que este documento existe para corrigir.

A faixa precisa de **cancelar**: entrar num modo sem saída óbvia é pior que não
ter modo.

**Depois de colocar, a bandeja fica fechada.** O botão está ali para reabrir. É
menos movimento, e quem acabou de colocar uma tarefa provavelmente quer olhar o
calendário. Se na prática o uso for planejar várias em sequência, reabrir
sozinha é ajuste de uma linha — vale ver antes de decidir.

### B7 — A dica muda de texto por breakpoint

Hoje: "Arraste para o calendário — ou toque para escolher e toque num dia." No
mobile o arraste é o caminho secundário, então a dica lidera pelo toque. Dois
`<span>`, um por breakpoint — sem JS, porque texto que muda com a largura é
trabalho de CSS.

### B8 — A lista rola dentro da bandeja

`.cal-unplanned` tem `max-height: 420px; overflow-y: auto`. Na bandeja o teto
passa a ser a própria bandeja: `max-height: none` com `flex: 1`, e a rolagem
acontece no contêiner que se declara rolável — o mesmo padrão do
`.report-table-wrap` e do `.cal-scroll`.

---

## Grupo D — o arraste

Entra **depois**, em PR próprio. O grupo B entrega o essencial sem depender dele.

### D1 — O arraste retrai a bandeja e a torna transparente ao ponteiro

No destravamento do pressionar-e-segurar (500ms, PR #19), a bandeja retrai
**e recebe `pointer-events: none`**.

As duas coisas juntas, e a segunda não é opcional: `resolveTarget()` usa
`elementFromPoint`, e a bandeja retraindo com transição de 220ms continuaria
debaixo do dedo durante a animação. Sem `pointer-events: none`, os primeiros
quadros do arraste resolveriam para a bandeja em vez do calendário.

O arraste sobrevive à mudança de DOM porque os listeners moram na `window`
(**A5**) e porque `renderCalendar()` é guardado por `dragState` — as duas
decisões que já pagaram três vezes.

### D2 — Auto-rolagem nas bordas, nos dois eixos

Sem ela o alcance do arraste é só o que está visível: `.cal-scroll` mostra ~10 de
24 horas, e a ≤860px ele **também rola na horizontal**, porque as colunas viram
`minmax(110px, 1fr)`.

Aproximar o ponteiro de uma borda do `.cal-scroll` rola naquela direção, com
`requestAnimationFrame`, enquanto o dedo permanecer na zona. Duas constantes
nomeadas, e não números soltos no meio do gesto: a largura da zona e a velocidade
por quadro.

Na visão de mês não há contêiner rolável — quem rola é a página, e o alvo da
auto-rolagem passa a ser `window`.

**A parada é tão importante quanto a partida:** o laço tem de morrer no
`pointerup`, no `pointercancel` e no `Escape`, ou fica rolando sozinho depois do
gesto. É o tipo de vazamento que não aparece num teste curto.

### D3 — Soltar de volta em "não planejadas" fica de fora no mobile

Com a bandeja retraída não há `#cal-aside` debaixo do dedo, então
`resolveTarget()` devolve `null` e nada acontece — que é o comportamento certo
para um alvo que não existe.

Desagendar no mobile continua pelo formulário, no preset **"Sem prazo"**, que já
existe e é preciso. Transformar o botão da barra em alvo de soltura é possível e
não vale a área de toque: um alvo de 30px numa toolbar, para um gesto que o
formulário já resolve.

### D4 — A retração vale para os dois gestos, e é o mesmo código

O grupo B já retrai a bandeja ao selecionar por toque (**B6**). O arraste retrai
no destravamento. É a mesma função, chamada de dois lugares — não duas
implementações que precisam ser mantidas em sincronia.

### D5 — O que o arraste acrescenta sobre os dois toques

Vale dizer, porque justifica o PR: colocar **na hora exata**. Dois toques na
grade de horas caem no vão da hora cheia (`createAtSlot` passa `hour * 60`); o
arraste resolve no passo de 15 minutos (`CAL_SNAP`). Para quem planeja o dia em
blocos, é a diferença entre "de manhã" e "às 9h45".

---

## Casos de borda

| Caso | Esperado |
|---|---|
| Bandeja aberta e o usuário troca de visão | fecha — o contexto mudou |
| Bandeja aberta e o usuário sai do Calendário | fecha, e não reabre ao voltar |
| Item selecionado e o usuário fecha a faixa | cancela a seleção, bandeja segue fechada |
| Item selecionado e o usuário reabre a bandeja | a seleção continua marcada no item |
| Último item colocado | bandeja mostra "tudo planejado" ao ser reaberta |
| Redimensionar de 375 para 1200 com a bandeja aberta | vira coluna do desktop, sem estado preso |
| Redimensionar de 1200 para 375 com a coluna aberta | bandeja nasce fechada, não herda o estado |
| Arraste começando sobre um item e virando rolagem | a bandeja **não** retrai (não destravou) |
| `pointercancel` no meio do arraste | bandeja volta, `pointer-events` restaurado, auto-rolagem morta |
| Auto-rolagem com o dedo parado na borda | rola até o fim e para, sem repique |
| Grade já no topo/fim | auto-rolagem não faz nada, e não trava o arraste |
| Bandeja aberta com a navbar visível | os dois cabem: 42vh + 96px em 812px |
| Teclado virtual aberto (busca? não há) | não se aplica — a bandeja não tem campo de texto |

---

## Pontos de edição

| Grupo | O quê | Onde |
|---|---|---|
| B | bandeja `fixed`, ancorada em 96px, `z-index: 93` | media query de 860px |
| B | anular `.aside-closed .cal-aside { display: none }` no mobile | mesma media query |
| B | alça de arrasto e cantos arredondados | CSS da `.cal-aside` |
| B | estado próprio, não persistido | ao lado de `calendarAsideOpen` |
| B | despacho do botão por breakpoint | `toggleCalendarAside()` |
| B | retrair ao selecionar + faixa de confirmação | `toggleTapSelect()` |
| B | fechar ao trocar de visão e de aba | `setCalendarView()`, `switchTab()` |
| B | dica por breakpoint | markup da `.cal-aside-hint` + CSS |
| D | retrair e `pointer-events: none` no destravamento | `startDrag()` |
| D | auto-rolagem | ao lado de `resolveTarget()` |
| D | matar o laço | `encerrar()` e `cancelar()` de `startDrag()` |

---

## Ordem de implementação

**Dois PRs**, e a ordem não é arbitrária:

1. **`fix/bandeja-de-nao-planejadas-no-mobile`** — grupo B. Entrega o essencial:
   a lista aparece, e o caminho de dois toques que já existia passa a ser
   alcançável. **Não depende do grupo D**, e se o arraste no dedo não funcionar
   no aparelho real, este PR continua de pé sozinho.
2. **`feat/arrastar-da-bandeja-com-auto-rolagem`** — grupo D. Mexe na camada de
   gesto, que é a que menos se testa fora de aparelho real e a que já foi tocada
   duas vezes (PR #17 e #19).

Separar é o que permite reverter o gesto sem perder a correção.

---

## Verificação

**Lógica pura, no Node** (`tests/funcoes-puras.mjs`, hoje com 104 casos): a conta
da auto-rolagem — dado um ponteiro, um retângulo e a zona, qual eixo e qual
direção — é pura e vai para lá. O resto do grupo B é layout e estado, que não se
extrai.

**Interface, no navegador**, medindo e não julgando pela captura:

- **A correção do relato:** a 375px e a 768px, tocar no botão e conferir que a
  bandeja fica **visível sem rolar** — `getBoundingClientRect().top < innerHeight`,
  que é exatamente a medida que hoje devolve `false`.
- **A navbar não é coberta:** `elementFromPoint` no centro da navbar devolve a
  navbar, e não a bandeja.
- **O calendário acima continua tocável:** `elementFromPoint` num dia devolve o
  dia — é o que prova que a ausência de backdrop funciona.
- **Os dois toques ponta a ponta:** tocar num item, conferir a retração e a
  faixa, tocar num dia, conferir `t.date` gravado.
- **O arraste com `pointerType: 'touch'` sintético**, os cinco passos, conferindo
  `pointer-events` durante e depois.
- **A auto-rolagem nos dois eixos**, e o laço morrendo no `pointerup`, no
  `pointercancel` e no `Escape`.
- **As duas travessias de breakpoint**, 375↔1200, sem estado preso.
- **Contraste da bandeja e da faixa nos dois temas**, com as transições
  desligadas antes de medir.

### Três armadilhas de medição já registradas, que valem aqui

De `docs/pendencias.md`, porque as três morderam nos PRs anteriores:

- **Transbordo se mede no contêiner, não no filho.** `filho.scrollWidth` não
  detecta nada quando o filho tem `nowrap`.
- **Desligue as transições antes de medir tema.** A bandeja tem transição de
  220ms; medir no meio dela dá o valor de antes.
- **Confira `window.innerWidth` depois de redimensionar.** O pane já reportou
  sucesso entregando outra largura, de forma intermitente.

---

## Fora de escopo

- **Mexer acima de 860px.** Medido: funciona. Entre 861 e 1100 a coluna de 260px
  come largura do calendário (célula de 165px para 124px), mas trocar um layout
  que funciona por um gesto a mais não se paga.
- **Arrastar o bloco da grade para desagendar no mobile** (**D3**).
- **Redimensionar a bandeja com o dedo**, tipo folha nativa com pontos de
  parada. A bandeja tem uma altura só.
- **Alça de arrasto que abre e fecha por gesto.** O botão da toolbar é o
  controle; a alça é afordância visual, não área de gesto.
- **Reordenar a lista de não planejadas.**
- **Auto-rolagem no arraste do desktop.** Lá o mouse alcança a barra de rolagem e
  a grade cabe melhor na tela. Se valer, é ajuste próprio.

---

## Riscos, nomeados

| Risco | Onde | Mitigação |
|---|---|---|
| Bandeja debaixo do dedo nos primeiros quadros do arraste | D1 | `pointer-events: none` junto da retração, não depois |
| Laço de auto-rolagem sobrevivendo ao gesto | D2 | morrer nos três caminhos de saída, e teste explícito |
| Estado da bandeja vazando para o desktop | B5 | estado separado e não persistido |
| Copiar a modalidade da gaveta da aba Tasks | B2 | escrito no código: sem backdrop, sem trava de rolagem |
| `position: fixed` ancorando no ancestral errado | B4 | cadeia percorrida e medida — nenhum bloco de contenção |
| Cinco etapas no arraste sem plano B | ordem dos PRs | o grupo B entrega os dois toques primeiro, e sozinho |
