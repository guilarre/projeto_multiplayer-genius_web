// SECTION: constantes e classes

// config geral
const MAX_BOTOES = 4; // CHECK: precisa ainda disso?
const MAX_PLAYERS = 4;
const MAX_SEQUENCIA = 12;
const PONTO_POR_ACERTO = 100;
const TEMPO_LED_ACESO = 400;
const TEMPO_LED_APAGADO = 200;

// elementos DOM do componente principal do jogo
// componentes acesos do svg
const verdeAceso = document.querySelector('#verde-aceso');
const vermelhoAceso = document.querySelector('#vermelho-aceso');
const amareloAceso = document.querySelector('#amarelo-aceso');
const azulAceso = document.querySelector('#azul-aceso');
// array com componentes acesos, pra controlarmos os 'leds'
const arrayLedsAcesos = [verdeAceso, vermelhoAceso, amareloAceso, azulAceso];
// componentes que usaremos para detectar clique
const botaoVerde = document.querySelector('#quadrante-verde');
const botaoVermelho = document.querySelector('#quadrante-vermelho');
const botaoAmarelo = document.querySelector('#quadrante-amarelo');
const botaoAzul = document.querySelector('#quadrante-azul');
// array com os nossos botões na ordem correta
const arrayBotoes = [botaoVerde, botaoVermelho, botaoAmarelo, botaoAzul];
// texto com qtd de players a selecionar
const arrayQtdPlayers = [
    arrayBotoes[0].querySelector('text'),
    arrayBotoes[1].querySelector('text'),
    arrayBotoes[2].querySelector('text'),
    arrayBotoes[3].querySelector('text')
];
// linhas do display onde iremos escrever
const displayLinha0 = document.querySelector('#linha-0');
const displayLinha1 = document.querySelector('#linha-1');
// array display pra referenciarmos depois mais facilmente
const display = [displayLinha0, displayLinha1];

// SECTION: classe Player

class Player {
    constructor() {
        this.score = 0;
        this.ativo = false;
        this.jogou = false;
    }

    reset() {
        this.score = 0;
        this.ativo = false;
        this.jogou = false;
    }

    ativar() {
        this.ativo = true;
    }

    desativar() {
        this.ativo = false;
    }

    setJogou() {
        this.jogou = true;
    }
}

// criando os players na memória...
// TEST: verificar se tá dando certo esse meio de iteração sobre um array
// (da outra vez eu botei um atributo id pra player e verifiquei a cada
// iteração se realmente mudava.) -- checar em um for
const playerList = [
    new Player(),
    new Player(),
    new Player(),
    new Player()
];

// SECTION: strings pros menus e mensagens
// TODO: remover as que não usaremos e ajeitar no código

// cores
const corToString = ["AZUL", "AMARELO", "VERMELHO", "VERDE"];
// menuSetup()
const menuSetupMsgs = [" --  Escolha  --", "1 jogador", "2 jogadores", "3 jogadores", "4 jogadores", "-- Confirmado --", " qtd de players "];
// menuPausa()
const menuPausaMsgs = ["--   PAUSA   --", "Voltar", "Placar atual", "Reiniciar jogo", "Terminar jogo"];
// de quem é a vez atual
const vezAtualMsgs = ["-- Player 1 --", "-- Player 2 --", "-- Player 3 --", "-- Player 4 --"];
// mostrarPlacar()
const pontuacaoMsgs = ["P1: ", "P2: ", "P3: ", "P4: "];
// msgs do sistema
const msgsSistema = ["Reiniciando...", "3...", "2...", "1...", "START!", "ERROU!", "ACERTOU!", "VOCÊ GANHOU!", "O JOGO ACABOU!"];

// SECTION: vars globais

// vars da sequência correta e tentativa do player
let sequenciaAtualGlobal = [];
let tentativaAtualGlobal = [];
// ponteiro pra indicar onde estamos olhando ao verificar jogada
let corAtual = 0;
// variáveis pra controlar pausa
let jogoPausado = false;
let partidaAtiva = false;
let resolverDespause = null;
let partidaController = null;

// SECTION: vars e funções de player

// ponteiro pro player atual
let playerAtual = 0;
// qtd de jogadores atual na partida
let totalPlayers = 1;
// qtd de jogadores original, pra referenciar em mostrarPlacar()
let qtdOriginalPlayers = 1;
// função pra iterar até o próx player válido
function proxPlayer() {
    if (totalPlayers === 1) return;

    let proxPlayer = playerAtual; //ponteiro em playerList

    do {
        proxPlayer = (proxPlayer + 1) % MAX_PLAYERS;
    } while (!playerList[proxPlayer].ativo && proxPlayer != playerAtual);

    playerAtual = proxPlayer;
}
// função pra pontuar playerAtual
function pontuarPlayer(pontos) {
    playerList[playerAtual].score += pontos;
}
// função pra quando jogador atual errar e precisar sair
function retirarPlayerEIterar() {
    const playerASair = playerAtual;
    proxPlayer();
    playerList[playerASair].desativar();
    totalPlayers--;
}

// SECTION: funções para sleep, pausa, modal de pausa, etc.

// função pra funcionar como o delay() do arduino
//  NOTE: (função que chamar ela deve ser async)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// TODO: comentario
function aguardarDespausar() {
    return new Promise((resolve) => {
        resolverDespause = resolve;
    });
}
// nosso delayComPausa() (delay não bloqueante) pra substituir o sleep()
// (delay bloqueante) quando jogo puder ser pausado
async function delayComPausa(ms) {
    let restante = ms;
    const fatia = 50; //checa a cada 50ms se pausou ou abortou

    while (restante > 0) {
        if (partidaController?.signal.aborted) return;

        if (jogoPausado) {
            await aguardarDespausar();
            if (partidaController?.signal.aborted) return;
        }

        const espera = Math.min(fatia, restante);
        await sleep(espera); //espera e checa qnt tempo passou
        restante -= espera;
    }

    // Garante que não avança para o próximo LED se pausou exatamente no fim do timer
    if (jogoPausado && !partidaController?.signal.aborted) {
        await aguardarDespausar();
    }
}
// modal de pausa
const modalPausa = document.querySelector('#modal-pausa');
// opções do modal de pausa
const optVoltar = modalPausa.querySelector('#opt-voltar');
const optReiniciar = modalPausa.querySelector('#opt-reiniciar');
const optTerminar = modalPausa.querySelector('#opt-terminar');
// array com opções do modal
const arrayOptsPausa = [optVoltar, optReiniciar, optTerminar];
// menu pausa
async function menuPausa() {
    modalPausa.classList.add('ativo'); //abre o modal

    const opcaoSelecionada = await new Promise((resolve) => {
        const menuController = new AbortController(); //objeto controller

        arrayOptsPausa.forEach((opt, idx) => {
            opt.addEventListener('pointerdown', () => {
                menuController.abort();
                resolve(idx);
            }, { signal: menuController.signal });
        });

        // dá a opção de clicar fora pra voltar tb
        modalPausa.addEventListener('pointerdown', (e) => {
            if (e.target === modalPausa) {
                menuController.abort();
                resolve(0); //opção de voltar ao jogo
            }
        }, { signal: menuController.signal });
    });

    modalPausa.classList.remove('ativo'); //fecha o modal

    switch (opcaoSelecionada) {
        case 0:
            return 'VOLTAR';
        // CHECK: pensar se vale a pena incluir mostrarPlacar() aqui..
        case 1:
            return 'REINICIAR';
        case 2:
            return 'TERMINAR';
    }
}
// botão de pausa
const btnPausa = document.querySelector('#btn-pausa');
// função de pausar no botão
btnPausa.addEventListener('pointerdown', async () => {
    // não pausa se já estiver pausado ou se estiver no menu inicial
    if (jogoPausado || !partidaAtiva) return;

    jogoPausado = true;

    const acao = await menuPausa();

    jogoPausado = false;

    if (acao === 'VOLTAR') {
        if (resolverDespause) {
            resolverDespause();
            resolverDespause = null;
        }
    } else if (acao === 'REINICIAR') {
        partidaController?.abort(); // interrompe o loopJogo atual
        if (resolverDespause) resolverDespause();
        await resetJogo();
    } else if (acao === 'TERMINAR') {
        partidaController?.abort();
        if (resolverDespause) resolverDespause();
        terminarJogo();
    }
});
// função pra aguardar input do user e piscar botões quando clicar num
function aguardarCliqueJogador() {
    return new Promise((resolve) => {
        const turnoController = new AbortController();

        // se reiniciar/terminar pelo menu de pausa, aborta a espera
        partidaController.signal.addEventListener('abort', () => {
            turnoController.abort();
            resolve(null);
        }, { once: true });

        arrayBotoes.forEach((botao, idx) => {
            botao.addEventListener('pointerdown', () => {
                if (jogoPausado) return; //ignora enquanto o menuPausa está aberto

                acenderBotao(arrayLedsAcesos[idx]);
                solicitarApagarBotao(arrayLedsAcesos[idx]);

                turnoController.abort();
                resolve(idx); // Entrega 0 (Azul), 1 (Amarelo), 2 (Vermelho) ou 3 (Verde)
            }, { signal: turnoController.signal });
        });
    });
}

// SECTION: funções do jogo

// função pra inserir uma cor aleatória na var global
function newRandomColor() {
    const randNum = Math.floor(Math.random() * 4);
    sequenciaAtualGlobal.push(randNum);
}
// pra printar no elem DOM corretos a msg correta
function printaString(arrayMsg, idx, displayY) {
    display[displayY].textContent = arrayMsg[idx];
}
// função pra resetar jogo
async function resetJogo() {
    // desativa partida
    partidaAtiva = false;
    // reseta sequenciaAtualGlobal e tentativaAtualGlobal
    sequenciaAtualGlobal = [];
    tentativaAtualGlobal = [];
    // desativa players
    playerList.forEach(player => player.reset());
    // retorna aos valores originais:
    playerAtual = 0;
    totalPlayers = 1;
    qtdOriginalPlayers = 1;

    // msg confirmando que resetou tudo
    printaString(msgsSistema, 0, 0); //Reiniciando...
    display[1].textContent = "";
    await sleep(2000); //tempo na tela

    // chama setup novamente...
    await setupJogo();
}
// função pra verificar tentativa do player
function verificarJogada(idxCorAtual) {
    if (sequenciaAtualGlobal[idxCorAtual] !== tentativaAtualGlobal[idxCorAtual]) return false;
    return true;
}
// função pra acender um botão
function acenderBotao(botao) {
    //cancela timeout pendente, se houver
    if (botao.dataset.timeoutId) {
        clearTimeout(Number(botao.dataset.timeoutId));
        botao.dataset.timeoutId = "";
    }

    botao.classList.add('ativo');
}
// apagando botão
function apagarBotao(botao) {
    botao.classList.remove('ativo');
    botao.dataset.timeoutId = "";
}
// seta delay mínimo antes de apagar
function solicitarApagarBotao(botao) {
    if (botao.dataset.timeoutId) return;

    const timeoutId = setTimeout(() => apagarBotao(botao), 250);

    botao.dataset.timeoutId = String(timeoutId);
}
// função pra mostrar sequência atual de cores
async function mostrarSequenciaGlobal() {
    for (const cor of sequenciaAtualGlobal) {
        if (partidaController?.signal.aborted) return; // CHECK:

        acenderBotao(arrayLedsAcesos[cor]);
        await delayComPausa(TEMPO_LED_ACESO);
        apagarBotao(arrayLedsAcesos[cor]);

        if (partidaController?.signal.aborted) return;
        await delayComPausa(TEMPO_LED_APAGADO);
    }
}

function mostrarPlacar() {

}

async function terminarJogo() {
    printaString(msgsSistema, 8, 1); //O JOGO ACABOU!
    await sleep(2000);

    mostrarPlacar(); // TODO: checar tb se precisa de await aqui
    await resetJogo();
}

// SECTION: menus

// TODO: definir melhor como será mostrado o menu
// TEST:
async function menuSetup() {
    // NOTE: msg na tela:
    // '--  Escolha  --'
    // '-- qtd player --'
    printaString(menuSetupMsgs, 0, 0);
    printaString(menuSetupMsgs, 6, 1);
    await sleep(1000);

    // ativa o texto nos botões
    arrayQtdPlayers.forEach((botao) => {
        botao.classList.add('ativo');
    });

    // vai esperar o botão com qtd de players ser selecionado
    const opcaoSelecionada = await new Promise((resolve) => {
        const controller = new AbortController(); //objeto controller

        arrayBotoes.forEach((botao, idx) => {
            botao.addEventListener('pointerdown', () => {
                acenderBotao(arrayLedsAcesos[idx]);
                solicitarApagarBotao(arrayLedsAcesos[idx]);
                controller.abort(); //remove os listeners de todos os botões
                resolve(idx+1); //libera o await entregando o número escolhido
            }, { signal: controller.signal });
        });
    });

    // setando na memória a qtd de players selecionada
    totalPlayers = opcaoSelecionada;
    qtdOriginalPlayers = totalPlayers;

    // printa na tela qnts jogadores foram confirmados
    printaString(menuSetupMsgs, 5, 0);
    printaString(menuSetupMsgs, opcaoSelecionada, 1);
    await sleep(1500);
 
    // desativa o texto nos botões
    arrayQtdPlayers.forEach((botao) => {
        botao.classList.remove('ativo');
    });
}

async function setupJogo() {
    await menuSetup(); //chama setup pra definir qtd de players

    // ativar os objetos players
    for (let i = 0; i < totalPlayers; i++) {
        playerList[i].ativar();
        playerList[i].setJogou();
    }

    // variáveis pra controlar partida e listeners dos botões
    partidaAtiva = true;
    partidaController = new AbortController();

    newRandomColor(); //gera primeira cor da sequência

    for (let i = 1; i < 5; i++) { //countdown
        printaString(msgsSistema, i, 1);
        await delayComPausa(1000);
        if (partidaController.signal.aborted) return;
    }

    await loopJogo();
}

async function loopJogo() {
    while (partidaAtiva && !partidaController.signal.aborted) {
        // mostra player atual na linha superior
        printaString(vezAtualMsgs, playerAtual, 0);
        // limpa linha inferior
        display[1].textContent = "";
        // tempo pra pausar antes da sequência
        await delayComPausa(1000);
        if (partidaController.signal.aborted) return;

        // mostra sequência de cores atual
        await mostrarSequenciaGlobal();
        if (partidaController.signal.aborted) return;

        // limpa tentativa do player anterior
        tentativaAtualGlobal = [];
        let acertouSequencia = true; //true como padrão

        for (let i = 0; i < sequenciaAtualGlobal.length; i++) {
            const corSelecionada = await aguardarCliqueJogador();
            if (partidaController.signal.aborted || corSelecionada === null) return;

            tentativaAtualGlobal.push(corSelecionada);

            if (!verificarJogada(i)) {
                acertouSequencia = false;
                break;
            }
        }

        if (acertouSequencia) {
            pontuarPlayer(PONTO_POR_ACERTO); //pontua player
            printaString(msgsSistema, 6, 1); //ACERTOU!
            await delayComPausa(1000);
            if (partidaController.signal.aborted) return;

            if (sequenciaAtualGlobal.length == MAX_SEQUENCIA) {
                printaString(vezAtualMsgs, playerAtual, 0);
                printaString(msgsSistema, 7, 1); //VOCÊ GANHOU!
                await sleep(2000);
                partidaAtiva = false;
                // CHECK:
                // terminarJogo();
                return;
            } else {
                newRandomColor(); //se acertar, +1 cor
            }

            proxPlayer();
        } else {
            printaString(msgsSistema, 5, 1); //ERROU!
            await delayComPausa(1000);
            if (partidaController.signal.aborted) return;

            retirarPlayerEIterar(); //desativa o player atual e vai pro prox válido

            if (totalPlayers <= 2) {
                terminarJogo();
                return;
            }
        }
    }
}

// chamando nossa função de entrada
setupJogo();

// VERIFY: chamadas de funções async sem await
// TODO:
// - countdown qnd voltar da pausa pro jogo?
// - como pessoa vai sair do jogo
// - quando for selecionar players, mostrar quantidade pra seleção nos botões
// - lógica pra verificar sequência a cada inserção
// - setup e loop
// COMMENT: nosso antigo struct "filaCor" não  é mais necessário, então apenas implementamos FIFO usando push() -> enqueue e shift() -> dequeue()
// COMMENT: faremos:
// ENQUEUE:
// function filaCorEnqueue(cor) {
//     filaCor.push(cor);
// }
// COMMENT: e:
// DEQUEUE: retorna 'undefined' se vazia
// function filaCorDequeue() {
//     return filaCor.shift();
// }
