# Modelo de dados

Esta é a parte menos óbvia do código e a que mais se paga entender antes de
mexer. Números de linha referem-se ao `index.html` em `6e3d625` e envelhecem —
prefira buscar pelo nome da função.

## Uma tarefa

Persistida em `localStorage` sob a chave `daily-tasks`, como um array JSON.

| Campo | Valores | Significado |
|---|---|---|
| `id` | string | `Date.now().toString()` |
| `name` | string | — |
| `date` | `YYYY-MM-DD` ou `null` | **`null` significa caixa de entrada (sem prazo)** |
| `time` | `HH:MM` ou `null` | `null` = tarefa do dia, sem hora marcada |
| `dur` | minutos ou `null` | Só faz sentido acompanhado de `time` |
| `projectId` | string | Referência a `daily-projects` |
| `status` | `pending` \| `active` \| `paused` \| `done` | — |
| `elapsed` | ms | Tempo acumulado |
| `startedAt` | timestamp ou `null` | Preenchido só enquanto `active` |
| `completedAt` | timestamp ou ausente | Gravado ao concluir e **nunca lido**. Ausente em registros antigos e não limpo ao reabrir — ver abaixo |

Projetos ficam em `daily-projects`: `{ id, name, colorIndex }`, onde
`colorIndex` indexa a constante `PALETTE`.

### `t.date` é a fonte única da verdade do prazo

Não existe mais nenhum campo de "contexto" ou "categoria". O prazo de uma tarefa
é **derivado** de `t.date`, sempre, por `matchesBucket()`.

Uma ressalva, e só uma: **o balde `today` lê `t.status` também.** Não é exceção
gratuita — é o que a regra sempre quis dizer. Ver
[Regras dos baldes](#regras-dos-baldes). Os outros três derivam puramente da data.

### O campo legado `t.context`

Registros antigos podem ter `t.context` com `'today'`, `'tomorrow'` ou
`'later'`. **Ele não é lido nem gravado.** Foi deixado nos dados de propósito:
é inerte, e uma migração destrutiva sobre dados que o usuário sincroniza em três
lugares diferentes não se paga.

Se você for limpar isso algum dia, note que a migração é segura porque
`context === 'later'` sempre implicava `date === null` no código antigo — a
gravação garantia isso. É por essa razão que nenhum passo de migração foi
necessário quando o modelo mudou.

## Regras dos baldes

Em `matchesBucket(t, bucket)`:

| Balde | Regra | Observação |
|---|---|---|
| `today` | `t.date === hoje`, **ou** `t.date < hoje && t.status !== 'done'` | O dia de hoje, mais a pendência que sobrou |
| `next7` | `hoje < t.date <= hoje+7` | Limite superior inclusivo |
| `inbox` | `!t.date` | Estritamente sem prazo |
| `all` | tudo | Rede de segurança: garante que nada fique invisível |

O motivo de `all` existir: sem ele, uma tarefa datada para daqui a 15 dias não
pertenceria a balde nenhum e desapareceria da interface até entrar na janela dos
7 dias.

### Por que `today` não é simplesmente `t.date <= hoje`

Era, até o [ajuste das concluídas](ajuste-balde-hoje-concluidas.md). O `<=`
puxava o passado inteiro, inclusive tarefas **já concluídas** dias atrás: elas
inflavam o contador e, pior, envenenavam as estatísticas do dia — dois itens
concluídos em julho viravam "50% de progresso" num dia em que nada tinha sido
feito.

A leitura certa é que **puxar o passado nunca foi uma regra de data.** Era a rede
para não perder trabalho a fazer. Uma tarefa concluída não é trabalho a fazer,
então sai — e não fica invisível, porque `all` continua com ela.

Consequências que valem lembrar antes de mexer:

- **Concluída hoje continua em `today`.** O corte é por data anterior, não por
  estar concluída; ver o que você fez hoje é o que dá sentido ao `progresso`.
- **`active` e `paused` de dias anteriores continuam aparecendo.** A regra olha
  só `done`. Tarefa antiga em andamento é a definição de pendência.
- **`status` ausente conta como pendente.** Registros antigos sem o campo não
  desaparecem.

### O que ainda mistura data planejada com data de conclusão

`t.completedAt` é gravado por `completeTask()` e **nunca é lido**. Duas coisas
dependem dele para ficarem certas, e nenhuma foi feita:

1. **Concluir hoje uma tarefa marcada para semana passada** a tira de `today` no
   mesmo instante, e ela não entra no progresso do dia.
2. **O gráfico de conclusão do relatório** agrupa por `t.date`, então essa tarefa
   aparece como concluída na data planejada, não na data em que foi concluída.

Antes de usar o campo: ele não existe em registros antigos, e `reopenTask()` não
o limpa — reabrir deixa um `completedAt` mentindo. Ver
[pendencias.md](pendencias.md).

## Ordenação

`taskSortKey(t)` devolve `(t.date || '9999-99-99') + (t.time || '00:00')`, e a
comparação é `localeCompare` sobre essa string. Consequências deliberadas:

- **Data manda mais que hora.** Necessário nos baldes `next7` e `all`, que
  abrangem vários dias.
- **Tarefas sem prazo vão para o fim**, pelo sentinela `9999-99-99`.
- **Dentro de um dia, as sem horário vêm primeiro**, pelo `00:00`.

## Render da timeline

O caminho é `render()` → `renderChronological()` → `groupByDay()` →
`renderDayTasks()`.

- `groupByDay()` agrupa preservando a ordem de `taskSortKey`. Tarefas sem prazo
  formam um grupo com chave `''`.
- `renderChronological()` **omite os cabeçalhos quando há um único grupo** — é o
  caso comum do balde "Hoje" sem atrasadas.
- `renderDayTasks()` só insere a linha do "agora" **dentro do grupo de hoje**, e
  antes da primeira tarefa com horário que esteja em curso ou ainda por vir.
  Não use índice para isso: as tarefas sem horário abrem o grupo. Foi
  exatamente esse o bug do PR #4.

## Armadilhas conhecidas

**`getProgress()` precisa comparar a data antes da hora.** A ordem dos ramos
importa: `status` → data futura → data passada → lógica de hoje. Inverter isso
traz de volta o bug de marcar "atrasada" uma tarefa da semana que vem.

**`toMins()` aceita nulo** e devolve `0`. É rede de segurança, não licença para
chamá-la sem pensar — os sorts foram corrigidos para não depender disso.

**Datas são strings, sempre.** A comparação lexicográfica de `YYYY-MM-DD`
equivale à cronológica, o que é o motivo de o código usar `<=` direto em string.
Ao construir datas, use `addDays()`/`toDateStr()`, que atravessam mês, ano e ano
bissexto corretamente. Não faça aritmética com `Date` na mão: o padrão
`new Date(ds + 'T00:00:00')` existe para evitar o deslocamento de fuso que
`new Date('2026-08-14')` provoca (esse é interpretado como UTC).

**Horário sem data é normalizado.** Se o formulário recebe hora e nenhuma data,
`saveTask()` assume hoje — uma hora sem dia não significa nada.

## Sincronização

Três modos, escolhidos no modal de Sincronização e guardados em
`daysk-sync-mode`: cache do navegador (`localStorage`), pasta local
(File System Access API, só Chrome/Edge) e Google Drive.

Os três serializam o mesmo array com `JSON.stringify`, **sem validar schema**.
Isso é o que tornou a mudança de modelo transparente para o transporte — e é
também o que significa que um campo malformado não é detectado em lugar nenhum.
Ao mexer no formato, teste os três.
