# Pendências e ressalvas conhecidas

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

**O que ainda falta:** 375px de largura real. O pane do navegador não desce
abaixo de 480px — pedir 375 devolve sucesso mas entrega 480. Como 480px é
justamente um dos breakpoints do arquivo (o de "só ícone" da navbar), a faixa
375–479px segue sem olhos em cima.

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

## README.md desatualizado

O `README.md` na raiz descreve **"Contextos Temporais (Hoje, Amanhã e Fazer
Depois)"**, que não existem mais desde o PR #3 — hoje são quatro baldes (Hoje,
Próximos 7 dias, Caixa de entrada, Todas). A seção "Estrutura de Arquivos"
também não menciona `docs/`.

Não foi corrigido porque reescrever a comunicação do produto é decisão de quem
mantém, não consequência automática da mudança técnica.

## Harnesses de teste não commitados

A verificação de lógica foi feita com três scripts Node que extraíam funções do
`index.html` por casamento de chaves e as avaliavam: baldes e ordenação (25
casos), `getProgress` (8) e `padTime` (8). **Eles viviam em diretório temporário
e foram perdidos.**

Se valer recriá-los, o padrão é: localizar `function nome(` no fonte, casar
chaves até o fechamento, concatenar as funções e dependências, e avaliar num
escopo isolado. Vale principalmente para as regras de balde e para `getProgress`,
onde os casos de borda (limite d+7/d+8, virada de ano, data futura vs atrasada)
não são óbvios à inspeção.

Uma alternativa mais durável seria extrair essas funções puras para um
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
