# Pendências e ressalvas conhecidas

## `reopenTask()` não limpa `completedAt`

`completeTask()` grava `t.completedAt = Date.now()`; `reopenTask()` devolve o
`status` para `'pending'` e **deixa o timestamp lá**. Uma tarefa reaberta fica
afirmando que foi concluída num instante preciso.

Hoje é inócuo, porque o campo não é lido em lugar nenhum — é a única ocorrência
no arquivo. Mas é pré-requisito de qualquer coisa que passe a ler `completedAt`.
A regra do balde "Hoje" acabou não precisando dele (ver
[ajuste-balde-hoje-concluidas.md](ajuste-balde-hoje-concluidas.md) — "Hoje" hoje
exclui toda concluída, de qualquer data, só com `t.status`); a candidata que
sobrou é o gráfico do relatório agrupar por data de conclusão em vez de data
planejada. Ver [modelo-de-dados.md](modelo-de-dados.md).

A correção é uma linha (`delete t.completedAt`), mas ela só faz sentido junto da
decisão de para que o campo serve — por isso não foi feita solta.

## O nome da tarefa fica ilegível abaixo de ~480px

Medido a 425px, na aba Tasks: `.task-name` chega a **0px de largura visível** em
algumas linhas e 14px em outras, enquanto o texto precisaria de ~126–151px. A
linha não gera scroll horizontal — os elementos se comprimem em vez de
transbordar — mas o nome, que é a informação principal, desaparece.

Quem disputa o espaço na `.task-row` é o bloco de horário, o selo do projeto, a
barra de progresso, o rótulo de estado e os três botões de ação. Nenhum cede.

**Não foi corrigido** porque decidir como a linha deve refluir no mobile é
decisão de design, não consequência da correção de overflow: dá para empilhar em
duas linhas, esconder a barra de progresso, colapsar os botões num menu, ou
esconder o selo quando estreito. Vale escolher antes de mexer.

É anterior à reestruturação — a `.task-row` não foi tocada em nenhum dos cinco
blocos.

## Sem acesso ao gerenciador de projetos no Calendário e nos Relatórios

O botão "projetos" saiu da `brand-bar` e o acesso passou a ser o `+` da seção
Projetos, no sidebar. Como o sidebar não existe nessas duas páginas
(`body.no-sidebar`), e o botão do menu também fica escondido lá, **não há
caminho para o gerenciador fora da aba Tasks**. Verificado nas três abas.

É consequência aceita de manter a gerência junto de onde os projetos vivem. Se
incomodar, o caminho mais simples é o `+` da seção também aparecer no cabeçalho
quando `body.no-sidebar` estiver ativo.

## Interpolação de nomes no HTML sem escape

O Bloco 4 introduziu `esc()` e o usa nos dois pontos que ele mesmo escreve: o
item de projeto no sidebar e a mensagem de lista vazia. **Os outros pontos
seguem sem escape** — são cerca de nove, entre nomes de projeto e de tarefa:

| Onde | O quê |
|---|---|
| `populateProjectSelect()` | nome do projeto no `<option>` |
| `projectTagHtml()` | nome do projeto no selo |
| `projectRowHtml()` | nome e contador no modal |
| `projectEditRowHtml()` | nome no `value=""` do input — **o mais frágil**, uma aspa dupla no nome quebra a marcação |
| `renderGroupedByProject()` | nome no cabeçalho do grupo |
| `taskRowHtml()` (dois pontos) | nome da tarefa |
| tabela do relatório | nome da tarefa e do projeto |

Não foi corrigido junto porque a superfície é maior do que o Bloco 4 e a
correção é transversal: vale como um PR próprio, que passe `esc()` nos nove de
uma vez em vez de deixar metade do arquivo escapando e metade não. O risco real
aqui é quebra de layout, não execução de terceiros — os dados são locais e do
próprio usuário.

## Selo de tendência: --green e --red erram o 4.5:1 no tema claro

Os selos "↑ +33h vs anterior" da Visão Geral usavam **cores fixas** que não
respondiam ao tema: `#16a34a` sobre `rgba(34,197,94,.12)` e `#dc2626` sobre
`rgba(239,68,68,.12)`. Medido, isso dava **2.97:1** para o de alta no tema claro
e **2.95:1** para o de queda no escuro — abaixo até do 3:1 de componente.

Corrigido para os tokens `--green` e `--red` sobre `--surface2`, o mesmo fundo
que o selo `.neutral` já usa. Medido depois: **4.39** e **4.23** no claro,
**7.96** e **5.02** no escuro.

**O que sobra:** o tema claro fica ~0.2 abaixo do 4.5:1 de texto normal. O
limite são os próprios tokens — `--green` #15803D dá 4.39:1 sobre `--surface2` e
`--red` #DC2626 dá 4.23:1, e nenhuma escolha de fundo resolve sem escurecer o
texto. Fechar a fresta exige mexer em `--green` e `--red` no app inteiro, o que
é decisão de design system e não consequência de um cartão — mesma lógica da
ressalva do `--text3` abaixo.

Vale saber que a informação **não depende da cor**: a seta (`↑` / `↓`) e o sinal
do número dizem a mesma coisa.

## Contraste dos botões de ícone, no app inteiro

Medido durante o Bloco 4, com as transições desligadas. `--text3` sobre `--bg`
dá **2.46:1 no tema claro** e 3.85:1 no escuro. A WCAG pede 3:1 para
componentes de interface, então o tema claro não passa.

Isso vale para `.btn-del`, `.btn-mini-del`, os ícones dos itens do sidebar e o
`+` da seção de projetos — que ficou nesse token justamente para acompanhar os
outros. Todos ganham `--text` no hover, então o problema é só o estado de
repouso.

**Não foi alterado** porque `--text3` é o token de ícone da casa: mudar apenas o
botão novo o deixaria fora do padrão, e mudar todos é uma decisão de design
system, não consequência deste bloco. Se for mexer, `--text2` dá 5.53:1 no claro
e 7.2:1 no escuro.

Como referência do que é o padrão: **`--text3` nunca é usado para texto** no
arquivo — texto pequeno usa `--text2` (ver `.stat-lbl`, 11px). O título da seção
de projetos nasceu em `--text3` a 10px, com 2.46:1, e foi corrigido para
`--text2` a 11px antes do merge.

## A gaveta abaixo de 860px foi finalmente vista — e tinha um bug

Registro do que a verificação visual no Chrome real achou, e que duas rodadas de
medição não tinham achado.

**A gaveta ocupava só a altura do conteúdo, não a tela inteira.** A 816px, o
painel terminava em ~430px de 909, com o conteúdo da página aparecendo embaixo.

A causa é sutil e vale saber: a regra base de `.sidebar` tem `align-self: start`,
necessária para o sticky da coluna no desktop. Numa caixa `position: fixed` com
`top` **e** `bottom` definidos, `align-self: start` **cancela o esticamento
vertical** — a caixa passa a ter a altura do conteúdo, mesmo com `bottom: 0`
computando como `0px`. A correção foi `align-self: stretch` dentro da media
query.

Isto é anterior ao Bloco 4 — vem do PR #6 — e é exatamente o tipo de coisa que a
ressalva "não verificado visualmente" estava escondendo. Nenhuma das medições
pegou porque eu media *se a media query aplicava* e *se o transform deslizava*,
nunca se a altura resultante fazia sentido.

**Como reproduzir sem viewport estreito**, útil porque redimensionar o viewport é
pouco confiável: aplique no elemento as mesmas declarações da media query
(`position: fixed; top: 0; bottom: 0; align-self: …`) na largura que estiver e
compare `getBoundingClientRect().height` com `window.innerHeight`.

## Layout abaixo de 860px: verificado a 480px, não a 375px

Substitui parcialmente a ressalva registrada no PR #6, que dizia que a faixa
mobile nunca havia sido vista. **Durante o Bloco 4 o viewport passou a
redimensionar de verdade** — `window.innerWidth` respondeu, a media query de
860px casou e a gaveta foi exercitada com dados reais a **480px**:

- Botão de menu aparece; `.sidebar` fica `position: fixed`, 280px de largura.
- Fechada em `translateX(-280px)`, aberta em `translateX(0)`, medido pela
  cascata com a transição desligada.
- Escolher um projeto fecha a gaveta: `aria-expanded` volta a `false`, o backdrop
  sai e a trava de `overflow` do `body` é liberada.
- `elementFromPoint` no centro do item de projeto devolve o próprio item — nada
  o cobre.
- Nenhum scroll horizontal; com 16 itens o conteúdo continua caber, e o
  `overflow-y: auto` está no lugar para telas mais curtas.

**O que ainda falta:** 375px de largura real **na aba Tasks**. Na época, o pane
do navegador não descia abaixo de 480px — pedir 375 devolvia sucesso e entregava
480.

**Isso deixou de ser verdade.** Durante o ajuste de largura dos Relatórios o
navegador embutido redimensionou para 375px de verdade (`window.innerWidth === 375`
confirmado), e a página de Relatórios foi medida ali: uma coluna, sem scroll
horizontal, com a tabela rolando dentro do próprio contêiner. **A ferramenta
existe agora** — o que falta é apontá-la para a gaveta do sidebar, que é o que
esta ressalva sempre foi.

Duas armadilhas do pane embutido, para quem for repetir:

- **Com ele oculto a página não compõe frames**, então `screenshot` expira.
  Medição por `getBoundingClientRect` funciona normalmente; só a captura precisa
  do pane visível.
- **O redimensionamento pode reportar sucesso e entregar outra largura.** Numa
  sessão o pane desceu a 375px; noutra ficou preso em 451px, respondendo "ok" a
  pedidos de 375 e 380. É a mesma classe de armadilha que a ferramenta antiga
  tinha, num piso diferente. **Sempre confira `window.innerWidth`** depois de
  redimensionar, em vez de confiar no retorno.

### Uma armadilha de medição que custou tempo

Com o pane do navegador oculto a página **não produz frames**, e sem frames
**transições CSS não avançam**. Medir `getComputedStyle(...).transform` logo
depois de abrir a gaveta devolve o valor inicial para sempre, o que parece
exatamente um bug de CSS: a classe `open` está lá, o backdrop aparece, e o
`transform` não muda.

O jeito de medir a cascata sem depender de frames é desligar a transição antes
(`el.style.transition = 'none'`) e só então alternar a classe. `requestAnimationFrame`
também não dispara nessa condição — esperar por ele trava a chamada.

## Não verificado visualmente: layout abaixo de 860px (PR #6)

> Mantido como registro histórico do que foi possível na época. A seção acima
> substitui a conclusão: a gaveta **foi** verificada a 480px durante o Bloco 4.

**O que está em risco:** a gaveta do sidebar e o comportamento do grid no
mobile, entregues no PR #6.

**Por que ficou assim:** o ambiente de automação de navegador usado durante a
implementação não conseguia redimensionar o viewport — `resize_window` retornava
sucesso, mas `window.innerWidth` continuava em 1536px. Então o ponto de corte
renderizado nunca foi visto.

**O que foi feito no lugar:**

- Confirmado via CSSOM que a media query de 860px parseou com os cinco seletores
  esperados. O modo de falha realista aqui é um erro de sintaxe derrubar o bloco
  inteiro, e isso está descartado.
- A gaveta foi inspecionada visualmente forçando os mesmos estilos sem o wrapper
  da media query — o desenho, o backdrop e a ordem de camadas estão certos.
- Comportamento de abrir/fechar verificado pelos três caminhos (backdrop,
  `Escape`, escolher balde), incluindo a trava de scroll e o `aria-expanded`.

**O que falta:** abrir em ~375px de largura real, no celular ou no DevTools, e
conferir que o botão de menu aparece, que a gaveta desliza e que nenhuma faixa
gera scroll horizontal. As faixas a olhar são 900px, 860px, 600px e 480px — os
três breakpoints do arquivo interagem nessa região.

## O `touch-action: none` do PR #17 roubou a rolagem — e a lição

Registro de um erro meu, porque o modo de falha é instrutivo.

O PR #17 achou uma declaração faltando (`touch-action: none` em `.cal-block` e
`.cal-chip`), mediu, confirmou e corrigiu. A correção estava certa **para o
arraste** e errada para tudo o mais: com ela, o dedo pousado sobre uma tarefa
deixa de rolar o calendário. E rolar é o gesto mais comum da tela.

**A lição:** `touch-action: none` não "conserta o arraste" — ele **transfere o
gesto** do navegador para o app. Toda transferência tem um lado que perde. Eu
medi o lado que ganhava (o arraste voltou a funcionar) e não medi o que perdia
(a rolagem parou), porque não tinha como exercitar toque de verdade.

O conserto foi devolver a rolagem ao navegador no toque e trancar o arraste
atrás de um pressionar-e-segurar — que era, aliás, o que o R16 já fazia para
redimensionar. O gesto do toque agora é um só, e não dois.

## O pressionar-e-segurar nunca foi tocado com um dedo

O modo de redimensionar no toque — pressionar e segurar 500ms num bloco para as
alças aparecerem — está atrás de `matchMedia('(pointer: coarse)')`, avaliado uma
única vez no carregamento. **O Chrome usado na verificação reporta ponteiro
fino**, e emular toque exigiria que a emulação estivesse ativa *antes* do load,
o que o ferramental disponível não garante.

**O que foi verificado no lugar:** os sete caminhos do gesto, com
`PointerEvent` sintético carregando `pointerType: 'touch'` — deslizar sem
segurar (rola, não arrasta), segurar e soltar (arma), segurar e arrastar no
mesmo gesto, toque curto (abre a edição), `pointercancel` no meio de uma
rolagem, mouse sem tranca nenhuma, e bloco já armado arrastando ao primeiro
toque.

**O que falta:** o gesto num aparelho real — o timer de 500ms sob um dedo que
treme, o `navigator.vibrate`, o `contextmenu` não abrindo, e as alças de 14px
sendo acertáveis. Sintetizar `pointerType: 'touch'` exercita a lógica do app,
**mas não exercita o navegador decidindo entre rolar e entregar o gesto** — que
é exatamente onde o erro do PR #17 morava. É a mesma dívida que o PR #12
registrou, e pela mesma razão.

## README.md desatualizado

O `README.md` na raiz descreve **"Contextos Temporais (Hoje, Amanhã e Fazer
Depois)"**, que não existem mais desde o PR #3 — hoje são quatro baldes (Hoje,
Próximos 7 dias, Caixa de entrada, Todas). A seção "Estrutura de Arquivos"
também não menciona `docs/`.

Não foi corrigido porque reescrever a comunicação do produto é decisão de quem
mantém, não consequência automática da mudança técnica.

## Harnesses de teste: metade recuperada

A verificação de lógica da reestruturação foi feita com três scripts Node que
extraíam funções do `index.html` por casamento de chaves e as avaliavam: baldes
e ordenação (25 casos), `getProgress` (8) e `padTime` (8). **Eles viviam em
diretório temporário e foram perdidos.**

O padrão foi recuperado e **commitado** em `tests/funcoes-puras.mjs`, junto do
campo "Final": localizar `function nome(` no fonte, casar chaves até o
fechamento, concatenar as funções e suas dependências, e avaliar num escopo
isolado. São 33 casos hoje, todos sobre a conversão duração ↔ relógio.

**O que continua faltando** são os casos que se perderam: as regras de balde e
`getProgress`, onde os limites (d+7/d+8, virada de ano, data futura vs atrasada)
não são óbvios à inspeção. Acrescentá-los ao arquivo que agora existe é trabalho
de uma sentada, e não depende de decisão nenhuma.

Uma limitação do método, que vale saber antes de estender: o casamento de chaves
é ingênuo — não pula chaves dentro de strings, template literals ou comentários.
Serve para função pequena e pura, que é o alvo. `calChipHtml` e `taskRowHtml`,
que são template literals inteiros, não são extraíveis assim.

A alternativa mais durável seria extrair as funções puras para um
`<script type="module">` ou um arquivo separado — o que colide com a decisão de
manter tudo em um único `index.html`. Vale a conversa, não a mudança silenciosa.

## Cosmético, pré-existente

`.context-selector` usa `grid-template-columns: repeat(3, 1fr)`, mas o modal de
agendamento rápido tem só dois botões (Hoje / Amanhã), deixando uma coluna vazia.
Anterior a toda a reestruturação; nunca foi tocado.

## Ambiente

O `gh` CLI pode não estar no `PATH` do shell mesmo estando instalado, quando a
sessão do terminal começou antes da instalação. O caminho absoluto no Windows é
`C:\Program Files\GitHub CLI\gh.exe`. Uma sessão nova resolve.
