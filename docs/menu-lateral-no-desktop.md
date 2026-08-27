# Menu lateral no desktop

**Implementado no PR #36.**

> Este documento é o plano, e foi mantido como foi escrito antes da
> implementação. As dez decisões foram todas seguidas; onde a implementação
> desmentiu o plano, a correção está **em citação dentro da própria decisão**, e
> o resumo está em [Desvios](#desvios). O texto original fica visível de
> propósito — o registro do que eu supus errado vale mais que um plano
> retroativamente correto.
>
> Referências a linhas valem para `2d9b2d2` (`main` no momento em que este plano
> foi escrito). Se elas não baterem mais, busque pelo nome da classe ou da
> função.

## Objetivo

No desktop, a navegação entre **Tasks**, **Calendário** e **Relatórios** deixa de
ser a pílula flutuante no rodapé e passa a ser uma **coluna fixa à esquerda**,
como o rail do TickTick.

**No mobile e no tablet nada muda.**

## A referência do TickTick, traduzida para o que existe aqui

O TickTick empilha três colunas: um rail estreito só de ícones (as áreas do app),
o menu de listas, e o conteúdo.

O Daysk **já tem a segunda e a terceira**: o `<aside class="sidebar">` de baldes e
projetos ([index.html:2779](../index.html:2779)) e o `.content`. O que falta é a
primeira. As duas colunas não competem — elas empilham, e cada uma responde a uma
pergunta diferente:

| Coluna | Pergunta que responde | No Daysk |
|---|---|---|
| Rail | *Em que parte do app eu estou?* | `.app-nav` — Tasks, Calendário, Relatórios |
| Sidebar | *Que recorte de tarefas eu estou vendo?* | `.sidebar` — baldes de prazo e projetos |

Nem tudo se transporta:

| No TickTick | Aqui | Por quê |
|---|---|---|
| Avatar e marca no topo do rail | Continuam na `brand-bar` | Ver **D2** |
| Sincronização e configurações no rodapé do rail | Continuam na `brand-bar` | Ver **D2** |
| Rail sempre visível, inclusive no mobile | Rail só no desktop | É o pedido |

## O estado do código hoje

Tudo verificado no fonte, não suposto:

| Peça | Onde | O que significa para este plano |
|---|---|---|
| `.app-nav` | CSS, [l. 266](../index.html:266) | Estilo **base**, sem media query: pílula `fixed`, `left: 50%`, `translateX(-50%)`, `border-radius: 999px`, `shadow-md`, `z-index: 90` |
| `.app-nav` no mobile | CSS, [l. 1301](../index.html:1301) | Dentro de `@media (max-width: 860px)`: barra de borda a borda, `z-index: 93` |
| `.nav-item` / `.nav-label` | CSS, [l. 281](../index.html:281) e [l. 1329](../index.html:1329) | O rótulo **só existe abaixo de 860px** — na pílula ele já está oculto |
| `<nav class="app-nav">` | HTML, [l. 3115](../index.html:3115) | Fica **fora** do `.container`, no fim do `<body>` |
| `--rodape` | CSS, [l. 127](../index.html:127) | `96px` no desktop, `64px` abaixo de 860px ([l. 1299](../index.html:1299)) |
| Consumidores de `--rodape` | [l. 118](../index.html:118), [l. 1049](../index.html:1049), [l. 1369](../index.html:1369), [l. 1379](../index.html:1379) | **Os três últimos vivem dentro de blocos `max-width: 860px`.** No desktop o único consumidor é o `padding` do `<body>` |
| `.container` | CSS, [l. 131](../index.html:131) | `max-width: 1180px; margin: 0 auto` |
| `.app-shell` | CSS, [l. 137](../index.html:137) | Grid `260px minmax(0, 880px)`, com as variantes `body.no-sidebar` e `body.no-sidebar.wide-content` |
| `.sidebar` | CSS, [l. 304](../index.html:304) | `position: sticky; top: 2rem` |
| `.menu-btn` | CSS, [l. 420](../index.html:420) | `display: none` por padrão; só aparece abaixo de 860px |
| `switchTab()` | JS, [l. 5028](../index.html:5028) | Alterna `.active` nos `.nav-item` e as classes `no-sidebar` / `wide-content` no `<body>`. **Não precisa mudar** |
| Elementos `fixed` que valem no desktop | `.app-nav` e `.cal-ghost` ([l. 1230](../index.html:1230)) | Todos os outros (`.sidebar-backdrop`, `.cal-tap-bar`, barra mobile) estão dentro de `max-width: 860px`. `.form-overlay` é `inset: 0` e modal |

### A consequência boa disso

O estilo da pílula é o **estilo base**. Um bloco `@media (min-width: 1025px)`
adicionado ao fim da folha sobrescreve o base sem tocar em uma linha do que já
existe. **Nenhuma regra do mobile ou do tablet precisa ser editada** — só
adicionada uma nova, que eles nunca casam.

## Decisões

### D1 — O rail começa em 1025px, não em 861px

A fronteira que o projeto usa hoje é 860px, mas ela separa *telefone* de *tudo
mais*: entre 861px e 1024px a navegação já é a pílula flutuante, e é isso que um
tablet vê hoje. Como o pedido é "mantenha como é no mobile e tablet", o corte
novo é `min-width: 1025px` — iPad em retrato (1024px CSS) e tudo abaixo ficam
exatamente como estão.

Isso cria uma faixa de 861–1024px que continua com a pílula. Não é um estado
novo: é o estado atual, preservado.

> **Contestável.** Se você preferir que o rail apareça já a partir de 861px, é
> trocar um número — e aí o iPad em retrato passa a ver o rail. Se preferir
> reusar o `min-width: 1100px` que já existe em [l. 1981](../index.html:1981),
> também é só o número; o custo é janela de notebook estreita ficar sem rail.

### D2 — O rail carrega só os três itens

Nem a marca no topo, nem Sincronização/tema no rodapé. A `brand-bar` fica
intocada.

O motivo é escopo: mover as ações para o rail esvazia a `brand-bar` no desktop,
o que provavelmente obriga a fazê-la sumir, o que obriga a achar outro lugar
para o "Enviar agora" — e aí o diff deixa de ser um bloco de CSS novo e vira
reforma de HTML com ramificação responsiva na barra. O ganho visual não paga
esse risco numa primeira rodada.

> **Contestável, e é a decisão mais fácil de reverter depois:** com o rail já de
> pé, mover a marca e as ações para dentro dele é um segundo PR isolado.

### D3 — Só ícones, 64px

Os três botões já têm `title` e `aria-label` ([l. 3115–3125](../index.html:3115)),
então tooltip e leitor de tela funcionam sem nenhum trabalho novo.

> **Corrigido ao implementar.** Este parágrafo dizia que o `.nav-label` "continua
> oculto no desktop, exatamente como já está hoje na pílula, então isso não é
> sequer uma mudança". **Está errado.** Não existe nenhuma regra que esconda o
> rótulo fora do bloco de 860px — a pílula mostra "Tasks / Calendário /
> Relatórios" por extenso. Esconder exige `.nav-label { display: none; }`
> explícito no bloco novo, e **é uma mudança visual real** no desktop.

64px é o que custa. Ícone+rótulo custaria ~200px, e somados aos 260px do sidebar
dariam 460px de colunas laterais — a 1366px a coluna de conteúdo começaria a
apertar.

### D4 — `fixed` + `padding-left` no `<body>`, sem mexer no grid

O rail continua `position: fixed`, agora colado à esquerda e de altura inteira. O
espaço é aberto com `padding-left` no `<body>`.

A alternativa — envolver tudo num grid de duas colunas — obrigaria a mexer no
HTML e a reconferir a matemática de todo elemento `fixed`, inclusive o
`.cal-ghost`, que é posicionado a partir das coordenadas do ponteiro durante o
arraste do Calendário. Com `fixed` + padding, essa matemática não muda.

### D5 — A `<nav>` fica onde está no HTML

Hoje ela é o último elemento antes dos modais. No desktop isso passa a divergir
da posição visual (primeira coluna, último no `Tab`).

Mover o nó para antes do `.container` conserta o desktop e **quebra a ordem do
mobile**, onde a barra é visualmente a última. Como o pedido é explicitamente não
mexer no mobile, ela fica onde está. A mitigação é que ela já é um landmark
`<nav aria-label="Navegação principal">` — navegação por landmark não depende da
ordem do DOM.

> Registrar em [pendencias.md](pendencias.md) ao implementar.

### D6 — O item ativo do rail não pode ser mais forte que o item ativo do sidebar

Hoje `.nav-item.active` é `background: var(--accent); color: var(--on-accent)` —
um bloco sólido. Isso funciona numa pílula isolada no rodapé. Coladas lado a
lado, a área do app ficaria visualmente **mais** selecionada que a lista que o
usuário de fato escolheu, invertendo a hierarquia.

Proposta: o item ativo do rail usa a mesma linguagem do `.sidebar-item.active`
([l. 339](../index.html:339)) — `background: var(--surface2)`, ícone em
`var(--text)` — mais uma barra de 3px em `var(--accent)` na borda esquerda como
indicador.

> **Corrigido ao implementar.** A frase original terminava com "o sólido continua
> sendo do sidebar", o que sugere que o `.sidebar-item.active` fosse o bloco em
> `--accent`. Ele **nunca foi**: é `--surface2` com `font-weight: 500`. O sólido
> sempre foi só da pílula. O raciocínio da decisão não muda — o que muda é que
> rail e sidebar ficam com o **mesmo** fundo de ativo, e quem distingue os dois é
> a barra na borda.

> **Contestável — é a única decisão puramente visual aqui.**

### D7 — Superfície de coluna, não de objeto flutuante

`border-radius: 999px` e `box-shadow: var(--shadow-md)` existem porque a pílula
flutua. Uma coluna fixa é estrutura: fundo `var(--surface)`, `border-right: 1px
solid var(--border)`, sem raio e sem sombra.

### D8 — `--rodape` cai para `2rem` no desktop

Os 96px existem só para a pílula não cobrir o fim da página. Sem pílula, é
espaço morto. Como verificado na tabela acima, no desktop o único consumidor de
`--rodape` é o `padding` do `<body>` — os outros três estão em blocos de 860px.

### D9 — A largura do rail vira variável

`--rail: 64px`, porque dois lugares dependem dela: o `padding-left` do `<body>` e
a largura do `.app-nav`. É a mesma razão pela qual `--rodape` já é variável.

### D10 — O `.container` passa a centralizar no espaço restante

Com `padding-left` no `<body>`, o `margin: 0 auto` do `.container` centraliza no
que sobra, não na viewport. É o comportamento do TickTick e é o desejado.

Orçamento horizontal: `1280 − 64 − 2rem = 1184px`, ainda acima dos 1180px do
`.container`. Ou seja, só abaixo de ~1276px as páginas em `wide-content`
(Calendário e Relatórios) começam a perder largura, e perdem pouco.

> **Corrigido ao implementar.** A conta acima esquece a barra de rolagem, que é a
> armadilha que `pendencias.md` já registra ("`innerWidth` inclui a barra de
> rolagem; o layout não"). Medido a 1280px: o `.container` fica com **1169px**,
> não 1184 — `1280 − 15 − 64 − 2rem`. A perda começa por volta de 1291px em vez
> de 1276px, e a 1280px são 11px. A conclusão não muda; o número, sim.

## Fora de escopo

- Marca, Sincronização e tema dentro do rail (**D2**) — candidato natural a um PR seguinte
- Rail que expande no hover, estilo Gmail — anima largura, mais CSS e mais chance de tremer o layout
- Atalhos de teclado (`1`/`2`/`3`) para trocar de aba
- Qualquer mudança em mobile ou tablet
- Recolher/expandir o sidebar de baldes

## Implementação

Um bloco de CSS novo, adicionado **depois** do bloco `max-width: 860px` da
navegação ([l. 1301](../index.html:1301)), para que a ordem no arquivo acompanhe
a leitura mobile-first do resto da folha:

1. `@media (min-width: 1025px)` com `:root { --rail: 64px; --rodape: 2rem; }`
2. `body { padding-left: calc(var(--rail) + 1rem); }` — o `1rem` é a goteira que
   o `padding` lateral do body já pratica
3. `.app-nav` — `left: 0; top: 0; bottom: auto; height: 100vh; transform: none;`
   `flex-direction: column; align-items: center; gap: 6px; padding: 20px 8px;`
   `width: var(--rail); border-radius: 0; border: none;`
   `border-right: 1px solid var(--border); box-shadow: none;`
4. `.nav-item` — quadrado de ~44px, `justify-content: center`, `border-radius:
   var(--radius-sm)`, `position: relative` (para o indicador do **D6**)
5. `.nav-item.active` e o `::before` do indicador, conforme **D6**
6. Conferir que o bloco não redefine nada fora de `.app-nav`, `.nav-item`,
   `--rail` e `--rodape`

Nenhuma mudança em HTML e nenhuma em JS. `switchTab()` já faz tudo que precisa.

## Verificação

Vale repetir os dois tipos que o [README](README.md) descreve, e o aprendizado
que ele registra: **medir, não julgar pela captura de tela.**

```bash
node tests/funcoes-puras.mjs
```

(não cobre CSS; roda para garantir que nada quebrou de tabela)

No navegador, servindo por HTTP:

```bash
python -m http.server 8899 --bind 127.0.0.1
```

- **Larguras:** 1440, 1280, 1100, **1025**, **1024**, 900, 768, 375. As duas em
  negrito são a fronteira do **D1** — o comportamento tem que trocar entre elas e
  em nenhum outro ponto
- **Temas:** claro e escuro, nas duas formas
- **As três abas:** o rail tem que permanecer nas três, inclusive com
  `body.no-sidebar.wide-content` no Calendário e Relatórios
- **Transbordo horizontal:** comparar `document.documentElement.scrollWidth` com
  `window.innerWidth` em cada largura — é a medição que já desmentiu um falso
  positivo antes
- **Sobreposição:** `document.elementFromPoint()` sobre um item do rail e sobre o
  primeiro `.sidebar-item`, confirmando que cada um recebe o próprio clique
- **Modal:** abrir "Nova atividade" — `.form-overlay` tem `z-index: 100` contra
  os 90 do rail, então cobre. Confirmar que é o que se quer
- **Arraste no Calendário:** o `.cal-ghost` tem que acompanhar o cursor sem
  deslocamento — é o teste que valida o **D4**
- **Abaixo de 1025px:** a pílula e a barra inferior têm que estar idênticas ao
  que são hoje. Se algo mudou ali, o bloco novo vazou

## Desvios

Três coisas que o plano afirmava e a implementação desmentiu. Nenhuma mudou uma
decisão; as três mudaram um fato.

| Onde | O plano dizia | O código diz |
|---|---|---|
| **D3** | O `.nav-label` já está oculto na pílula, esconder não é mudança | Não há regra que o esconda fora dos 860px. A pílula mostra os três rótulos por extenso. Precisou de `display: none` explícito, e **é mudança visual** |
| **D6** | "O sólido continua sendo do sidebar" | O `.sidebar-item.active` nunca foi sólido — é `--surface2` com `font-weight: 500`. O sólido era só da pílula |
| **D10** | A 1280px o `.container` fica com 1184px | Fica com **1169px**: a conta esquecia os 15px da barra de rolagem |

O que o plano acertou e vale registrar, porque era a aposta central: **o diff
saiu com 117 inserções e nenhuma remoção.** Nenhuma regra existente foi editada,
e nenhuma linha de HTML ou de JS foi tocada.

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| O bloco novo vazar para tablet/mobile | O `min-width: 1025px` é disjunto do `max-width: 860px`; o teste em 1024px pega qualquer vazamento |
| `z-index` do rail (90) contra a gaveta (94) e a barra mobile (93) | Os dois últimos só existem abaixo de 860px, onde o rail não existe |
| `position: sticky` do sidebar quebrar com o padding do body | `sticky` se ancora no bloco de rolagem, não no padding do `<body>`. Verificar mesmo assim rolando a lista de Tasks |
| Ordem visual ≠ ordem de `Tab` no desktop (**D5**) | Aceito e registrado em `pendencias.md` |
