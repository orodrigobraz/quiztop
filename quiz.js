function selecionarIndicesAleatorios(total, quantidade) {
    const indicesAleatorios = new Set();

    while (indicesAleatorios.size < quantidade) {
        indicesAleatorios.add(Math.floor(Math.random() * total));
    }

    return Array.from(indicesAleatorios);
}

let perguntas = [];
let perguntaAtual = 0;
let score = 0;
let opcaoSelecionada = false;

const questionText = document.querySelector(".question-text");
const optionsList = document.querySelector(".options-list");
const scoreText = document.querySelector(".score");

async function carregarPerguntas(quantidade) {
    try {
        const resposta = await fetch("perguntas.json");
        perguntas = await resposta.json();

        const indicesSelecionados = selecionarIndicesAleatorios(perguntas.length, quantidade);
        perguntas = indicesSelecionados.map(index => perguntas[index]);

        embaralharPerguntas();
        mostrarPergunta();
    } catch (error) {
        console.error("Erro ao carregar perguntas.", error);
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function embaralharPerguntas() {
    shuffleArray(perguntas);
    perguntas.forEach((pergunta) => {
        shuffleArray(pergunta["opcoes"]);
    });
}

function mostrarPergunta() {
    const atual = perguntas[perguntaAtual];
    questionText.textContent = `${perguntaAtual + 1}- ${atual["pergunta"]}`;
    optionsList.innerHTML = "";

    atual["opcoes"].forEach((opcao, index) => {
        const optionItem = document.createElement("li");
        optionItem.textContent = opcao["texto"];
        optionItem.classList.add("option");
        optionItem.setAttribute("data-option-id", index + 1);
        optionItem.addEventListener("click", verificarResposta);
        optionsList.appendChild(optionItem);
    });

    // scoreText.textContent = `Pontuação: ${score}/${perguntas.length}`;
}

function verificarResposta(event) {
    if (opcaoSelecionada) {
        return;
    }

    opcaoSelecionada = true;

    const respostaSelecionada = event.target.textContent;
    const respostaCorreta = perguntas[perguntaAtual]["opcoes"].find((opcao) => opcao["id"] === perguntas[perguntaAtual]["resposta"])["texto"];

    if (respostaSelecionada === respostaCorreta) {
        event.target.classList.add("correct");
        score++;
    } else {
        event.target.classList.add("incorrect");
    }

    setTimeout(() => {
        opcaoSelecionada = false;
        perguntaAtual++;

        if (perguntaAtual !== perguntas.length) {
            mostrarPergunta();
        } else {
            mostrarResultadoFinal();
        }
    }, 500); // Tempo de atraso em milissegundos (0.5 segundo)
}

function mostrarResultadoFinal() {
    const mainDiv = document.querySelector(".quiz-container");
    mainDiv.innerHTML = "";

    const resultadosTitulo = document.createElement("h1");
    resultadosTitulo.textContent = "Seus resultados: ";

    const resultadosQuantidade = document.createElement("h2");
    resultadosQuantidade.textContent = `${score} de ${perguntas.length}`;

    const porcentagem = document.createElement("h3");
    porcentagem.textContent = `${((score / perguntas.length) * 100) % 1 === 0 ? ((score / perguntas.length) * 100).toFixed(0) : ((score / perguntas.length) * 100).toFixed(2)}% de aproveitamento`;

    const reiniciarBotao = document.createElement("button");
    reiniciarBotao.textContent = "Jogar novamente?";
    reiniciarBotao.addEventListener("click", () => {
        location.reload();
    });

    mainDiv.appendChild(resultadosTitulo);
    mainDiv.appendChild(resultadosQuantidade);
    mainDiv.appendChild(porcentagem);
    mainDiv.appendChild(reiniciarBotao);
}

document.addEventListener("DOMContentLoaded", () => {
    const iniciarQuizButton = document.getElementById("iniciar-quiz");
    const quantidadeInput = document.getElementById("quantidade-perguntas");
    const qtdPerguntasContainer = document.querySelector(".qtd-perguntas");
    const quizContent = document.getElementById("quiz-content");

    quantidadeInput.addEventListener("keyup", (event) => {
        if (event.key === "Enter") {
            const quantidade = parseInt(quantidadeInput.value, 10);

            if (quantidade > 0) {
                qtdPerguntasContainer.style.display = "none";
                quizContent.style.display = "block";
                carregarPerguntas(quantidade);
            } else {
                alert("Insira um número válido de perguntas.");
            }
        }
    });

    iniciarQuizButton.addEventListener("click", () => {
        const quantidade = parseInt(quantidadeInput.value, 10);

        if (quantidade > 0) {
            qtdPerguntasContainer.style.display = "none";
            quizContent.style.display = "block";
            carregarPerguntas(quantidade);
        } else {
            alert("Insira um número válido de perguntas.");
        }
    });
});

carregarPerguntas();