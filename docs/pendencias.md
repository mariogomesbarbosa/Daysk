# Pendências e ressalvas conhecidas

## Não verificado visualmente: layout abaixo de 860px

**O que está em risco:** a gaveta do sidebar e o comportamento do grid no
mobile, entregues no PR #6.

**Por que ficou assim:** o ambiente de automação de navegador usado durante a
implementação não conseguia redimensionar o viewport — `resize_window` retornava
sucesso, mas `window.innerWidth` continuava em 1536px. Então o ponto de corte
renderizado nunca foi visto.

**O que foi feito no lugar:**

- Confirmado via CSSOM que a media query de 860px parseou com os cinco seletores
  esperados. O modo de falha realista aqui é um erro de sintaxe derrubar o bloco
  inteiro, e isso está descartado.
- A gaveta foi inspecionada visualmente forçando os mesmos estilos sem o wrapper
  da media query — o desenho, o backdrop e a ordem de camadas estão certos.
- Comportamento de abrir/fechar verificado pelos três caminhos (backdrop,
  `Escape`, escolher balde), incluindo a trava de scroll e o `aria-expanded`.

**O que falta:** abrir em ~375px de largura real, no celular ou no DevTools, e
conferir que o botão de menu aparece, que a gaveta desliza e que nenhuma faixa
gera scroll horizontal. As faixas a olhar são 900px, 860px, 600px e 480px — os
três breakpoints do arquivo interagem nessa região.

## README.md desatualizado

O `README.md` na raiz descreve **"Contextos Temporais (Hoje, Amanhã e Fazer
Depois)"**, que não existem mais desde o PR #3 — hoje são quatro baldes (Hoje,
Próximos 7 dias, Caixa de entrada, Todas). A seção "Estrutura de Arquivos"
também não menciona `docs/`.

Não foi corrigido porque reescrever a comunicação do produto é decisão de quem
mantém, não consequência automática da mudança técnica.

## Harnesses de teste não commitados

A verificação de lógica foi feita com três scripts Node que extraíam funções do
`index.html` por casamento de chaves e as avaliavam: baldes e ordenação (25
casos), `getProgress` (8) e `padTime` (8). **Eles viviam em diretório temporário
e foram perdidos.**

Se valer recriá-los, o padrão é: localizar `function nome(` no fonte, casar
chaves até o fechamento, concatenar as funções e dependências, e avaliar num
escopo isolado. Vale principalmente para as regras de balde e para `getProgress`,
onde os casos de borda (limite d+7/d+8, virada de ano, data futura vs atrasada)
não são óbvios à inspeção.

Uma alternativa mais durável seria extrair essas funções puras para um
`<script type="module">` ou um arquivo separado — o que colide com a decisão de
manter tudo em um único `index.html`. Vale a conversa, não a mudança silenciosa.

## Cosmético, pré-existente

`.context-selector` usa `grid-template-columns: repeat(3, 1fr)`, mas o modal de
agendamento rápido tem só dois botões (Hoje / Amanhã), deixando uma coluna vazia.
Anterior a toda a reestruturação; nunca foi tocado.

## Ambiente

O `gh` CLI pode não estar no `PATH` do shell mesmo estando instalado, quando a
sessão do terminal começou antes da instalação. O caminho absoluto no Windows é
`C:\Program Files\GitHub CLI\gh.exe`. Uma sessão nova resolve.
