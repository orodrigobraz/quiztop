let perguntas = [];
let perguntaAtual = 0;
let score = 0;
let opcaoSelecionada = false;
let isJogoTreino = false;

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

// Array temporário para armazenar acertos durante a rodada
let acertosTemporarios = [];
// Chave para backup temporário de acertos em andamento
let backupKeyTemporario = null;
// Set para rastrear perguntas mostradas na rodada atual
let perguntasMostradasNaRodada = new Set();

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
        
        // Carregar acertos do Firebase (só os confirmados)
        const acertosSet = await carregarAcertosUsuario();
        
            // Tentar carregar backup temporário se existir
    const temBackup = carregarBackupTemporario();
    
    // Se há backup temporário, mostrar mensagem ao usuário
    if (temBackup && acertosTemporarios.length > 0) {
        console.log(`Carregados ${acertosTemporarios.length} acertos temporários da rodada anterior`);
        // Mostrar mensagem visual para o usuário
        const mensagemBackup = document.createElement('div');
        mensagemBackup.style.cssText = 'background: #4CAF50; color: white; padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center;';
        mensagemBackup.textContent = `🔄 Carregados ${acertosTemporarios.length} acertos da rodada anterior`;
        
        // Verificar se o container do quiz existe antes de inserir a mensagem
        const quizContainer = document.querySelector('.quiz-container');
        if (quizContainer) {
            quizContainer.insertBefore(mensagemBackup, quizContainer.firstChild);
            
            // Remover mensagem após 5 segundos
            setTimeout(() => {
                if (mensagemBackup.parentNode) {
                    mensagemBackup.parentNode.removeChild(mensagemBackup);
                }
            }, 5000);
        }
    }
    
    // Filtrar perguntas que o usuário ainda não acertou (apenas as confirmadas no Firebase)
    const restantes = todasPerguntas.filter(p => !acertosSet.has(p.pergunta_id));
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
    
    atual.opcoes.forEach((opcao, index) => {
        const li = document.createElement("li");
        li.textContent = opcao.texto;
        li.classList.add("option");
        li.onclick = verificarResposta;
        li.dataset.index = index;
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
    
    const indexSelecionado = Number(event.target.dataset.index);
    const atual = perguntas[perguntaAtual];
    const corretaIndex = atual.opcoes.findIndex(o => o.id === atual.resposta); // compara internamente
    
    // Marcar pergunta como mostrada na rodada
    perguntasMostradasNaRodada.add(atual.pergunta_id);
    
    if (indexSelecionado === corretaIndex) {
        event.target.classList.add("correct");
        score++;
        // Adicionar acerto temporário com o pergunta_id
        if (!acertosTemporarios.includes(atual.pergunta_id) && !isJogoTreino) {
            acertosTemporarios.push(atual.pergunta_id);
        }
        criarConfetes();
    } else {
        event.target.classList.add("incorrect");
    }
    
    setTimeout(async () => {
        opcaoSelecionada = false;
        perguntaAtual++;
        if (perguntaAtual < perguntas.length) {
            mostrarPergunta();
        } else {
            await mostrarResultadoFinal();
        }
    }, 500);
}


async function mostrarResultadoFinal() {
    const mainDiv = document.querySelector(".quiz-container");
    const answered = perguntas.length;
    const percent = answered > 0 ? ((score / answered) * 100).toFixed(0) : 0;
    const points = calcularPontosRanking(score, answered);
    
    // Salvar acertos no Firebase apenas quando a rodada terminar
    if (acertosTemporarios.length > 0 && !isJogoTreino) {
        await salvarAcertosRodada(acertosTemporarios);
    }
    
    if (!isJogoTreino) salvarResultadoRanking(points, score, answered).catch(() => {});
    mainDiv.innerHTML = `
        <h1>Seus resultados:</h1>
        <h2>${score} de ${answered}</h2>
        <h3>${percent}% de aproveitamento</h3>
        ${!isJogoTreino ? `<h3>Pontos no ranking: ${points}</h3>` : '<h3>Modo Treino Finalizado! (Pontuação não contabilizada)</h3>'}
        <div style="display:flex; gap:8px; margin-top:12px; justify-content:center;">
            <button id="reiniciar-quiz">Jogar novamente?</button>
            ${!isJogoTreino ? '<button id="abrir-ranking">Ver Ranking</button>' : ''}
        </div>
    `;
    document.getElementById("reiniciar-quiz").onclick = () => location.reload();
    if (!isJogoTreino) {
        document.getElementById("abrir-ranking").onclick = () => {
            location.href = "ranking.html";
        };
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Esconde controle de quantidade até login
    if (qtdPerguntasContainer) qtdPerguntasContainer.style.display = "none";

    // Limpar backups temporários antigos ao carregar a página
    limparBackupsTemporariosAntigos();

    inicializarFirebaseEAUTH();

    const btnTreino = document.getElementById("jogo-treino");
    if (btnTreino) {
        btnTreino.onclick = () => {
            isJogoTreino = true;
            const authContainer = document.querySelector('.auth-container');
            if (authContainer) authContainer.classList.add('hidden');
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) welcomeMessage.style.display = 'none';
            qtdPerguntasContainer.style.display = "block";
        };
    }

    async function iniciarQuiz() {
        const quantidade = parseInt(quantidadeInput.value, 10);
        if (!currentUser && !isJogoTreino) {
            alert("Faça login com sua conta Google para iniciar o quiz.");
            return;
        }
        if (quantidade > 0) {
            // Verificar se há perguntas suficientes disponíveis
            try {
                const resposta = await fetch("perguntas.json");
                const todasPerguntas = await resposta.json();
                const totalPerguntas = todasPerguntas.length;
                
                // Carregar acertos do usuário
                const acertosSet = await carregarAcertosUsuario();
                const acertosUsuario = acertosSet.size;
                
                // Calcular perguntas disponíveis
                const perguntasDisponiveis = totalPerguntas - acertosUsuario;
                
                // Verificar se a quantidade solicitada é maior que as disponíveis
                if (quantidade > perguntasDisponiveis) {
                    // Mostrar alerta simples
                    alert(`Quantidade de perguntas disponível pra você: ${perguntasDisponiveis}`);
                    return; // Não iniciar o quiz
                }
                
                // Se chegou aqui, há perguntas suficientes
                // Limpar acertos temporários ao iniciar nova rodada
                acertosTemporarios = [];
                // Limpar perguntas mostradas na rodada
                perguntasMostradasNaRodada.clear();
                // Gerar nova chave de backup para esta rodada
                backupKeyTemporario = `quiz_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                qtdPerguntasContainer.style.display = "none";
                quizContent.style.display = "block";
                carregarPerguntas(quantidade);
                
            } catch (error) {
                console.error("Erro ao verificar perguntas disponíveis:", error);
                alert("Erro ao verificar perguntas disponíveis. Tente novamente.");
            }
        } else {
            alert("Insira um número válido de perguntas.");
        }
    }

    if (iniciarQuizButton) iniciarQuizButton.onclick = iniciarQuiz;
    if (quantidadeInput) quantidadeInput.onkeyup = e => { if (e.key === "Enter") iniciarQuiz(); };
    
    // Adicionar listener para salvar backup antes de fechar a página
    window.addEventListener('beforeunload', () => {
        if (acertosTemporarios.length > 0) {
            salvarBackupTemporario();
        }
    });
    
    // Adicionar listener para salvar backup quando a página perder o foco
    window.addEventListener('blur', () => {
        if (acertosTemporarios.length > 0) {
            salvarBackupTemporario();
        }
    });
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
        // Filtrar apenas acertos confirmados (não temporários)
        const acertosConfirmados = arr.filter(id => !id.toString().includes('temp_'));
        acertosConfirmados.forEach(id => set.add(id));
    } catch {}
    return set;
}

function gerarStorageKeyAcertos() {
    const uid = currentUser && currentUser.uid ? currentUser.uid : "anon";
    return `quiz_acertos_${uid}`;
}

// Função modificada para não salvar acertos imediatamente
async function marcarAcerto(pergunta) {
    // Esta função agora só é chamada para compatibilidade, mas não salva no Firebase
    // Os acertos são salvos apenas quando a rodada termina
    console.log("Acerto marcado temporariamente:", pergunta?.pergunta_id);
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

// Função para salvar backup temporário dos acertos
function salvarBackupTemporario() {
    if (backupKeyTemporario && acertosTemporarios.length > 0) {
        try {
            localStorage.setItem(backupKeyTemporario, JSON.stringify({
                acertos: acertosTemporarios,
                timestamp: Date.now(),
                userId: currentUser?.uid || 'anon'
            }));
        } catch (error) {
            console.warn("Não foi possível salvar backup temporário:", error);
        }
    }
}

// Função para carregar backup temporário (se existir)
function carregarBackupTemporario() {
    if (!backupKeyTemporario) return;
    
    try {
        const backup = localStorage.getItem(backupKeyTemporario);
        if (backup) {
            const data = JSON.parse(backup);
            // Verificar se o backup é recente (menos de 1 hora)
            const umaHora = 60 * 60 * 1000;
            if (Date.now() - data.timestamp < umaHora && data.userId === (currentUser?.uid || 'anon')) {
                acertosTemporarios = data.acertos || [];
                console.log("Backup temporário carregado:", acertosTemporarios.length, "acertos");
                return true;
            }
        }
    } catch (error) {
        console.warn("Erro ao carregar backup temporário:", error);
    }
    return false;
}

// Função para verificar se há acertos temporários pendentes
function verificarAcertosTemporariosPendentes() {
    try {
        const umaHora = 60 * 60 * 1000;
        const agora = Date.now();
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('quiz_temp_')) {
                try {
                    const backup = localStorage.getItem(key);
                    if (backup) {
                        const data = JSON.parse(backup);
                        if (agora - data.timestamp < umaHora && data.userId === (currentUser?.uid || 'anon')) {
                            return true; // Há acertos temporários pendentes
                        }
                    }
                } catch (error) {
                    // Ignorar erros de parsing
                }
            }
        }
    } catch (error) {
        console.warn("Erro ao verificar acertos temporários pendentes:", error);
    }
    return false;
}

// Função para limpar backup temporário
function limparBackupTemporario() {
    if (backupKeyTemporario) {
        try {
            localStorage.removeItem(backupKeyTemporario);
            backupKeyTemporario = null;
        } catch (error) {
            console.warn("Erro ao limpar backup temporário:", error);
        }
    }
}

// Função para limpar backups temporários antigos (mais de 1 hora)
function limparBackupsTemporariosAntigos() {
    try {
        const umaHora = 60 * 60 * 1000;
        const agora = Date.now();
        
        // Procurar por todas as chaves de backup temporário
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('quiz_temp_')) {
                try {
                    const backup = localStorage.getItem(key);
                    if (backup) {
                        const data = JSON.parse(backup);
                        if (agora - data.timestamp > umaHora) {
                            localStorage.removeItem(key);
                            console.log(`Backup temporário antigo removido: ${key}`);
                        }
                    }
                } catch (error) {
                    // Se não conseguir ler, remover a chave
                    localStorage.removeItem(key);
                }
            }
        }
    } catch (error) {
        console.warn("Erro ao limpar backups temporários antigos:", error);
    }
}

// Nova função para salvar acertos da rodada no Firebase
async function salvarAcertosRodada(acertosIds) {
    const uid = currentUser && currentUser.uid ? currentUser.uid : null;
    if (usingFirestore && uid && acertosIds.length > 0) {
        try {
            const ref = firebaseDb.collection("users").doc(uid);
            // Usar arrayUnion para adicionar todos os acertos da rodada
            await ref.set({ 
                acertos: firebase.firestore.FieldValue.arrayUnion(...acertosIds) 
            }, { merge: true });
            console.log(`Acertos da rodada salvos no Firebase: ${acertosIds.length} acertos`);
            
            // Limpar backup temporário após salvar com sucesso
            limparBackupTemporario();
        } catch (error) {
            console.error("Erro ao salvar acertos da rodada:", error);
            // Fallback para localStorage se falhar no Firebase
            acertosIds.forEach(id => marcarAcertoLocal(id));
            
            // Mostrar mensagem de erro
            const mensagemErro = document.createElement('div');
            mensagemErro.style.cssText = 'background: #f44336; color: white; padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center;';
            mensagemErro.textContent = `❌ Erro ao salvar acertos. Salvando localmente...`;
            
            const quizContainer = document.querySelector('.quiz-container');
            if (quizContainer) {
                quizContainer.insertBefore(mensagemErro, quizContainer.firstChild);
                
                // Remover mensagem após 5 segundos
                setTimeout(() => {
                    if (mensagemErro.parentNode) {
                        mensagemErro.parentNode.removeChild(mensagemErro);
                    }
                }, 5000);
            }
        }
    } else if (acertosIds.length > 0) {
        // Fallback para localStorage se não houver Firebase
        acertosIds.forEach(id => marcarAcertoLocal(id));
        // Limpar backup temporário
        limparBackupTemporario();
    }
}