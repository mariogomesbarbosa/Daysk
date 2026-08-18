# Bloco 4 — Projetos no sidebar

Último bloco do roteiro. **Planejado, não implementado.**

## Objetivo

Levar a lista de projetos para o sidebar, abaixo dos baldes de prazo, com um
botão para criar projeto — completando o modelo do wireframe, em que o menu
lateral concentra navegação por prazo *e* por projeto.

## O que já existe e deve ser reaproveitado

| Peça | Onde | Observação |
|---|---|---|
| `PALETTE` | constante no topo do script | Cores dos projetos, indexadas por `colorIndex` |
| `openProjectsManager()` | modal de gerenciamento | **Continua sendo o lugar de editar, remover e trocar cor** |
| `projectRowHtml()` / `swatchGridHtml()` | linhas do modal | Carregam botões de editar/excluir — *não* servem para o sidebar |
| `.sidebar-item` / `.ctx-count` | CSS do Bloco 3 | O item de projeto deve reusar essas classes |
| `setBucket()` | alterna `.sidebar-item` por `data-bucket` | Precisa conviver com a seleção por projeto |

O sidebar é **navegação**; o modal segue sendo **gerenciamento**. O botão "novo
projeto" deve abrir o modal existente, sem duplicar formulário.

## Decisão central: seleção única

**Escolher um projeto desmarca o balde, e vice-versa** — como na referência do
TickTick, onde "Hoje" e as listas são itens irmãos do mesmo menu.

O motivo é evitar o produto cartesiano balde × projeto, que exigiria uma segunda
dimensão de estado, uma segunda linha de filtro na interface e uma decisão sobre
o que "Hoje + Projeto X vazio" deveria mostrar. Seleção única mantém um só
`render()` e um só conceito de "o que estou vendo".

### Como isso cai no código

Hoje o estado é `currentBucket`, e `render()` filtra com
`tasks.filter(t => matchesBucket(t, currentBucket))`.

A forma mais direta é generalizar para uma **seleção** com dois formatos
possíveis, em vez de acrescentar uma variável paralela — o projeto já tropeçou
nisso antes, com `currentFormContext` divergindo do que estava na tela:

```js
// esboço, não código final
let currentView = { tipo: 'bucket', valor: 'today' };  // ou { tipo: 'project', valor: p.id }

function matchesCurrentView(t) {
  return currentView.tipo === 'project'
    ? t.projectId === currentView.valor
    : matchesBucket(t, currentView.valor);
}
```

`setBucket()` e um novo `setProject()` passariam a escrever nesse objeto e a
sincronizar o `active` sobre **todos** os `.sidebar-item`, de ambos os grupos.

## Pontos a resolver na implementação

**O cabeçalho.** Hoje `updateHeader()` mostra dia/data na tela de Tasks. Ao
selecionar um projeto, o cabeçalho deveria dizer o nome do projeto? A
ramificação precisa morar dentro de `updateHeader()`, nunca no handler de
clique — `render()` roda a cada 60s e sobrescreveria (ver PR #2 no
[roteiro](roteiro-reestruturacao.md)).

**As estatísticas.** `s-total` / `s-done` / `s-hours` / `s-pct` são calculadas
sobre a lista filtrada, então acompanham naturalmente. Vale conferir se
"planejadas" faz sentido para um projeto que mistura vários dias.

**A visão "por horário".** Um projeto abrange vários dias, então cai no mesmo
caso do balde `next7`: precisa dos cabeçalhos de dia, que `renderChronological()`
já produz. Provavelmente funciona de graça — confirmar.

**A visão "por projeto".** Filtrar por projeto *e* agrupar por projeto é
redundante. Considerar esconder o `#view-options-bar`, como já é feito no balde
`inbox`.

**Contadores por projeto.** Decidir o que contam: todas as tarefas do projeto, ou
só as não concluídas? Os baldes contam tudo.

**Projeto sem tarefas.** Aparece na lista com contador zero, ou é omitido? Como o
sidebar também é o caminho para gerenciar, omitir esconderia um projeto recém
criado.

**Sincronizar após mexer no modal.** Criar, renomear ou remover projeto precisa
redesenhar o sidebar. Hoje `renderProjectsManager()` só atualiza o modal.

**Remover o projeto atualmente selecionado.** Precisa recair para um balde,
senão a lista fica filtrada por um id que não existe mais.

## Verificação sugerida

Além do roteiro geral em [pendencias.md](pendencias.md):

1. Selecionar projeto filtra a lista e desmarca o balde; voltar a um balde
   desmarca o projeto.
2. Criar projeto pelo botão do sidebar aparece na lista sem recarregar.
3. Renomear e trocar cor pelo modal reflete no sidebar.
4. Remover o projeto selecionado não deixa a lista vazia e sem saída.
5. Na gaveta mobile, escolher projeto fecha o painel — mesmo motivo dos baldes.
6. Projeto com tarefas em vários dias mostra cabeçalhos de dia.
