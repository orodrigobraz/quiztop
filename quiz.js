let perguntas = [];
let perguntaAtual = 0;
let score = 0;
let opcaoSelecionada = false;

// Estado de auth e persistência
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let usingFirestore = false;

// UI
const questionText = document.querySelector(".question-text");
const optionsList = document.querySelector(".options-list");
const qtdPerguntasContainer = document.querySelector(".qtd-perguntas");
const quizContent = document.getElementById("quiz-content");
const iniciarQuizButton = document.getElementById("iniciar-quiz");
const quantidadeInput = document.getElementById("quantidade-perguntas");
const loginButton = document.getElementById("login-google");
const logoutButton = document.getElementById("logout");
const userInfo = document.getElementById("user-info");

function selecionarIndicesAleatorios(total, quantidade) {
    const indices = new Set();
    while (indices.size < quantidade) {
        indices.add(Math.floor(Math.random() * total));
    }
    return Array.from(indices);
}

async function carregarPerguntas(quantidade) {
    try {
        const resposta = await fetch("perguntas.json");
        const todasPerguntas = await resposta.json();
        const acertosSet = await carregarAcertosUsuario();
        const restantes = todasPerguntas.filter(p => !acertosSet.has(p.resposta_id));
        const qtdParaUsar = Math.max(0, Math.min(restantes.length, quantidade));
        if (qtdParaUsar === 0) {
            perguntas = [];
            perguntaAtual = 0;
            mostrarResultadoFinal();
            return;
        }
        const indices = selecionarIndicesAleatorios(restantes.length, qtdParaUsar);
        perguntas = indices.map(i => restantes[i]);
        embaralharPerguntas();
        mostrarPergunta();
    } catch (error) {
        alert("Erro ao carregar perguntas.");
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
    perguntas.forEach(p => shuffleArray(p.opcoes));
}

function mostrarPergunta() {
    const atual = perguntas[perguntaAtual];
    if (!atual) { mostrarResultadoFinal(); return; }
    questionText.textContent = `${perguntaAtual + 1}- ${atual.pergunta}`;
    optionsList.innerHTML = "";
    atual.opcoes.forEach(opcao => {
        const li = document.createElement("li");
        li.textContent = opcao.texto;
        li.classList.add("option");
        li.onclick = verificarResposta;
        li.dataset.optionId = opcao.id;
        optionsList.appendChild(li);
    });
}

// Função para criar confetes de comemoração usando Canvas Confetti
function criarConfetes() {
    // Verificar se a biblioteca está disponível
    if (typeof confetti === 'undefined') {
        console.warn('Biblioteca Canvas Confetti não carregada');
        return;
    }
    
    // Configuração dos confetes
    const count = 200;
    const defaults = {
        origin: { y: 0.7 },
        spread: 360,
        ticks: 50,
        gravity: 0,
        decay: 0.94,
        startVelocity: 30,
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd']
    };

    function fire(particleRatio, opts) {
        confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
        });
    }

    // Disparar confetes em sequência para efeito mais dramático
    fire(0.25, {
        spread: 26,
        startVelocity: 55,
    });
    
    fire(0.2, {
        spread: 60,
    });
    
    fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
    });
    
    fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
    });
    
    fire(0.1, {
        spread: 120,
        startVelocity: 45,
    });
}

function verificarResposta(event) {
    if (opcaoSelecionada) return;
    opcaoSelecionada = true;
    const selecionada = Number(event.target.dataset.optionId);
    const correta = perguntas[perguntaAtual].resposta;
    if (selecionada === correta) {
        event.target.classList.add("correct");
        score++;
        marcarAcerto(perguntas[perguntaAtual]);
        
        // Criar confetes de comemoração para resposta correta
        criarConfetes();
    } else {
        event.target.classList.add("incorrect");
    }
    setTimeout(() => {
        opcaoSelecionada = false;
        perguntaAtual++;
        if (perguntaAtual < perguntas.length) {
            mostrarPergunta();
        } else {
            mostrarResultadoFinal();
        }
    }, 500);
}

function mostrarResultadoFinal() {
    const mainDiv = document.querySelector(".quiz-container");
    const answered = perguntas.length;
    const percent = answered > 0 ? ((score / answered) * 100).toFixed(0) : 0;
    const points = calcularPontosRanking(score, answered);
    salvarResultadoRanking(points, score, answered).catch(() => {});
    mainDiv.innerHTML = `
        <h1>Seus resultados:</h1>
        <h2>${score} de ${answered}</h2>
        <h3>${percent}% de aproveitamento</h3>
        <h3>Pontos no ranking: ${points}</h3>
        <div style="display:flex; gap:8px; margin-top:12px; justify-content:center;">
            <button id="reiniciar-quiz">Jogar novamente?</button>
            <button id="abrir-ranking">Ver Ranking</button>
        </div>
    `;
    document.getElementById("reiniciar-quiz").onclick = () => location.reload();
    document.getElementById("abrir-ranking").onclick = () => {
        location.href = "ranking.html";
    };
}

document.addEventListener("DOMContentLoaded", () => {
    // Esconde controle de quantidade até login
    if (qtdPerguntasContainer) qtdPerguntasContainer.style.display = "none";

    inicializarFirebaseEAUTH();

    function iniciarQuiz() {
        const quantidade = parseInt(quantidadeInput.value, 10);
        if (!currentUser) {
            alert("Faça login com sua conta Google para iniciar o quiz.");
            return;
        }
        if (quantidade > 0) {
            qtdPerguntasContainer.style.display = "none";
            quizContent.style.display = "block";
            carregarPerguntas(quantidade);
        } else {
            alert("Insira um número válido de perguntas.");
        }
    }

    if (iniciarQuizButton) iniciarQuizButton.onclick = iniciarQuiz;
    if (quantidadeInput) quantidadeInput.onkeyup = e => { if (e.key === "Enter") iniciarQuiz(); };
});

// ----------------------
// Auth + Persistência
// ----------------------
function inicializarFirebaseEAUTH() {
    try {
        if (window.FIREBASE_CONFIG) {
            firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
            firebaseAuth = firebase.auth();
            firebaseDb = firebase.firestore();
            usingFirestore = true;
        }
    } catch (e) {
        usingFirestore = false;
    }

    // Handlers de UI de login/logout
    if (loginButton) {
        loginButton.onclick = async () => {
            console.log("Botão de login clicado");
            if (!usingFirestore) {
                console.log("Firebase não configurado");
                alert("Firebase não configurado (config.js). Preencha suas credenciais do Firebase para ativar o login Google.");
                return;
            }
            if (location && location.protocol === 'file:') {
                console.log("Protocolo file:// detectado");
                alert("Para autenticar com o Google, rode via http(s) (ex.: http://localhost:8080). Abrir via file:// causa erros de configuração.");
            }
            console.log("Iniciando autenticação Google...");
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                console.log("Chamando signInWithPopup...");
                const result = await firebaseAuth.signInWithPopup(provider);
                console.log("Resultado do popup:", result);
                currentUser = (result && result.user) ? result.user : firebaseAuth.currentUser;
                console.log("Usuário atual:", currentUser);
                if (currentUser) {
                    console.log("Salvando dados do usuário...");
                    try {
                        console.log("Tentando acessar Firestore...");
                        console.log("Firebase DB:", firebaseDb);
                        console.log("Collection users existe?", firebaseDb.collection("users"));
                        
                        const nome = currentUser.displayName || currentUser.email || "Usuário";
                        console.log("Salvando usuário:", nome, "com UID:", currentUser.uid);
                        
                        const userRef = firebaseDb.collection("users").doc(currentUser.uid);
                        console.log("Referência do usuário criada:", userRef);
                        
                        await userRef.set({
                            displayName: nome,
                            email: currentUser.email || null,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        console.log("Dados do usuário salvos com sucesso");
                    } catch (e) { 
                        console.error("Erro detalhado ao salvar dados do usuário:", e);
                        console.error("Código do erro:", e.code);
                        console.error("Mensagem do erro:", e.message);
                        console.error("Stack trace:", e.stack);
                    }
                    atualizarUIParaAuth();
                }
            } catch (err) {
                console.error("Erro na autenticação:", err);
                const code = err && err.code ? err.code : '';
                if (code === 'auth/configuration-not-found' || code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') {
                    console.log("Tentando redirect...");
                    try {
                        await firebaseAuth.signInWithRedirect(provider);
                        return;
                    } catch (e2) {
                        console.error("Erro no redirect:", e2);
                        alert("Falha ao autenticar: " + (e2 && e2.message ? e2.message : String(e2)) + "\nVerifique: Authentication > Sign-in method (Google habilitado) e Authorized domains (inclua localhost)." );
                        return;
                    }
                }
                alert("Falha ao autenticar: " + err.message);
            }
        };
    }
    if (logoutButton) {
        logoutButton.onclick = async () => {
            if (usingFirestore && firebaseAuth) await firebaseAuth.signOut();
            currentUser = null;
            atualizarUIParaAuth();
        };
    }

    // Removido: handlers de email/senha

    if (usingFirestore && firebaseAuth) {
        firebaseAuth.onAuthStateChanged(async user => {
            currentUser = user;
            if (currentUser) {
                try {
                    const nome = currentUser.displayName || currentUser.email || "Usuário";
                    await firebaseDb.collection("users").doc(currentUser.uid).set({
                        displayName: nome,
                        email: currentUser.email || null,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (e) { /* ignore */ }
            }
            atualizarUIParaAuth();
        });
        // Trata retorno do fluxo via redirect
        firebaseAuth.getRedirectResult().then((result) => {
            if (result && result.user) {
                currentUser = result.user;
                atualizarUIParaAuth();
            }
        }).catch(() => {});
    } else {
        // Sem Firebase, não há auth real; mantém UI de login ativa
        currentUser = null;
        atualizarUIParaAuth();
    }
}

function atualizarUIParaAuth() {
    console.log("atualizarUIParaAuth chamada com usuário:", currentUser);
    
    // Elementos do cabeçalho fixo
    const authHeader = document.getElementById('auth-header');
    const userGreeting = document.getElementById('user-greeting');
    const headerLogoutBtn = document.getElementById('header-logout');
    
    // Elemento da mensagem de boas-vindas
    const welcomeMessage = document.querySelector('.welcome-message');
    
    // Container de autenticação
    const authContainer = document.querySelector('.auth-container');
    
    if (currentUser) {
        console.log("Usuário logado, atualizando UI...");
        
        // Mostrar cabeçalho fixo
        if (authHeader) {
            authHeader.style.display = "flex";
            console.log("Cabeçalho fixo mostrado");
        }
        
        // Esconder container de autenticação completo
        if (authContainer) {
            authContainer.classList.add('hidden');
            console.log("Container de autenticação escondido");
        }
        
        // Esconder mensagem de boas-vindas
        if (welcomeMessage) {
            welcomeMessage.style.display = "none";
            console.log("Mensagem de boas-vindas escondida");
        }
        
        // Atualizar saudação no cabeçalho
        if (userGreeting) {
            const nome = currentUser.displayName || currentUser.email || "Usuário";
            userGreeting.textContent = `Olá, ${nome}`;
            console.log("Saudação no cabeçalho atualizada");
        }
        
        // Configurar botão de logout do cabeçalho
        if (headerLogoutBtn) {
            headerLogoutBtn.onclick = async () => {
                if (usingFirestore && firebaseAuth) await firebaseAuth.signOut();
                currentUser = null;
                atualizarUIParaAuth();
            };
            console.log("Botão de logout do cabeçalho configurado");
        }
        
        // Esconder elementos de autenticação antigos
        if (userInfo) userInfo.style.display = "none";
        if (loginButton) {
            loginButton.style.display = "none";
            console.log("Botão de login escondido");
        }
        if (logoutButton) logoutButton.style.display = "none";
        
        // Mostrar conteúdo do quiz
        if (qtdPerguntasContainer && quizContent) {
            quizContent.style.display = "none";
            qtdPerguntasContainer.style.display = "block";
            console.log("Container de quantidade de perguntas mostrado");
        }
    } else {
        console.log("Usuário não logado, resetando UI...");
        
        // Esconder cabeçalho fixo
        if (authHeader) {
            authHeader.style.display = "none";
            console.log("Cabeçalho fixo escondido");
        }
        
        // Mostrar container de autenticação completo
        if (authContainer) {
            authContainer.classList.remove('hidden');
            console.log("Container de autenticação mostrado");
        }
        
        // Mostrar mensagem de boas-vindas
        if (welcomeMessage) {
            welcomeMessage.style.display = "block";
            console.log("Mensagem de boas-vindas mostrada");
        }
        
        // Mostrar elementos de autenticação antigos
        if (userInfo) userInfo.style.display = "none";
        if (loginButton) loginButton.style.display = "inline-block";
        if (logoutButton) logoutButton.style.display = "none";
        
        // Esconder conteúdo do quiz
        if (qtdPerguntasContainer) qtdPerguntasContainer.style.display = "none";
        if (quizContent) quizContent.style.display = "none";
    }
}

async function carregarAcertosUsuario() {
    const set = new Set();
    const uid = currentUser && currentUser.uid ? currentUser.uid : null;
    if (usingFirestore && uid) {
        try {
            const ref = firebaseDb.collection("users").doc(uid);
            const snap = await ref.get();
            const data = snap.exists ? snap.data() : null;
            const acertos = (data && Array.isArray(data.acertos)) ? data.acertos : [];
            acertos.forEach(id => set.add(id));
            return set;
        } catch (e) {
            return carregarAcertosLocal();
        }
    }
    return carregarAcertosLocal();
}

function carregarAcertosLocal() {
    const set = new Set();
    const key = gerarStorageKeyAcertos();
    try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        arr.forEach(id => set.add(id));
    } catch {}
    return set;
}

function gerarStorageKeyAcertos() {
    const uid = currentUser && currentUser.uid ? currentUser.uid : "anon";
    return `quiz_acertos_${uid}`;
}

async function marcarAcerto(pergunta) {
    const idPergunta = pergunta && pergunta.resposta_id;
    if (!idPergunta) return;
    const uid = currentUser && currentUser.uid ? currentUser.uid : null;
    if (usingFirestore && uid) {
        try {
            const ref = firebaseDb.collection("users").doc(uid);
            await ref.set({ acertos: firebase.firestore.FieldValue.arrayUnion(idPergunta) }, { merge: true });
        } catch {
            marcarAcertoLocal(idPergunta);
        }
    } else {
        marcarAcertoLocal(idPergunta);
    }
}

function marcarAcertoLocal(idPergunta) {
    const key = gerarStorageKeyAcertos();
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    if (!arr.includes(idPergunta)) {
        arr.push(idPergunta);
        localStorage.setItem(key, JSON.stringify(arr));
    }
}

function calcularPontosRanking(certos, respondidas) {
    if (respondidas <= 0) return 0;
    const base = (certos * certos) / respondidas; // privilegia acurácia e volume
    const volumeFactor = 1 + (respondidas / 20); // mais perguntas, mais peso gradual
    return Math.max(0, Math.round(base * volumeFactor * 10));
}

async function salvarResultadoRanking(pontos, certos, respondidas) {
    const uid = currentUser && currentUser.uid ? currentUser.uid : null;
    const nome = currentUser ? (currentUser.displayName || currentUser.email || "Usuário") : "Anônimo";
    if (usingFirestore && uid) {
        try {
            const userRef = firebaseDb.collection("users").doc(uid);
            await firebaseDb.runTransaction(async (tx) => {
                const snap = await tx.get(userRef);
                const prev = snap.exists ? snap.data() : {};
                const totalPoints = (prev.totalPoints || 0) + pontos;
                const totalAnswered = (prev.totalAnswered || 0) + respondidas;
                const totalCorrect = (prev.totalCorrect || 0) + certos;
                const gamesPlayed = (prev.gamesPlayed || 0) + 1;
                tx.set(userRef, {
                    displayName: nome,
                    totalPoints,
                    totalAnswered,
                    totalCorrect,
                    gamesPlayed,
                    lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            // opcional: registrar jogo
            await firebaseDb.collection("users").doc(uid).collection("games").add({
                points: pontos,
                correct: certos,
                answered: respondidas,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // leaderboard agregado
            await firebaseDb.collection("leaderboard").doc(uid).set({
                displayName: nome,
                totalPoints: firebase.firestore.FieldValue.increment(pontos),
                totalAnswered: firebase.firestore.FieldValue.increment(respondidas),
                totalCorrect: firebase.firestore.FieldValue.increment(certos),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            salvarResultadoRankingLocal(pontos, nome, certos, respondidas);
        }
    } else {
        salvarResultadoRankingLocal(pontos, nome, certos, respondidas);
    }
}

function salvarResultadoRankingLocal(pontos, nome, certos, respondidas) {
    const key = "quiz_leaderboard_local";
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const uid = currentUser && currentUser.uid ? currentUser.uid : "anon";
    const idx = arr.findIndex(x => x.uid === uid);
    if (idx >= 0) {
        arr[idx].displayName = nome;
        arr[idx].totalPoints = (arr[idx].totalPoints || 0) + pontos;
        arr[idx].totalAnswered = (arr[idx].totalAnswered || 0) + respondidas;
        arr[idx].totalCorrect = (arr[idx].totalCorrect || 0) + certos;
        arr[idx].updatedAt = Date.now();
    } else {
        arr.push({ uid, displayName: nome, totalPoints: pontos, totalAnswered: respondidas, totalCorrect: certos, updatedAt: Date.now() });
    }
    localStorage.setItem(key, JSON.stringify(arr));
}