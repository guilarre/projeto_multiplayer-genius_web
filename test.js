const btnPausa = document.querySelector('#btn-pausa');

let jogoPausado = false;
let partidaAtiva = false;
let resolverDespause = null;
let partidaController = null; // Cancela turnos pendentes se reiniciar/terminar

// Cria uma Promise que só libera quando o menuPausa() terminar
function aguardarDespausar() {
    return new Promise((resolve) => {
        resolverDespause = resolve;
    });
}

// Substitui o sleep() durante a partida para respeitar a pausa
async function delayComPausa(tempoMs) {
    let restante = tempoMs;
    const fatia = 50; // Checa a cada 50ms se pausou ou abortou

    while (restante > 0) {
        if (partidaController?.signal.aborted) return;

        if (jogoPausado) {
            await aguardarDespausar();
            if (partidaController?.signal.aborted) return;
        }

        const espera = Math.min(fatia, restante);
        await sleep(espera);
        restante -= espera;
    }

    // Garante que não avança para o próximo LED se pausou exatamente no fim do timer
    if (jogoPausado && !partidaController?.signal.aborted) {
        await aguardarDespausar();
    }
}


////////////////////////////////////////////////////////////

btnPausa.addEventListener('pointerdown', async () => {
    // Não pausa se já estiver pausado ou se estiver no menu inicial
    if (jogoPausado || !partidaAtiva) return;

    jogoPausado = true;

    // Salva o que estava no visor antes da pausa (ex: "-- Player 1 --")
    const visorAnterior0 = display[0].textContent;
    const visorAnterior1 = display[1].textContent;

    const acao = await menuPausa();

    jogoPausado = false;

    if (acao === 'VOLTAR') {
        display[0].textContent = visorAnterior0;
        display[1].textContent = visorAnterior1;
        if (resolverDespause) {
            resolverDespause();
            resolverDespause = null;
        }
    } else if (acao === 'REINICIAR') {
        partidaController?.abort(); // Interrompe o loopJogo atual
        if (resolverDespause) resolverDespause();
        await resetJogo();
    } else if (acao === 'TERMINAR') {
        partidaController?.abort();
        if (resolverDespause) resolverDespause();
        terminarJogo();
    }
});

async function menuPausa() {
    while (true) {
        printaString(menuPausaMsgs, 0, 0); // "--   PAUSA   --"
        printaString(menuPausaMsgs, 1, 1); // Ex: instrução ou opção padrão

        // Mostra os números 1 a 4 nos botões (reaproveitando sua lógica do setup)
        arrayQtdPlayers.forEach((tspan) => {
            tspan.classList.add('ativo');
        });

        const escolha = await new Promise((resolve) => {
            const menuController = new AbortController();

            arrayBotoes.forEach((botao, idx) => {
                botao.addEventListener('pointerdown', () => {
                    menuController.abort();
                    resolve(idx + 1); // Retorna 1, 2, 3 ou 4
                }, { signal: menuController.signal });
            });
        });

        arrayQtdPlayers.forEach((tspan) => tspan.classList.remove('ativo'));

        if (escolha === 1) return 'VOLTAR';
        if (escolha === 2) {
            await mostrarPlacar(); // Mostra o placar e o while(true) volta pro menuPausa
        }
        if (escolha === 3) return 'REINICIAR';
        if (escolha === 4) return 'TERMINAR';
    }
}

////////////////////////////////////////////////////////////

// CHECK: VAI USAR???
function aguardarCliqueJogador() {
    return new Promise((resolve) => {
        const turnoController = new AbortController();

        // Se o jogador reiniciar/terminar pelo menu de pausa, aborta a espera
        partidaController.signal.addEventListener('abort', () => {
            turnoController.abort();
            resolve(null);
        }, { once: true });

        arrayBotoes.forEach((botao, idxCor) => {
            botao.addEventListener('pointerdown', () => {
                if (jogoPausado) return; // Ignora enquanto o menuPausa está aberto

                turnoController.abort();
                resolve(idxCor); // Entrega 0 (Azul), 1 (Amarelo), 2 (Vermelho) ou 3 (Verde)
            }, { signal: turnoController.signal });
        });
    });
}
