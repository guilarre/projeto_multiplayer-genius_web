// Exporta para o Node.js (testes) e para o navegador
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.GeniusCore = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Indices das cores: 0 Verde, 1 Vermelho, 2 Amarelo, 3 Azul
  const CORES = Object.freeze(['verde', 'vermelho', 'amarelo', 'azul']);

  const NOMES_CORES = Object.freeze(['Verde', 'Vermelho', 'Amarelo', 'Azul']);

  // Niveis da chave Skill do Genius original: cores para vencer e tempos em ms
  const NIVEIS = Object.freeze({
    1: Object.freeze({ nome: 'Fácil', alvo: 8, aceso: 700, apagado: 300 }),
    2: Object.freeze({ nome: 'Médio', alvo: 14, aceso: 550, apagado: 250 }),
    3: Object.freeze({ nome: 'Difícil', alvo: 20, aceso: 420, apagado: 200 }),
    4: Object.freeze({ nome: 'Expert', alvo: 31, aceso: 350, apagado: 150 })
  });

  // Ciclo minimo de 350 ms: no maximo 2,86 piscadas por segundo (WCAG 2.3.1)
  const TEMPO_MIN_ACESO = 250;
  const TEMPO_MIN_APAGADO = 100;

  const MARCOS_ACELERACAO = Object.freeze([5, 9, 13]);

  const MAX_JOGADORES = 4;

  function normalizarNivel(nivel) {
    const n = Number(nivel);
    return NIVEIS[n] ? n : 1;
  }

  function normalizarJogadores(qtd) {
    const n = Math.floor(Number(qtd));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, MAX_JOGADORES);
  }

  // Sorteia a proxima cor; o rng pode ser trocado nos testes
  function gerarProximaCor(rng) {
    const aleatorio = typeof rng === 'function' ? rng : Math.random;
    const indice = Math.floor(aleatorio() * CORES.length);
    return Math.min(Math.max(indice, 0), CORES.length - 1);
  }

  // Acelera 12% nas rodadas 5, 9 e 13, sem passar dos tempos minimos
  function calcularIntervalos(nivel, rodada) {
    const cfg = NIVEIS[normalizarNivel(nivel)];
    const aceleracoes = MARCOS_ACELERACAO.filter(function (m) { return rodada >= m; }).length;
    const fator = Math.pow(0.88, aceleracoes);
    return {
      aceso: Math.max(TEMPO_MIN_ACESO, Math.round(cfg.aceso * fator)),
      apagado: Math.max(TEMPO_MIN_APAGADO, Math.round(cfg.apagado * fator))
    };
  }

  // Proximo jogador nao eliminado, em ordem circular
  function proximoJogadorAtivo(jogadores, atual) {
    const total = jogadores.length;
    for (let passo = 1; passo <= total; passo++) {
      const candidato = (atual + passo) % total;
      if (jogadores[candidato].ativo) return candidato;
    }
    return atual;
  }

  function contarAtivos(jogadores) {
    return jogadores.filter(function (j) { return j.ativo; }).length;
  }

  function atualizarRecorde(recordeAtual, rodadasConcluidas) {
    const r = Number(recordeAtual) || 0;
    return Math.max(r, Number(rodadasConcluidas) || 0);
  }

  // Estado inicial; a fase controla quando o tabuleiro aceita jogadas
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
      maiorSequencia: 0,
      vencedor: null,
      ultimoErro: null
    };
  }

  function resetarJogo(estado) {
    return criarEstado({ nivel: estado.nivel, numJogadores: estado.jogadores.length });
  }

  function iniciarPartida(estado, rng) {
    const novo = resetarJogo(estado);
    novo.sequencia = [gerarProximaCor(rng)];
    novo.fase = 'EXIBINDO';
    return novo;
  }

  function concluirExibicao(estado) {
    if (estado.fase !== 'EXIBINDO') return estado;
    return Object.assign({}, estado, { fase: 'ENTRADA', indiceEntrada: 0 });
  }

  function copiarJogadores(jogadores) {
    return jogadores.map(function (j) { return Object.assign({}, j); });
  }

  // Compara a cor tocada com a esperada e devolve o novo estado e o resultado
  function validarJogada(estado, cor, rng) {
    if (estado.fase !== 'ENTRADA') {
      return { estado: estado, resultado: 'IGNORADA' };
    }

    const esperada = estado.sequencia[estado.indiceEntrada];
    const jogadores = copiarJogadores(estado.jogadores);
    const atual = estado.jogadorAtual;

    // Erro: elimina o jogador; termina o jogo se restar no maximo um
    if (cor !== esperada) {
      const ultimoErro = { esperada: esperada, recebida: cor };
      jogadores[atual].ativo = false;
      const restantes = contarAtivos(jogadores);

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

    // Acerto parcial: avanca para a proxima cor
    const indice = estado.indiceEntrada + 1;
    if (indice < estado.sequencia.length) {
      return {
        resultado: 'ACERTO',
        estado: Object.assign({}, estado, { indiceEntrada: indice })
      };
    }

    // Sequencia completa: soma ponto, vence no alvo ou sorteia nova cor
    const tamanho = estado.sequencia.length;
    jogadores[atual].pontos += 1;
    const maiorSequencia = Math.max(estado.maiorSequencia, tamanho);

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

  function rodadaAtual(estado) {
    return estado.sequencia.length;
  }

  function aceitaEntrada(estado) {
    return estado.fase === 'ENTRADA';
  }

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
