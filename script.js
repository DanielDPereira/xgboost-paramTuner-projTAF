let rawData = [];
let groupedData = {};
let timestamps = [];
let currentIndex = 0;

function jumpToExecution(time) {
    const idx = timestamps.indexOf(time);
    if (idx !== -1) {
        currentIndex = idx;
        document.getElementById('executionSelect').selectedIndex = currentIndex;
        resetSortAndRender();
        document.getElementById('mainDashboard').scrollIntoView({behavior: 'smooth'});
    }
}

let evoChartInst = null, classChartInst = null, regChartInst = null, featChartInst = null;

let sortState = { class: { col: 'auc', asc: false }, reg: { col: 'r2', asc: false } };
const classImportantParams = ['param_max_depth', 'param_learning_rate', 'param_n_estimators', 'spw', 'param_subsample', 'param_colsample_bytree', 'param_min_child_weight', 'param_gamma', 'param_reg_lambda', 'param_reg_alpha'];
const regImportantParams = ['param_max_depth', 'param_learning_rate', 'param_n_estimators', 'param_reg_lambda', 'param_reg_alpha', 'param_subsample', 'param_colsample_bytree', 'param_min_child_weight', 'param_gamma'];

document.addEventListener("DOMContentLoaded", () => {
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const htmlEl = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = themeToggleBtn.querySelector('.theme-text');
    
    function applyThemeToCharts(theme) {
        if (theme === 'dark') {
            Chart.defaults.color = '#94a3b8';
            Chart.defaults.scale.grid.color = '#1e325c';
        } else {
            Chart.defaults.color = '#64748b';
            Chart.defaults.scale.grid.color = '#e2e8f0';
        }
        if(rawData.length > 0) renderDashboard();
    }

    function setTheme(theme) {
        htmlEl.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            themeIcon.innerText = '☀️';
            themeText.innerText = 'Modo Claro';
        } else {
            themeIcon.innerText = '🌙';
            themeText.innerText = 'Modo Escuro';
        }
        applyThemeToCharts(theme);
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });

    document.getElementById('csvFileInput').addEventListener('change', handleFileUpload);
    document.getElementById('executionSelect').addEventListener('change', (e) => { currentIndex = e.target.selectedIndex; resetSortAndRender(); });
    document.getElementById('conjuntoSelect').addEventListener('change', renderDashboard);
    document.getElementById('aeroSelect').addEventListener('change', renderDashboard);
    document.getElementById('targetSelect').addEventListener('change', renderDashboard);
    document.getElementById('btnPrev').addEventListener('click', () => changeExecution(-1));
    document.getElementById('btnNext').addEventListener('click', () => changeExecution(1));

    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', (e) => handleSort(e.currentTarget.dataset.type, e.currentTarget.dataset.col));
    });

    // Auto-Fetch CSV na inicialização
    fetch('historico_modelos_xgboost.csv')
        .then(response => {
            if (!response.ok) throw new Error("Local CSV fetch failed.");
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true, dynamicTyping: true, skipEmptyLines: true,
                complete: function (results) { processData(results.data); }
            });
        })
        .catch(err => console.log("Aguardando upload manual do CSV local.", err));
});

function handleFileUpload(e) {
    if (!e.target.files[0]) return;
    Papa.parse(e.target.files[0], {
        header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: function (results) { processData(results.data); }
    });
}

function processData(data) {
    rawData = data;
    groupedData = {};
    let aerodromos = new Set();
    let targets = new Set();

    data.forEach(row => {
        const time = row.data_teste || 'Desconhecido';
        if (!groupedData[time]) groupedData[time] = { classRows: [], regRows: [] };

        if (!row.conjunto) row.conjunto = 'desconhecido';
        if (row.aerodromo) aerodromos.add(row.aerodromo);
        if (row.target) targets.add(row.target);

        if (row.tipo === 'binario') groupedData[time].classRows.push(row);
        if (row.tipo === 'continuo') groupedData[time].regRows.push(row);
    });

    timestamps = Object.keys(groupedData).sort((a, b) => new Date(a) - new Date(b));

    // Popular selects
    const execSelect = document.getElementById('executionSelect');
    execSelect.innerHTML = '';
    timestamps.forEach((time, index) => { execSelect.add(new Option(`Lote ${index + 1}: ${time}`, time)); });

    const aeroSelect = document.getElementById('aeroSelect');
    aeroSelect.innerHTML = '<option value="todos">Todos os Aeródromos</option>';
    [...aerodromos].sort().forEach(a => aeroSelect.add(new Option(a, a)));

    const targetSelect = document.getElementById('targetSelect');
    targetSelect.innerHTML = '<option value="todos">Todos os Targets</option>';
    [...targets].sort().forEach(t => targetSelect.add(new Option(t, t)));

    document.getElementById('uploadSec').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'block';

    currentIndex = timestamps.length - 1;
    execSelect.selectedIndex = currentIndex;

    resetSortAndRender();
}

function changeExecution(step) {
    currentIndex += step;
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= timestamps.length) currentIndex = timestamps.length - 1;
    document.getElementById('executionSelect').selectedIndex = currentIndex;
    resetSortAndRender();
}

function resetSortAndRender() {
    // Controle de botões Next/Prev
    document.getElementById('btnPrev').disabled = currentIndex === 0;
    document.getElementById('btnNext').disabled = currentIndex === timestamps.length - 1;
    renderDashboard();
}

function renderDashboard() {
    const selectedTime = timestamps[currentIndex];
    const lote = groupedData[selectedTime];
    if (!lote) return;

    const filtroConjunto = document.getElementById('conjuntoSelect').value;
    const filtroAero = document.getElementById('aeroSelect').value;
    const filtroTarget = document.getElementById('targetSelect').value;

    let classData = lote.classRows.filter(r =>
        (filtroConjunto === 'todos' || (r.conjunto || '').toLowerCase().includes(filtroConjunto)) &&
        (filtroAero === 'todos' || r.aerodromo === filtroAero) &&
        (filtroTarget === 'todos' || r.target === filtroTarget)
    );
    let regData = lote.regRows.filter(r =>
        (filtroConjunto === 'todos' || (r.conjunto || '').toLowerCase().includes(filtroConjunto)) &&
        (filtroAero === 'todos' || r.aerodromo === filtroAero) &&
        (filtroTarget === 'todos' || r.target === filtroTarget)
    );

    classData = sortDataArray(classData, sortState.class.col, sortState.class.asc);
    regData = sortDataArray(regData, sortState.reg.col, sortState.reg.asc);

    updateSortIcons();

    // Passa lote anterior para comparar parâmetros
    const prevLote = currentIndex > 0 ? groupedData[timestamps[currentIndex - 1]] : null;
    renderParams(lote.classRows, lote.regRows, prevLote);

    renderScoresAndTables(classData, regData);
    renderBarCharts(classData, regData);
    renderEvolutionChart(filtroConjunto, filtroAero, filtroTarget);
    renderAdvancedAnalysis(classData, regData);
    renderLeaderboard();
}

function renderEvolutionChart(fConjunto, fAero, fTarget) {
    if (evoChartInst) evoChartInst.destroy();

    const labels = timestamps.map((t, i) => `Lote ${i + 1}`);
    const avgAuc = timestamps.map(t => {
        const rows = groupedData[t].classRows.filter(r =>
            (fConjunto === 'todos' ? r.conjunto !== 'treino' : r.conjunto.includes(fConjunto)) &&
            (fAero === 'todos' || r.aerodromo === fAero) &&
            (fTarget === 'todos' || r.target === fTarget)
        );
        return rows.length ? rows.reduce((s, r) => s + (r.auc || 0), 0) / rows.length : null;
    });
    const avgR2 = timestamps.map(t => {
        const rows = groupedData[t].regRows.filter(r =>
            (fConjunto === 'todos' ? r.conjunto !== 'treino' : r.conjunto.includes(fConjunto)) &&
            (fAero === 'todos' || r.aerodromo === fAero) &&
            (fTarget === 'todos' || r.target === fTarget)
        );
        return rows.length ? rows.reduce((s, r) => s + Math.max(0, r.r2 || 0), 0) / rows.length : null;
    });

    const ctx = document.getElementById('evolutionChart').getContext('2d');
    evoChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Média AUC (Class)', data: avgAuc, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, pointRadius: 4 },
                { label: 'Média R² (Reg)', data: avgR2, borderColor: '#22c55e', backgroundColor: '#22c55e', tension: 0.3, pointRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: { y: { beginAtZero: true, max: 1 } }
        }
    });
}

function renderBarCharts(classData, regData) {
    if (classChartInst) classChartInst.destroy();
    if (regChartInst) regChartInst.destroy();

    const ctxClass = document.getElementById('classChart').getContext('2d');
    classChartInst = new Chart(ctxClass, {
        type: 'bar',
        data: {
            labels: classData.length ? classData.map(d => `${d.aerodromo}-${d.target}`) : ['Sem Dados'],
            datasets: [{ label: 'AUC', data: classData.map(d => d.auc || 0), backgroundColor: '#3b82f6', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 1 } } }
    });

    const ctxReg = document.getElementById('regChart').getContext('2d');
    regChartInst = new Chart(ctxReg, {
        type: 'bar',
        data: {
            labels: regData.length ? regData.map(d => `${d.aerodromo}-${d.target}`) : ['Sem Dados'],
            datasets: [{ label: 'R²', data: regData.map(d => Math.max(0, d.r2 || 0)), backgroundColor: '#22c55e', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 1 } } }
    });
}

function renderAdvancedAnalysis(classRows, regRows) {
    const cmContainer = document.getElementById('cmContainer');
    
    let tp = 0, fp = 0, fn = 0, tn = 0, hasCM = false;
    classRows.forEach(r => {
        let rTP = r.tp, rFP = r.fp, rFN = r.fn, rTN = r.tn;

        // Engenharia reversa da Matriz se os dados brutos não existirem
        if (rTP === undefined && r.f1 !== undefined && r.accuracy !== undefined && r.n_pos_real !== undefined && r.n_pos_pred !== undefined) {
            rTP = Math.round((r.f1 * (r.n_pos_real + r.n_pos_pred)) / 2);
            rFN = Math.max(0, r.n_pos_real - rTP);
            rFP = Math.max(0, r.n_pos_pred - rTP);
            let S = rTP + rFP + rFN;
            if (r.accuracy < 1 && r.accuracy > 0) {
                rTN = Math.round((r.accuracy * S - rTP) / (1 - r.accuracy));
            } else {
                rTN = 0; 
            }
        }

        const nTP = Number(rTP);
        const nFP = Number(rFP);
        const nFN = Number(rFN);
        const nTN = Number(rTN);

        if (Number.isFinite(nTP) && Number.isFinite(nFP) && Number.isFinite(nFN)) {
            tp += nTP;
            fp += nFP;
            fn += nFN;
            tn += Math.max(0, Number.isFinite(nTN) ? nTN : 0);
            hasCM = true;
        }
    });

    if (hasCM) {
        cmContainer.innerHTML = `
            <div class="cm-grid">
                <div></div><div class="cm-header">Prev Pos</div><div class="cm-header">Prev Neg</div>
                <div class="cm-header" style="writing-mode: vertical-rl; transform: rotate(180deg);">Real Pos</div>
                <div class="cm-cell cm-tp"><span class="cm-label">TP (Verdadeiro Pos)</span>${tp}</div>
                <div class="cm-cell cm-fn"><span class="cm-label">FN (Falso Negativo)</span>${fn}</div>
                <div class="cm-header" style="writing-mode: vertical-rl; transform: rotate(180deg);">Real Neg</div>
                <div class="cm-cell cm-fp"><span class="cm-label">FP (Falso Positivo)</span>${fp}</div>
                <div class="cm-cell cm-tn"><span class="cm-label">TN (Verdadeiro Neg)</span>${tn}</div>
            </div>
        `;
    } else {
        cmContainer.innerHTML = `<div class="empty-state">Requer métricas base f1, accuracy e pos_real/pred para efetuar cálculos reversos da matriz.</div>`;
    }

    if (featChartInst) featChartInst.destroy();
    const featCtx = document.getElementById('featChart').getContext('2d');
    
    if (hasCM) {
        document.getElementById('featEmpty').style.display = 'none';
        document.getElementById('featChart').style.display = 'block';
        
        const prec = tp + fp > 0 ? (tp / (tp + fp)) : 0;
        const rec = tp + fn > 0 ? (tp / (tp + fn)) : 0;
        const spec = tn + fp > 0 ? (tn / (tn + fp)) : 0;

        featChartInst = new Chart(featCtx, {
            type: 'bar',
            data: {
                labels: ['Precisão (Acerto)', 'Recall (Captura)', 'Especificidade (Rej. Falsos)'],
                datasets: [{ 
                    label: 'Efetividade Geral', 
                    data: [prec, rec, spec], 
                    backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981'], 
                    borderRadius: 4 
                }]
            },
            options: { 
                indexAxis: 'y', 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { x: { min: 0, max: 1 } },
                plugins: { legend: { display: false } }
            }
        });
    } else {
        document.getElementById('featChart').style.display = 'none';
        document.getElementById('featEmpty').style.display = 'block';
    }
}

function renderParams(classRows, regRows, prevLote) {
    const cGrid = document.getElementById('classParamsGrid');
    const rGrid = document.getElementById('regParamsGrid');
    cGrid.innerHTML = ''; rGrid.innerHTML = '';

    const prevClassP = prevLote && prevLote.classRows.length > 0 ? prevLote.classRows[0] : {};
    const prevRegP = prevLote && prevLote.regRows.length > 0 ? prevLote.regRows[0] : {};

    if (classRows.length > 0) {
        const curr = classRows[0];
        classImportantParams.forEach(p => {
            if (curr[p] !== undefined) {
                const changed = prevLote && prevClassP[p] != curr[p] ? 'param-changed' : '';
                const icon = changed ? '<span class="changed-icon">● Diff</span>' : '';
                cGrid.innerHTML += `<div class="param-card ${changed}"><div class="param-label">${p.replace('param_', '')} ${icon}</div><div class="param-value">${curr[p]}</div></div>`;
            }
        });
    }

    if (regRows.length > 0) {
        const curr = regRows[0];
        regImportantParams.forEach(p => {
            if (curr[p] !== undefined) {
                const changed = prevLote && prevRegP[p] != curr[p] ? 'param-changed' : '';
                const icon = changed ? '<span class="changed-icon">● Diff</span>' : '';
                rGrid.innerHTML += `<div class="param-card ${changed}"><div class="param-label">${p.replace('param_', '')} ${icon}</div><div class="param-value">${curr[p]}</div></div>`;
            }
        });
    }
}

// Calcula score customizado para o círculo
function calcClassScore(data) {
    if (!data.length) return null;
    let sum = 0;
    data.forEach(r => {
        let nAuc = Math.max(0, (r.auc - 0.5) * 2);
        let bal = (r.n_pos_real > 0 && r.n_pos_pred > 0) ? Math.min(r.n_pos_real, r.n_pos_pred) / Math.max(r.n_pos_real, r.n_pos_pred) : (r.n_pos_real === 0 && r.n_pos_pred === 0 ? 1 : 0);
        sum += (nAuc * 70) + (bal * 30);
    });
    return sum / data.length;
}

function calcRegScore(data) {
    if (!data.length) return null;
    let sum = data.reduce((acc, r) => acc + Math.min(100, Math.max(0, r.r2 || 0) * 150), 0);
    return sum / data.length;
}

function renderScoresAndTables(classRows, regRows) {
    const binTbody = document.querySelector('#binaryTable tbody');
    const contTbody = document.querySelector('#continuousTable tbody');
    binTbody.innerHTML = ''; contTbody.innerHTML = '';

    // Calcular Scores Atuais
    let currentClassScore = calcClassScore(classRows);
    let currentRegScore = calcRegScore(regRows);

    // Calcular Scores Anteriores (para Delta) - Respeitando os mesmos filtros
    let prevClassScore = null; let prevRegScore = null;
    if (currentIndex > 0) {
        const prevLote = groupedData[timestamps[currentIndex - 1]];
        const fConjunto = document.getElementById('conjuntoSelect').value;
        const fAero = document.getElementById('aeroSelect').value;
        const fTarget = document.getElementById('targetSelect').value;
        const fConjuntoNorm = (fConjunto || '').toLowerCase();

        let pCData = prevLote.classRows.filter(r => (fConjunto === 'todos' || ((r.conjunto || '').toLowerCase().includes(fConjuntoNorm))) && (fAero === 'todos' || r.aerodromo === fAero) && (fTarget === 'todos' || r.target === fTarget));
        let pRData = prevLote.regRows.filter(r => (fConjunto === 'todos' || ((r.conjunto || '').toLowerCase().includes(fConjuntoNorm))) && (fAero === 'todos' || r.aerodromo === fAero) && (fTarget === 'todos' || r.target === fTarget));
        prevClassScore = calcClassScore(pCData);
        prevRegScore = calcRegScore(pRData);
    }

    updateScoreUI('classScoreCircle', 'classDelta', currentClassScore, prevClassScore);
    updateScoreUI('regScoreCircle', 'regDelta', currentRegScore, prevRegScore);

    classRows.forEach(row => {
        let evalPos = getPosEvaluation(row.n_pos_real, row.n_pos_pred);
        let lowSample = (row.conjunto !== 'treino' && row.n_pos_real != null && row.n_pos_real < 30) ? `<span title="Baixa Amostra (n < 30)" style="cursor:help; border-bottom:1px dotted var(--warn-text);">⚠️</span>` : '';
        let conjBadgeClass = row.conjunto.includes('val') ? 'validacao' : (row.conjunto === 'treino' ? 'treino' : 'teste');
        
        let curLote = groupedData[timestamps[currentIndex]];
        let treinRow = row.conjunto !== 'treino' ? curLote.classRows.find(r => r.conjunto === 'treino' && r.aerodromo === row.aerodromo && r.target === row.target) : null;
        let overfitHtml = '';
        if (treinRow && Number.isFinite(row.auc) && Number.isFinite(treinRow.auc)) {
            let gap = treinRow.auc - row.auc;
            if (gap > 0.15) overfitHtml = `<br><span style="font-size:11px; color:var(--bad-border);" title="Overfitting Crítico: Gap de ${gap.toFixed(3)}">🔥 Tr: ${(treinRow.auc).toFixed(3)} (Overfit)</span>`;
            else overfitHtml = `<br><span style="font-size:11px; color:var(--text-light);">Tr: ${(treinRow.auc).toFixed(3)} (Δ -${gap.toFixed(2)})</span>`;
        }

        let rTP = row.tp, rFP = row.fp, rFN = row.fn;
        if (rTP === undefined && row.f1 !== undefined && row.n_pos_real !== undefined && row.n_pos_pred !== undefined) {
            rTP = Math.round((row.f1 * (row.n_pos_real + row.n_pos_pred)) / 2);
            rFN = Math.max(0, row.n_pos_real - rTP);
            rFP = Math.max(0, row.n_pos_pred - rTP);
        }
        let prec = (rTP + rFP) > 0 ? (rTP / (rTP + rFP)) : 0;
        let rec = (rTP + rFN) > 0 ? (rTP / (rTP + rFN)) : 0;

        binTbody.innerHTML += `<tr>
        <td><b>${row.aerodromo}</b></td><td>${row.target} ${lowSample}</td><td><span class="badge-conjunto badge-${conjBadgeClass}">${row.conjunto}</span></td>
        <td>${(row.auc || 0).toFixed(3)} ${getBadge(row.auc, 0.88, 0.80)} ${overfitHtml}</td>
        <td>${prec.toFixed(3)}</td><td>${rec.toFixed(3)}</td>
        <td>${(row.f1 || 0).toFixed(3)}</td>
        <td>${evalPos.html}</td><td>${getStatus(row.auc, evalPos.status, false)}</td>
    </tr>`;
    });

    regRows.forEach(row => {
        let r2Badge = getBadge(row.r2, 0.45, 0.30);
        let conjBadgeClass = row.conjunto.includes('val') ? 'validacao' : (row.conjunto === 'treino' ? 'treino' : 'teste');
        
        let curLote = groupedData[timestamps[currentIndex]];
        let treinRow = row.conjunto !== 'treino' ? curLote.regRows.find(r => r.conjunto === 'treino' && r.aerodromo === row.aerodromo && r.target === row.target) : null;
        let overfitHtml = '';
        if (treinRow && Number.isFinite(row.r2) && Number.isFinite(treinRow.r2)) {
            let gap = treinRow.r2 - row.r2;
            if (gap > 0.20 && treinRow.r2 > 0.5) overfitHtml = `<br><span style="font-size:11px; color:var(--bad-border);">🔥 Tr: ${(treinRow.r2).toFixed(3)} (Overfit)</span>`;
        }

        let outlierHtml = '';
        if (row.mae > 0 && row.rmse > 0) {
            let ratio = row.rmse / row.mae;
            if (ratio > 1.5) outlierHtml = `<br><span title="RMSE é ${ratio.toFixed(1)}x o MAE (Muitos outliers em previsões raras)" style="font-size:11px; color:var(--warn-border);">⚠️ Outliers (${ratio.toFixed(1)}x)</span>`;
        }

        contTbody.innerHTML += `<tr>
        <td><b>${row.aerodromo}</b></td><td>${row.target}</td><td><span class="badge-conjunto badge-${conjBadgeClass}">${row.conjunto}</span></td>
        <td>${(row.mae || 0).toFixed(3)}</td><td>${(row.rmse || 0).toFixed(3)} ${outlierHtml}</td>
        <td>${(row.r2 || 0).toFixed(3)} ${r2Badge} ${overfitHtml}</td><td>${getStatus(row.r2, r2Badge.includes('bom') ? 'bom' : 'ruim', true)}</td>
    </tr>`;
    });

    if (!classRows.length) binTbody.innerHTML = '<tr><td colspan="7">Nenhum dado.</td></tr>';
    if (!regRows.length) contTbody.innerHTML = '<tr><td colspan="7">Nenhum dado.</td></tr>';
}

function renderLeaderboard() {
    const fAero = document.getElementById('aeroSelect').value;
    const fTarget = document.getElementById('targetSelect').value;
    const fConjunto = document.getElementById('conjuntoSelect').value;

    if (!renderLeaderboard._cache ||
        renderLeaderboard._cacheGroupedDataRef !== groupedData ||
        renderLeaderboard._cacheTimestampsRef !== timestamps ||
        renderLeaderboard._cacheTimestampsLength !== timestamps.length) {
        renderLeaderboard._cache = new Map();
        renderLeaderboard._cacheGroupedDataRef = groupedData;
        renderLeaderboard._cacheTimestampsRef = timestamps;
        renderLeaderboard._cacheTimestampsLength = timestamps.length;
    }

    const cacheKey = `${fAero}::${fTarget}::${fConjunto}`;
    let cachedResult = renderLeaderboard._cache.get(cacheKey);

    if (!cachedResult) {
        let bestClass = null;
        let bestReg = null;

        timestamps.forEach(time => {
            groupedData[time].classRows.forEach(r => {
                if ((fAero === 'todos' || r.aerodromo === fAero) &&
                    (fTarget === 'todos' || r.target === fTarget) &&
                    (fConjunto === 'todos' ? r.conjunto !== 'treino' : r.conjunto.includes(fConjunto))) {
                    
                    if (!bestClass || (r.auc && r.auc > bestClass.row.auc)) {
                        bestClass = { lote: time, row: r };
                    }
                }
            });
            groupedData[time].regRows.forEach(r => {
                if ((fAero === 'todos' || r.aerodromo === fAero) &&
                    (fTarget === 'todos' || r.target === fTarget) &&
                    (fConjunto === 'todos' ? r.conjunto !== 'treino' : r.conjunto.includes(fConjunto))) {
                    
                    if (!bestReg || (r.r2 && r.r2 > bestReg.row.r2)) {
                        bestReg = { lote: time, row: r };
                    }
                }
            });
        });

        cachedResult = { bestClass, bestReg };
        renderLeaderboard._cache.set(cacheKey, cachedResult);
    }

    const { bestClass, bestReg } = cachedResult;
    const lb = document.getElementById('leaderboardContainer');
    let html = '<table style="width:100%; border-collapse: collapse; text-align:left;">';
    if(bestClass) {
        html += `<tr style="border-bottom:1px dotted var(--border-color); cursor:pointer;" onmouseover="this.style.backgroundColor='var(--badge-treino)'" onmouseout="this.style.backgroundColor='transparent'" onclick="jumpToExecution('${bestClass.lote}')"><td style="padding:10px;">🏆 <b>Maior AUC</b></td><td>Lote: <span style="font-family:monospace; color:var(--text-muted);">${bestClass.lote}</span></td><td><span class="badge bom">${bestClass.row.auc.toFixed(4)}</span></td><td>${bestClass.row.aerodromo} - ${bestClass.row.target} &nbsp;<span class="badge-conjunto badge-${bestClass.row.conjunto.includes('val')?'validacao':(bestClass.row.conjunto==='treino'?'treino':'teste')}">${bestClass.row.conjunto}</span></td></tr>`;
    }
    if(bestReg) {
        html += `<tr style="cursor:pointer;" onmouseover="this.style.backgroundColor='var(--badge-treino)'" onmouseout="this.style.backgroundColor='transparent'" onclick="jumpToExecution('${bestReg.lote}')"><td style="padding:10px;">🎯 <b>Maior R²</b></td><td>Lote: <span style="font-family:monospace; color:var(--text-muted);">${bestReg.lote}</span></td><td><span class="badge bom">${bestReg.row.r2.toFixed(4)}</span></td><td>${bestReg.row.aerodromo} - ${bestReg.row.target} &nbsp;<span class="badge-conjunto badge-${bestReg.row.conjunto.includes('val')?'validacao':(bestReg.row.conjunto==='treino'?'treino':'teste')}">${bestReg.row.conjunto}</span></td></tr>`;
    }
    if(!bestClass && !bestReg) {
         html += '<tr><td style="padding:15px; color:var(--text-light);">Sem dados suficientes para o filtro atual.</td></tr>';
    }
    html += '</table>';
    lb.innerHTML = html;
}

function updateScoreUI(circleId, deltaId, score, prevScore) {
    const el = document.getElementById(circleId);
    const delEl = document.getElementById(deltaId);

    el.className = 'score-circle';
    if (score === null || isNaN(score)) { el.childNodes[0].nodeValue = 'N/A'; delEl.style.display = 'none'; return; }

    el.childNodes[0].nodeValue = `${Math.round(score)}%`;
    if (score >= 75) el.classList.add('score-good');
    else if (score >= 50) el.classList.add('score-warn');
    else el.classList.add('score-bad');

    delEl.style.display = 'block';
    if (prevScore !== null && !isNaN(prevScore)) {
        let diff = Math.round(score - prevScore);
        if (diff > 0) { delEl.innerHTML = `↑ +${diff}%`; delEl.className = 'score-delta delta-up'; }
        else if (diff < 0) { delEl.innerHTML = `↓ ${diff}%`; delEl.className = 'score-delta delta-down'; }
        else { delEl.innerHTML = `- 0%`; delEl.className = 'score-delta delta-neutral'; }
    } else {
        delEl.style.display = 'none';
    }
}

function getPosEvaluation(r, p) {
    if (r == null || p == null) return { html: '-', status: 'neutral' };
    if (r === 0) return { html: `R: 0 | P: ${p}`, status: p === 0 ? 'bom' : 'ruim' };
    const rt = p / r; let st = 'bom'; let cl = 'var(--good-border)';
    if (rt < 0.5 || rt > 2.0) { st = 'ruim'; cl = 'var(--bad-border)'; } else if (rt < 0.8 || rt > 1.2) { st = 'alerta'; cl = 'var(--warn-border)'; }
    return { html: `<div style="font-size:11px; display:flex; justify-content:space-between"><span>R: <b>${r}</b></span><span>P: <b style="color:${cl}">${p}</b></span></div><div class="ratio-bar-container"><div class="ratio-bar" style="width:${Math.min(rt * 50, 100)}%; background:${cl};"></div></div>`, status: st };
}

function getBadge(v, g, w) { if (v == null) return ''; if (v >= g) return `<span class="badge bom">Bom</span>`; if (v >= w) return `<span class="badge alerta">Reg</span>`; return `<span class="badge ruim">Ruim</span>`; }
function getStatus(v, s, c) { if (v == null) return '-'; let g = c ? (v >= 0.45) : (v >= 0.88 && s === 'bom'); let w = c ? (v >= 0.30) : (v >= 0.80 && s !== 'ruim'); if (g) return `<span class="badge bom">Excelente</span>`; if (w) return `<span class="badge alerta">Aceitável</span>`; return `<span class="badge ruim">Revisar</span>`; }

// Funções auxiliares de Sort
function handleSort(type, col) {
    if (sortState[type].col === col) sortState[type].asc = !sortState[type].asc;
    else { sortState[type].col = col; sortState[type].asc = false; }
    renderDashboard();
}
function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(i => { i.innerText = '↕'; i.classList.remove('sort-active'); });
    ['class', 'reg'].forEach(t => {
        const icon = document.getElementById(`sort-${t}-${sortState[t].col}`);
        if (icon) { icon.innerText = sortState[t].asc ? '↑' : '↓'; icon.classList.add('sort-active'); }
    });
}
function sortDataArray(arr, col, asc) {
    return [...arr].sort((a, b) => {
        let va = a[col] ?? (typeof a[col] === 'string' ? '' : -Infinity), vb = b[col] ?? (typeof b[col] === 'string' ? '' : -Infinity);
        if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase();
        return va < vb ? (asc ? -1 : 1) : (va > vb ? (asc ? 1 : -1) : 0);
    });
}
