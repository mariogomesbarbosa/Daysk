# Roteiro da reestruturação da página de Tasks

## O problema de origem

A página de Tasks acumulava três fileiras de pílulas visualmente parecidas, em
níveis hierárquicos diferentes, uma embaixo da outra: as abas (`hoje` /
`relatório`), os contextos (`Hoje` / `Amanhã` / `Fazer depois`) e as opções de
visualização (`por horário` / `por projeto`). O resultado é que "hoje" (aba) e
"Hoje" (contexto) apareciam lado a lado sem nenhuma distinção de peso.

A proposta foi promover Tasks, Calendário e Relatórios a **páginas** de fato,
navegadas por uma barra flutuante, e mover a categorização para um menu lateral
no modelo consagrado por TickTick e Todoist.

## Por que dividir em blocos

O trabalho foi quebrado em cinco blocos, cada um um PR verificável, porque havia
uma dependência real no meio: **nada de "Próximos 7 dias" ou Calendário era
possível antes do modelo de dados aceitar uma data arbitrária.** Tentar fazer
tudo junto significaria um PR gigante onde uma regressão de persistência ficaria
indistinguível de um bug de layout.

| # | Bloco | Estado |
|---|---|---|
| 0 | Calendário na navbar (placeholder) | ✅ PR #2 |
| 1 | Fundação de dados: data arbitrária | ✅ PR #3 (fundido com o 2) |
| 2 | Novos baldes de prazo | ✅ PR #3 |
| 3 | Shell de duas colunas + sidebar | ✅ PR #6 |
| 4 | Projetos no sidebar | ✅ PR #8 — plano em [bloco-4-projetos-no-sidebar.md](bloco-4-projetos-no-sidebar.md) |
| — | Calendário (conteúdo, adiado no Bloco 0) | ✅ plano em [calendario.md](calendario.md) |

---

## Bloco 0 — Calendário na navbar

Isolou a mudança de navegação, que não dependia de nada, e fechou o formato da
navbar antes de mexer em conteúdo.

O Calendário entrou **só como item de navegação e página vazia**, de propósito:
o conteúdo depende de data arbitrária, que só chegou no bloco seguinte.

### Decisões

**A ramificação do cabeçalho mora dentro de `updateHeader()`, não no
`switchTab()`.** Este é o ponto que mais fácil se erra ao mexer no cabeçalho:
`render()` roda a cada 60 segundos via `setInterval`, independente da aba ativa,
e chama `updateHeader()`. Escrever o título no `switchTab` funciona por um
minuto e depois é silenciosamente sobrescrito.

**O breakpoint de "só ícone" da navbar subiu de 380px para 480px.** Com três
itens, a navbar mede ~397px de largura (medido, não estimado: "Calendário" e
"Relatórios" têm 10 caracteres cada). Em 380px a barra estouraria a viewport na
faixa dos 380–410px.

---

## Blocos 1 e 2 — Data arbitrária, horário opcional e baldes

### Por que foram juntos num PR

Separados, o Bloco 1 deixaria uma tarefa marcada para daqui a 5 dias caindo no
balde "Fazer depois" com o selo errado, porque a categorização antiga só
conhecia hoje e amanhã. Seria um `main` intermediário incoerente.

### O que havia antes

`saveTask()` tinha um `if/else` de três vias que só gravava `todayStr()` ou
`tomorrowStr()`. Não existia campo de data no formulário. A categorização
misturava dois eixos: uma flag `t.context` e o campo `t.date`.

### Decisões

**`t.date` passou a ser a fonte única da verdade**, e `t.context` deixou de ser
lido *e* gravado. O campo **não foi removido** dos registros existentes: é
inerte, e uma migração destrutiva não se paga. Ver
[modelo-de-dados.md](modelo-de-dados.md).

**Horário virou opcional.** Uma tarefa pode ter data sem hora ("fazer na
sexta"). Isso ampliou o bloco bem além de "adicionar um campo": mexeu em
ordenação, rótulos de progresso e na régua da timeline.

**Um quarto balde, "Todas", entrou como rede de segurança.** Com apenas Hoje /
Próximos 7 dias / Caixa de entrada, uma tarefa datada para daqui a 15 dias não
pertenceria a balde nenhum e desapareceria da interface.

**Os presets de data passaram a derivar do campo.** Os botões Hoje / Amanhã /
Sem prazo escrevem no `<input type="date">`, e o estado ativo é lido de volta do
valor do campo. Isso eliminou `currentFormContext` e `selectedSchedContext`, que
eram estado paralelo capaz de divergir do que estava na tela.

### Três problemas que o modelo antigo mascarava

Não eram bugs novos — eram bugs que só se tornavam visíveis com datas
arbitrárias:

1. **`getProgress()` ignorava `t.date`**, comparando só a hora do dia contra o
   relógio. Uma tarefa daqui a 5 dias às 09:00 apareceria como "atrasada" às
   15:00 de hoje. Não aparecia antes porque "amanhã" tinha um `if` dedicado.
2. **Os sorts da timeline chamavam `toMins(t.time)` sem guarda**, o que estoura
   com horário nulo. Não aparecia porque as tarefas sem horário viviam num balde
   que usava outro caminho de render.
3. **A timeline precisou de cabeçalhos de dia.** Os baldes `next7` e `all`
   abrangem vários dias, e a linha renderizada mostra só a hora, nunca a data —
   sem cabeçalho o usuário vê `09:00, 14:00, 09:00` sem saber de que dia é cada
   uma.

---

## Bloco 3 — Shell de duas colunas e sidebar

### Decisões

**Estatísticas e cabeçalho ficaram na coluna de conteúdo.** O sidebar é pura
navegação, como no TickTick. Os números acompanham o balde selecionado, então
fazem mais sentido perto da lista; e quatro números não caberiam bem em 260px.

**A coluna de conteúdo tem teto de 880px.** Sem ele, Calendário e Relatórios —
que não têm sidebar — esticariam até os 1180px do container, redesenhando na
marra uma tela que ninguém pediu para mexer. O `minmax(0, 880px)` também é o que
mantém o `.report-table-wrap` rolando dentro do próprio contêiner em vez de
esticar o grid.

**O estado `no-sidebar` mora no `<body>`, não no `.app-shell`.** O botão do menu
vive na `.brand-bar`, **fora** do shell; um seletor descendente não o alcançaria,
e ele apareceria no Calendário e Relatórios abrindo uma gaveta sem propósito.

**A coluna sem sidebar é alinhada à esquerda, não centralizada.** Centralizada,
ela ficava recuada 150px enquanto o logo permanecia na borda do container — nada
alinhava. Alinhada, conteúdo e marca compartilham o mesmo eixo vertical.

**A gaveta reaproveita a mecânica dos modais** em vez de inventar outra: classe
`open`, trava de `overflow` no `body` e o handler de `Escape` já existente.
`z-index: 95` — acima da navbar flutuante (90) e abaixo dos modais (100),
preservando a ordem que já existia.

**A gaveta fecha ao escolher um balde.** Senão o painel cobre justamente a lista
que a pessoa acabou de filtrar.

**O trabalho de JS foi mínimo, e isso não foi sorte.** A lógica de baldes já era
agnóstica de layout: `setBucket()` alterna a classe por `data-bucket` e
`updateContextBadges()` escreve em ids `count-<balde>`. Migrar para o sidebar foi
quase só mover markup — o único ajuste foi um seletor CSS no `setBucket`.

---

## Bloco 4 — Projetos no sidebar

O plano, com as decisões e o raciocínio de cada uma, está em
[bloco-4-projetos-no-sidebar.md](bloco-4-projetos-no-sidebar.md) e foi seguido
sem desvio de rumo. O que vale registrar aqui é o que só apareceu ao implementar.

**A seleção única saiu mais barata que o previsto porque o estado virou um objeto
só.** `currentBucket` deu lugar a `currentView = { type, value }`, e o filtro do
`render()` passou a chamar `matchesCurrentView()`. Foram seis pontos de leitura,
todos mecânicos. A tentação era acrescentar um `currentProjectId` ao lado do
balde — o mesmo erro de `currentFormContext`, removido no Bloco 1.

**Uma varredura só decide o `active` dos dois grupos.** `syncSidebarActive()` é
chamada de dentro do `render()`, depois de `renderSidebarProjects()`. Isso importa
porque os botões de projeto são recriados a cada render: marcá-los no template
funcionaria, mas manteria duas mecânicas de seleção — uma para cada grupo — que
divergem no primeiro caso de borda. Por isso o template dos projetos **não**
escreve `active`.

**Desenhar o sidebar dentro do `render()` resolveu a sincronização de graça.**
Todo caminho que mexe em dados já chamava `render()`, inclusive o da
sincronização. As duas exceções eram reais e estavam previstas:
`createProject()` e `addProjectFromManager()` não chamavam, então criar um projeto
não o faria aparecer.

### Três coisas que só a implementação mostrou

1. **Os grupos de dia e os grupos de projeto compartilham as classes CSS.**
   `renderChronological()` emite `.project-group` / `.project-group-name` com
   `formatDayHeader()`. Ao medir "a lista de um projeto tem cabeçalhos de dia?",
   contar `.project-group` não responde nada — é preciso ler o **texto** do
   cabeçalho para saber se é uma data ou um nome de projeto.
2. **Truncar `.sidebar-label` deixou de ser cosmético.** Os rótulos dos baldes são
   curtos e fixos; nome de projeto é texto arbitrário. Sem `text-overflow`, um
   nome longo transformava o item de 35px em 103px, com três linhas. O nome
   inteiro ficou no `title`.
3. **O ponto de cor precisou de margem para alinhar.** Ele tem 9px e os ícones
   dos baldes 17px: sem `margin: 0 4px` os nomes dos projetos ficam 8px à esquerda
   dos rótulos dos baldes. Medido, não estimado — depois da margem o delta é 0.
4. **A recaída para "Hoje" foi para dentro do `render()`, não do
   `deleteProject()`.** O plano a colocava no caminho da exclusão, mas há um
   segundo caminho pelo qual o projeto selecionado desaparece: a sincronização
   trazendo outro conjunto de projetos. No `render()` uma checagem cobre os dois,
   e o modo de falha era feio — `EMPTY_MSG[<id do projeto>]` é `undefined`, então
   a tela exibia literalmente "undefined".

## As duas correções (PRs #4 e #5)

Ambas surgiram da **verificação visual no navegador**, depois que os harnesses em
Node já tinham passado. Vale como lembrete de que testar a lógica não substitui
abrir a tela.

**#4 — a linha do "agora" sumia.** Regressão introduzida no PR #3. A checagem
herdada usava `i === 0` para decidir se a linha entrava antes da primeira tarefa;
ao agrupar por dia, o índice passou a ser relativo ao grupo, que agora inclui as
tarefas sem horário. Com uma tarefa sem hora abrindo o dia, a primeira tarefa com
horário caía no índice 1 e a linha nunca era desenhada. A correção passou a
inserir antes da primeira tarefa com horário em curso ou por vir, sem depender de
índice — o que também fechou um buraco anterior, em que a linha não aparecia
*entre* duas tarefas.

**#5 — o horário de término virava "24:30".** `padTime` formatava
minutos-desde-a-meia-noite sem tratar transbordo de 24h. Bug pré-existente. O
módulo entrou dentro da própria `padTime` para cobrir chamadores futuros; o outro
chamador (a linha do "agora") nunca passa de 1439, então é inócuo lá.
