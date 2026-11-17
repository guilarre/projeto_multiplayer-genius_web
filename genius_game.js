// SECTION: constantes e classes

// config geral
const MAX_BOTOES = 4; // CHECK: precisa ainda disso?
const MAX_PLAYERS = 4;
const MAX_SEQUENCIA = 12;
const PONTO_POR_ACERTO = 100;
const TEMPO_LED_ACESO = 250;

// elementos DOM
// componentes acesos do svg
const azulAceso = document.querySelector('#azul-aceso');
const amareloAceso = document.querySelector('#amarelo-aceso');
const vermelhoAceso = document.querySelector('#vermelho-aceso');
const verdeAceso = document.querySelector('#verde-aceso');
// array com os botões acesos pra ativarmos/desativarmos
const arrayBotoes = [azulAceso, amareloAceso, vermelhoAceso, verdeAceso];
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

// cores
const corToString = ["AZUL", "AMARELO", "VERMELHO", "VERDE"];
// menuSetup()
const menuSetupMsgs = ["--  Escolha  --", "1 jogador", "2 jogadores", "3 jogadores", "4 jogadores", "-- Confirmado --"];
// menuPausa()
const menuPausaMsgs = ["--   PAUSA   --", "Voltar", "Placar atual", "Reiniciar jogo", "Terminar jogo"];
// de quem é a vez atual
const vezAtualMsgs = ["-- Player 1 --", "-- Player 2 --", "-- Player 3 --", "-- Player 4 --"];
// mostrarPlacar()
const pontuacaoMsgs = ["P1: ", "P2: ", "P3: ", "P4: "];
// msgs do sistema
const msgsSistema = ["Reiniciando...", "3...", "2...", "1...", "START!", "ERROU!", "ACERTOU!", "VOCE GANHOU!", "O JOGO ACABOU!"];

// SECTION: vars globais e funções do jogo

// vars da sequência correta e tentativa do player
let sequenciaAtualGlobal = [];
let tentativaAtualGlobal = [];
// ponteiro pra indicar onde estamos olhando ao verificar jogada
let corAtual = 0;
// função pra inserir uma cor aleatória na var global
function newRandomColor() {
    const randNum = Math.floor(Math.random() * 4);
    sequenciaAtualGlobal.push(randNum);
}

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

// SECTION: funções do jogo

// função pra funcionar como o delay() do arduino (função que chamar ela deve ser async)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// pra printar no elem DOM corretos a msg correta
function printaString(arrayMsg, idx, displayY) {
    display[displayY].textContent = arrayMsg[idx];
}
// função pra resetar jogo
async function resetJogo() {
    // reseta sequenciaAtualGlobal
    sequenciaAtualGlobal = [];
    // desativa players
    playerList.forEach(player => player.reset());
    // retorna aos valores originais:
    playerAtual = 0;
    totalPlayers = 1;
    qtdOriginalPlayers = 1;

    // msg confirmando que resetou tudo
    printaString(msgsSistema, 0, 0);
    sleep(2000); //tempo na tela

    // chama setup novamente...
    menuSetup();
    newRandomColor();
}
// função pra verificar tentativa do player
// OBS: pra resolver o verificarJogada:
// sempre que inserir a tentativa em tentativaAtualGlobal, tem que chamar
// verificarJogada. caso retorne falso, perde.
//
// function verificarJogada() {
//     let sequenciaAtualCopia = sequenciaAtualGlobal;
//     let tentativaAtualCopia = tentativaAtualGlobal;
//
//     if (tentativaAtualCopia.qtd != sequenciaAtualGlobal) return false;
//
//     // TODO: mudaremos isso daqui pra não pecorrer td vez que for verificar
//     for (let i = 0; i < sequenciaAtualGlobal.qtd; i++) {
//         const corAtualTentativa = tentativaAtualCopia.shift();
//         const corAtualGlobal = sequenciaAtualCopia.shift();
//
//         if (corAtualTentativa != corAtualGlobal) return false;
//     }
//     return true;
// }
function verificarJogada(idxCorAtual) {
    if (sequenciaAtualGlobal[idxCorAtual] !== tentativaAtualGlobal[idxCorAtual]) return false;
    return true;
}

// FALTA:

function mostrarSequenciaGlobal() {

}

function mostrarPlacar() {

}

function terminarJogo() {

}

function delayComPausa(tempoMs) {
    
}

function verificarBotaoMenu() {

}


// SECTION: menus

function menuSetup() {

}

// menu pausa
async function menuPausa() {
    let opcaoSelecionada = 1; //opção inicial na tela

    printaString(menuPausaMsgs, 0, 0);
    printaString(menuPausaMsgs, opcaoSelecionada, 0);

    // TODO: loop até confirmação:: n pode usar while (true)
}

function gameSetup() {
    menuSetup();
    newRandomColor();

    for (let i = 1; i < 5; i++) {
        printaString(msgsSistema, i, 1);
        delayComPausa(1000); // TODO:
    }
}

function gameLoop() {

}


// TODO:
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
