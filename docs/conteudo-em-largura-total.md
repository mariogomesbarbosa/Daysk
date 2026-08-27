# Conteúdo em largura total

**Plano, não implementado.**

> Referências a linhas valem para `ce1e9fb` (`main` no momento em que este plano
> foi escrito). Se elas não baterem mais, busque pelo nome da classe ou da
> função.
>
> As medições deste documento foram feitas no navegador, a 1920x1000 e a
> 1512x900, servindo o `index.html` por HTTP. Onde está escrito "medido", foi
> medido — e três suposições sobre o JS foram confirmadas por execução, não por
> leitura. Ver [O que quebra no JS](#o-que-quebra-no-js-medido).

## Objetivo

O conteúdo passa a ocupar **toda a largura disponível**, e no desktop o app vira
o shell de três colunas do TickTick: rail de ícones, painel de listas, painel de
conteúdo — cada painel com altura total e rolagem própria.

Hoje o conteúdo é uma coluna centralizada de 1180px no meio de uma tela larga.

**No mobile e no tablet nada muda.** Ver **D1**.

## O vão, medido

A 1920x1000, na aba Tasks:

| Peça | Onde está | Onde deveria estar |
|---|---|---|
| Rail | 0–64 | 0–64 |
| Sidebar | **402**–662 | 64–324 |
| Conteúdo | 690–**1570** | 324–1920 |

- **338px de vão morto** entre o rail e o sidebar.
- **350px de vão morto** entre o fim do conteúdo e a borda direita.
- **688px, 36% da tela, sem uso.** A 1512px são 280px (19%). A 2560px seriam
  1284px só do teto do container.

A causa são duas linhas:

| Linha | Regra | Efeito |
|---|---|---|
| [l. 130](../index.html:130) | `.container { max-width: 1180px; margin: 0 auto }` | Centraliza tudo e cria os dois vãos laterais |
| [l. 137](../index.html:137) | `.app-shell { grid-template-columns: 260px minmax(0, 880px) }` | Trava a coluna de conteúdo em 880px |

## A referência do TickTick, traduzida

O TickTick empilha três colunas, e o Daysk **já tem as três** desde o PR #36 — o
que falta não é uma coluna, é o *comportamento de painel*:

| No TickTick | No Daysk hoje | O que muda |
|---|---|---|
| Rail de ícones, altura total | `.app-nav` a 64px, `height: 100vh` | Ganha a marca no topo e as ações no pé (**D5**, **D6**) |
| Painel de listas com fundo, borda e rolagem própria | `.sidebar`, transparente, `sticky top: 2rem` | Vira painel (**D3**) |
| Painel de conteúdo com cabeçalho fixo e rolagem própria | `.content` dentro da página que rola | Vira painel (**D2**, **D4**) |
| Uma rolagem por painel | Uma rolagem, do `<body>` | **É a decisão de fundo, e a fonte de todo o risco** (**D2**) |

Uma coisa **não** se transporta: o TickTick tem avatar no topo do rail e um menu
de conta. Aqui o topo do rail recebe só o símbolo da marca, sem função de
clique.

## O estado do código hoje

Tudo verificado no fonte, não suposto:

| Peça | Onde | O que significa para este plano |
|---|---|---|
| `.container` | CSS, [l. 130](../index.html:130) | `max-width: 1180px; margin: 0 auto` |
| `.app-shell` | CSS, [l. 137](../index.html:137) | Grid `260px minmax(0, 880px)`, `gap: 28px` |
| Variantes do shell | CSS, [l. 145](../index.html:145) e [l. 157](../index.html:157) | `no-sidebar` → só conteúdo a 880px; `no-sidebar.wide-content` → `1fr`. Calendário e Relatórios **já** abriram mão do teto de 880 — mas seguem presos ao container de 1180 |
| `.sidebar` | CSS, [l. 304](../index.html:304) | `position: sticky; top: 2rem; align-self: start`. Sem fundo e sem borda |
| `.sidebar` no mobile | CSS, [l. 1505](../index.html:1505) | Gaveta: `fixed`, `background: var(--surface)`, `border-right`, `overflow-y: auto` |
| `.content` | CSS, [l. 164](../index.html:164) | Só `min-width: 0` |
| `.page-header` | HTML, [l. 2902](../index.html:2902) | **Fora** dos três `#view-*` — é compartilhado pelas três telas |
| `.brand-bar` | CSS [l. 184](../index.html:184), HTML [l. 2829](../index.html:2829) | `flex`, `space-between`. Contém `.brand-left` (menu-btn + logotipo) e `.brand-actions` |
| `.brand-actions` | CSS, [l. 191](../index.html:191) | Enviar agora + Sincronização + tema |
| `.app-nav` | CSS [l. 266](../index.html:266), HTML [l. 3200](../index.html:3200) | Pílula no base; coluna de 64px em `min-width: 1025px` ([l. 1351](../index.html:1351)); barra inferior em `max-width: 860px` ([l. 1297](../index.html:1297)) |
| `--rodape` | CSS, [l. 126](../index.html:126) | `2rem` no desktop. **No desktop o único consumidor é o `padding` do `<body>`** — os outros três estão em blocos de 860px |
| `.task-row` | CSS, [l. 1838](../index.html:1838) | Grid `14px 78px 1fr auto` |
| `.cal-scroll` | CSS, [l. 819](../index.html:819) | `max-height: 520px` — já é rolador interno, não depende da rolagem da página |
| `window.scrollTo` | JS, [l. 5137](../index.html:5137) | Em `switchTab()` |
| `body.style.overflow` | JS, [l. 4451](../index.html:4451), [4871](../index.html:4871), [4886](../index.html:4886), [4949](../index.html:4949), [5077](../index.html:5077) | Cinco travas de rolagem: sync, projetos, formulário, gaveta mobile, agendar |
| `document.scrollingElement` | JS, [l. 6188](../index.html:6188) | Auto-rolagem do arraste, **só na visão de mês** |

## Decisões

### D1 — Tudo dentro de `@media (min-width: 1025px)`

Nenhuma regra abaixo de 1025px é editada. Isso não é cautela, é uma propriedade
**verificada** do código:

| Teto | Só morde acima de | Está dentro do bloco desktop? |
|---|---|---|
| `.container` a 1180px | 1276px de janela | Sim |
| Conteúdo a 880px | 1264px de janela | Sim |

O cálculo: o container dispõe de `viewport − 96px` no desktop (64 do rail + 1rem
de goteira + 1rem à direita), então `viewport − 96 > 1180` só a partir de 1276px.
Abaixo de 1025px a goteira é de 32px, e `viewport − 32 > 1180` exigiria 1212px —
largura que aquele bloco nunca vê, porque acima de 1024px quem manda é o bloco
desktop.

**Os dois tetos são letra morta abaixo de 1025px.** É a mesma propriedade em que
o PR #36 se apoiou, e continua valendo: o bloco desktop sobrescreve o base sem
que uma linha de mobile ou tablet mude.

### D2 — O `<body>` deixa de rolar; quem rola são os painéis

Esta é a decisão de fundo, e **todo o risco do plano sai dela**.

```css
body { padding: 0 0 0 var(--rail); height: 100vh; overflow: hidden; }
.container { max-width: none; margin: 0; height: 100%; }
.app-shell { grid-template-columns: 260px minmax(0, 1fr); gap: 0; height: 100%; }
body.no-sidebar .app-shell,
body.no-sidebar.wide-content .app-shell { grid-template-columns: minmax(0, 1fr); }
.sidebar { min-height: 0; overflow-y: auto; }
.content { min-height: 0; overflow-y: auto; }
```

O `min-height: 0` nos dois painéis não é enfeite: item de grid tem mínimo
automático de `min-content`, e sem ele o painel cresce além da célula em vez de
rolar dentro dela.

O `gap: 0` substitui os 28px: painéis encostam e a separação passa a ser a borda
do **D3**, não espaço vazio. É o que "colado" quer dizer.

**Medido com este CSS aplicado, a 1920x1000:** rail 0–64, sidebar 64–324,
conteúdo 324–1920. Vão esquerdo 0, vão direito 0, sem transbordo horizontal.
Os 688px voltaram por inteiro.

> O preço está em [O que quebra no JS](#o-que-quebra-no-js-medido). Três coisas
> deixam de funcionar, todas por esta decisão.

### D3 — O sidebar vira painel, com o visual que a gaveta do mobile já tem

```css
.sidebar {
  position: static;          /* anula o sticky top: 2rem da regra base */
  align-self: stretch;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 12px;
}
```

**Nenhuma linguagem visual nova é inventada.** `background: var(--surface)` +
`border-right: 1px solid var(--border)` é literalmente o que a gaveta do mobile
já usa ([l. 1516–1517](../index.html:1516)). A gaveta *já é* este painel; o
desktop passa a mostrá-la aberta e fixa.

O `padding` interno é obrigatório, não estético: sem ele os itens do sidebar
encostam na borda do rail e no divisor, e "colado" viraria "grudado".

### D4 — O `.page-header` vira o cabeçalho fixo do painel

```css
.content { padding: 24px 24px 32px; }
.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg);
  margin: -24px -24px 0;     /* sangra até as bordas do painel */
  padding: 24px 24px 14px;
}
```

Ele é o candidato natural e **não precisa sair do lugar no HTML**: já vive fora
dos três `#view-*` ([l. 2902](../index.html:2902)), servindo as três telas. O
`background` opaco é obrigatório — sem ele o conteúdo rolaria visível por baixo.

O `padding-bottom: 32px` do painel é para onde vai o respiro que o `--rodape`
dava. Ver **D10**.

### D5 — A `brand-bar` morre no desktop sem sair do lugar no HTML

```css
.brand-bar { display: contents; }
.brand-left { display: none; }
.brand-actions {
  position: fixed;
  left: 0;
  bottom: 0;
  width: var(--rail);
  flex-direction: column;
  align-items: center;
  padding: 8px 0 16px;
  z-index: 91;
}
```

`display: contents` no pai deixa `.brand-actions` escapar da barra e ser
posicionado no pé do rail **sem mover um nó do DOM**. Isso importa por três
razões concretas:

1. Os três botões guardam seus `id` (`btn-enviar-agora`, `theme-toggle`) e os
   handlers que os leem — [l. 4319](../index.html:4319) e
   [l. 3456](../index.html:3456) continuam achando o que buscam.
2. Não há duplicata. Duplicar os botões no rail significaria `id` repetido, que
   é bug garantido nesses dois pontos.
3. **O mobile fica intacto por construção.** A `brand-bar` só se dissolve dentro
   do bloco de 1025px; abaixo dele ela é a mesma barra de sempre, com o
   `menu-btn` que abre a gaveta.

Isto fecha a **D2 do PR #36**, que deixou explícito: *"com o rail já de pé,
mover a marca e as ações para dentro dele é um segundo PR isolado"*. É este.

### D6 — A marca no topo do rail é um SVG novo, só-símbolo

O logotipo de hoje tem `viewBox="0 0 190 50"` e inclui as letras "Daysk" — a
64px não cabe, e **CSS não recorta `viewBox`**. Então é elemento novo, não
reaproveitamento.

Verificado na geometria do SVG ([l. 2836](../index.html:2836)): o símbolo é
autocontido nos primeiros 50x50. São três formas — o `rect` 50x50 `rx=10`, o
path da seta, e o quadrado de 7.84 com `transform="rotate(90 39 31.1599)"`, que
sob rotação de 90° em torno do próprio canto cai em `x ∈ [31.16, 39]`,
`y ∈ [31.16, 39]`, dentro da caixa. **`viewBox="0 0 50 50"` captura o símbolo
inteiro sem cortar nada.**

Vai como primeiro filho de `<nav class="app-nav">`, `display: none` abaixo de
1025px e `aria-hidden="true"` — é decoração, não navegação, e o `.app-nav` já é
`flex-direction: column` no desktop, então o símbolo assenta no topo sem
posicionamento novo.

### D7 — "Sincronização" precisa ganhar um `<span>`

O rótulo daquele botão é **nó de texto solto** ([l. 2856](../index.html:2856)),
e CSS não esconde nó de texto solto. Precisa virar
`<span class="btn-label">Sincronização</span>`.

Não é padrão novo: `.btn-enviar-txt` ([l. 2851](../index.html:2851)) já existe
para exatamente isto no "Enviar agora", e já colapsa abaixo de 480px
([l. 2727](../index.html:2727)). O plano estende o padrão da casa, não cria um.

### D8 — As ações no rail viram 44x44 sem borda, iguais ao `.nav-item`

Mesma medida e mesmo raio dos três itens de navegação, `background: none` e
`border: none` — no rail elas são estrutura, não botões soltos sobre conteúdo.

Duas consequências que precisam de resposta explícita:

- **O estado de erro do "Enviar agora" é hoje uma borda vermelha**
  ([l. 2723](../index.html:2723)). Sem borda no rail, ele passa a se expressar
  como ícone vermelho (`color: var(--red)`).
- **Ícone sem rótulo não perde informação aqui.** O `title` daquele botão é
  dinâmico e já carrega "último envio há X" ou a falha
  ([l. 4326–4331](../index.html:4326)); o tooltip continua contando a história
  inteira. O de tema e o de sincronização já têm `title` e `aria-label`.

Detalhe de visibilidade que **não** muda: "Enviar agora" só aparece com
`syncMode === 'gdrive' && gdriveStatus === 'connected'`
([l. 4321](../index.html:4321)). No rail ele segue intermitente — o pé do rail
tem de continuar bem resolvido com dois botões e com três.

### D9 — A lista de tarefas estica sem teto

**Decidido explicitamente, com o custo à vista.** Medido: a 1920 o painel de
conteúdo tem 1596px. A `.task-row` é grid `14px 78px 1fr auto`
([l. 1838](../index.html:1838)), então o nome fica na esquerda e os botões de
ação vão para a borda direita — cerca de 1400px de percurso para o olho.

O TickTick faz exatamente isso, e foi a referência escolhida. Fica registrado
que a reversão é de uma linha: um `max-width` em `.task-list` e
`.summary-bar` dentro do bloco desktop.

### D10 — `--rodape` fica sem consumidor no desktop

Com o `padding` do `<body>` indo a zero, o **único** consumidor de `--rodape` no
desktop desaparece ([l. 118](../index.html:118)) — os outros três vivem em
blocos de 860px. O valor `2rem` de [l. 1355](../index.html:1355) passa a não
governar nada.

O respiro do fim da página migra para o `padding-bottom` do `.content` (**D4**).
A variável **não** é removida: ela continua carregando o mobile, onde é a altura
que a barra inferior reserva.

## O que quebra no JS (medido)

As três foram confirmadas **executando** com o CSS do **D2** aplicado, não
inferidas da leitura. Todas saem da mesma causa: o `<body>` não rola mais.

### 1. `switchTab()` não volta ao topo

[l. 5137](../index.html:5137) — `window.scrollTo({ top: 0 })`.

> **Medido:** painel rolado a 900px, `window.scrollTo({top:0})` chamado, painel
> continuou em **900px**. Trocar de aba passaria a preservar a rolagem da aba
> anterior.

Correção: zerar o `scrollTop` do painel de conteúdo, **mantendo** o
`window.scrollTo` para o mobile, onde quem rola é a página.

### 2. As travas de rolagem dos modais deixam de travar

Cinco pontos põem `document.body.style.overflow = 'hidden'`:
[4451](../index.html:4451) (sincronização), [4871](../index.html:4871)
(projetos), [4886](../index.html:4886) (formulário),
[4949](../index.html:4949) (gaveta — só mobile), [5077](../index.html:5077)
(agendar).

> **Medido:** com a trava ativa, o painel de conteúdo **rolou para 600px**.
> Esconder o overflow do `<body>` não diz nada a um `overflow-y: auto` que é
> outro contêiner.

Correção: um helper único — `travarRolagem(bool)` — usado pelos cinco pontos,
que além do `<body>` marca uma classe no `<body>`; no bloco desktop essa classe
põe `overflow: hidden` nos dois painéis. Um mecanismo só, em vez de cinco cópias
divergindo. O ponto da gaveta é mobile e não precisaria, mas usar o mesmo helper
não custa e evita a pergunta "por que este é diferente".

### 3. A auto-rolagem do arraste morre na visão de mês

[l. 6185–6190](../index.html:6185):

```js
const usaCaixa = box && calendarView !== 'month' && box.offsetParent !== null;
const alvo = usaCaixa ? box : document.scrollingElement;
const r = usaCaixa ? box.getBoundingClientRect()
                   : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
```

Nas visões de grade o alvo é `#cal-scroll`, rolador interno — **essas não são
afetadas**. Na visão de mês o alvo é a página.

> **Medido:** `document.scrollingElement.scrollTop` travado em 0. Arrastar uma
> tarefa para a borda da tela no mês pararia de rolar o calendário.

Correção: o alvo do caso não-caixa passa a ser o painel `.content`, e o
retângulo passa a ser o `getBoundingClientRect()` dele em vez do retângulo da
viewport. `calcularAutoRolagem()` ([l. 6149](../index.html:6149)) já recebe o
retângulo como parâmetro e não precisa mudar.

## Verificação

Sem suíte de testes; o que dá para verificar, verificar medindo — o
[docs/README](README.md#verificação) registra duas vezes em que a captura de tela
sugeriu um problema que a medição desmentiu.

**Geometria, no console, em três larguras (1280, 1512, 1920) e nas três abas:**

- `.sidebar` começa em 64 e o `.content` termina em `innerWidth`. Vãos = 0.
- `document.documentElement.scrollWidth <= innerWidth` — sem transbordo
  horizontal. Comparar com `innerWidth` e não confiar no olho: já houve falso
  positivo aqui por `devicePixelRatio`.
- `.sidebar` e `.content` rolam sozinhos; o `<body>` não rola.

**As três correções de JS, uma a uma:**

- Rolar o painel, trocar de aba, conferir `scrollTop === 0`.
- Abrir cada um dos quatro modais de desktop e tentar rolar o painel atrás.
- Arrastar uma tarefa até a borda inferior na visão de **mês** e ver o
  calendário rolar; repetir numa visão de grade para confirmar que aquela não
  regrediu.

**Mobile e tablet, que o D1 promete intocados:** a 375px e a 1024px, percorrer
as três abas, abrir a gaveta, e conferir que a `brand-bar` está lá com o
`menu-btn`. Se algo mudou nessas larguras, o bloco de 1025px vazou.

**Os dois temas**, porque o **D3** introduz `--surface` numa superfície que
antes era `--bg`, e o contraste da borda entre painéis é diferente nos dois.

## O que fica fora

| Item | Por quê |
|---|---|
| `.cal-scroll` com `max-height: 520px` | Num painel de 1000px de altura sobra espaço morto embaixo. Agora que o painel tem altura conhecida, a grade poderia preenchê-la — mas é refino do Calendário, não deste plano |
| Teto de leitura na lista de tarefas | Decidido contra, no **D9**. Registrado como reversão de uma linha |
| Rail no mobile | Segue fora, como no PR #36. O pedido é desktop |
| Avatar / menu de conta no topo do rail | O TickTick tem; o Daysk não tem conta de usuário para pendurar ali |
