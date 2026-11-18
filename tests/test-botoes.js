const azulAceso = document.querySelector('#azul-aceso');
const amareloAceso = document.querySelector('#amarelo-aceso');
const vermelhoAceso = document.querySelector('#vermelho-aceso');
const verdeAceso = document.querySelector('#verde-aceso');

const arrayBotoes = [azulAceso, amareloAceso, vermelhoAceso, verdeAceso];

function acenderBotao(botao) {
    //cancela timeout pendente, se houver
    if (botao.dataset.timeoutId) {
        clearTimeout(Number(botao.dataset.timeoutId));
        botao.dataset.timeoutId = "";
    }

    botao.classList.add('ativo');
}

function apagarBotao(botao) {
    botao.classList.remove('ativo');
    botao.dataset.timeoutId = "";
}

function solicitarApagarBotao(botao) {
    if (botao.dataset.timeoutId) return;

    const timeoutId = setTimeout(() => apagarBotao(botao), 250);

    botao.dataset.timeoutId = String(timeoutId);
}

arrayBotoes.forEach((botao) => {
    // qnd user clica
    botao.addEventListener('pointerdown', () => acenderBotao(botao));
    // qnd user libera click
    botao.addEventListener('pointerup', () => solicitarApagarBotao(botao));
    // qnd user cancela toque
    botao.addEventListener('pointercancel', () => solicitarApagarBotao(botao));
    // qnd mouse/dedo sai do botão
    botao.addEventListener('mouseleave', () => solicitarApagarBotao(botao));
});
