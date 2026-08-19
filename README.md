<p align="center">
  <img src="assets/trademark.svg" alt="Daysk Logo" width="320" />
</p>

<p align="center">
  <strong>Gerenciador Inteligente e Minimalista de Tarefas Diárias & Controle de Tempo</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Em_Desenvolvimento-blue?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Tecnologias-HTML5_|_CSS3_|_JS-394149?style=for-the-badge" alt="Tecnologias">
  <img src="https://img.shields.io/badge/Tema-Light_&_Dark-15181B?style=for-the-badge" alt="Tema">
</p>

<p align="center">
  🌐 <strong>Acesse a aplicação online: <a href="https://mariogomesbarbosa.github.io/Daysk/">Daysk</a></strong>
</p>

---

## 📌 Sobre o Daysk

O **Daysk** é uma aplicação web minimalista e elegante voltada para o acompanhamento produtivo de tarefas diárias, planejamento de tempo e organização de projetos. Projetado com uma interface focada em UX/UI de alta performance, o Daysk oferece uma experiência fluida, sem distrações, ideal para profissionais, equipes de design e desenvolvedores.

Você pode utilizar o produto diretamente pelo navegador em [Daysk](https://mariogomesbarbosa.github.io/Daysk/).

---

## 📸 Captura de Tela

<p align="center">
  <img src="assets/preview.png" alt="Daysk Interface" width="100%" />
</p>

---

## ✨ Funcionalidades Principais

- 📅 **Contextos Temporais (Hoje, Amanhã e Fazer Depois)**: Organização inteligente em 3 cenários de tempo. Crie tarefas para o dia atual, planeje para o dia seguinte ou guarde ideias no "Fazer depois" para agendar rapidamente quando quiser.
- ⏱️ **Controle de Tempo em Tempo Real**: Inicie, pause e acompanhe a duração de execução de cada tarefa com um cronômetro integrado.
- 📂 **Organização por Projetos**: Categorize suas tarefas em diferentes projetos utilizando marcas de cor personalizadas.
- 📊 **Dashboard de Produtividade**: Visualize dados em tempo real sobre total de tarefas planejadas, horas alocadas, progresso diário, curva de desempenho e gráficos por projeto.
- 🌓 **Suporte a Temas (Light & Dark)**: Alternância suave entre temas claro e escuro.
- 💾 **Persistência de Dados & Sincronização**: Armazenamento e sincronização local ou via arquivos JSON (`projects.json` e `tasks.json`) em uma pasta do seu computador ou Google Drive.
- 📱 **Design Responsivo & Acessível**: Tipografia otimizada (Inter e JetBrains Mono) e layout fluido para qualquer tela.

---

## 🛠️ Tecnologias Utilizadas

- **Estrutura**: HTML5 Semântico
- **Estilização**: Vanilla CSS (Variáveis CSS, CSS Grid, Flexbox e Animações)
- **Lógica & Interatividade**: JavaScript Vanilla (ES6+)
- **Fontes**: [Inter](https://fonts.google.com/specimen/Inter) & [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
- **Branding**: SVG Vetorial Nativo

---

## 🌐 Acesso Online & Como Executar

### 🚀 Acesso Online Direto
Você pode acessar e usar o produto online em [Daysk](https://mariogomesbarbosa.github.io/Daysk/).

### 💻 Executar Localmente
Como o Daysk foi construído de forma leve e direta com tecnologias web nativas, você também pode executá-lo localmente:

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/mariogomesbarbosa/Daysk.git
   cd Daysk
   ```

2. **Abrir a Aplicação**:
   - Basta dar um duplo clique no arquivo `index.html` para abrir diretamente no seu navegador.
   - *Ou*, para utilizar uma extensão como **Live Server** no VS Code ou um servidor local estático:
     ```bash
     npx serve .
     ```

---

## 📱 Instalar como App

O Daysk é um **PWA**: dá para instalar no celular ou no desktop e usar como um
app de verdade — ícone próprio, tela cheia sem a barra do navegador, e
**funcionando sem internet**.

### Android (Chrome)

1. Abra [Daysk](https://mariogomesbarbosa.github.io/Daysk/) no Chrome.
2. Menu **⋮** → **Instalar app**.
3. O ícone aparece na tela inicial e abre como aplicativo.

> Se você já tinha um atalho antigo na tela inicial e ele não abria, **apague-o
> antes**. Aquele era um atalho de favorito, não um app, e não se converte
> sozinho.

### iOS (Safari)

Compartilhar → **Adicionar à Tela de Início**.

### Desktop (Chrome/Edge)

Ícone de instalar na barra de endereço, ou menu → **Instalar Daysk**.

### Offline

Depois da primeira visita, o app abre sem conexão. Os dados já eram locais; o
que faltava era o app carregar. Abrindo **com** internet você sempre recebe a
versão mais recente — o service worker tenta a rede primeiro e só usa o cache
como rede de segurança.

---

## 📁 Estrutura de Arquivos

```text
Daysk/
├── assets/
│   ├── icons/               # Ícones PNG do app instalável (192, 512, maskable, iOS)
│   ├── preview.png          # Captura de tela da aplicação
│   └── trademark.svg        # Logotipo oficial
├── docs/                    # Documentação de trabalho: decisões e pendências
├── tests/
│   └── funcoes-puras.mjs    # Harness das funções puras (node tests/funcoes-puras.mjs)
├── .gitignore               # Configuração de arquivos ignorados no Git
├── index.html               # Aplicação web completa (UI + Lógica + Estilos)
├── manifest.webmanifest     # Web App Manifest — é o que torna o app instalável
├── sw.js                    # Service worker: instalação e funcionamento offline
└── README.md                # Documentação do projeto
```

---

## 👤 Autor

Desenvolvido por **Mário Gomes Barbosa**  
GitHub: [@mariogomesbarbosa](https://github.com/mariogomesbarbosa)
