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

Projetos ficam em `daily-projects`: `{ id, name, colorIndex }`, onde
`colorIndex` indexa a constante `PALETTE`.

### `t.date` é a fonte única da verdade

Não existe mais nenhum campo de "contexto" ou "categoria". O balde de uma tarefa
é **derivado** de `t.date`, sempre, por `matchesBucket()`.

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
| `today` | `t.date <= hoje` | **Inclui atrasadas** — de propósito, para não sumirem |
| `next7` | `hoje < t.date <= hoje+7` | Limite superior inclusivo |
| `inbox` | `!t.date` | Estritamente sem prazo |
| `all` | tudo | Rede de segurança: garante que nada fique invisível |

O motivo de `all` existir: sem ele, uma tarefa datada para daqui a 15 dias não
pertenceria a balde nenhum e desapareceria da interface até entrar na janela dos
7 dias.

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
