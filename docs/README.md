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
| [ajuste-balde-hoje-concluidas.md](ajuste-balde-hoje-concluidas.md) | Por que "Hoje" exclui toda tarefa concluída — e as duas rodadas que levaram a essa regra |
| [calendario.md](calendario.md) | O Calendário: as 13 decisões, o desvio do D8 e a verificação |
| [calendario-alternador-de-visao.md](calendario-alternador-de-visao.md) | As quatro visões e o planejar por arraste: 24 decisões, e os dois desvios que desfizeram |
| [refinamento-calendario.md](refinamento-calendario.md) | Os quatro ajustes de refino: coluna, campo Final, redimensionar e contraste |
| [refinamento-relatorios.md](refinamento-relatorios.md) | Largura da página, registro de sessões no modelo e as horas trabalhadas nos gráficos |
| [bandeja-de-nao-planejadas-no-mobile.md](bandeja-de-nao-planejadas-no-mobile.md) | Por que o botão parecia não fazer nada, e a bandeja inferior que resolve |
| [instalacao-android.md](instalacao-android.md) | Por que o atalho não abria, e o que instalar como app custou à arquitetura |
| [enviar-agora-e-o-descarte-silencioso.md](enviar-agora-e-o-descarte-silencioso.md) | Com que frequência o Drive recebe upload, o bug que descarta gravações, e o botão manual |
| [pendencias.md](pendencias.md) | Ressalvas conhecidas, incluindo o que foi para `main` sem verificação visual |

## Estado atual

Os cinco blocos estão em `main`, e o Calendário — a peça adiada no Bloco 0 —
está implementado. A reestruturação está fechada; o que resta são as
ressalvas de [pendencias.md](pendencias.md).

| PR | O quê |
|---|---|
| #1 | Navbar flutuante separando Tasks de Relatórios |
| #2 | Calendário na navbar + página placeholder |
| #3 | Data arbitrária, horário opcional, 4 baldes de prazo |
| #4 | Correção: linha do "agora" sumindo |
| #5 | Correção: horário de término virando "24:30" |
| #6 | Sidebar de duas colunas + gaveta no mobile |
| #8 | Projetos no sidebar, com seleção única |
| #9 | "Hoje" deixa de contar tarefas concluídas |

## Arquitetura, em uma frase

Quase tudo — HTML, CSS e JS — vive em `index.html`. Sem build, sem dependências
instaladas. As externas são carregadas por CDN: JetBrains Mono, Chart.js e as
bibliotecas do Google (para o modo de sincronização com o Drive).

Isso é deliberado e vale preservar: o app abre com um duplo clique e é publicado
por GitHub Pages sem nenhuma etapa intermediária.

**O "quase" tem uma causa só, e está documentada:** instalar como app no Android
exigiu `manifest.webmanifest`, `sw.js` e ícones PNG como arquivos separados — um
service worker não pode ser embutido, e o Chrome não monta WebAPK a partir de
manifest em `data:` URI nem de ícone SVG. O que a decisão protegia continua de
pé: nenhuma etapa de build, nenhuma dependência instalada, e o duplo clique
segue funcionando. Ver [instalacao-android.md](instalacao-android.md).

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

**Lógica pura, no Node.** Como não há módulos, o caminho é extrair as funções
do `index.html` por casamento de chaves e avaliá-las num escopo isolado. Isso
agora vive em `tests/funcoes-puras.mjs`, commitado:

```bash
node tests/funcoes-puras.mjs
```

Cobre hoje `endFromDur`/`durFromEnd` (incluindo o ida-e-volta que atravessa a
meia-noite), `padTime` e `minsToHm`. Os harnesses **anteriores** — baldes,
ordenação, agrupamento por dia e `getProgress` — foram perdidos por morar em
diretório temporário; ver [pendencias.md](pendencias.md).

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
