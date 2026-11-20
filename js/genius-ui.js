/* ============================================================================
 * GENIUS WEB — INTERFACE (genius-ui.js)
 * ----------------------------------------------------------------------------
 * Liga a lógica pura (GeniusCore) ao navegador:
 *   • desenho do estado na tela (placar, display LCD, botões)
 *   • motor de áudio (Web Audio API — osciladores, sem arquivos para baixar)
 *   • eventos de mouse, toque (Pointer Events) e teclado
 *   • temporização da exibição da sequência, pausa e diálogos acessíveis
 *   • persistência do recorde e das preferências (localStorage)
 * ==========================================================================*/
(function () {
  'use strict';

  const G = window.GeniusCore;
  const $ = (seletor) => document.querySelector(seletor);

  // --------------------------------------------------------------------------
  // 1. REFERÊNCIAS AOS ELEMENTOS DA PÁGINA
  // --------------------------------------------------------------------------
  const el = {
    corpo: document.body,
    status: $('#status'),
    rodada: $('#placar-rodada'),
    alvo: $('#placar-alvo'),
    recorde: $('#placar-recorde'),
    vez: $('#placar-vez'),
    barra: $('#barra-progresso'),
    listaJogadores: $('#lista-jogadores'),
    btnIniciar: $('#btn-iniciar'),
    rotuloIniciar: $('#btn-iniciar .rotulo-btn'),
    btnPausa: $('#btn-pausa'),
    btnSom: $('#btn-som'),
    btnNarrar: $('#btn-narrar'),
    btnAjuda: $('#btn-ajuda'),
    selNivel: $('#sel-nivel'),
    selJogadores: $('#sel-jogadores'),
    lcd: [$('#linha-0'), $('#linha-1')],
    narrador: $('#narrador'),
    legenda: $('#legenda-cor'),
    dlgAjuda: $('#dlg-ajuda'),
    dlgPausa: $('#dlg-pausa'),
    pausaResumo: $('#pausa-resumo'),
    dlgFim: $('#dlg-fim'),
    fimTitulo: $('#fim-titulo'),
    fimResumo: $('#fim-resumo'),
    fimRanking: $('#fim-ranking')
  };

  // Quadrantes na ordem dos índices de cor: 0 Verde, 1 Vermelho, 2 Amarelo, 3 Azul
  const quadrantes = G.CORES.map((cor) => $('#quadrante-' + cor));
  const leds = G.CORES.map((cor) => $('#' + cor + '-aceso'));

  // Atalhos de teclado → índice da cor (números e letras na mesma disposição do tabuleiro)
  const TECLAS = { '1': 0, '2': 1, '3': 2, '4': 3, q: 0, w: 1, a: 2, s: 3 };

  // --------------------------------------------------------------------------
  // 2. PREFERÊNCIAS E RECORDE (localStorage)
  // --------------------------------------------------------------------------
  const CHAVE_ARMAZENAMENTO = 'geniusweb:v1';
  const PADRAO = { som: true, narrar: false, nivel: 1, jogadores: 1, recordes: { 1: 0, 2: 0, 3: 0, 4: 0 }, viuAjuda: false };

  // try/catch: em modo anônimo de alguns navegadores o localStorage lança erro
  function lerPreferencias() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO));
      return Object.assign({}, PADRAO, salvo, { recordes: Object.assign({}, PADRAO.recordes, salvo && salvo.recordes) });
    } catch (e) {
      return Object.assign({}, PADRAO);
    }
  }
  function salvarPreferencias() {
    try { localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(prefs)); } catch (e) { /* sem persistência */ }
  }
  const prefs = lerPreferencias();

  // --------------------------------------------------------------------------
  // 3. VARIÁVEIS DE ESTADO DA INTERFACE
  // --------------------------------------------------------------------------
  // `estado` vem do núcleo (sequência, fase, jogadores...). As variáveis abaixo
  // só existem na interface:
  let estado = G.criarEstado({ nivel: prefs.nivel, numJogadores: prefs.jogadores });
  let pausado = false;   // true enquanto o diálogo de pausa está aberto
  let geracao = 0;       // "token" de cancelamento: incrementar invalida esperas pendentes
  const timersLed = [null, null, null, null]; // timers que apagam cada LED

  // --------------------------------------------------------------------------
  // 4. MOTOR DE ÁUDIO (Web Audio API)
  // --------------------------------------------------------------------------
  // Frequências do Genius/Simon original (Hz): Verde, Vermelho, Amarelo, Azul
  const FREQUENCIAS = [415.3, 310.0, 252.0, 209.0];
  let audioCtx = null;
  let volumeGeral = null;

  /**
   * Navegadores móveis (principalmente iOS) só liberam áudio após um gesto
   * do usuário. Por isso o contexto é criado/retomado no primeiro toque.
   */
  function prepararAudio() {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    if (!audioCtx) {
      audioCtx = new Contexto();
      volumeGeral = audioCtx.createGain();
      volumeGeral.gain.value = prefs.som ? 0.3 : 0;
      volumeGeral.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  /** Toca um tom com envelope curto (evita "clique" no início e no fim). */
  function tocarTom(frequencia, duracaoMs, forma, atrasoMs) {
    if (!prefs.som || !audioCtx) return;
    const inicio = audioCtx.currentTime + (atrasoMs || 0) / 1000;
    const fim = inicio + duracaoMs / 1000;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = forma || 'triangle';
    osc.frequency.value = frequencia;
    env.gain.setValueAtTime(0.0001, inicio);
    env.gain.exponentialRampToValueAtTime(1, inicio + 0.012);
    env.gain.setValueAtTime(1, Math.max(inicio + 0.013, fim - 0.04));
    env.gain.exponentialRampToValueAtTime(0.0001, fim);
    osc.connect(env).connect(volumeGeral);
    osc.start(inicio);
    osc.stop(fim + 0.02);
  }

  const somErro = () => tocarTom(98, 650, 'sawtooth');
  const somVitoria = () => [0, 1, 2, 3, 0].forEach((c, i) => tocarTom(FREQUENCIAS[3 - c] * 2, 140, 'triangle', i * 150));

  // --------------------------------------------------------------------------
  // 4b. NARRAÇÃO POR VOZ (Web Speech API — speechSynthesis)
  // --------------------------------------------------------------------------
  // Com "Narrar cores" ligado, o navegador FALA o nome de cada cor (voz em
  // português do próprio sistema, sem internet). Funciona mesmo com o Som
  // desligado, pois é um recurso de acessibilidade com chave própria.
  const voz = window.speechSynthesis || null;
  let vozPtBr = null;
  function escolherVoz() {
    if (!voz) return;
    const vozes = voz.getVoices();
    vozPtBr = vozes.find((v) => /^pt[-_]BR/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang)) || null;
  }
  if (voz) {
    escolherVoz();
    // Em alguns navegadores a lista de vozes só fica pronta depois
    if ('onvoiceschanged' in voz) voz.addEventListener('voiceschanged', escolherVoz);
  }
  /** Fala `texto` imediatamente, interrompendo a fala anterior (mantém o sincronismo). */
  function falar(texto) {
    if (!prefs.narrar || !voz) return;
    try {
      voz.cancel();
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = 'pt-BR';
      if (vozPtBr) fala.voice = vozPtBr;
      fala.rate = 1.15;
      voz.speak(fala);
    } catch (e) { /* navegador sem suporte: segue só com a legenda */ }
  }
  function calarVoz() { if (voz) try { voz.cancel(); } catch (e) { /* ignora */ } }

  /** Liga/desliga o som. Desligar zera o volume geral imediatamente. */
  function alternarSom() {
    prefs.som = !prefs.som;
    salvarPreferencias();
    if (volumeGeral) volumeGeral.gain.value = prefs.som ? 0.3 : 0;
    render();
    anunciar(prefs.som ? 'Som ligado.' : 'Som desligado.');
  }

  // --------------------------------------------------------------------------
  // 5. LEDS (acender/apagar quadrantes) E TEMPORIZAÇÃO
  // --------------------------------------------------------------------------
  /** Acende o quadrante `cor` por `ms` milissegundos, com som sincronizado. */
  function acender(cor, ms) {
    clearTimeout(timersLed[cor]);
    leds[cor].classList.add('ativo');
    quadrantes[cor].classList.add('aceso-agora');
    tocarTom(FREQUENCIAS[cor], ms);
    timersLed[cor] = setTimeout(() => apagar(cor), ms);
  }
  function apagar(cor) {
    leds[cor].classList.remove('ativo');
    quadrantes[cor].classList.remove('aceso-agora');
    timersLed[cor] = null;
  }
  function apagarTodos() { for (let c = 0; c < 4; c++) { clearTimeout(timersLed[c]); apagar(c); } }

  /** Espera `ms` e diz se a espera ainda é válida (ninguém pausou/reiniciou). */
  function esperar(ms) {
    const minha = geracao;
    return new Promise((ok) => setTimeout(() => ok(minha === geracao), ms));
  }
  /** Cancela qualquer exibição/espera em andamento. */
  function cancelarEsperas() { geracao++; }

  // --------------------------------------------------------------------------
  // 6. MENSAGENS: status visível, leitor de tela e display LCD do tabuleiro
  // --------------------------------------------------------------------------
  function setStatus(html) { el.status.innerHTML = html; }
  function anunciar(texto) {
    // Limpa e reescreve para o leitor de tela anunciar mesmo textos repetidos
    el.narrador.textContent = '';
    setTimeout(() => { el.narrador.textContent = texto; }, 30);
  }
  /** Escreve duas linhas de até 16 caracteres, centralizadas, no display. */
  function lcd(l0, l1) {
    [l0, l1].forEach((txt, i) => {
      const t = String(txt || '').slice(0, 16);
      const esq = Math.floor((16 - t.length) / 2);
      el.lcd[i].textContent = ' '.repeat(esq) + t;
    });
  }
  const dois = (n) => String(n).padStart(2, '0');
  const nomeCor = (c) => G.NOMES_CORES[c] + ' (' + (c + 1) + ')';
  const multiplayer = () => estado.jogadores.length > 1;
  const jogadorDaVez = () => estado.jogadores[estado.jogadorAtual].id;

  function mostrarLegenda(texto) {
    if (!prefs.narrar) return;
    el.legenda.textContent = texto;
    el.legenda.classList.add('visivel');
  }
  function esconderLegenda() { el.legenda.classList.remove('visivel'); }

  // --------------------------------------------------------------------------
  // 7. RENDERIZAÇÃO: reflete o estado atual em todos os elementos
  // --------------------------------------------------------------------------
  function render() {
    const andamento = G.partidaEmAndamento(estado);
    el.corpo.dataset.fase = pausado ? 'PAUSADO' : estado.fase;

    // Placar
    el.rodada.textContent = G.rodadaAtual(estado);
    el.alvo.textContent = G.NIVEIS[estado.nivel].alvo;
    el.recorde.textContent = prefs.recordes[estado.nivel] || 0;
    el.vez.textContent = andamento ? (multiplayer() ? 'J' + jogadorDaVez() : 'Você') : '—';

    // Barra de progresso (quantas cores o jogador já repetiu nesta vez)
    const total = estado.sequencia.length || 1;
    el.barra.style.width = (estado.fase === 'ENTRADA' ? (estado.indiceEntrada / total) * 100 : 0) + '%';

    // Lista de jogadores (multiplayer)
    el.listaJogadores.hidden = !multiplayer();
    if (multiplayer()) {
      el.listaJogadores.innerHTML = estado.jogadores.map((j, i) => {
        const classes = [];
        if (!j.ativo) classes.push('eliminado');
        if (andamento && i === estado.jogadorAtual) classes.push('atual');
        const situacao = !j.ativo ? ', eliminado' : (andamento && i === estado.jogadorAtual ? ', vez atual' : '');
        return '<li class="' + classes.join(' ') + '" aria-label="Jogador ' + j.id + ': ' + j.pontos + ' pontos' + situacao + '">' +
          '<span>J' + j.id + '</span><span>' + j.pontos + ' pts</span></li>';
      }).join('');
    }

    // Botões e campos: impede configurações inconsistentes durante a partida
    el.rotuloIniciar.textContent = andamento ? 'Reiniciar…' : 'Iniciar';
    el.btnPausa.disabled = !andamento;
    el.selNivel.disabled = andamento;
    el.selJogadores.disabled = andamento;
    el.btnSom.setAttribute('aria-pressed', String(prefs.som));
    el.btnNarrar.setAttribute('aria-pressed', String(prefs.narrar));

    // Quadrantes: informa ao leitor de tela quando estão bloqueados
    const bloqueado = andamento && !G.aceitaEntrada(estado);
    quadrantes.forEach((q) => q.setAttribute('aria-disabled', String(bloqueado)));
  }

  // --------------------------------------------------------------------------
  // 8. FLUXO DA PARTIDA
  // --------------------------------------------------------------------------
  /** Inicia (ou reinicia) uma partida com o nível e nº de jogadores escolhidos. */
  async function iniciar() {
    prepararAudio();
    cancelarEsperas();
    apagarTodos();
    fecharDialogo(el.dlgPausa);
    fecharDialogo(el.dlgFim);
    pausado = false;
    estado = G.iniciarPartida(G.criarEstado({ nivel: prefs.nivel, numJogadores: prefs.jogadores }));
    render();
    // Contagem regressiva curta para o jogador se preparar
    for (const n of ['3', '2', '1']) {
      lcd(G.NIVEIS[estado.nivel].nome.toUpperCase(), n + '...');
      setStatus('Prepare-se… <strong>' + n + '</strong>');
      if (!(await esperar(550))) return;
    }
    exibirSequencia();
  }

  /** Loop de exibição: pisca cada cor da sequência com som; depois libera a vez. */
  async function exibirSequencia() {
    cancelarEsperas();
    const rodada = G.rodadaAtual(estado);
    const quem = multiplayer() ? 'Jogador ' + jogadorDaVez() + ': ' : '';
    lcd('RODADA ' + dois(rodada) + '/' + dois(estado.alvo), 'OBSERVE');
    setStatus(quem + 'Observe a sequência (' + rodada + (rodada > 1 ? ' cores' : ' cor') + ')…');
    render();
    if (!(await esperar(650))) return;

    const t = G.calcularIntervalos(estado.nivel, rodada);
    // Com narração, cada cor fica acesa tempo suficiente para o nome ser falado
    if (prefs.narrar) { t.aceso = Math.max(t.aceso, 650); t.apagado = Math.max(t.apagado, 250); }
    for (let i = 0; i < estado.sequencia.length; i++) {
      const cor = estado.sequencia[i];
      acender(cor, t.aceso);
      if (prefs.narrar) {
        mostrarLegenda((i + 1) + ' · ' + nomeCor(cor));
        falar(G.NOMES_CORES[cor]); // fala o nome da cor junto com a piscada
      }
      if (!(await esperar(t.aceso + t.apagado))) { esconderLegenda(); return; }
    }
    esconderLegenda();

    // Terminou a demonstração → libera a entrada do jogador
    estado = G.concluirExibicao(estado);
    lcd('RODADA ' + dois(rodada) + '/' + dois(estado.alvo), 'SUA VEZ!');
    setStatus(quem + '<strong>Sua vez!</strong> Repita ' + (rodada > 1 ? 'as ' + rodada + ' cores.' : 'a cor.'));
    render();
    if (await esperar(t.apagado)) falar((multiplayer() ? 'Jogador ' + jogadorDaVez() + ', sua vez' : 'Sua vez'));
  }

  /** Trata cada clique/toque/tecla em um quadrante. */
  async function jogar(cor) {
    prepararAudio();
    if (pausado || dialogoAberto()) return;

    // Fora de partida: "modo livre" para conhecer as cores e os sons
    if (!G.partidaEmAndamento(estado)) { acender(cor, 220); falar(G.NOMES_CORES[cor]); return; }

    const r = G.validarJogada(estado, cor);
    if (r.resultado === 'IGNORADA') {
      setStatus('Aguarde a sequência terminar…');
      return;
    }
    estado = r.estado;

    switch (r.resultado) {
      case 'ACERTO':
        acender(cor, 220);
        falar(G.NOMES_CORES[cor]); // confirma por voz a cor tocada
        lcd('RODADA ' + dois(G.rodadaAtual(estado)) + '/' + dois(estado.alvo), estado.indiceEntrada + ' DE ' + estado.sequencia.length);
        render();
        break;

      case 'RODADA_COMPLETA':
        acender(cor, 220);
        falar(G.NOMES_CORES[cor] + '. Acertou!');
        lcd('ACERTOU!', '+1 COR');
        setStatus('Acertou! ' + (multiplayer() ? 'Agora é a vez do Jogador ' + jogadorDaVez() + '.' : 'Próxima rodada…'));
        render();
        if (await esperar(900)) exibirSequencia();
        break;

      case 'VITORIA':
        acender(cor, 220);
        render();
        if (!(await esperar(300))) return;
        somVitoria();
        finalizar();
        break;

      case 'ELIMINADO':
      case 'GAME_OVER': {
        const erro = estado.ultimoErro;
        somErro();
        if (navigator.vibrate) navigator.vibrate(200); // retorno tátil no celular
        lcd('ERROU!', 'ERA ' + G.NOMES_CORES[erro.esperada].toUpperCase());
        const msg = 'Errou! A cor certa era <strong>' + nomeCor(erro.esperada) + '</strong>; você tocou ' + nomeCor(erro.recebida) + '.';
        render();
        if (!(await esperar(700))) return;
        acender(erro.esperada, 700); // mostra qual era a cor certa
        falar('Errou. A cor certa era ' + G.NOMES_CORES[erro.esperada]);
        if (r.resultado === 'ELIMINADO') {
          setStatus(msg + ' Jogador eliminado. Próximo: Jogador ' + jogadorDaVez() + '.');
          if (await esperar(1800)) exibirSequencia();
        } else {
          setStatus(msg);
          if (await esperar(1000)) finalizar();
        }
        break;
      }
    }
  }

  /** Fim de partida: atualiza recorde e abre o diálogo de resultado. */
  function finalizar() {
    const pontos = estado.maiorSequencia;
    const recordeAnterior = prefs.recordes[estado.nivel] || 0;
    prefs.recordes[estado.nivel] = G.atualizarRecorde(recordeAnterior, pontos);
    salvarPreferencias();
    const novoRecorde = pontos > recordeAnterior;
    const venceu = estado.fase === 'VITORIA';

    let titulo;
    if (multiplayer()) titulo = estado.vencedor ? 'Jogador ' + estado.vencedor + ' venceu!' : 'Fim de jogo';
    else titulo = venceu ? 'Você venceu!' : 'Fim de jogo';

    let resumo = venceu
      ? 'Sequência completa de ' + estado.alvo + ' cores no nível ' + G.NIVEIS[estado.nivel].nome + '.'
      : 'Maior sequência completada: ' + pontos + (pontos === 1 ? ' cor.' : ' cores.');
    resumo += novoRecorde ? ' 🏆 Novo recorde!' : ' Recorde do nível: ' + prefs.recordes[estado.nivel] + '.';

    lcd(venceu ? 'PARABENS!' : 'FIM DE JOGO', 'RECORDE ' + dois(prefs.recordes[estado.nivel]));
    setStatus('<strong>' + titulo + '</strong> ' + resumo.replace(' 🏆', ''));
    el.fimTitulo.textContent = titulo;
    el.fimResumo.textContent = resumo;

    // Ranking multiplayer ordenado por pontos
    el.fimRanking.hidden = !multiplayer();
    if (multiplayer()) {
      el.fimRanking.innerHTML = estado.jogadores
        .slice().sort((a, b) => b.pontos - a.pontos)
        .map((j) => '<li>Jogador ' + j.id + ' — ' + j.pontos + ' pts' + (j.id === estado.vencedor ? ' (vencedor)' : '') + '</li>')
        .join('');
    }
    render();
    abrirDialogo(el.dlgFim);
  }

  // --------------------------------------------------------------------------
  // 9. PAUSA E DIÁLOGOS
  // --------------------------------------------------------------------------
  function dialogoAberto() { return [el.dlgAjuda, el.dlgPausa, el.dlgFim].some((d) => d.open); }
  function abrirDialogo(d) {
    if (d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function fecharDialogo(d) {
    if (!d.open) return;
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }

  /** Pausa: interrompe a exibição e bloqueia o tabuleiro. */
  function pausar() {
    if (pausado || !G.partidaEmAndamento(estado) || dialogoAberto()) return;
    pausado = true;
    cancelarEsperas();
    calarVoz();
    apagarTodos();
    esconderLegenda();
    el.pausaResumo.textContent = 'Rodada ' + G.rodadaAtual(estado) + ' de ' + estado.alvo +
      (estado.fase === 'ENTRADA' && estado.indiceEntrada > 0 ? ' — você já repetiu ' + estado.indiceEntrada + ' cor(es).' : '.');
    lcd('PAUSADO', '');
    render();
    abrirDialogo(el.dlgPausa);
  }

  /** Continua: se estava exibindo, mostra a sequência de novo (mais justo). */
  function continuar() {
    if (!pausado) return;
    pausado = false;
    fecharDialogo(el.dlgPausa);
    if (estado.fase === 'EXIBINDO') {
      exibirSequencia();
    } else {
      lcd('RODADA ' + dois(G.rodadaAtual(estado)) + '/' + dois(estado.alvo), 'SUA VEZ!');
      setStatus('<strong>Sua vez!</strong> Continue: cor ' + (estado.indiceEntrada + 1) + ' de ' + estado.sequencia.length + '.');
      render();
    }
  }

  /** Encerra a partida sem registrar como derrota. */
  function encerrar() {
    pausado = false;
    cancelarEsperas();
    calarVoz();
    fecharDialogo(el.dlgPausa);
    estado = G.resetarJogo(estado);
    lcd('GENIUS WEB', 'APERTE INICIAR');
    setStatus('Partida encerrada. Toque em <strong>Iniciar</strong> para jogar.');
    render();
    el.btnIniciar.focus();
  }

  // --------------------------------------------------------------------------
  // 10. EVENTOS (mouse, toque, teclado e controles)
  // --------------------------------------------------------------------------
  quadrantes.forEach((q, cor) => {
    // pointerdown responde no instante do toque (sem os 300 ms do "click")
    // e cobre mouse, caneta e toque com um único evento → sem disparo duplo
    q.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // só botão esquerdo
      e.preventDefault();
      jogar(cor);
    });
    // Enter / Espaço quando o quadrante está focado via Tab
    q.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        jogar(cor);
      }
    });
    q.addEventListener('contextmenu', (e) => e.preventDefault()); // toque longo no celular
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return; // ignora tecla segurada e atalhos do sistema
    if (dialogoAberto()) return;                              // diálogos tratam as próprias teclas
    const alvo = e.target;
    if (alvo && (alvo.tagName === 'SELECT' || alvo.tagName === 'INPUT')) return;
    const tecla = e.key.toLowerCase();

    if (tecla in TECLAS) { e.preventDefault(); jogar(TECLAS[tecla]); return; }
    if (tecla === 'p' || tecla === 'escape') { pausar(); return; }
    if (tecla === 'm') { alternarSom(); return; }
    if (tecla === 'enter' && (alvo === document.body || (alvo.closest && alvo.closest('#area-tabuleiro')))) {
      if (!G.partidaEmAndamento(estado)) { e.preventDefault(); iniciar(); }
    }
  });

  el.btnIniciar.addEventListener('click', () => {
    // Prevenção de erro: durante a partida, reiniciar passa pela confirmação da pausa
    if (G.partidaEmAndamento(estado)) pausar(); else iniciar();
  });
  el.btnPausa.addEventListener('click', pausar);
  el.btnSom.addEventListener('click', () => { prepararAudio(); alternarSom(); });
  el.btnNarrar.addEventListener('click', () => {
    prefs.narrar = !prefs.narrar;
    salvarPreferencias();
    render();
    if (prefs.narrar) falar('Narração das cores ligada');
    else { calarVoz(); anunciar('Narração das cores desligada.'); }
  });
  el.btnAjuda.addEventListener('click', () => { if (G.partidaEmAndamento(estado)) pausar(); if (!dialogoAberto()) abrirDialogo(el.dlgAjuda); });

  el.selNivel.addEventListener('change', () => {
    prefs.nivel = Number(el.selNivel.value);
    salvarPreferencias();
    estado = G.criarEstado({ nivel: prefs.nivel, numJogadores: prefs.jogadores });
    render();
  });
  el.selJogadores.addEventListener('change', () => {
    prefs.jogadores = Number(el.selJogadores.value);
    salvarPreferencias();
    estado = G.criarEstado({ nivel: prefs.nivel, numJogadores: prefs.jogadores });
    render();
  });

  // Diálogo de pausa
  $('#pausa-continuar').addEventListener('click', continuar);
  $('#pausa-reiniciar').addEventListener('click', iniciar);
  $('#pausa-encerrar').addEventListener('click', encerrar);
  el.dlgPausa.addEventListener('cancel', (e) => { e.preventDefault(); continuar(); }); // Esc = continuar

  // Diálogo de fim
  $('#fim-novamente').addEventListener('click', iniciar);
  el.dlgFim.addEventListener('close', () => { if (!G.partidaEmAndamento(estado)) el.btnIniciar.focus(); });

  // Botões genéricos "Fechar"/"Entendi"
  document.querySelectorAll('[data-fechar]').forEach((b) => {
    b.addEventListener('click', () => fecharDialogo(b.closest('dialog')));
  });
  el.dlgAjuda.addEventListener('close', () => { prefs.viuAjuda = true; salvarPreferencias(); });

  // Clique no fundo escuro fecha a ajuda e o resultado (não a pausa, para evitar engano)
  [el.dlgAjuda, el.dlgFim].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) fecharDialogo(d); }));

  // Trocou de aba / bloqueou a tela no meio da partida → pausa automática
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });

  // --------------------------------------------------------------------------
  // 11. INICIALIZAÇÃO
  // --------------------------------------------------------------------------
  el.selNivel.value = String(prefs.nivel);
  el.selJogadores.value = String(prefs.jogadores);
  lcd('GENIUS WEB', 'APERTE INICIAR');
  render();
  if (!prefs.viuAjuda) abrirDialogo(el.dlgAjuda); // instruções na primeira visita

  // Exposto apenas para os testes automatizados de interface (Playwright)
  window.__genius = { estado: () => estado, iniciar: iniciar };
})();
