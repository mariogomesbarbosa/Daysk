# Sincronização — botão de enviar agora, e o descarte silencioso

Dois assuntos que chegaram como um: um botão para subir os dados no Google Drive
sob comando, e — descoberto ao investigar a frequência do upload — um bug que
faz gravações sumirem sem aviso.

Números de linha envelhecem — este documento cita nomes de função.

---

## Com que frequência o upload acontece hoje

**Não há agendamento nenhum.** O upload é disparado por evento: toda chamada de
`save()` e `saveProjects()` chama `writeToGoogleDrive()` quando o modo é Drive.

`save()` é chamada de **13 pontos**: criar, editar e excluir atividade;
iniciar, pausar, concluir e reabrir o cronômetro; soltar no calendário;
agendamento rápido; e a migração no carregamento.

Os únicos `setInterval` do arquivo são `render` (60s) e `tick` (1s), e **nenhum
dos dois salva**. Ao carregar a página, `initSync()` **baixa** do Drive — nunca
sobe.

Na prática: cada clique em "iniciar" sobe dois arquivos, `tasks.json` e
`projects.json`, sequencialmente.

---

## O bug: `gdriveWriteQueued` descarta, apesar do nome

```js
if (gdriveWriteQueued) return;      // ← não enfileira nada; descarta
gdriveWriteQueued = true;
try {
  await writeGDriveFile('tasks.json', …);
  await writeGDriveFile('projects.json', …);
} finally { gdriveWriteQueued = false; }
```

Se um `save()` acontece **enquanto um upload está em voo**, a função retorna e
aquela gravação **nunca chega ao Drive**. A janela é a duração de dois uploads —
segundos numa conexão ruim, e o cronômetro produz saves em rajada.

Isso se auto-corrige *se* vier outro save depois, porque o próximo sobe o estado
inteiro. Mas **o último save de uma sequência pode ser descartado**, e aí o Drive
fica desatualizado até a próxima ação do usuário. Como o erro só vai para
`console.error`, nada na tela denuncia.

**O mesmo bug existe no modo pasta local**, com o mesmo formato:
`if (writeQueued) return`. Ali a gravação é em disco e a janela é bem menor, mas
a lógica é idêntica — corrigir só o Drive deixaria um bug conhecido no irmão.

---

## Decisões

### S1 — O descarte vira "ficou coisa por subir"

A troca é pequena e resolve a classe inteira:

```js
let gdriveEscrevendo = false;
let gdrivePendente = false;

async function writeToGoogleDrive() {
  if (syncMode !== 'gdrive' || gdriveStatus !== 'connected') return;
  if (gdriveEscrevendo) { gdrivePendente = true; return; }   // marca, não descarta
  gdriveEscrevendo = true;
  try {
    do {
      gdrivePendente = false;
      await writeGDriveFile('tasks.json', JSON.stringify(tasks, null, 2));
      await writeGDriveFile('projects.json', JSON.stringify(projects, null, 2));
    } while (gdrivePendente);
  } finally { gdriveEscrevendo = false; }
}
```

**Nada precisa ser guardado em buffer.** O `JSON.stringify` roda *dentro* do
laço e lê o estado atual, então a repetição sobe o que existe agora — não uma
fila de versões antigas. É por isso que um laço resolve onde uma fila seria a
resposta óbvia e errada.

O laço termina sozinho: cada volta zera a marca no topo, e ela só volta a
`true` se houver save durante aquela volta. Uma rajada de N saves produz no
máximo duas voltas, não N.

**A correção vale para os dois modos.** `writeToFolder()` recebe o mesmo
tratamento.

### S2 — O botão se chama "enviar agora", e não "sincronizar"

Ele **só sobe**. Chamá-lo de "sincronizar" prometeria duas vias e criaria a
expectativa de que apertar traz o que está no Drive — o oposto do que ele faz.

O nome honesto também evita a pergunta "por que apertei sincronizar e o dado do
outro aparelho não veio".

### S3 — Antes de subir, ele confere se o Drive tem coisa mais nova

O caso real: você mexeu no celular, depois abre o PC — que carregou dados velhos
ou nem carregou — e aperta enviar. Um upload cego apagaria o que o celular
gravou.

A comparação **não custa chamada nova**: `findGDriveFileId()` já pede
`fields=files(id,name,size,modifiedTime)` e **joga o `modifiedTime` fora**. Basta
devolvê-lo.

**O carimbo comparado é o do próprio Drive, nunca `Date.now()` local.** Depois de
cada upload bem-sucedido, relê-se o `modifiedTime` do arquivo e guarda-se esse
valor em `daysk-gdrive-carimbo`. Na vez seguinte, se o `modifiedTime` remoto for
diferente do guardado, alguém escreveu de fora — e aí pergunta.

Usar o relógio local produziria conflito falso a cada desvio de relógio entre o
aparelho e o Google, que é justamente o tipo de bug que aparece só na casa de
alguém.

Se houver conflito, o `confirm()` oferece as duas saídas em português claro:
subir mesmo assim (sobrescreve) ou cancelar. Cancelar não faz nada — recarregar
a página é o caminho de trazer o que está no Drive, e isso o app já faz sozinho.

### S4 — Dois lugares: o modal e a barra superior

Um botão de "sobe agora" que exige abrir um modal para ser alcançado é meio
inútil. Então:

- **No modal**, junto de `desconectar` e `alterar pasta`, no cartão do Drive.
- **Na barra superior**, ao lado do botão "Sincronização", que continua abrindo
  o modal — mudar o que aquele botão faz tiraria o caminho para as
  configurações.

**O botão da barra só aparece quando o modo é Drive.** Em cache do navegador não
há para onde enviar, e em pasta local a gravação é imediata. Isso também limita
o aperto de largura na `brand-bar` a quem de fato usa o Drive.

Abaixo de 480px ele fica **só com o ícone** — é a mesma medida que a barra já
toma com outros controles em tela estreita.

### S5 — Três retornos, e cada um resolve uma cegueira diferente

**"Última sincronização há X"**, no cartão do Drive. Hoje não existe nada: não dá
para saber se o Drive está em dia sem abrir o Drive. O carimbo do **S3** já vai
estar guardado, então isto é exibição, não estado novo.

**Erro visível.** Falha de upload hoje vai só para `console.error`. Falha
silenciosa num app de sincronização é o pior modo de falha possível — o usuário
confia num backup que não existe. Dois comportamentos, e a diferença importa:

| Origem da falha | O que acontece |
|---|---|
| Upload **automático** | estado de erro persistente no botão da barra e no cartão do modal |
| Upload **manual** | além disso, um `alert()` |

O `alert()` só no manual porque ali o usuário está esperando resposta. No
automático ele seria intrusivo e poderia disparar em série.

**Estado "enviando…"** no botão, que fica desabilitado durante o upload. Sem
isso dá para disparar dois em cima do outro — e, com o **S1**, o segundo só
marcaria o pendente, o que é correto mas invisível.

### S6 — O que o botão **não** faz

Não baixa. Não funde. Não agenda. A descida continua acontecendo no
carregamento, por `initSync()`, e a fusão continua sendo a que já existe quando
se conecta a uma pasta com dados.

Vale escrever porque "sincronizar" é uma palavra que carrega expectativa, e o
**S2** só resolve metade do problema se o documento não disser o resto.

---

## Casos de borda

| Caso | Esperado |
|---|---|
| Apertar enviar sem estar conectado | botão nem aparece na barra; no modal, desabilitado |
| Apertar enviar em modo cache ou pasta | botão não existe nesses modos |
| Token expirado no meio do envio | `gdriveFetch` já trata 401; o erro chega ao usuário pelo S5 |
| Rede cai no meio | erro visível, carimbo **não** é atualizado |
| Dois envios em sequência rápida | o segundo marca pendente; uma volta extra do laço |
| Save durante um envio manual | mesma coisa — o laço do S1 pega |
| Primeiro envio, arquivo ainda não existe | `writeGDriveFile` já cria; sem carimbo guardado, não há conflito a checar |
| Remoto mais novo e o usuário cancela | nada sobe, nada muda, carimbo intacto |
| Remoto mais novo e o usuário confirma | sobe e o carimbo é atualizado com o novo `modifiedTime` |
| Relógio do aparelho errado | irrelevante: o carimbo é do Drive (**S3**) |
| Duas abas abertas no mesmo navegador | cada uma tem seu carimbo em `localStorage`, compartilhado — a segunda vê o carimbo da primeira e não acusa conflito falso |

---

## Pontos de edição

| O quê | Onde |
|---|---|
| marca pendente no lugar do descarte | `writeToGoogleDrive()` e `writeToFolder()` |
| devolver o `modifiedTime` que já é buscado | `findGDriveFileId()` |
| carimbo persistido | `daysk-gdrive-carimbo` no `localStorage` |
| checagem de conflito e `confirm()` | função nova, ao lado de `writeToGoogleDrive()` |
| botão no cartão do Drive | markup do modal, em `.sync-actions` |
| botão na barra superior | `.brand-bar`, condicionado ao modo |
| "última sincronização há X", erro e "enviando…" | `updateSyncUI()` |
| esconder o rótulo abaixo de 480px | CSS da `.brand-bar` |

---

## Ordem de implementação

**Dois PRs**, e nesta ordem:

1. **`fix/gravacao-descartada-na-sincronizacao`** — só o **S1**, nos dois modos.
   É correção de bug, não depende de nada, e vai sozinha porque merece ser
   revisada sem o barulho de um recurso novo em volta.
2. **`feat/enviar-agora-para-o-drive`** — S2 a S6. O botão, o conflito e os
   retornos, sobre uma base que já não descarta.

Separar também dá a chance de o **S1** sozinho resolver o incômodo: se o
automático virar confiável, o botão passa a ser conforto e não remendo.

---

## Verificação

**Lógica pura, no Node** (`tests/funcoes-puras.mjs`, hoje com 124 casos): a
decisão de conflito é pura e vai para lá — dado um carimbo guardado e um
`modifiedTime` remoto, conflita ou não, incluindo carimbo ausente (primeiro
envio) e valores iguais.

**No navegador**, com o Drive **falsificado**. É o ponto que precisa ser dito com
todas as letras: **o fluxo real do Google Drive não se automatiza daqui** — exige
OAuth interativo. Então `writeGDriveFile` e `findGDriveFileId` são substituídos
por dublês que registram chamadas e devolvem `modifiedTime` controlado. Isso
exercita:

- que uma gravação durante um envio **não se perde** — o dublê atrasa a resposta,
  um `save()` dispara no meio, e a contagem de uploads tem de ser 2, não 1
- que uma rajada de 5 saves produz **duas** voltas, não cinco
- que o carimbo é gravado só em caso de sucesso
- que o conflito dispara o `confirm()` e que cancelar não sobe nada
- que o botão desabilita durante o envio e volta depois
- que a falha automática não abre `alert()` e a manual abre

**E o que fica devendo:** o caminho real contra o Google — token expirando,
resposta 401, arquivo grande, pasta renomeada por fora. Nenhum desses se
reproduz com dublê, e todos dependem de uma conta real. É a mesma dívida que
`docs/instalacao-android.md` já registra para o modo Drive.

---

## Fora de escopo

- **Baixar sob comando.** É o botão simétrico e um pedido próprio; hoje a descida
  acontece no carregamento.
- **Sincronização periódica em segundo plano.** O modelo é por evento, e um
  intervalo mudaria a natureza da coisa.
- **Resolver conflito item a item.** A checagem do **S3** é do arquivo inteiro.
  Fusão fina por tarefa é outro projeto.
- **Histórico de versões no Drive.** O Google guarda revisões; expor isso no app
  é recurso, não ajuste.
- **Mudar o comportamento do botão "Sincronização" atual**, que continua abrindo
  as configurações.

---

## Riscos, nomeados

| Risco | Onde | Mitigação |
|---|---|---|
| Laço do S1 não terminar | S1 | a marca é zerada no topo de cada volta; rajada de N dá 2 voltas |
| Conflito falso por relógio torto | S3 | o carimbo é o `modifiedTime` do Drive, nunca `Date.now()` |
| Upload cego apagar dado de outro aparelho | S3 | checagem antes, com saída de cancelar |
| `alert()` em série no automático | S5 | `alert()` só no manual |
| Barra superior apertada no mobile | S4 | botão só no modo Drive, e só ícone abaixo de 480px |
| Dublê provar algo que o Drive real não faz | verificação | declarado; o caminho real fica devendo |
