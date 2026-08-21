# "Sessão do Google expirada" a cada envio

O relato: toda tentativa de enviar para o Drive termina em *"Sessão do Google
expirada. Reconecte a conta."*

Números de linha envelhecem — este documento cita nomes de função.

---

## O diagnóstico: três causas encadeadas

### C1 — O `expires_in` é jogado fora

`connectGoogleDrive()` usa `google.accounts.oauth2.initTokenClient`, que é o
**fluxo implícito**: ele devolve um `access_token` com validade de **uma hora** e
**não existe refresh token no navegador** — é assim por desenho, não é
configuração faltando.

A resposta traz `expires_in`. **O arquivo não menciona esse campo em lugar
nenhum** — conferido por busca. O que acontece é:

```js
gdriveAccessToken = response.access_token;
localStorage.setItem('daysk-gdrive-token', gdriveAccessToken);
```

O token é guardado e reusado para sempre. Depois de uma hora ele está morto, e
toda requisição responde 401.

### C2 — "Conectado" é inferido da existência do token, não da validade

A mesma condição aparece em **dois** lugares:

```js
if (gdriveAccessToken && gdriveFolderId) gdriveStatus = 'connected';
```

Uma em `initSync()`, no carregamento. A outra dentro de `updateSyncUI()` — que
roda a cada atualização de interface.

E é aí que está o golpe. Em `gdriveFetch`, ao receber 401:

```js
gdriveStatus = 'needs-auth';
updateSyncUI();        // ← e updateSyncUI põe de volta 'connected'
throw new Error('Sessão do Google expirada. Reconecte a conta.');
```

**A chamada que existe para oferecer "reconectar" se desfaz no mesmo instante.**

A captura do relato é a prova: o cartão mostra *enviar agora*, *desconectar* e
*alterar pasta* — os botões do estado **conectado** — e nunca "reconectar Google
Drive", que é o que `updateSyncUI()` exibiria se o estado `needs-auth`
sobrevivesse. **Não há caminho de saída na tela.**

E mesmo se sobrevivesse, o `initSync()` do próximo carregamento reafirmaria
`connected` sobre o token morto.

### C3 — Não há renovação, embora a chamada já exista

A ironia: `requestAccessToken({ prompt: '' })` — exatamente a renovação sem
interação — **já está no arquivo**, na última linha de `connectGoogleDrive()`.
Ela só é alcançada quando o usuário clica em conectar, o que o **C2** impede de
acontecer.

### Por que "toda vez"

As três se somam: o token morre em uma hora (**C1**), a tela continua dizendo que
está tudo bem e não oferece saída (**C2**), e nada renova sozinho (**C3**). A
partir da primeira hora de uso, **todo** envio falha — automático e manual — e o
único conserto é desconectar e conectar de novo, que não é óbvio.

### Um detalhe cosmético, do PR #32

A mensagem sai com ponto duplo: `'Falha ao enviar: ' + envioErro + '.'`, e
`envioErro` já termina em ponto. Visível na captura: *"Reconecte a conta.. Os
dados seguem salvos"*.

---

## Decisões

### R1 — Guardar a validade junto do token

`expires_in` vira um instante absoluto, persistido ao lado do token:

```js
gdriveTokenExpiraEm = Date.now() + (response.expires_in - 60) * 1000;
```

**Menos 60 segundos de margem**, porque a requisição leva tempo e um token que
expira no meio dela produz exatamente o 401 que se quer evitar.

Fica em `localStorage`, ao lado do token: recarregar a página dentro da hora
continua funcionando sem reconectar. A exposição não muda em relação a hoje —
é um token de escopo `drive.file` com uma hora de vida, e guardar a validade não
acrescenta risco nenhum.

### R2 — O estado deixa de ser inferido do token

As duas linhas de `if (gdriveAccessToken && gdriveFolderId) gdriveStatus = 'connected'`
saem. Estado é **estado**, não derivação — e derivar de "existe uma string"
sempre ia mentir.

No lugar, uma função que responde a pergunta certa:

```js
function tokenValido() {
  return !!gdriveAccessToken && !!gdriveTokenExpiraEm && Date.now() < gdriveTokenExpiraEm;
}
```

`initSync()` passa a marcar `connected` só quando o token é válido, e
`needs-auth` quando existe token mas ele venceu — que é a informação útil: **a
conta está configurada, só falta renovar.**

E `updateSyncUI()` deixa de escrever em `gdriveStatus` por completo. Uma função
de desenhar interface que altera estado de domínio é a origem do **C2**.

### R3 — Renovação silenciosa, e uma repetição só

`gdriveFetch` ganha o caminho que faltava:

1. Antes de sair, se o token estiver vencido pelo **R1**, renova.
2. Se mesmo assim vier 401, renova **uma vez** e repete a requisição.
3. Se a repetição falhar de novo, aí sim é `needs-auth`.

**Uma repetição, e não um laço.** Se a renovação devolveu um token que também é
recusado, o problema não é validade — é permissão revogada, escopo mudado ou
conta trocada, e insistir só transforma um erro claro numa espera.

A renovação embrulha o GIS num `Promise`, porque `requestAccessToken` responde
por callback:

```js
function renovarToken() {
  return new Promise((ok, erro) => { … requestAccessToken({ prompt: '' }) … });
}
```

Com **duas guardas** que o embrulho ingênuo esquece:

- **Uma renovação por vez.** Vários `save()` em rajada disparariam várias
  renovações concorrentes. A promessa em voo é reusada — mesma lição do
  `gdrivePendente` do PR #31.
- **Tempo limite.** Se o GIS nunca chamar o callback — popup bloqueado, biblioteca
  meio carregada — a promessa fica pendurada para sempre, e com ela o `save()`.
  Um teto de ~20s transforma isso em erro visível.

O cliente de token precisa existir sem passar pelo fluxo de conexão inteiro
(que monta pasta e faz pergunta de fusão). Então `initTokenClient` sai de dentro
de `connectGoogleDrive()` para um `garantirTokenClient()` que os dois usam.

### R4 — Falhou a renovação: avisa e para de tentar

Estado `needs-auth`, botão virando **"reconectar Google Drive"** — que já existe
em `updateSyncUI()` e hoje é inalcançável — e o **automático para de bater no
Google** até haver token válido de novo.

Parar importa: sem isso, cada `save()` vira uma tentativa de renovação que
falha, e o app fica martelando o Google em segundo plano por um erro que só o
usuário resolve.

**Os dados continuam salvos no navegador.** A mensagem tem de dizer isso — o medo
real de quem vê "falha ao sincronizar" é ter perdido trabalho.

### R5 — Reconectar não pode fazer a pergunta de fusão de novo

`connectGoogleDrive()` hoje lê o Drive e, se houver dados, pergunta *"usar os
dados do Google Drive, substituindo os locais?"*. Isso faz sentido ao **conectar
pela primeira vez** e é hostil ao **renovar uma sessão**: o usuário só queria
voltar a enviar, e recebe uma pergunta que pode apagar o trabalho da última hora.

Então o fluxo de reconexão pula a fusão quando já há pasta configurada e o que
mudou foi só o token.

### R6 — O ponto duplo

`envioErro` já termina em pontuação. A concatenação para de acrescentar a sua.

---

## Casos de borda

| Caso | Esperado |
|---|---|
| Token válido | nada muda; nenhuma renovação |
| Token vencido pelo relógio, antes de enviar | renova, envia, sem o usuário ver |
| Token ainda válido mas 401 (revogado por fora) | renova uma vez, repete, e só então `needs-auth` |
| Renovação recusada (deslogado do Google) | `needs-auth`, botão "reconectar", automático para |
| Rajada de saves com o token vencido | **uma** renovação, não uma por save |
| GIS não responde | tempo limite vira erro visível, sem `save()` pendurado |
| Recarregar dentro da hora | `connected`, sem reconectar |
| Recarregar depois da hora | `needs-auth` de cara — e não `connected` mentindo |
| Reconectar com pasta já configurada | **não** pergunta sobre fusão (**R5**) |
| Conectar pela primeira vez | pergunta, como hoje |
| `desconectar` | limpa token **e** validade |
| Modo cache ou pasta | nada disto roda |

---

## Pontos de edição

| O quê | Onde |
|---|---|
| guardar `expires_in` como instante absoluto | callback de `initTokenClient` |
| `tokenValido()` | ao lado de `gdriveFetch` |
| tirar a inferência de estado | `initSync()` e `updateSyncUI()` |
| renovar + repetir uma vez | `gdriveFetch` |
| `garantirTokenClient()` e `renovarToken()` | extraídos de `connectGoogleDrive()` |
| parar o automático sem token | `writeToGoogleDrive()` |
| pular a fusão ao reconectar | `connectGoogleDrive()` |
| limpar a validade | `disconnectGoogleDrive()` |
| ponto duplo | `updateSyncUI()` |

---

## Ordem de implementação

**Um PR só.** As três causas são um mecanismo, não três bugs independentes:
corrigir a validade sem corrigir o estado deixa a tela mentindo, e corrigir o
estado sem renovar entrega um "reconecte de hora em hora" que ninguém quer.

O commit separa os assuntos em parágrafos; o PR entrega o caminho inteiro
funcionando.

---

## Verificação

**Lógica pura, no Node** (`tests/funcoes-puras.mjs`, hoje com 133 casos):
`tokenValido()` — token ausente, validade ausente, vencido, vencendo dentro da
margem, e válido.

**No navegador, com o GIS falsificado.** É o ponto a dizer com todas as letras:
**o fluxo real do Google não se automatiza daqui** — exige OAuth interativo. Um
dublê de `google.accounts.oauth2.initTokenClient` devolve tokens e erros
controlados, o que exercita:

- token vencido antes de enviar → **uma** renovação e o envio conclui
- 401 com token "válido" → renova, **repete uma vez**, conclui
- 401 depois da repetição → `needs-auth`, sem terceira tentativa
- renovação recusada → `needs-auth`, botão vira "reconectar", automático para de
  chamar o Google
- rajada de 5 saves com token vencido → **uma** renovação, não cinco
- GIS mudo → tempo limite dispara, erro visível, nada pendurado
- recarregar com token vencido no `localStorage` → `needs-auth`, e **não**
  `connected`
- reconectar com pasta configurada → **zero** `confirm()` de fusão

**A regressão que importa medir:** que `updateSyncUI()` **não escreve mais** em
`gdriveStatus`. É a causa do C2, e o teste é direto — pôr `needs-auth`, chamar
`updateSyncUI()`, e conferir que continua `needs-auth`.

**O que fica devendo:** o caminho real contra o Google — token de verdade
expirando, consentimento revogado no painel da conta, popup bloqueado pelo
navegador. Mesma dívida que `docs/instalacao-android.md` e
`docs/enviar-agora-e-o-descarte-silencioso.md` já registram.

---

## Fora de escopo

- **Trocar o fluxo de OAuth.** Refresh token exigiria um servidor para guardar o
  *client secret*, e o app é estático publicado por GitHub Pages. O fluxo
  implícito com renovação silenciosa é o que o navegador oferece.
- **Tirar o token do `localStorage`.** Decidido manter: recarregar dentro da hora
  continua funcionando, e a exposição é a de hoje.
- **Fila de gravações para subir depois** que a conexão voltar. Hoje o próximo
  `save()` sobe o estado inteiro, então nada se perde — só atrasa.
- **Avisar antes de expirar**, com contagem regressiva. A renovação silenciosa
  torna isso invisível na maioria dos casos.

---

## Riscos, nomeados

| Risco | Onde | Mitigação |
|---|---|---|
| Renovações concorrentes numa rajada | R3 | promessa em voo reusada |
| Promessa do GIS pendurada para sempre | R3 | tempo limite de ~20s |
| Laço de renovação em token recusado | R3 | uma repetição, nunca duas |
| Martelar o Google com a conta desconectada | R4 | o automático para em `needs-auth` |
| Reconectar apagar o trabalho da última hora | R5 | pular a fusão quando só o token mudou |
| Dublê provar algo que o Google real não faz | verificação | declarado; o caminho real fica devendo |
