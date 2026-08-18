# Ajuste — tarefas concluídas de dias anteriores no balde "Hoje"

**Implementado.** A decisão central entrou como planejada, numa linha de
`matchesBucket()`; a alternativa rica com `completedAt` segue em aberto, com os
pré-requisitos registrados em [pendencias.md](pendencias.md). A regra final está
documentada em [modelo-de-dados.md](modelo-de-dados.md).

## O problema

O balde "Hoje" conta 4 tarefas quando só 2 são de hoje. As outras duas são de
29/07 e 30/07, **já concluídas**, e aparecem na lista com cabeçalho de dia
próprio (`quarta-feira · 29/07`, `quinta-feira · 30/07`).

O efeito colateral pior está nas estatísticas: com 2 concluídas antigas de 4
totais, o painel mostra **50% de progresso** e `4h planejadas` para um dia em que
nada foi concluído e nada tem horário. O número mais visível da tela está errado.

## Por que acontece

Uma linha, em `matchesBucket()`:

```js
if (bucket === 'today') return t.date <= today;
```

O `<=` é deliberado e está documentado em
[modelo-de-dados.md](modelo-de-dados.md): serve para **atrasadas não sumirem**.
Uma tarefa de ontem que ficou por fazer precisa continuar visível, senão ela
desaparece silenciosamente.

O que a regra não previu é que `t.date < hoje` **e** `status === 'done'` não é uma
atrasada — é uma tarefa resolvida, que já cumpriu seu papel. A cortesia de puxar
o passado para hoje foi escrita para não perder pendência, e uma tarefa concluída
não é pendência.

## Decisão central

**"Hoje" = tarefas datadas para hoje + o que ficou para trás e ainda não foi
concluído.**

```js
// esboço, não código final
if (bucket === 'today') {
  if (t.date === today) return true;              // o dia de hoje, feito ou não
  return t.date < today && t.status !== 'done';    // o passado só se ainda pende
}
```

Duas consequências que valem ser explícitas:

**Uma tarefa concluída hoje continua em "Hoje".** O corte é por data anterior, não
por estar concluída. Ver o que você fez hoje é justamente o que dá sentido ao
`progresso` do painel.

**`active` e `paused` de dias anteriores continuam aparecendo.** A regra olha só
`done`. Uma tarefa antiga em andamento é a definição de pendência.

### O custo conceitual, declarado

Hoje o [modelo-de-dados.md](modelo-de-dados.md) afirma que **o balde é derivado de
`t.date`, sempre**. Com este ajuste o balde `today` passa a ler `t.status`
também, e essa frase deixa de ser verdadeira ao pé da letra.

Vale pagar, e a forma honesta de reescrever a regra é parar de descrevê-la como
"data ≤ hoje" e passar a descrevê-la como o que ela sempre quis ser: **o dia de
hoje, mais a pendência que sobrou.** A inclusão do passado nunca foi uma regra de
data — era uma rede para não perder trabalho a fazer. Ler `status` é inerente a
essa intenção, não um desvio dela.

Os outros três baldes seguem puramente derivados de `t.date`.

## Casos de borda

| `t.date` | `status` | Hoje | Por quê |
|---|---|---|---|
| hoje | `pending` | entra | o dia de hoje |
| hoje | `done` | **entra** | o progresso do dia precisa dela |
| hoje | `active` / `paused` | entra | idem |
| passado | `pending` | entra | atrasada — a rede original |
| passado | `active` / `paused` | entra | pendência em andamento |
| passado | `done` | **sai** | **é o ajuste** |
| futuro | qualquer | não | é de `next7` ou de `all` |
| sem data | qualquer | não | é da caixa de entrada |

**Nada fica invisível.** Toda tarefa que sai de "Hoje" continua em "Todas", que
existe exatamente para isso. Vale reler o motivo em
[modelo-de-dados.md](modelo-de-dados.md) antes de mexer.

## O que não muda

- **`getProgress()`** já trata `status === 'done'` antes de qualquer lógica de
  data, então nenhuma concluída antiga jamais foi rotulada "atrasada". Não encoste.
- **Os contadores do sidebar** se corrigem sozinhos: `updateContextBadges()`
  chama `matchesBucket()`. Um ponto de mudança, dois efeitos.
- **As estatísticas** derivam da lista filtrada, então também se corrigem
  sozinhas. No exemplo passariam a `2 total · 0 concluídas · 0min · 0%`.
- **Os cabeçalhos de dia** desaparecem no caso do exemplo, porque sobra um grupo
  só e `renderChronological()` omite cabeçalho quando há apenas um.
- **`next7`, `inbox` e `all`** ficam intocados.

## A alternativa mais rica, e por que não agora

Existe uma leitura melhor de "Hoje": **o dia de hoje mais o que eu terminei
hoje**, independentemente da data planejada. Ela resolve um caso que a decisão
acima deixa de fora — concluir hoje uma tarefa que estava marcada para 29/07,
que sob a regra proposta sai de "Hoje" no mesmo instante em que você a conclui, e
não entra no progresso do dia.

**E o campo para isso já existe.** `completeTask()` grava `t.completedAt =
Date.now()`. Mesmo assim não recomendo agora, por três motivos que precisam ser
resolvidos primeiro:

1. **O campo nunca é lido.** É a única ocorrência no arquivo, e não está
   documentado em [modelo-de-dados.md](modelo-de-dados.md).
2. **Registros antigos não têm o campo.** As duas tarefas do exemplo podem ou não
   tê-lo, dependendo de quando a linha entrou. Qualquer regra que dependa dele
   precisa de um caminho para `undefined` — e o comportamento nesse caminho é
   justamente o da decisão acima.
3. **`reopenTask()` não limpa o campo.** Reabrir deixa um `completedAt` mentindo
   sobre uma tarefa que voltou a pendente. Isso é bug, e é pré-requisito.

Ou seja: a decisão central é o degrau certo agora, e também é o alicerce da
versão rica — que fica como bloco próprio, junto de resolver os três itens acima.

### Uma inconsistência vizinha, para registro

O gráfico de conclusão do relatório agrupa por `t.date`, não por `completedAt`:

```js
filtered.filter(t => t.date === ds && t.status === 'done').length
```

Então uma tarefa planejada para 29/07 e concluída hoje aparece como concluída em
**29/07** no gráfico. É o mesmo tema — data planejada versus data de conclusão —
e o mesmo bloco futuro deveria decidir os dois juntos, para o app não passar a
responder duas coisas diferentes para a mesma pergunta.

## Pontos de edição

| O quê | Onde |
|---|---|
| A regra | `matchesBucket()`, o ramo `today` — uma linha vira três |
| A documentação da regra | tabela de baldes em [modelo-de-dados.md](modelo-de-dados.md), e a frase "o balde é derivado de `t.date`, sempre" |

Nada de CSS, nada de markup, nenhum outro ponto de JS.

## Verificação

**Harness em Node**, estendendo o que já existe: as oito linhas da tabela de
casos de borda, mais a confirmação de que `next7`, `inbox` e `all` devolvem
exatamente o mesmo conjunto de antes — é a regressão que importa, porque a
mudança mora numa função compartilhada pelos quatro.

**No navegador**, com dados semeados reproduzindo o relato: duas tarefas de hoje
sem horário e duas concluídas de datas anteriores.

1. "Hoje" conta 2, não 4.
2. O painel mostra `0 concluídas` e `0%`, não `2` e `50%`.
3. Os cabeçalhos de dia somem, porque sobrou um grupo só.
4. "Todas" continua contando 4 — nada ficou invisível.
5. Concluir uma tarefa de hoje: ela **permanece** na lista e o progresso sobe.
6. Reabrir uma concluída antiga: ela **volta** para "Hoje" como atrasada.
7. Uma tarefa antiga em `active` ou `paused` continua em "Hoje".
