// TEST: escrevendo na tela: usar o tspan!!
function escreverNaTela() {
    const tela = document.querySelector("#container svg tspan");
    tela.textContent = 'oiiiii';
}

const botaoTeste = document.querySelector("button");

if (botaoTeste) {
    botaoTeste.addEventListener('click', escreverNaTela);
}
