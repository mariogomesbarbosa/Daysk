# Instalar como app no Android

Registro do que estava errado, do que foi feito e do que ficou em aberto.

## O sintoma, e a causa

O relato: no Chrome do Android o site funciona; "adicionar à tela inicial" cria
o ícone; tocar no ícone **não abre nada**.

A causa é direta. Antes disto o repositório **não tinha manifest nem service
worker** — só um favicon SVG embutido como `data:` URI. Sem manifest, o Chrome
não instala um app de verdade: ele cria um **atalho de favorito** legado, do
tipo que depende de o launcher resolver um intent do Chrome. É exatamente esse
atalho que falha em silêncio em várias combinações de launcher e versão de
Android.

Com manifest e service worker no lugar, o Chrome monta um **WebAPK** — um pacote
de app real, com ícone próprio, entrada no alternador de tarefas e janela sem a
barra do navegador.

## O que isto custou à arquitetura

O `docs/README.md` dizia, e com razão, que **tudo vive num único `index.html`**,
e que isso é deliberado. Instalar como app rompe essa regra, e não havia
alternativa:

- **O service worker precisa ser um arquivo próprio, de mesma origem.** Não
  existe forma de embuti-lo. É uma restrição da plataforma, não uma escolha.
- **O Chrome no Android não monta WebAPK a partir de manifest em `data:` URI.**
- **O Chrome não aceita ícone SVG** para instalação: exige PNG de 192 e 512.

O que **foi** preservado, que é o que a decisão realmente protegia:

- **Nenhuma etapa de build.** Continua sendo arquivo estático publicado direto
  pelo GitHub Pages.
- **Nenhuma dependência instalada.**
- **O duplo clique no `index.html` continua funcionando.** O registro do service
  worker é protegido por `location.protocol.startsWith('http')`, porque em
  `file://` não há origem segura e `register()` rejeitaria — sujando o console
  de um fluxo que precisa continuar limpo.

## Arquivos novos

| Arquivo | Para quê |
|---|---|
| `manifest.webmanifest` | Nome, ícones, `display: standalone`, cores. É o que transforma atalho em app. |
| `sw.js` | Service worker. Critério de instalação **e** o que faz abrir sem rede. |
| `assets/icons/icon-192.png` | Exigido pelo Chrome. |
| `assets/icons/icon-512.png` | Exigido pelo Chrome; vira a splash screen. |
| `assets/icons/icon-maskable-512.png` | Ícone adaptativo do Android. |
| `assets/icons/apple-touch-icon.png` | 180px, para o iOS. |

Os quatro PNG somam 40KB e foram gerados a partir do mesmo SVG do favicon,
rasterizados no navegador — sem acrescentar ferramenta ao projeto.

### Por que um ícone "maskable" separado

O Android recorta o ícone na forma que o launcher usar (círculo, squircle,
gota). O recorte respeita uma **zona segura**: o círculo central de 80%. Um
ícone comum, com o desenho indo até a borda, é cortado.

A marca do Daysk ocupa 28 de 50 unidades, centrada — diagonal de 39.6 num
círculo seguro de 40. **Cabe raspando.** O ícone maskable a reduz para 85% (
diagonal ~33.7) e usa fundo sangrado, sem cantos arredondados, porque quem
arredonda é a máscara.

## Estratégia de cache, e o porquê

Escolhida com o trade-off na mesa: **offline completo, rede primeiro**.

- **Documento — rede primeiro, cache como rede de segurança.** Todo o app é um
  `index.html`. Cache-primeiro no documento significaria continuar vendo a
  versão velha depois de um deploy — o problema clássico de PWA. Rede primeiro
  custa alguns milissegundos e paga com "abrir online é sempre a versão nova".
- **Ícones, fontes e Chart.js — cache com revalidação em segundo plano.** São
  imutáveis na prática, e é onde está o peso.
- **Autenticação e API do Google — nunca passam pelo service worker.** Cachear
  resposta de OAuth é pedir para o login quebrar de um jeito difícil de
  diagnosticar.

O precache usa `Promise.allSettled`, e não `all`, de propósito: um único 404
faria a instalação inteira falhar, e **sem service worker não há instalação do
app**. Uma CDN fora do ar no momento errado não pode custar isso.

## A cor da barra de status

Três `<meta name="theme-color">`. Duas no `<head>`, com `media`, seguem o
sistema. A terceira é criada e atualizada por `sincronizarCorDaBarra()` quando o
usuário escolhe um tema no app — sem ela, o toggle do app e a barra de status
discordariam, porque as duas primeiras só sabem do sistema.

## Verificado

Servindo por HTTP em `127.0.0.1`, que é contexto seguro:

- Service worker registrado e `active`, escopo na raiz.
- Manifest com `name`, `short_name`, `display: standalone`, `start_url` e
  `scope` resolvendo certo; os três ícones respondendo 200 com `image/png`.
- Cache com 8 itens depois da segunda carga: o shell, o manifest, os três
  ícones, o Chart.js e a fonte. **Nada de `accounts.google` ou `apis.google`.**
- **O teste que importa:** servidor derrubado, página recarregada. O app abriu
  inteiro, com a fonte, o Chart.js disponível, e foi possível criar uma
  atividade (15:00–16:30, gravando `dur: 90`) e vê-la no Calendário. Confirmado
  que a rede estava mesmo fora por um `fetch` com `cache: 'no-store'`.

## Em aberto

**Instalação num Android real nunca foi exercitada.** Toda a verificação
aconteceu no Chrome de desktop, onde os critérios de instalação são os mesmos e
`beforeinstallprompt` usa a mesma lógica — mas o WebAPK em si é montado por um
serviço do Google a partir do manifest, e isso não tem como ser testado daqui.

**A sincronização com o Google Drive em modo `standalone` é um risco não
medido.** O fluxo do Google Identity Services abre popup; numa janela de WebAPK
o popup vira Custom Tab, e o retorno para a janela de origem nem sempre
funciona. Se quebrar, o caminho é trocar o fluxo de popup por redirect. Os
outros dois modos de sincronização (cache do navegador e pasta local) não
dependem disso.

**Antes de reinstalar, apague o atalho velho.** O ícone quebrado que já está na
tela inicial não vira WebAPK sozinho — é outro tipo de objeto. Apague, abra o
site no Chrome, e use "Instalar app" (não "Adicionar à tela inicial", embora as
duas passem a levar ao mesmo lugar depois do manifest).
