# Documentação — Daysk

Documentação de trabalho da reestruturação da página de Tasks. O objetivo destes
arquivos é permitir retomar o projeto em outra máquina sem perder as decisões e
o *porquê* delas.

> Nota de proveniência: estes documentos foram escritos ao final da reestruturação,
> reconstruindo o histórico a partir das sessões de planejamento. Os planos eram
> mantidos num arquivo temporário sobrescrito a cada bloco, então só o plano do
> Bloco 3 existia em disco. O conteúdo aqui reflete o que foi efetivamente
> decidido e implementado — confira sempre contra o código antes de agir.

## Índice

| Documento | Para quê |
|---|---|
| [roteiro-reestruturacao.md](roteiro-reestruturacao.md) | Os 5 blocos, o que entrou em cada um e as decisões com o raciocínio |
| [modelo-de-dados.md](modelo-de-dados.md) | Como uma tarefa é representada e as regras dos baldes — a parte menos óbvia do código |
| [bloco-4-projetos-no-sidebar.md](bloco-4-projetos-no-sidebar.md) | O plano do Bloco 4, com as decisões e o que ficou fora |
| [ajuste-balde-hoje-concluidas.md](ajuste-balde-hoje-concluidas.md) | Ajuste planejado: concluídas de dias anteriores somem do balde "Hoje" |
| [pendencias.md](pendencias.md) | Ressalvas conhecidas, incluindo o que foi para `main` sem verificação visual |

## Estado atual

Os cinco blocos estão em `main`. Falta o Calendário, que hoje é só um
placeholder e terá planejamento próprio.

| PR | O quê |
|---|---|
| #1 | Navbar flutuante separando Tasks de Relatórios |
| #2 | Calendário na navbar + página placeholder |
| #3 | Data arbitrária, horário opcional, 4 baldes de prazo |
| #4 | Correção: linha do "agora" sumindo |
| #5 | Correção: horário de término virando "24:30" |
| #6 | Sidebar de duas colunas + gaveta no mobile |
| #8 | Projetos no sidebar, com seleção única |

## Arquitetura, em uma frase

Tudo — HTML, CSS e JS — vive em `index.html`. Sem build, sem dependências
instaladas. As externas são carregadas por CDN: JetBrains Mono, Chart.js e as
bibliotecas do Google (para o modo de sincronização com o Drive).

Isso é deliberado e vale preservar: o app abre com um duplo clique e é publicado
por GitHub Pages sem nenhuma etapa intermediária.

## Rodando localmente

Duplo clique em `index.html` funciona para a maior parte das coisas. Para
qualquer teste que envolva `localStorage` isolado ou a sincronização, sirva por
HTTP:

```bash
python -m http.server 8899 --bind 127.0.0.1
```

Depois abra <http://127.0.0.1:8899/index.html>.

Atenção ao `localStorage`: ele é isolado por origem. Dados abertos via
`file://` **não** são os mesmos de `127.0.0.1:8899`. Isso é conveniente para
testar com dados falsos sem tocar nos reais — e é uma pegadinha se você
esperar ver suas tarefas ao trocar de origem.

## Verificação

O projeto não tem suíte de testes. A verificação usada durante a reestruturação
foi de dois tipos, e vale repetir os dois:

**Lógica pura, no Node.** Como não há módulos, o caminho foi extrair as funções
do `index.html` por casamento de chaves e avaliá-las num harness descartável.
Cobriu baldes, ordenação, agrupamento por dia, `getProgress` e `padTime`.
Esses harnesses **não foram commitados** — veja [pendencias.md](pendencias.md).

**Interface, no navegador.** Semear `localStorage` com tarefas cobrindo os
casos de borda (hoje com e sem hora, atrasada, d+3, d+15, sem prazo) e
percorrer os quatro baldes, as três telas e os dois temas.

Um aprendizado que se repetiu: **medir em vez de julgar pela captura de tela.**
Duas vezes uma screenshot sugeriu um problema que a medição desmentiu — uma
suposta sobreposição de `z-index` (resolvida com `elementFromPoint`) e um
suposto transbordo horizontal (resolvido comparando `scrollWidth` com
`innerWidth`, e que era artefato de `devicePixelRatio`).

## Convenções

- **Commits, PRs e comentários de código em português.** O repositório é pessoal
  e o histórico é todo em pt-BR. Uma configuração global da SIEG pede inglês em
  código; ela não se aplica aqui.
- **Branches:** `feat/...` e `fix/...`, um assunto por PR.
- Ícones vêm do pacote oficial [`@phosphor-icons/core`](https://github.com/phosphor-icons/core),
  regular, `viewBox="0 0 256 256"`, embutidos inline. Copie os paths do pacote,
  não escreva geometria à mão:
  ```bash
  curl -s https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/tray.svg
  ```
