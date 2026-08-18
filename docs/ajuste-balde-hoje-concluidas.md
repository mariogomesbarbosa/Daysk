# Ajuste — tarefas concluídas de dias anteriores no balde "Hoje"

**Implementado, em duas rodadas.** A primeira excluía só as concluídas
*antigas*; um teste real no Chrome mostrou que concluídas *de hoje* também
precisavam sair. A regra final é mais simples que a primeira versão — ver
[Revisão](#revisão-concluída-de-hoje-também-sai). A alternativa rica com
`completedAt` segue em aberto, com os pré-requisitos em
[pendencias.md](pendencias.md). A regra final está documentada em
[modelo-de-dados.md](modelo-de-dados.md).

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
| hoje | `done` | **sai** | ver [Revisão](#revisão-concluída-de-hoje-também-sai) |
| hoje | `active` / `paused` | entra | idem |
| passado | `pending` | entra | atrasada — a rede original |
| passado | `active` / `paused` | entra | pendência em andamento |
| passado | `done` | **sai** | é o ajuste original |
| futuro | qualquer | não | é de `next7` ou de `all` |
| sem data | qualquer | não | é da caixa de entrada |

**Nada fica invisível.** Toda tarefa que sai de "Hoje" continua em "Todas", que
existe exatamente para isso. Vale reler o motivo em
[modelo-de-dados.md](modelo-de-dados.md) antes de mexer.

## Revisão: concluída de hoje também sai

A decisão central, como planejada, mantinha uma tarefa concluída **hoje** dentro
de "Hoje" — o raciocínio era que o progresso do dia precisava dela. Um teste real
no Chrome, feito pelo próprio usuário depois da implementação, mostrou que essa
premissa estava errada: **"Hoje" deve ser só o que está em aberto.** Uma tarefa
concluída, de hoje ou de antes, deve sumir da lista e do contador **no instante
em que é concluída**.

A regra final é mais simples que a original — colapsa para uma linha só:

```js
if (bucket === 'today') return t.date <= today && t.status !== 'done';
```

A ramificação `t.date === today ⇒ sempre entra` deixou de existir. Não há mais
tratamento especial para hoje: é hoje-ou-atrasado, e não concluído.

**Consequência que vale saber antes de mexer de novo:** como o balde `today`
nunca inclui uma tarefa `done`, as estatísticas de "Hoje" (`s-done`, `s-pct`)
são **sempre `0` e `0%`**. Não é um bug a corrigir — é o preço de "Hoje" ser
puramente uma lista de pendências. Quem quiser ver o que foi concluído no dia
usa "Todas" ou o Relatório.

## O que não muda

- **`getProgress()`** já trata `status === 'done'` antes de qualquer lógica de
  data, então nenhuma concluída jamais foi rotulada "atrasada". Não encoste.
- **Os contadores do sidebar** se corrigem sozinhos: `updateContextBadges()`
  chama `matchesBucket()`. Um ponto de mudança, dois efeitos.
- **As estatísticas** derivam da lista filtrada, então também se corrigem
  sozinhas — sempre `0 concluídas · 0%` em "Hoje", pela razão acima.
- **Os cabeçalhos de dia** desaparecem sempre que sobra um único grupo, porque
  `renderChronological()` omite cabeçalho nesse caso.
- **`next7`, `inbox` e `all`** ficam intocados.

## `completedAt`: por que não precisou entrar aqui, e onde ainda importa

Antes da revisão, eu havia considerado usar `t.completedAt` para uma leitura
mais rica de "Hoje" (dia de hoje + o que foi terminado hoje, independente da
data planejada). O teste do usuário resolveu a questão na direção oposta: "Hoje"
não deveria mostrar concluídas de jeito nenhum, nem as de hoje. Isso torna
`completedAt` desnecessário para a regra do balde — `t.status` sozinho basta.

O campo continua relevante para outra coisa, que não mudou:

**O gráfico de conclusão do relatório agrupa por `t.date`, não por
`completedAt`:**

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
| A regra | `matchesBucket()`, o ramo `today` — uma linha, na versão final |
| A documentação da regra | tabela de baldes em [modelo-de-dados.md](modelo-de-dados.md), e a frase "o balde é derivado de `t.date`, sempre" |

Nada de CSS, nada de markup, nenhum outro ponto de JS.

## Verificação

**Harness em Node**, cobrindo a tabela de casos de borda (agora com "hoje +
`done`" invertido para "sai") mais a confirmação de que `next7`, `inbox` e `all`
devolvem exatamente o mesmo conjunto de antes — é a regressão que importa,
porque a mudança mora numa função compartilhada pelos quatro.

**No navegador**, em duas rodadas — a segunda depois da revisão:

1. "Hoje" conta só o que está em aberto — no exemplo original, 2 de 4.
2. O painel mostra `0 concluídas` e `0%` sempre em "Hoje", nunca refletindo uma
   concluída — nem as de hoje.
3. Os cabeçalhos de dia somem quando sobra um grupo só.
4. "Todas" continua contando tudo — nada ficou invisível.
5. **Concluir a única tarefa aberta de hoje faz "Hoje" cair a zero na hora** —
   ela não permanece nem contribui para o progresso. Este é o ponto que a
   primeira rodada tinha errado.
6. Reabrir uma concluída, de hoje ou antiga: ela **volta** para "Hoje" — hoje
   como pendente comum, antiga como "atrasada".
7. Uma tarefa antiga em `active` ou `paused` continua em "Hoje".
