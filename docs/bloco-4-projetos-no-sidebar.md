# Bloco 4 — Projetos no sidebar

Último bloco do roteiro. **Implementado no PR #8.**

> Este documento é o plano, e foi mantido como foi escrito antes da
> implementação: é o registro das decisões e do raciocínio delas. As onze
> decisões foram todas seguidas. O que só apareceu ao implementar está no
> [roteiro](roteiro-reestruturacao.md#bloco-4--projetos-no-sidebar), e o que
> ficou em aberto está em [pendencias.md](pendencias.md).
>
> Referências a linhas valem para `34b6357`, *antes* das mudanças deste bloco, e
> portanto já não batem — busque pelo nome da função.

## Objetivo

Levar a lista de projetos para o sidebar, abaixo dos baldes de prazo, com um
botão para criar projeto — completando o modelo em que o menu lateral concentra
navegação por prazo *e* por projeto, como no TickTick.

## A referência do TickTick, traduzida para o que existe aqui

A referência é a seção "Listas" do menu lateral do TickTick: um cabeçalho de
grupo discreto, itens irmãos dos filtros de prazo, cada um com ícone, nome e
contador à direita.

Nem tudo se transporta, porque um projeto no Daysk é `{ id, name, colorIndex }`
e nada mais:

| No TickTick | No Daysk | Por quê |
|---|---|---|
| Emoji por lista (🍄 Pessoal) | Ponto colorido da `PALETTE` | Não há campo de ícone. O ponto já identifica projeto em três lugares (`projectTagHtml`, `project-group-header`, linhas do modal); inventar um quarto vocabulário visual seria pior que reusar o que já existe |
| Listas aninhadas (*Design Tasks* dentro de *SIEG*) | Lista plana | Exige um `parentId` no modelo, migração e recursão no filtro. Fora de escopo — ver [Fora de escopo](#fora-de-escopo) |
| Contador = tarefas não concluídas | Contador = todas as tarefas | Coerência interna com os baldes. Ver **D4** |
| Menu "…" no hover de cada lista | Nada no item; gerência no modal | O modal de projetos já faz editar, remover e trocar cor. Ver **D3** |
| Reordenar arrastando | Ordem de criação | Fora de escopo |

O que se transporta e é o essencial: **projeto e balde são itens irmãos do mesmo
menu, e só um está selecionado por vez.**

## O estado do código hoje

Tudo verificado no fonte, não suposto:

| Peça | Onde | O que significa para este bloco |
|---|---|---|
| `.sidebar-item`, `.sidebar-label`, `.ctx-count` | CSS, ~l. 286–330 | O item de projeto reusa as três. Só falta CSS novo para o cabeçalho da seção e o botão "+" |
| `.project-dot` | CSS, l. 1179 | 9px, redondo, `flex-shrink: 0`. Serve como está |
| `<aside class="sidebar" aria-label="Filtros por prazo">` | l. 1578 | O rótulo fica errado quando a lista deixa de ser só de prazos |
| `currentBucket` | l. 2975, lido em 6 pontos | A superfície de mudança do estado. Enumerada em **D1** |
| `setBucket()` | l. 2978 | Marca `active` em `.sidebar-item` por `data-bucket`, fecha a gaveta, chama `render()` |
| `render()` | l. 3456 | Filtra por `matchesBucket`, decide `#view-options-bar`, escolhe entre as duas visões, calcula as estatísticas |
| `updateHeader()` | l. 3279 | Já ramifica por `currentTab`. É onde a ramificação por projeto tem de morar |
| `EMPTY_MSG` | l. 3442 | Indexado por balde. Precisa de um caminho para projeto |
| `openProjectsManager()` | l. 2941 | Continua sendo o lugar de gerenciar |
| `deleteProject()` | l. 2827 | Já chama `render()`; já impede excluir o único projeto |
| `createProject()` | l. 2815 | **Não chama `render()`** |
| `addProjectFromManager()` | l. 2900 | **Não chama `render()`** |
| `ensureDefaultProject()` | l. 2762 | Garante que `projects` nunca é vazio |
| `setInterval(render, 60000)` | l. 4007 | O motivo de a ramificação de cabeçalho não poder morar no handler de clique |

---

## Decisões

### D1 — Seleção única, num único objeto de estado

**Escolher um projeto desmarca o balde, e vice-versa.**

O motivo é evitar o produto cartesiano balde × projeto: uma segunda dimensão de
estado, uma segunda linha de filtro na interface e uma decisão de produto sobre
o que "Hoje + Projeto X sem nada hoje" deveria mostrar. Seleção única mantém um
só `render()` e um só conceito de "o que estou vendo".

`currentBucket` vira `currentView`, um objeto com dois formatos:

```js
// esboço, não código final
let currentView = { type: 'bucket', value: 'today' };  // ou { type: 'project', value: p.id }

function matchesCurrentView(t) {
  return currentView.type === 'project'
    ? t.projectId === currentView.value
    : matchesBucket(t, currentView.value);
}
```

Uma variável nova ao lado da antiga seria mais fácil de escrever e é exatamente
o erro que o projeto já cometeu: `currentFormContext` e `selectedSchedContext`
eram estado paralelo que divergia da tela, e foram removidos no Bloco 1.

**Os seis pontos que leem `currentBucket` hoje**, e o que cada um passa a fazer:

| Linha | Uso hoje | Depois |
|---|---|---|
| 2979 | `setBucket()` grava | Grava `{ type: 'bucket', value: bucket }` |
| 3028–3029 | `defaultDateForBucket()` sugere a data da nova tarefa | Projeto selecionado ⇒ sugere hoje (ver **D9**) |
| 3460 | `tasks.filter(t => matchesBucket(t, currentBucket))` | `tasks.filter(matchesCurrentView)` |
| 3466 | esconde `#view-options-bar` na caixa de entrada | Esconde também com projeto selecionado (**D7**) |
| 3470 | `EMPTY_MSG[currentBucket]` | Mensagem própria para projeto (**D5**) |
| 3471 | caminho de render da caixa de entrada | Inalterado; a condição passa a testar `currentView` |

`updateContextBadges()` não usa `currentBucket` — itera `BUCKETS`. Não muda, só
ganha um par para os projetos.

### D2 — Anatomia do item: ponto, nome, contador

Idêntica à dos baldes, na mesma ordem: o ponto colorido ocupa o lugar do ícone,
o nome usa `.sidebar-label`, o contador usa `.ctx-count`. Um item de projeto e um
item de balde devem ser distinguíveis pelo conteúdo, nunca pela forma — é o que
faz os dois grupos lerem como um menu só.

Marca o `active` por `data-project` em vez de `data-bucket`, e o sincronismo
passa a varrer **todos** os `.sidebar-item`, dos dois grupos.

### D3 — O sidebar navega; o modal gerencia

O item de projeto tem um único gesto: selecionar. Sem menu de contexto, sem
lápis, sem lixeira.

O cabeçalho da seção leva um botão "+" que chama `openProjectsManager()`. Nada de
formulário novo: já existem **duas** telas de criação de projeto (o modal e a
linha embutida no formulário de tarefa), e uma terceira multiplicaria os caminhos
a testar sem ganho.

Por isso `projectRowHtml()` e `swatchGridHtml()` **não** servem aqui — carregam
os botões de editar e excluir. O sidebar precisa de uma função nova e menor.

### D4 — O contador conta todas as tarefas do projeto

Todas as datas, incluindo as sem prazo, incluindo as concluídas.

O TickTick conta as pendentes, o que é mais útil isolado. Mas os baldes daqui
contam tudo, e os dois grupos usam o **mesmo** `.ctx-count`: badges idênticos com
semânticas diferentes, um embaixo do outro, mentem para quem lê. Se algum dia
"pendentes" ganhar, muda nos dois — é uma linha em cada.

Contar todas as datas, e não só as do balde ativo, é consequência de **D1**:
clicar no projeto mostra o projeto inteiro, então o número precisa prometer
exatamente isso.

### D5 — Projeto sem tarefas aparece, com zero

Omitir esconderia um projeto recém-criado justamente de onde a pessoa acabou de
criá-lo, e o sidebar agora é a superfície de descoberta.

A lista vazia precisa de mensagem própria, porque `EMPTY_MSG` é indexado por
balde. Algo como `nenhuma atividade em "<nome>"`.

### D6 — O cabeçalho mostra o nome do projeto, e a ramificação mora em `updateHeader()`

A estrutura de duas linhas já existe e serve: `day-label` recebe `projeto`,
`date-label` recebe o nome. Fica paralelo ao que Calendário e Relatórios já
fazem, e não pede markup novo.

**Escrever isso no handler de clique não funciona.** `render()` roda a cada 60
segundos via `setInterval` e chama `updateHeader()`; o título correto duraria até
o próximo minuto e depois seria sobrescrito pela data de hoje. É o mesmo erro
descrito no Bloco 0 do [roteiro](roteiro-reestruturacao.md).

### D7 — Com projeto selecionado, esconder as opções de visão e forçar a cronológica

Filtrar por projeto e agrupar por projeto é redundante: `renderGroupedByProject`
produziria um único grupo com um cabeçalho repetindo o nome que já está no
cabeçalho da página. Esconde `#view-options-bar`, pelo mesmo mecanismo já usado
na caixa de entrada.

**A parte que se erra:** esconder a barra não muda `listView`. Quem estava em
"por projeto" e seleciona um projeto continua com `listView === 'project'` e cai
justamente no render redundante — sem a barra na tela para escapar. Então
`render()` precisa escolher o caminho cronológico quando há projeto selecionado,
**sem gravar em `listView`**. Gravar perderia a preferência da pessoa quando ela
voltasse para um balde.

### D8 — O sidebar de projetos é desenhado dentro de `render()`

Não em cada mutação. `render()` já é chamado por todo caminho que mexe em dados —
inclusive o de sincronização (l. 2174) — então criar, renomear, trocar cor e
remover refletem no sidebar de graça, e o contador acompanha cada tarefa criada
ou concluída.

O custo é redesenhar uma lista de poucos itens a cada 60 segundos. É aceitável, e
há uma condição para continuar sendo: **o item não pode conter campo de entrada**,
senão o redesenho engoliria o que estivesse sendo digitado. É a mesma razão pela
qual gerenciar continua no modal (**D3**).

Duas exceções reais, que hoje não chamam `render()` e precisam passar a chamar:

- `createProject()` — l. 2815, a linha embutida no formulário de tarefa
- `addProjectFromManager()` — l. 2900, o campo de novo projeto do modal

Sem isso, criar um projeto não o faz aparecer no sidebar até a próxima
renderização — e é exatamente o caminho do botão "+" de **D3**.

### D9 — O projeto selecionado sugere o projeto da nova tarefa

`openCreateForm()` hoje pré-seleciona sempre `projects[0]` (l. 3042). Com um
projeto selecionado no sidebar, pré-selecionar esse projeto é o comportamento que
a referência tem e que a pessoa espera: criar uma tarefa vendo uma lista põe a
tarefa naquela lista.

A data sugerida por `defaultDateForBucket()` passa a ser hoje, porque um projeto
não carrega prazo. Vale renomear a função — `defaultDateForView()` — já que ela
deixa de falar só de baldes.

### D10 — Excluir o projeto selecionado recai para "Hoje"

Senão a lista fica filtrada por um id que não existe mais: nenhuma tarefa
corresponde, a mensagem de vazio cita um projeto que sumiu e o sidebar não tem
nenhum item marcado. `deleteProject()` já chama `render()`; falta zerar a seleção
antes.

### D11 — Escolher projeto fecha a gaveta no mobile

Mesma razão dos baldes: o painel cobre a lista que a pessoa acabou de filtrar.
Sai de graça se `setProject()` chamar `closeSidebar()`, como `setBucket()` faz.

---

## Plano de implementação

Sete passos, em ordem de dependência. Um PR só — a fatia é pequena, e um `main`
intermediário com `currentView` mas sem os projetos na tela não é verificável.

**1. Generalizar o estado.** `currentBucket` → `currentView`,
`matchesCurrentView()`, e os seis pontos de leitura da tabela de **D1**. Nada
muda na tela ainda; a verificação deste passo é que os quatro baldes continuam
funcionando idênticos.

**2. Markup da seção.** Depois do `</nav>` dos baldes, dentro do `<aside>`: um
cabeçalho `Projetos` com o botão "+" (`onclick="openProjectsManager()"`) e um
`<nav id="sidebar-projects">` vazio, preenchido por JS. Corrigir o `aria-label`
do `<aside>`, que hoje diz "Filtros por prazo".

**3. CSS novo.** Só o cabeçalho da seção e o botão "+" — o item reusa as classes
existentes (**D2**). Um separador acima da seção e espaçamento vertical. Atenção
ao caso mobile: com muitos projetos a gaveta precisa rolar, e ela já tem
`overflow-y: auto` na media query de 860px.

**4. `renderSidebarProjects()`**, chamada de dentro de `render()` (**D8**). Monta
ponto + nome + contador e marca `active` por `data-project`.

**5. `setProject()` e o sincronismo do `active`.** Extrair uma função que varre
todos os `.sidebar-item` dos dois grupos e decide `active` a partir de
`currentView`, usada por `setProject()` **e** por `setBucket()`. Duas varreduras
independentes divergem no primeiro caso de borda.

**6. Cabeçalho, vazio e visões.** **D6**, **D5**, **D7**.

**7. Bordas.** O `render()` em `createProject()` e `addProjectFromManager()`
(**D8**), a recaída de `deleteProject()` (**D10**) e a pré-seleção de
`openCreateForm()` (**D9**).

---

## Fora de escopo

Registrado porque a referência mostra e alguém vai perguntar:

- **Projetos aninhados.** Pede `parentId` no modelo, migração dos registros
  existentes, filtro recursivo (selecionar o pai mostra os filhos?) e uma
  interface de reparentar. É um bloco próprio, não um detalhe deste.
- **Ícone ou emoji por projeto.** Pede campo novo e um seletor de emoji.
- **Reordenar arrastando.** Pede um campo de ordem persistido.
- **Menu de contexto no item.** Deliberadamente não — **D3**.

## Verificação

Sem suíte de testes; o roteiro geral é o de [pendencias.md](pendencias.md).
Específico deste bloco:

1. Selecionar projeto filtra a lista, desmarca o balde e escreve o nome no
   cabeçalho. Voltar a um balde desmarca o projeto e devolve a data.
2. **Esperar mais de um minuto com um projeto selecionado.** É a verificação que
   pega o erro de **D6**: se o título voltar a ser a data de hoje, a ramificação
   ficou no lugar errado.
3. Criar projeto pelo "+" do sidebar aparece na lista sem recarregar. Repetir
   pela linha embutida no formulário de tarefa — é outro caminho (**D8**).
4. Renomear e trocar cor pelo modal refletem no sidebar.
5. Excluir o projeto selecionado deixa a tela num estado com saída (**D10**).
6. Projeto com tarefas em vários dias mostra cabeçalhos de dia — `groupByDay()`
   deveria dar isso de graça, é o mesmo caso do balde `next7`. Confirmar, não
   presumir.
7. Estar em "por projeto" e então selecionar um projeto: a lista não deve vir
   agrupada com um cabeçalho redundante. Voltar a um balde deve **restaurar** "por
   projeto" (**D7**).
8. Projeto sem nenhuma tarefa: aparece com 0 e mostra a mensagem de vazio.
9. Concluir uma tarefa decrementa o contador? **Não deve** — o contador conta tudo
   (**D4**).
10. Na gaveta mobile, escolher projeto fecha o painel; com 10+ projetos a gaveta
    rola. Vale lembrar que a faixa abaixo de 860px nunca foi vista renderizada —
    ver [pendencias.md](pendencias.md).
11. Os três modos de sincronização, porque o sidebar passa a depender de
    `projects` estar carregado quando `render()` roda.

## Armadilhas

**A ordem dos passos não é decorativa.** O passo 1 é uma refatoração de estado
sem efeito visível; misturá-lo com o markup faz uma regressão de filtro ficar
indistinguível de um erro de layout.

**Nome de projeto entra no HTML sem escape.** `renderSidebarProjects()` vai
interpolar `p.name` num template, como `projectRowHtml()` e `projectTagHtml()` já
fazem. Um nome com `<` ou `"` quebra a marcação. É pré-existente e não é deste
bloco resolver — mas este bloco acrescenta um ponto de interpolação, e se valer
corrigir, corrija nos quatro de uma vez.

**`projects` nunca é vazio**, por `ensureDefaultProject()`, e `deleteProject()`
impede remover o último. A seção nunca aparece sem nenhum item, então não há
estado vazio a desenhar para ela.
