<h1>Genius Web — Jogo da Memória com Cores e Sons</h1>

<p align="center">
  <img src="http://img.shields.io/static/v1?label=HTML5&message=Sem%C3%A2ntico&color=E34F26&style=for-the-badge&logo=html5"/>
  <img src="http://img.shields.io/static/v1?label=CSS3&message=Responsivo&color=1572B6&style=for-the-badge&logo=css3"/>
  <img src="http://img.shields.io/static/v1?label=JavaScript&message=ES2017&color=F7DF1E&style=for-the-badge&logo=javascript"/>
  <img src="http://img.shields.io/static/v1?label=Node.js&message=18%2B&color=339933&style=for-the-badge&logo=node.js"/>
  <img src="http://img.shields.io/static/v1?label=Playwright&message=E2E&color=2EAD33&style=for-the-badge&logo=playwright"/>
  <img src="http://img.shields.io/static/v1?label=GitHub&message=Pages&color=181717&style=for-the-badge&logo=github"/>
  <img src="http://img.shields.io/static/v1?label=STATUS&message=EM%20FINALIZA%C3%87%C3%83O&color=yellow&style=for-the-badge"/>
</p>

> Status do Projeto: :heavy_check_mark: (concluído) | :warning: (em desenvolvimento) | :x: (não iniciado)

| Etapa | Status |
| --- | :---: |
| Jogo web responsivo e acessível | :heavy_check_mark: |
| Testes automatizados (unitários e de interface) | :heavy_check_mark: |
| Documentação do projeto (modelo UNICAP) | :heavy_check_mark: |
| Publicação no GitHub Pages | :warning: |
| Testes em celular real e com leitor de tela | :warning: |

---

# Tópicos

:small_blue_diamond: [Contexto](#contexto-information_source)

:small_blue_diamond: [Problema](#problema-writing_hand)

:small_blue_diamond: [Objetivo](#objetivo-dart)

:small_blue_diamond: [Funcionalidades](#funcionalidades-video_game)

:small_blue_diamond: [Como Jogar](#como-jogar-joystick)

:small_blue_diamond: [Estrutura do Projeto](#estrutura-do-projeto-file_folder)

:small_blue_diamond: [Pré-requisitos](#pré-requisitos-warning)

:small_blue_diamond: [Instalação](#instalação-rocket)

:small_blue_diamond: [Como Rodar o Projeto](#como-rodar-o-projeto-computer)

:small_blue_diamond: [Testes](#testes-white_check_mark)

:small_blue_diamond: [Publicação no GitHub Pages](#publicação-no-github-pages-globe_with_meridians)

:small_blue_diamond: [Tecnologias Utilizadas](#tecnologias-utilizadas-wrench)

:small_blue_diamond: [Documentação](#documentação-book)

:small_blue_diamond: [Desenvolvedores](#desenvolvedores-octocat)

---

# Contexto :information_source:

<p align="justify">
O projeto foi desenvolvido para a disciplina de <strong>Design de Interface e Usabilidade</strong> da <strong>Universidade Católica de Pernambuco (UNICAP)</strong>, sob orientação do <strong>Prof. Emmanuel Barreto</strong>, em 2026. O trabalho consiste em criar uma interface web responsiva para o <strong>Genius</strong> (Simon), o clássico jogo de memória sequencial com quatro cores e sons.
</p>

<p align="justify">
A interface deve funcionar no navegador de desktops, notebooks, tablets e celulares, com mouse, teclado e toque, seguir boas práticas de usabilidade e acessibilidade e atender ao padrão IEEE 830 e às heurísticas de Nielsen. A aplicação deve ficar disponível em um link público.
</p>

---

# Problema :writing_hand:

<p align="justify">
As versões web comuns do Genius funcionam bem apenas no computador. No celular, o layout quebra ou exige rolagem, o toque responde com atraso de 300 ms e o som atrasa ou não toca no iOS. Além disso, costumam ser jogáveis só por quem enxerga bem as cores e usa mouse.
</p>

Os principais pontos a resolver:

- Tabuleiro que se adapte de telas de **360 px** a **1920 px** ou mais, sem rolagem horizontal;
- Resposta imediata ao toque e ao clique, sem disparo duplo;
- Identificação dos botões **sem depender da cor** (pessoas com daltonismo);
- Jogo completo **só pelo teclado** e compatível com **leitor de tela**;
- Nada de piscar mais de **3 vezes por segundo** (segurança para pessoas fotossensíveis).

---

# Objetivo :dart:

<p align="justify">
O objetivo é entregar um Genius que todos na sala consigam jogar juntos: <strong>multiplayer local de 1 a 4 jogadores</strong> no mesmo aparelho, com acessibilidade completa e sem abrir mão do visual do aparelho clássico.
</p>

<p align="justify">
A lógica do jogo fica separada da interface, em funções puras cobertas por testes automatizados, seguindo o ciclo <strong>TDD</strong> (Red → Green → Refactor). Assim, as regras podem ser verificadas no Node.js sem abrir o navegador.
</p>

---

# Funcionalidades :video_game:

- **Som** gerado pela Web Audio API, nas frequências do Genius original, com chave para ligar e desligar;
- **4 níveis**, iguais à chave *Skill* do Genius original: Fácil 8 · Médio 14 · Difícil 20 · Expert 31 cores para vencer;
- **Aceleração** nas rodadas 5, 9 e 13;
- **Multiplayer local** de 1 a 4 jogadores em turnos: quem erra sai e o último que sobrar vence;
- **Recorde por nível** salvo no navegador (`localStorage`);
- **Pausa** pelo botão, pelas teclas `P` ou `Esc`, ou automaticamente ao trocar de aba;
- **Explicação do erro**: o jogo mostra qual era a cor certa;
- **Acessibilidade**: números 1–4 nos botões, teclado, leitor de tela, modo "Narrar cores" e sem limite de tempo para responder.

---

# Como Jogar :joystick:

1. Toque em **Iniciar** (ou aperte `Enter`).
2. Observe as cores que acendem.
3. Repita a sequência. A cada acerto, uma cor nova entra na sequência.

| Botão | Teclas | Posição |
| --- | --- | --- |
| Verde (1) | `1` ou `Q` | superior esquerdo |
| Vermelho (2) | `2` ou `W` | superior direito |
| Amarelo (3) | `3` ou `A` | inferior esquerdo |
| Azul (4) | `4` ou `S` | inferior direito |

> `P` ou `Esc` pausam e `M` liga/desliga o som. Também dá para usar `Tab` e `Enter`/`Espaço`.

---

# Estrutura do Projeto :file_folder:

```text
projeto_multiplayer-genius_web/
│
├── index.html                    # estrutura semântica + tabuleiro SVG acessível
│
├── css/
│   └── style.css                 # layout mobile-first, media queries, alto contraste
│
├── js/
│   ├── genius-core.js            # regras do jogo: funções puras, testáveis no Node
│   └── genius-ui.js              # DOM, Web Audio, toque/mouse/teclado, pausa, recorde
│
├── tests/
│   ├── genius-core.test.js       # testes unitários (node:test)
│   └── e2e/
│       └── responsivo.cjs        # testes de interface em 6 tamanhos de tela (Playwright)
│
├── docs/
│   ├── DOCUMENTO-PROJETO.md      # documento do projeto em Markdown (modelo UNICAP)
│   ├── DOCUMENTO-PROJETO.docx    # documento do projeto em Word (modelo UNICAP)
│   ├── fluxograma.png            # fluxograma de funcionamento
│   ├── diagrama-telas.png        # diagrama de telas
│   └── capturas/                 # capturas geradas pelos testes
│
├── assets/
│   └── tabuleiro-genius.svg      # arte original do tabuleiro
│
├── .github/workflows/testes.yml  # roda os testes a cada push
├── package.json
├── .gitignore
└── README.md
```

---

# Pré-requisitos :warning:

Para **jogar**, basta um navegador moderno (Chrome, Edge, Firefox ou Safari).

Para **clonar o repositório e rodar os testes**, é necessário ter instalado:

**1. Git:**
  - Caso não tenha Git, instale: https://git-scm.com/install/

**2. Node.js 18 ou superior:**
  - Caso não tenha Node.js, instale: https://nodejs.org/

**3. VS Code (ou outro editor de código):**
  - Caso não tenha VS Code, instale: https://code.visualstudio.com/download

---

# Instalação :rocket:

### 1️⃣ Clonar o repositório

```bash
git clone https://github.com/guilarre/projeto_multiplayer-genius_web.git
```

---

### 2️⃣ Entrar na pasta do projeto

```bash
cd projeto_multiplayer-genius_web
```

---

### 3️⃣ Instalar as dependências de teste (opcional)

O jogo não tem dependências. Este passo só é necessário para os testes de interface:

```bash
npm install
npx playwright install chromium
```

---

# Como Rodar o Projeto :computer:

A forma mais simples é abrir o arquivo `index.html` direto no navegador.

Para rodar com um servidor local (recomendado para testar no celular pela rede):

```bash
npx serve .
```

ou, com Python:

```bash
python -m http.server 8000
```

Depois, abra no navegador:

```text
http://localhost:8000
```

---

# Testes :white_check_mark:

```bash
npm test            # testes unitários (só precisa do Node 18+)
npm run test:e2e    # responsividade, toque, teclado, recorde e multiplayer
```

- **Testes unitários:** 12 testes da lógica do jogo (sequência, validação, multiplayer, velocidade, recorde);
- **Testes de interface:** 24 verificações em 8 tamanhos de tela, de **360×800** a **1920×1080**, incluindo Windows com zoom de 125% e 150%;
- **Integração contínua:** os testes unitários rodam a cada push pelo GitHub Actions.

---

# Publicação no GitHub Pages :globe_with_meridians:

1. Envie a branch para o GitHub e faça o merge na `main`.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Escolha a branch `main` e a pasta `/ (root)` e clique em **Save**.
4. Em 1 a 2 minutos o jogo estará em:

```text
https://guilarre.github.io/projeto_multiplayer-genius_web/
```

> O site é 100% estático, então também funciona na Vercel ou na Netlify sem nenhuma configuração.

---

# Tecnologias Utilizadas :wrench:

- **HTML5**
- **CSS3** (Grid, Flexbox, media queries)
- **JavaScript** (sem frameworks)
- **SVG**
- **Web Audio API**
- **Node.js** (`node:test`)
- **Playwright**
- **GitHub Actions**
- **GitHub Pages**
- **Git**

> O jogo não usa bibliotecas externas: funciona direto no navegador, sem instalação e sem etapa de build.

---

# Documentação :book:

A especificação completa do projeto está disponível em dois formatos:

- :page_facing_up: [DOCUMENTO-PROJETO.md](docs/DOCUMENTO-PROJETO.md) — versão em Markdown, para ler direto no GitHub
- :blue_book: [DOCUMENTO-PROJETO.docx](docs/DOCUMENTO-PROJETO.docx) — versão em Word, para baixar, imprimir ou entregar

O documento apresenta:

- Apresentação da instituição, da equipe e do escopo
- Contexto, problema e proposta de solução (Quests 1 a 3)
- Requisitos funcionais, não-funcionais e técnicos no padrão IEEE 830
- Matriz de testes TDD
- Avaliação pelas heurísticas de Nielsen e pela WCAG 2.2
- Fluxograma de funcionamento e diagrama de telas
- Código-fonte comentado
- Cronograma e referências bibliográficas

---

# Desenvolvedores :octocat:

Time responsável pelo desenvolvimento do projeto.

| [<img src="https://github.com/USUARIO-ADRIANO.png" width="115"><br><sub>Adriano Araújo</sub>](https://github.com/USUARIO-ADRIANO) | [<img src="https://github.com/guilarre.png" width="115"><br><sub>Guilherme Larré</sub>](https://github.com/guilarre) | [<img src="https://github.com/francisLauriano.png" width="115"><br><sub>Francis Lauriano</sub>](https://github.com/francisLauriano) |
| :---: | :---: | :---: |

---
