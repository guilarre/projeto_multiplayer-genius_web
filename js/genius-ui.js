(function () {
  'use strict';

  const G = window.GeniusCore;
  const $ = (seletor) => document.querySelector(seletor);

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

  const quadrantes = G.CORES.map((cor) => $('#quadrante-' + cor));
  const leds = G.CORES.map((cor) => $('#' + cor + '-aceso'));

  // Teclas 1-4 e Q/W/A/S na mesma posicao do tabuleiro
  const TECLAS = { '1': 0, '2': 1, '3': 2, '4': 3, q: 0, w: 1, a: 2, s: 3 };

  // Preferencias e recordes salvos no navegador
  const CHAVE_ARMAZENAMENTO = 'geniusweb:v1';
  const PADRAO = { som: true, narrar: false, nivel: 1, jogadores: 1, recordes: { 1: 0, 2: 0, 3: 0, 4: 0 }, viuAjuda: false };

  function lerPreferencias() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO));
      return Object.assign({}, PADRAO, salvo, { recordes: Object.assign({}, PADRAO.recordes, salvo && salvo.recordes) });
    } catch (e) {
      return Object.assign({}, PADRAO);
    }
  }
  function salvarPreferencias() {
    try { localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(prefs)); } catch (e) { }
  }
  const prefs = lerPreferencias();

  let estado = G.criarEstado({ nivel: prefs.nivel, numJogadores: prefs.jogadores });
  let pausado = false;
  // Incrementar cancela exibicoes e esperas pendentes
  let geracao = 0;
  const timersLed = [null, null, null, null];

  // Frequencias do Genius original em Hz
  const FREQUENCIAS = [415.3, 310.0, 252.0, 209.0];
  let audioCtx = null;
  let volumeGeral = null;

  // Navegadores moveis so liberam o audio depois de um toque
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

  // Narracao das cores por voz (Web Speech API)
  const voz = window.speechSynthesis || null;
  let vozPtBr = null;
  function escolherVoz() {
    if (!voz) return;
    const vozes = voz.getVoices();
    vozPtBr = vozes.find((v) => /^pt[-_]BR/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang)) || null;
  }
  if (voz) {
    escolherVoz();
    if ('onvoiceschanged' in voz) voz.addEventListener('voiceschanged', escolherVoz);
  }
  // Fala o texto e devolve uma Promise que termina quando a frase acaba
  function falar(texto) {
    if (!prefs.narrar || !voz) return Promise.resolve();
    return new Promise((pronto) => {
      let feito = false;
      const concluir = () => { if (!feito) { feito = true; clearTimeout(limite); pronto(); } };
      // Limite de seguranca caso o navegador nao avise o fim da fala
      const limite = setTimeout(concluir, 1200 + texto.length * 90);
      try {
        voz.cancel();
        const fala = new SpeechSynthesisUtterance(texto);
        fala.lang = 'pt-BR';
        if (vozPtBr) fala.voice = vozPtBr;
        fala.rate = 1.15;
        fala.onend = concluir;
        fala.onerror = concluir;
        voz.speak(fala);
      } catch (e) { concluir(); }
    });
  }
  function calarVoz() { if (voz) try { voz.cancel(); } catch (e) { } }

  function alternarSom() {
    prefs.som = !prefs.som;
    salvarPreferencias();
    if (volumeGeral) volumeGeral.gain.value = prefs.som ? 0.3 : 0;
    render();
    anunciar(prefs.som ? 'Som ligado.' : 'Som desligado.');
  }

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

  // Espera cancelavel: devolve false se a partida foi pausada ou reiniciada
  function esperar(ms) {
    const minha = geracao;
    return new Promise((ok) => setTimeout(() => ok(minha === geracao), ms));
  }
  function cancelarEsperas() { geracao++; }
  // Espera o tempo minimo e o fim das falas; devolve false se a partida foi pausada ou reiniciada
  function esperarFalas(ms, ...falas) {
    const minha = geracao;
    return Promise.all([new Promise((ok) => setTimeout(ok, ms)), ...falas]).then(() => minha === geracao);
  }

  function setStatus(html) { el.status.innerHTML = html; }
  function anunciar(texto) {
    el.narrador.textContent = '';
    setTimeout(() => { el.narrador.textContent = texto; }, 30);
  }
  // Display central: duas linhas de 16 caracteres
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

  // Atualiza placar, botoes e quadrantes a partir do estado
  function render() {
    const andamento = G.partidaEmAndamento(estado);
    el.corpo.dataset.fase = pausado ? 'PAUSADO' : estado.fase;

    el.rodada.textContent = G.rodadaAtual(estado);
    el.alvo.textContent = G.NIVEIS[estado.nivel].alvo;
    el.recorde.textContent = prefs.recordes[estado.nivel] || 0;
    el.vez.textContent = andamento ? (multiplayer() ? 'J' + jogadorDaVez() : 'Você') : '—';

    const total = estado.sequencia.length || 1;
    el.barra.style.width = (estado.fase === 'ENTRADA' ? (estado.indiceEntrada / total) * 100 : 0) + '%';

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

    el.rotuloIniciar.textContent = andamento ? 'Reiniciar…' : 'Iniciar';
    el.btnPausa.disabled = !andamento;
    el.selNivel.disabled = andamento;
    el.selJogadores.disabled = andamento;
    el.btnSom.setAttribute('aria-pressed', String(prefs.som));
    el.btnNarrar.setAttribute('aria-pressed', String(prefs.narrar));

    const bloqueado = andamento && !G.aceitaEntrada(estado);
    quadrantes.forEach((q) => q.setAttribute('aria-disabled', String(bloqueado)));
  }

  async function iniciar() {
    prepararAudio();
    cancelarEsperas();
    apagarTodos();
    fecharDialogo(el.dlgPausa);
    fecharDialogo(el.dlgFim);
    pausado = false;
    estado = G.iniciarPartida(G.criarEstado({ nivel: prefs.nivel, numJogadores: prefs.jogadores }));
    render();
    for (const n of ['3', '2', '1']) {
      lcd(G.NIVEIS[estado.nivel].nome.toUpperCase(), n + '...');
      setStatus('Prepare-se… <strong>' + n + '</strong>');
      if (!(await esperar(550))) return;
    }
    exibirSequencia();
  }

  // Pisca a sequencia e depois libera a vez do jogador
  async function exibirSequencia() {
    cancelarEsperas();
    const rodada = G.rodadaAtual(estado);
    const quem = multiplayer() ? 'Jogador ' + jogadorDaVez() + ': ' : '';
    lcd('RODADA ' + dois(rodada) + '/' + dois(estado.alvo), 'OBSERVE');
    setStatus(quem + 'Observe a sequência (' + rodada + (rodada > 1 ? ' cores' : ' cor') + ')…');
    render();
    if (!(await esperar(650))) return;

    const t = G.calcularIntervalos(estado.nivel, rodada);
    if (prefs.narrar) { t.aceso = Math.max(t.aceso, 650); t.apagado = Math.max(t.apagado, 250); }
    let ultimaFala = Promise.resolve();
    for (let i = 0; i < estado.sequencia.length; i++) {
      const cor = estado.sequencia[i];
      acender(cor, t.aceso);
      if (prefs.narrar) {
        mostrarLegenda((i + 1) + ' · ' + nomeCor(cor));
        ultimaFala = falar(G.NOMES_CORES[cor]);
      }
      if (!(await esperar(t.aceso + t.apagado))) { esconderLegenda(); return; }
    }
    esconderLegenda();
    if (!(await esperarFalas(0, ultimaFala))) return;

    estado = G.concluirExibicao(estado);
    lcd('RODADA ' + dois(rodada) + '/' + dois(estado.alvo), 'SUA VEZ!');
    setStatus(quem + '<strong>Sua vez!</strong> Repita ' + (rodada > 1 ? 'as ' + rodada + ' cores.' : 'a cor.'));
    render();
    falar(multiplayer() ? 'Jogador ' + jogadorDaVez() + ', sua vez' : 'Sua vez');
  }

  // Trata cada toque, clique ou tecla em um quadrante
  async function jogar(cor) {
    prepararAudio();
    if (pausado || dialogoAberto()) return;

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
        falar(G.NOMES_CORES[cor]);
        lcd('RODADA ' + dois(G.rodadaAtual(estado)) + '/' + dois(estado.alvo), estado.indiceEntrada + ' DE ' + estado.sequencia.length);
        render();
        break;

      case 'RODADA_COMPLETA':
        acender(cor, 220);
        const falaAcerto = falar(G.NOMES_CORES[cor] + '. Acertou!');
        lcd('ACERTOU!', '+1 COR');
        setStatus('Acertou! ' + (multiplayer() ? 'Agora é a vez do Jogador ' + jogadorDaVez() + '.' : 'Próxima rodada…'));
        render();
        if (await esperarFalas(900, falaAcerto)) exibirSequencia();
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
        if (navigator.vibrate) navigator.vibrate(200);
        lcd('ERROU!', 'ERA ' + G.NOMES_CORES[erro.esperada].toUpperCase());
        const msg = 'Errou! A cor certa era <strong>' + nomeCor(erro.esperada) + '</strong>; você tocou ' + nomeCor(erro.recebida) + '.';
        render();
        if (!(await esperar(700))) return;
        acender(erro.esperada, 700);
        const falaErro = falar('Errou. A cor certa era ' + G.NOMES_CORES[erro.esperada]);
        if (r.resultado === 'ELIMINADO') {
          setStatus(msg + ' Jogador eliminado. Próximo: Jogador ' + jogadorDaVez() + '.');
          if (await esperarFalas(1800, falaErro)) exibirSequencia();
        } else {
          setStatus(msg);
          if (await esperarFalas(1000, falaErro)) finalizar();
        }
        break;
      }
    }
  }

  // Fim de partida: atualiza o recorde e abre o resultado
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

  function dialogoAberto() { return [el.dlgAjuda, el.dlgPausa, el.dlgFim].some((d) => d.open); }
  function abrirDialogo(d) {
    if (d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function fecharDialogo(d) {
    if (!d.open) return;
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }

  // Pausa cancela a exibicao; ao continuar, a sequencia se repete
  function pausar(abrirDialogoPausa = true) {
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
    if (abrirDialogoPausa) abrirDialogo(el.dlgPausa);
  }
  // Ajuda durante a partida: pausa sem o dialogo de pausa e mostra as instrucoes
  function abrirAjuda() {
    if (G.partidaEmAndamento(estado) && !pausado) pausar(false);
    fecharDialogo(el.dlgPausa);
    abrirDialogo(el.dlgAjuda);
  }

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

  quadrantes.forEach((q, cor) => {
    // pointerdown responde ao toque sem atraso e sem disparo duplo
    q.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      jogar(cor);
    });
    q.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        jogar(cor);
      }
    });
    q.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (dialogoAberto()) return;
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
  el.btnAjuda.addEventListener('click', abrirAjuda);

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

  $('#pausa-continuar').addEventListener('click', continuar);
  $('#pausa-ajuda').addEventListener('click', abrirAjuda);
  $('#pausa-reiniciar').addEventListener('click', iniciar);
  $('#pausa-encerrar').addEventListener('click', encerrar);
  el.dlgPausa.addEventListener('cancel', (e) => { e.preventDefault(); continuar(); });

  $('#fim-novamente').addEventListener('click', iniciar);
  el.dlgFim.addEventListener('close', () => { if (!G.partidaEmAndamento(estado)) el.btnIniciar.focus(); });

  document.querySelectorAll('[data-fechar]').forEach((b) => {
    b.addEventListener('click', () => fecharDialogo(b.closest('dialog')));
  });
  el.dlgAjuda.addEventListener('close', () => {
    prefs.viuAjuda = true;
    salvarPreferencias();
    if (pausado) abrirDialogo(el.dlgPausa);
  });

  [el.dlgAjuda, el.dlgFim].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) fecharDialogo(d); }));

  // Pausa automatica ao trocar de aba ou bloquear a tela
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });

  el.selNivel.value = String(prefs.nivel);
  el.selJogadores.value = String(prefs.jogadores);
  lcd('GENIUS WEB', 'APERTE INICIAR');
  render();
  if (!prefs.viuAjuda) abrirDialogo(el.dlgAjuda);

  // Usado pelos testes de interface
  window.__genius = { estado: () => estado, iniciar: iniciar };
})();
