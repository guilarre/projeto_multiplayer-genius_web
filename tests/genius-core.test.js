const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/genius-core.js');

// Gerador previsivel que devolve as cores pedidas, em ordem
function rngDe(cores) {
  let i = 0;
  return function () {
    const cor = cores[i % cores.length];
    i++;
    return (cor + 0.5) / 4;
  };
}

function estadoComSequencia(seq, opcoes) {
  const e = G.criarEstado(opcoes || {});
  return Object.assign(e, { fase: 'ENTRADA', sequencia: seq.slice(), indiceEntrada: 0 });
}

test('TST-01 · [Verde, Azul] respondido com [Verde, Vermelho] → GAME_OVER', () => {
  let e = estadoComSequencia([0, 3]);
  let r = G.validarJogada(e, 0);
  assert.equal(r.resultado, 'ACERTO');
  r = G.validarJogada(r.estado, 1);
  assert.equal(r.resultado, 'GAME_OVER');
  assert.equal(r.estado.fase, 'GAME_OVER');
  assert.deepEqual(r.estado.ultimoErro, { esperada: 3, recebida: 1 });
});

test('TST-05 · RF-01: sequência cresce 1 cor por rodada e suporta ≥ 20 rodadas', () => {
  let e = G.iniciarPartida(G.criarEstado({ nivel: 3 }), Math.random);
  assert.equal(e.sequencia.length, 1);
  for (let rodada = 1; rodada < 20; rodada++) {
    e = G.concluirExibicao(e);
    let r;
    for (const cor of e.sequencia) {
      r = G.validarJogada(e, cor, Math.random);
      e = r.estado;
    }
    assert.equal(r.resultado, 'RODADA_COMPLETA');
    assert.equal(e.sequencia.length, rodada + 1, 'adiciona exatamente uma cor');
    e.sequencia.forEach((c) => assert.ok(c >= 0 && c <= 3));
  }
  e = G.concluirExibicao(e);
  let r;
  for (const cor of e.sequencia) { r = G.validarJogada(e, cor); e = r.estado; }
  assert.equal(r.resultado, 'VITORIA');
  assert.equal(e.maiorSequencia, 20);
});

test('RF-01 · sequências diferem entre partidas (não há sequência fixa)', () => {
  const geraSeq = () => Array.from({ length: 20 }, () => G.gerarProximaCor());
  const a = geraSeq().join('');
  const b = geraSeq().join('');
  assert.notEqual(a, b);
});

test('gerarProximaCor sempre devolve 0..3, mesmo com rng nos extremos', () => {
  assert.equal(G.gerarProximaCor(() => 0), 0);
  assert.equal(G.gerarProximaCor(() => 0.999999), 3);
  assert.equal(G.gerarProximaCor(() => 1), 3);
});

test('RF-03 · bloqueio: jogadas fora da fase ENTRADA são ignoradas', () => {
  const ocioso = G.criarEstado();
  assert.equal(G.validarJogada(ocioso, 0).resultado, 'IGNORADA');
  const exibindo = G.iniciarPartida(ocioso, rngDe([2]));
  const r = G.validarJogada(exibindo, 2);
  assert.equal(r.resultado, 'IGNORADA');
  assert.equal(r.estado, exibindo, 'estado não muda');
  assert.equal(G.aceitaEntrada(exibindo), false);
  assert.equal(G.aceitaEntrada(G.concluirExibicao(exibindo)), true);
});

test('funções são puras: o estado original não é alterado', () => {
  const e = estadoComSequencia([1, 2]);
  const copia = JSON.stringify(e);
  G.validarJogada(e, 1);
  G.validarJogada(e, 3);
  assert.equal(JSON.stringify(e), copia);
});

test('RF-05 · multiplayer: acerto passa a vez; erro elimina e mantém sequência', () => {
  let e = estadoComSequencia([0], { numJogadores: 3 });
  let r = G.validarJogada(e, 0, rngDe([1]));
  assert.equal(r.resultado, 'RODADA_COMPLETA');
  assert.equal(r.estado.jogadorAtual, 1, 'vez do jogador 2');
  assert.equal(r.estado.jogadores[0].pontos, 1);

  e = G.concluirExibicao(r.estado);
  r = G.validarJogada(e, 3);
  assert.equal(r.resultado, 'ELIMINADO');
  assert.equal(r.estado.jogadores[1].ativo, false);
  assert.equal(r.estado.jogadorAtual, 2, 'vez do jogador 3');
  assert.deepEqual(r.estado.sequencia, [0, 1], 'mesma sequência para o próximo');

  e = G.concluirExibicao(r.estado);
  r = G.validarJogada(e, 2);
  assert.equal(r.resultado, 'GAME_OVER');
  assert.equal(r.estado.vencedor, 1);
});

test('proximoJogadorAtivo pula eliminados e dá a volta', () => {
  const js = [{ ativo: true }, { ativo: false }, { ativo: false }, { ativo: true }];
  assert.equal(G.proximoJogadorAtivo(js, 0), 3);
  assert.equal(G.proximoJogadorAtivo(js, 3), 0);
});

test('RNF-05 · velocidade aumenta nas rodadas 5, 9 e 13 sem passar de 3 flashes/s', () => {
  const r1 = G.calcularIntervalos(2, 1);
  const r5 = G.calcularIntervalos(2, 5);
  const r13 = G.calcularIntervalos(2, 13);
  assert.ok(r5.aceso < r1.aceso && r13.aceso < r5.aceso);
  for (let nivel = 1; nivel <= 4; nivel++) {
    for (let rodada = 1; rodada <= 31; rodada++) {
      const { aceso, apagado } = G.calcularIntervalos(nivel, rodada);
      const flashesPorSegundo = 1000 / (aceso + apagado);
      assert.ok(flashesPorSegundo < 3, `nível ${nivel} rodada ${rodada}: ${flashesPorSegundo}`);
    }
  }
});

test('TST-04 (lógica) · recorde só aumenta', () => {
  assert.equal(G.atualizarRecorde(5, 3), 5);
  assert.equal(G.atualizarRecorde(5, 7), 7);
  assert.equal(G.atualizarRecorde(undefined, 2), 2);
  assert.equal(G.atualizarRecorde('lixo', 0), 0);
});

test('resetarJogo / criarEstado normalizam entradas inválidas', () => {
  const e = G.criarEstado({ nivel: 99, numJogadores: 10 });
  assert.equal(e.nivel, 1);
  assert.equal(e.jogadores.length, 4);
  const r = G.resetarJogo(Object.assign({}, e, { sequencia: [1, 2, 3], fase: 'GAME_OVER' }));
  assert.equal(r.fase, 'OCIOSO');
  assert.deepEqual(r.sequencia, []);
  assert.equal(r.jogadores.length, 4);
});

test('níveis seguem a chave Skill do Genius original (8/14/20/31)', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => G.NIVEIS[n].alvo), [8, 14, 20, 31]);
});
