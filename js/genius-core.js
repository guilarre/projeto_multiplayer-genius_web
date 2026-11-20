/* ============================================================================
 * GENIUS WEB — NÚCLEO DE LÓGICA (genius-core.js)
 * ----------------------------------------------------------------------------
 * Este arquivo contém SOMENTE regras do jogo, sem tocar no DOM, no áudio ou
 * em temporizadores. Por isso pode ser executado tanto no navegador quanto
 * no Node.js, onde é coberto pelos testes automatizados (tests/*.test.js).
 *
 * Princípio adotado: funções puras. Cada função recebe um "estado" e devolve
 * um NOVO estado (nunca altera o objeto recebido). Isso facilita o TDD: dado
 * um estado de entrada, o teste confere exatamente o estado de saída.
 *
 * Máquina de estados (campo `fase`):
 *   OCIOSO ──iniciarPartida──► EXIBINDO ──concluirExibicao──► ENTRADA
 *   ENTRADA ──acerto parcial──► ENTRADA
 *   ENTRADA ──sequência completa──► EXIBINDO (nova cor; próximo jogador)
 *   ENTRADA ──sequência no tamanho‑alvo──► VITORIA
 *   ENTRADA ──erro (1 jogador ou só resta 1)──► GAME_OVER
 *   ENTRADA ──erro (multiplayer, restam ≥2)──► EXIBINDO (mesma sequência)
 * ==========================================================================*/
(function (raiz, fabrica) {
  // Padrão UMD: exporta via module.exports no Node e via window no navegador
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.GeniusCore = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONSTANTES DE CONFIGURAÇÃO
  // --------------------------------------------------------------------------

  /** Índices fixos das cores. A ordem segue o tabuleiro (sentido horário). */
  const CORES = Object.freeze(['verde', 'vermelho', 'amarelo', 'azul']);

  /** Nomes legíveis usados em mensagens e leitores de tela. */
  const NOMES_CORES = Object.freeze(['Verde', 'Vermelho', 'Amarelo', 'Azul']);

  /**
   * Níveis inspirados na chave "Skill" do Genius original (8, 14, 20 e 31
   * sinais). `aceso`/`apagado` são os tempos (ms) de cada piscada no início.
   */
  const NIVEIS = Object.freeze({
    1: Object.freeze({ nome: 'Fácil', alvo: 8, aceso: 700, apagado: 300 }),
    2: Object.freeze({ nome: 'Médio', alvo: 14, aceso: 550, apagado: 250 }),
    3: Object.freeze({ nome: 'Difícil', alvo: 20, aceso: 420, apagado: 200 }),
    4: Object.freeze({ nome: 'Expert', alvo: 31, aceso: 350, apagado: 150 })
  });

  /**
   * Limites mínimos de tempo. Um ciclo aceso+apagado nunca fica abaixo de
   * 350 ms, ou seja, no máximo ~2,9 piscadas por segundo — abaixo do limite
   * de 3 flashes/s da WCAG 2.3.1 (proteção contra crises fotossensíveis).
   */
  const TEMPO_MIN_ACESO = 250;
  const TEMPO_MIN_APAGADO = 100;

  /** Rodadas a partir das quais a velocidade aumenta (como no original). */
  const MARCOS_ACELERACAO = Object.freeze([5, 9, 13]);

  const MAX_JOGADORES = 4;

  // --------------------------------------------------------------------------
  // 2. FUNÇÕES AUXILIARES
  // --------------------------------------------------------------------------

  /** Garante que o nível é 1..4; qualquer valor inválido vira 1 (Fácil). */
  function normalizarNivel(nivel) {
    const n = Number(nivel);
    return NIVEIS[n] ? n : 1;
  }

  /** Garante que o número de jogadores fica entre 1 e 4. */
  function normalizarJogadores(qtd) {
    const n = Math.floor(Number(qtd));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, MAX_JOGADORES);
  }

  /**
   * Sorteia a próxima cor (0 a 3). O gerador `rng` é injetável para que os
   * testes possam usar uma sequência previsível.
   */
  function gerarProximaCor(rng) {
    const aleatorio = typeof rng === 'function' ? rng : Math.random;
    const indice = Math.floor(aleatorio() * CORES.length);
    // Proteção caso um rng devolva exatamente 1.0
    return Math.min(Math.max(indice, 0), CORES.length - 1);
  }

  /**
   * Calcula o tempo de cada piscada para a rodada informada. A cada marco
   * (5, 9, 13) o jogo fica 12% mais rápido, sem passar dos mínimos seguros.
   */
  function calcularIntervalos(nivel, rodada) {
    const cfg = NIVEIS[normalizarNivel(nivel)];
    const aceleracoes = MARCOS_ACELERACAO.filter(function (m) { return rodada >= m; }).length;
    const fator = Math.pow(0.88, aceleracoes);
    return {
      aceso: Math.max(TEMPO_MIN_ACESO, Math.round(cfg.aceso * fator)),
      apagado: Math.max(TEMPO_MIN_APAGADO, Math.round(cfg.apagado * fator))
    };
  }

  /**
   * Procura, em sentido circular, o próximo jogador ainda ativo depois de
   * `atual`. Se nenhum outro estiver ativo, devolve o próprio `atual`.
   */
  function proximoJogadorAtivo(jogadores, atual) {
    const total = jogadores.length;
    for (let passo = 1; passo <= total; passo++) {
      const candidato = (atual + passo) % total;
      if (jogadores[candidato].ativo) return candidato;
    }
    return atual;
  }

  /** Quantidade de jogadores que ainda não foram eliminados. */
  function contarAtivos(jogadores) {
    return jogadores.filter(function (j) { return j.ativo; }).length;
  }

  /** Devolve o maior valor entre o recorde salvo e a pontuação atual. */
  function atualizarRecorde(recordeAtual, rodadasConcluidas) {
    const r = Number(recordeAtual) || 0;
    return Math.max(r, Number(rodadasConcluidas) || 0);
  }

  // --------------------------------------------------------------------------
  // 3. CRIAÇÃO E REINÍCIO DE ESTADO
  // --------------------------------------------------------------------------

  /**
   * Estado inicial (tela "aguardando Iniciar").
   * Variáveis de estado principais:
   *  - sequencia: cores sorteadas pelo sistema (ex.: [0, 3, 1])
   *  - indiceEntrada: quantas cores da sequência o jogador já acertou nesta vez
   *  - fase: em qual etapa da máquina de estados o jogo está; o bloqueio de
   *    cliques é derivado dela (só se aceita jogada na fase ENTRADA)
   *  - jogadores / jogadorAtual: suporte a partidas de 1 a 4 pessoas
   */
  function criarEstado(opcoes) {
    const op = opcoes || {};
    const nivel = normalizarNivel(op.nivel);
    const qtd = normalizarJogadores(op.numJogadores);
    const jogadores = [];
    for (let i = 0; i < qtd; i++) {
      jogadores.push({ id: i + 1, ativo: true, pontos: 0 });
    }
    return {
      fase: 'OCIOSO',
      nivel: nivel,
      alvo: NIVEIS[nivel].alvo,
      sequencia: [],
      indiceEntrada: 0,
      jogadores: jogadores,
      jogadorAtual: 0,
      maiorSequencia: 0, // maior sequência completada na partida (base do recorde)
      vencedor: null,    // id do jogador vencedor (multiplayer ou vitória solo)
      ultimoErro: null   // { esperada, recebida } para explicar o erro ao usuário
    };
  }

  /** Recomeça do zero mantendo nível e número de jogadores. */
  function resetarJogo(estado) {
    return criarEstado({ nivel: estado.nivel, numJogadores: estado.jogadores.length });
  }

  /** Inicia uma partida: sorteia a 1ª cor e passa para a fase de exibição. */
  function iniciarPartida(estado, rng) {
    const novo = resetarJogo(estado);
    novo.sequencia = [gerarProximaCor(rng)];
    novo.fase = 'EXIBINDO';
    return novo;
  }

  /** Chamado pela interface quando termina de piscar a sequência. */
  function concluirExibicao(estado) {
    if (estado.fase !== 'EXIBINDO') return estado;
    return Object.assign({}, estado, { fase: 'ENTRADA', indiceEntrada: 0 });
  }

  // --------------------------------------------------------------------------
  // 4. VALIDAÇÃO DAS JOGADAS (coração do jogo)
  // --------------------------------------------------------------------------

  /** Cópia dos jogadores, para não alterar o array original. */
  function copiarJogadores(jogadores) {
    return jogadores.map(function (j) { return Object.assign({}, j); });
  }

  /**
   * Compara a cor tocada com a cor esperada na posição atual.
   * Devolve { estado, resultado }, onde resultado é um destes códigos:
   *  IGNORADA        – jogada fora da vez (ex.: durante a exibição) → bloqueio
   *  ACERTO          – cor certa, mas a sequência ainda não terminou
   *  RODADA_COMPLETA – sequência inteira certa; nova cor foi sorteada
   *  VITORIA         – atingiu o tamanho‑alvo do nível
   *  ELIMINADO       – multiplayer: jogador errou e saiu; partida continua
   *  GAME_OVER       – fim de jogo por erro
   */
  function validarJogada(estado, cor, rng) {
    if (estado.fase !== 'ENTRADA') {
      return { estado: estado, resultado: 'IGNORADA' };
    }

    const esperada = estado.sequencia[estado.indiceEntrada];
    const jogadores = copiarJogadores(estado.jogadores);
    const atual = estado.jogadorAtual;

    // ---- Caso 1: ERRO ------------------------------------------------------
    if (cor !== esperada) {
      const ultimoErro = { esperada: esperada, recebida: cor };
      jogadores[atual].ativo = false;
      const restantes = contarAtivos(jogadores);

      // Solo, ou só sobrou um jogador → Game Over
      if (jogadores.length === 1 || restantes <= 1) {
        const sobrevivente = jogadores.find(function (j) { return j.ativo; });
        return {
          resultado: 'GAME_OVER',
          estado: Object.assign({}, estado, {
            fase: 'GAME_OVER',
            jogadores: jogadores,
            ultimoErro: ultimoErro,
            vencedor: jogadores.length > 1 && sobrevivente ? sobrevivente.id : null
          })
        };
      }

      // Multiplayer com ≥2 restantes: o próximo repete a MESMA sequência
      return {
        resultado: 'ELIMINADO',
        estado: Object.assign({}, estado, {
          fase: 'EXIBINDO',
          jogadores: jogadores,
          jogadorAtual: proximoJogadorAtivo(jogadores, atual),
          indiceEntrada: 0,
          ultimoErro: ultimoErro
        })
      };
    }

    // ---- Caso 2: ACERTO PARCIAL -------------------------------------------
    const indice = estado.indiceEntrada + 1;
    if (indice < estado.sequencia.length) {
      return {
        resultado: 'ACERTO',
        estado: Object.assign({}, estado, { indiceEntrada: indice })
      };
    }

    // ---- Caso 3: SEQUÊNCIA COMPLETA ---------------------------------------
    const tamanho = estado.sequencia.length;
    jogadores[atual].pontos += 1; // 1 ponto por rodada concluída
    const maiorSequencia = Math.max(estado.maiorSequencia, tamanho);

    // Atingiu o tamanho‑alvo do nível → vitória
    if (tamanho >= estado.alvo) {
      return {
        resultado: 'VITORIA',
        estado: Object.assign({}, estado, {
          fase: 'VITORIA',
          jogadores: jogadores,
          indiceEntrada: indice,
          maiorSequencia: maiorSequencia,
          vencedor: jogadores[atual].id
        })
      };
    }

    // Ainda não: acrescenta uma cor e passa a vez
    return {
      resultado: 'RODADA_COMPLETA',
      estado: Object.assign({}, estado, {
        fase: 'EXIBINDO',
        sequencia: estado.sequencia.concat([gerarProximaCor(rng)]),
        jogadores: jogadores,
        jogadorAtual: proximoJogadorAtivo(jogadores, atual),
        indiceEntrada: 0,
        maiorSequencia: maiorSequencia
      })
    };
  }

  // --------------------------------------------------------------------------
  // 5. CONSULTAS PARA A INTERFACE
  // --------------------------------------------------------------------------

  /** Número da rodada exibido no placar (tamanho da sequência atual). */
  function rodadaAtual(estado) {
    return estado.sequencia.length;
  }

  /** Verdadeiro quando a interface deve aceitar cliques/toques no tabuleiro. */
  function aceitaEntrada(estado) {
    return estado.fase === 'ENTRADA';
  }

  /** Verdadeiro durante uma partida em andamento (pode ser pausada). */
  function partidaEmAndamento(estado) {
    return estado.fase === 'EXIBINDO' || estado.fase === 'ENTRADA';
  }

  return Object.freeze({
    CORES: CORES,
    NOMES_CORES: NOMES_CORES,
    NIVEIS: NIVEIS,
    MAX_JOGADORES: MAX_JOGADORES,
    TEMPO_MIN_ACESO: TEMPO_MIN_ACESO,
    TEMPO_MIN_APAGADO: TEMPO_MIN_APAGADO,
    gerarProximaCor: gerarProximaCor,
    calcularIntervalos: calcularIntervalos,
    proximoJogadorAtivo: proximoJogadorAtivo,
    atualizarRecorde: atualizarRecorde,
    criarEstado: criarEstado,
    resetarJogo: resetarJogo,
    iniciarPartida: iniciarPartida,
    concluirExibicao: concluirExibicao,
    validarJogada: validarJogada,
    rodadaAtual: rodadaAtual,
    aceitaEntrada: aceitaEntrada,
    partidaEmAndamento: partidaEmAndamento
  });
});
