(function(){
    let usingFirestore = false;
    let db = null;
    try {
        if (window.FIREBASE_CONFIG) {
            // Evita inicialização duplicada se a página reusar app
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(window.FIREBASE_CONFIG);
            }
            usingFirestore = true;
            db = firebase.firestore();
        }
    } catch (e) {
        usingFirestore = false;
    }

    const container = document.getElementById('ranking-list');

    async function loadRanking() {
        let entries = [];
        if (usingFirestore && db) {
            try {
                const snap = await db.collection('leaderboard').orderBy('totalPoints', 'desc').limit(50).get();
                entries = snap.docs.map(d => {
                    const v = d.data();
                    return {
                        uid: d.id,
                        displayName: v.displayName || v.email || 'Usuário',
                        totalPoints: v.totalPoints || 0,
                        totalAnswered: v.totalAnswered || 0,
                        totalCorrect: v.totalCorrect || 0
                    };
                });
            } catch (e) {
                entries = loadLocal();
            }
        } else {
            entries = loadLocal();
        }
        render(entries);
    }

    function loadLocal() {
        const raw = localStorage.getItem('quiz_leaderboard_local');
        const arr = raw ? JSON.parse(raw) : [];
        return arr.sort((a,b) => (b.totalPoints||0) - (a.totalPoints||0)).slice(0,50);
    }

    let isExpanded = false;
    let domRendered = false;

    function createRankingItem(entry, index) {
        const acc = entry.totalAnswered || 0;
        const corr = entry.totalCorrect || 0;
        const perc = acc > 0 ? Math.round((corr/acc)*100) : 0;
        
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        let positionClass = '';
        let positionText = (index + 1).toString();
        
        if (index === 0) {
            positionClass = 'medal-1';
            positionText = '🥇';
        } else if (index === 1) {
            positionClass = 'medal-2';
            positionText = '🥈';
        } else if (index === 2) {
            positionClass = 'medal-3';
            positionText = '🥉';
        }
        
        rankingItem.innerHTML = `
            <div class="ranking-position ${positionClass}">${positionText}</div>
            <div class="ranking-info">
                <div class="ranking-name">${entry.displayName}</div>
                <div class="ranking-stats">
                    <span class="ranking-points">${entry.totalPoints} pts</span>
                    <span class="ranking-accuracy">${perc}%</span>
                    <span class="ranking-ratio">${corr}/${acc}</span>
                </div>
            </div>
        `;
        return rankingItem;
    }

    function render(entries) {
        if (!entries || entries.length === 0) {
            container.innerHTML = `
                <div class="ranking-empty">
                    <div class="ranking-empty-icon">📊</div>
                    <p>Nenhum resultado ainda. Jogue para aparecer aqui!</p>
                </div>
            `;
            return;
        }
        
        if (domRendered) return;
        
        container.innerHTML = '';
        
        const top5 = entries.slice(0, 5);
        top5.forEach((entry, index) => {
            container.appendChild(createRankingItem(entry, index));
        });

        if (entries.length > 5) {
            const extraRankings = document.createElement('div');
            extraRankings.className = 'extra-rankings';
            
            const extraRankingsInner = document.createElement('div');
            extraRankingsInner.className = 'extra-rankings-inner';
            
            const rest = entries.slice(5);
            rest.forEach((entry, index) => {
                extraRankingsInner.appendChild(createRankingItem(entry, index + 5));
            });
            
            extraRankings.appendChild(extraRankingsInner);
            container.appendChild(extraRankings);
            
            const toggleDiv = document.createElement('div');
            toggleDiv.style.textAlign = 'center';
            toggleDiv.style.marginTop = '15px';
            
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'ranking-back-btn';
            toggleBtn.style.padding = '8px 20px';
            toggleBtn.style.border = 'none';
            toggleBtn.style.background = 'transparent';
            toggleBtn.style.color = '#666';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.fontWeight = 'bold';
            toggleBtn.style.textDecoration = 'underline';
            toggleBtn.style.boxShadow = 'none';
            
            toggleBtn.innerHTML = 'Ver mais ▼';
            toggleBtn.onmouseover = () => toggleBtn.style.color = '#333';
            toggleBtn.onmouseout = () => toggleBtn.style.color = '#666';

            toggleBtn.addEventListener('click', () => {
                isExpanded = !isExpanded;
                if (isExpanded) {
                    extraRankings.classList.add('expanded');
                    toggleBtn.innerHTML = 'Ver menos ▲';
                } else {
                    extraRankings.classList.remove('expanded');
                    toggleBtn.innerHTML = 'Ver mais ▼';
                }
            });
            
            toggleDiv.appendChild(toggleBtn);
            container.appendChild(toggleDiv);
        }
        domRendered = true;
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadRanking();
        
        // Configurar modal de explicação dos pontos
        const infoIcon = document.getElementById('info-icon');
        const pointsModal = document.getElementById('points-modal');
        const closeModal = document.getElementById('close-modal');
        
        // Abrir modal ao clicar no ícone de informação
        if (infoIcon) {
            infoIcon.addEventListener('click', () => {
                pointsModal.style.display = 'block';
            });
        }
        
        // Fechar modal ao clicar no X
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                pointsModal.style.display = 'none';
            });
        }
        
        // Fechar modal ao clicar fora dele
        if (pointsModal) {
            pointsModal.addEventListener('click', (e) => {
                if (e.target === pointsModal) {
                    pointsModal.style.display = 'none';
                }
            });
        }
        
        // Fechar modal com tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && pointsModal.style.display === 'block') {
                pointsModal.style.display = 'none';
            }
        });
    });
})();