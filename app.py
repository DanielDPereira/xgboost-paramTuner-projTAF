import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import os

st.set_page_config(page_title="XGBoost ML TAF Dashboard", page_icon="🌤️", layout="wide")

# Custom CSS for styling
st.markdown("""
<style>
    .metric-card {
        background-color: var(--background-color);
        border: 1px solid var(--secondary-background-color);
        padding: 5%;
        border-radius: 5px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .param-card {
        padding: 10px;
        margin-bottom: 10px;
        background-color: var(--secondary-background-color);
        border-radius: 5px;
        font-family: monospace;
        font-size: 0.9em;
    }
    .param-changed {
        border-left: 4px solid #f59e0b;
        background-color: rgba(245, 158, 11, 0.1);
    }
    .changed-label {
        color: #f59e0b;
        font-weight: bold;
        font-size: 0.8em;
    }
    
    .cm-grid {
        display: grid;
        grid-template-columns: 80px 1fr 1fr;
        grid-template-rows: auto 1fr 1fr;
        gap: 5px;
        margin-top: 10px;
    }
    .cm-header {
        font-weight: bold;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(128, 128, 128, 0.1);
        border-radius: 4px;
        padding: 5px;
    }
    .cm-cell {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 4px;
        padding: 15px;
        font-size: 1.5em;
        font-weight: bold;
    }
    .cm-tp { background-color: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; }
    .cm-tn { background-color: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; }
    .cm-fp { background-color: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; }
    .cm-fn { background-color: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; }
    .cm-label { font-size: 0.4em; font-weight: normal; color: gray; margin-bottom: 5px; text-transform: uppercase;}
</style>
""", unsafe_allow_html=True)

# -----------------
# Data Loading
# -----------------
@st.cache_data
def load_data():
    file_path = "data/historico_modelos_xgboost.csv"
    if not os.path.exists(file_path):
        return pd.DataFrame()
    df = pd.read_csv(file_path)
    df['data_teste'] = df['data_teste'].fillna('Desconhecido')
    
    # Pre-calculate Reverse CM metrics
    def calc_cm(r):
        if r['tipo'] != 'binario': return pd.Series([np.nan, np.nan, np.nan, np.nan])
        if pd.notna(r.get('tp')): return pd.Series([r['tp'], r['fp'], r['fn'], r['tn']])
        
        # Reverse engineering
        if pd.notna(r.get('f1')) and pd.notna(r.get('n_pos_real')) and pd.notna(r.get('n_pos_pred')):
            tp = round((r['f1'] * (r['n_pos_real'] + r['n_pos_pred'])) / 2)
            fn = max(0, r['n_pos_real'] - tp)
            fp = max(0, r['n_pos_pred'] - tp)
            
            # Estimate TN if accuracy is known
            tn = 0
            if pd.notna(r.get('accuracy')) and r['accuracy'] > 0 and r['accuracy'] < 1:
                S = tp + fp + fn
                try:
                    tn = round(((r['accuracy'] * S) - tp) / (1 - r['accuracy']))
                except: tn = 0
            return pd.Series([tp, fp, fn, tn])
        return pd.Series([np.nan, np.nan, np.nan, np.nan])
    
    df[['tp_calc', 'fp_calc', 'fn_calc', 'tn_calc']] = df.apply(calc_cm, axis=1)
    return df

df = load_data()

if df.empty:
    st.error("Arquivo `data/historico_modelos_xgboost.csv` não encontrado ou vazio. Verifique o diretório.")
    st.stop()

# Identify Lotes (Executions) based on unique timestamps
timestamps = sorted(df['data_teste'].unique())
LOTE_OPTS = [f"Lote {i+1}: {t}" for i, t in enumerate(timestamps)]

# -----------------
# Sidebar Filters
# -----------------
st.sidebar.title("🎛️ Filtros & Controles")

# 1. Navigation
selected_lote_str = st.sidebar.selectbox("Execução / Lote Temporal", LOTE_OPTS, index=len(LOTE_OPTS)-1)
curr_idx = LOTE_OPTS.index(selected_lote_str)
curr_time = timestamps[curr_idx]

# 2. Scope Filters
all_aeros = ["todos"] + sorted([x for x in df['aerodromo'].dropna().unique() if x])
all_targets = ["todos"] + sorted([x for x in df['target'].dropna().unique() if x])
all_conjs = ["todos", "treino", "validacao", "teste"]

st.sidebar.divider()
st.sidebar.subheader("🎯 Refinar Análise")
f_aero = st.sidebar.selectbox("Aeródromo", all_aeros)
f_target = st.sidebar.selectbox("Target do Modelo", all_targets)
f_conj = st.sidebar.selectbox("Conjunto de Dados", all_conjs)

st.sidebar.divider()
st.sidebar.info("Dashboard desenvolvido com Streamlit e Pandas. Compatível com os dados gerados pela pipeline automatizada de Machine Learning da IACIT.")


# -----------------
# Filter Data logic
# -----------------
def filter_df(data, t_time=None, f_conj="todos", f_aero="todos", f_target="todos"):
    res = data.copy()
    if t_time is not None:
        if isinstance(t_time, list):
            res = res[res['data_teste'].isin(t_time)]
        else:
            res = res[res['data_teste'] == t_time]
    
    if f_conj != "todos":
        res = res[res['conjunto'].str.contains(f_conj, na=False, case=False)]
    if f_aero != "todos":
        res = res[res['aerodromo'] == f_aero]
    if f_target != "todos":
        res = res[res['target'] == f_target]
    return res

curr_df = filter_df(df, t_time=curr_time, f_conj=f_conj, f_aero=f_aero, f_target=f_target)
prev_df = filter_df(df, t_time=timestamps[curr_idx-1], f_conj=f_conj, f_aero=f_aero, f_target=f_target) if curr_idx > 0 else pd.DataFrame()

df_class = curr_df[curr_df['tipo'] == 'binario']
df_reg = curr_df[curr_df['tipo'] == 'continuo']

prev_class = prev_df[prev_df['tipo'] == 'binario']
prev_reg = prev_df[prev_df['tipo'] == 'continuo']

# Helpers
def calc_class_score(data):
    if data.empty: return np.nan
    sum_score = 0
    for _, r in data.iterrows():
        auc_part = max(0, ((r.get('auc', 0.5) - 0.5) * 2))
        nr, np_ = r.get('n_pos_real', 0), r.get('n_pos_pred', 0)
        bal_part = 1
        if nr > 0 and np_ > 0:
            bal_part = min(nr, np_) / max(nr, np_)
        elif nr == 0 and np_ == 0:
            pass # remains 1
        else: bal_part = 0
            
        sum_score += (auc_part * 70) + (bal_part * 30)
    return sum_score / len(data)

def calc_reg_score(data):
    if data.empty: return np.nan
    sum_score = 0
    for _, r in data.iterrows():
        r2 = r.get('r2', 0)
        sum_score += min(100, max(0, r2) * 150)
    return sum_score / len(data)

curr_score_c = calc_class_score(df_class)
prev_score_c = calc_class_score(prev_class)

curr_score_r = calc_reg_score(df_reg)
prev_score_r = calc_reg_score(prev_reg)

# -----------------
# Header Section
# -----------------
st.title(f"📊 Relatório do Modelo: {selected_lote_str}")

# KPI Row
col1, col2, col3, col4 = st.columns(4)
with col1:
    delta_c = f"{curr_score_c - prev_score_c:.1f}%" if pd.notna(prev_score_c) and pd.notna(curr_score_c) else None
    st.metric("Score Classificação (Geral)", f"{curr_score_c:.1f}%" if pd.notna(curr_score_c) else "N/A", delta_c)
with col2:
    if not df_class.empty and 'auc' in df_class.columns:
        mean_auc = df_class['auc'].mean()
        prev_auc = prev_class['auc'].mean() if not prev_class.empty and 'auc' in prev_class.columns else np.nan
        delta_auc = f"{mean_auc - prev_auc:.3f}" if pd.notna(prev_auc) else None
        st.metric("Média AUC", f"{mean_auc:.3f}", delta_auc)
    else: st.metric("Média AUC", "N/A")

with col3:
    delta_r = f"{curr_score_r - prev_score_r:.1f}%" if pd.notna(prev_score_r) and pd.notna(curr_score_r) else None
    st.metric("Score Regressão (Geral)", f"{curr_score_r:.1f}%" if pd.notna(curr_score_r) else "N/A", delta_r)
with col4:
    if not df_reg.empty and 'r2' in df_reg.columns:
        mean_r2 = df_reg['r2'].clip(lower=0).mean()
        prev_r2 = prev_reg['r2'].clip(lower=0).mean() if not prev_reg.empty and 'r2' in prev_reg.columns else np.nan
        delta_r2 = f"{mean_r2 - prev_r2:.3f}" if pd.notna(prev_r2) else None
        st.metric("Média R²", f"{mean_r2:.3f}", delta_r2)
    else: st.metric("Média R²", "N/A")


# -----------------
# TABS for Main Views
# -----------------
tab1, tab2, tab3 = st.tabs(["📋 Tabelas Táticas & Hiperparâmetros", "📈 Evolução & Overfit (Visual)", "🔍 Análise Avançada"])

with tab1:
    st.markdown("### 🛠️ Monitoramento de Parâmetros Modificados")
    p_col1, p_col2 = st.columns(2)
    
    important_c_params = ['param_max_depth', 'param_learning_rate', 'param_n_estimators', 'param_scale_pos_weight', 'param_subsample', 'param_colsample_bytree', 'param_min_child_weight', 'param_gamma', 'param_reg_lambda', 'param_reg_alpha']
    important_r_params = ['param_max_depth', 'param_learning_rate', 'param_n_estimators', 'param_reg_lambda', 'param_reg_alpha', 'param_subsample', 'param_colsample_bytree', 'param_min_child_weight', 'param_gamma']
    
    def render_params(curr_data, prev_data, p_list, col_title):
        markdown_str = f"**{col_title}**\n<div style='max-height: 200px; overflow-y: auto; padding-right:10px;'>"
        if not curr_data.empty:
            curr_row = curr_data.iloc[0]
            prev_row = prev_data.iloc[0] if not prev_data.empty else None
            
            has_p = False
            for p in p_list:
                if p in curr_row and pd.notna(curr_row[p]):
                    has_p = True
                    val = curr_row[p]
                    is_changed = prev_row is not None and p in prev_row and prev_row[p] != val
                    
                    css_class = "param-changed" if is_changed else ""
                    icon = "<span class='changed-label'>● Diff</span>" if is_changed else ""
                    markdown_str += f"<div class='param-card {css_class}'>{p.replace('param_','')} {icon}<br><span style='font-size:1.1em; color:var(--text-color);'>{val}</span></div>"
            if not has_p: markdown_str += "<div class='param-card'>Nenhum parâmetro extraído</div>"
        else:
            markdown_str += "<div class='param-card'>Sem dados no lote</div>"
        markdown_str += "</div>"
        return markdown_str

    with p_col1: st.markdown(render_params(df_class, prev_class, important_c_params, "Modelos de Classificação"), unsafe_allow_html=True)
    with p_col2: st.markdown(render_params(df_reg, prev_reg, important_r_params, "Modelos de Regressão"), unsafe_allow_html=True)
    
    st.divider()

    st.markdown("### 🏆 Tabelas de Performance")
    
    st.subheader("Modelos de Classificação")
    if not df_class.empty:
        # Prepara df pra exibição
        show_c = df_class[['aerodromo', 'target', 'conjunto', 'auc', 'accuracy', 'f1', 'n_pos_real', 'n_pos_pred']].copy()
        show_c['ratio'] = show_c['n_pos_pred'] / show_c['n_pos_real'].replace(0, np.nan)
        show_c['alerta_amostras'] = show_c['n_pos_real'].apply(lambda n: '⚠️ n<30' if n < 30 else 'OK')
        
        st.dataframe(show_c.style.format({'auc': '{:.3f}', 'accuracy': '{:.3f}', 'f1': '{:.3f}', 'ratio': '{:.2f}x'}), use_container_width=True)
    else: st.info("Não há dados de classificação para o filtro.")
        
    st.subheader("Modelos de Regressão")
    if not df_reg.empty:
        show_r = df_reg[['aerodromo', 'target', 'conjunto', 'mae', 'rmse', 'r2']].copy()
        show_r['outlier_ratio'] = show_r['rmse'] / show_r['mae'].replace(0, np.nan)
        show_r['alerta_outliers'] = show_r['outlier_ratio'].apply(lambda x: '⚠️ RMSE/MAE > 1.5' if pd.notna(x) and x > 1.5 else 'OK')
        
        st.dataframe(show_r.style.format({'mae': '{:.3f}', 'rmse': '{:.3f}', 'r2': '{:.3f}', 'outlier_ratio': '{:.2f}x'}).background_gradient(subset=['r2'], cmap='Greens', vmin=0, vmax=1), use_container_width=True)
    else: st.info("Não há dados de regressão para o filtro.")

with tab2:
    st.markdown("### Histórico Global - Treinamento vs Validação vs Teste")
        
    colA, colB = st.columns([2, 1])
    
    with colA:
        if f_target == "todos":
            st.warning("Selecione um Target específico no menu lateral para visualizar o gráfico de Overfit.")
        else:
            # Overfit Line chart using Plotly
            is_bin = df[df['target'] == f_target]['tipo'].iloc[0] == 'binario' if not df[df['target'] == f_target].empty else True
            metric_col = 'auc' if is_bin else 'r2'
            
            overfit_df = filter_df(df, f_aero=f_aero, f_target=f_target)
            
            if not overfit_df.empty:
                # Aggregate means per Lote (data_teste) and conjunto
                agg_df = overfit_df.groupby(['data_teste', 'conjunto'])[metric_col].mean().reset_index()
                
                # Sort temporal
                agg_df['lote_idx'] = agg_df['data_teste'].apply(lambda x: LOTE_OPTS[timestamps.index(x)])
                agg_df = agg_df.sort_values('data_teste')
                
                # Clip R2 for visualization
                if not is_bin: agg_df[metric_col] = agg_df[metric_col].clip(lower=0)
                
                fig_o = px.line(agg_df, x='lote_idx', y=metric_col, color='conjunto',
                                title=f"Distanciamento Train/Val/Test ({metric_col.upper()})",
                                markers=True, 
                                color_discrete_map={'treino':'purple', 'validacao':'#3b82f6', 'teste':'#22c55e'})
                fig_o.update_layout(yaxis_title=metric_col.upper(), xaxis_title="")
                st.plotly_chart(fig_o, use_container_width=True)
            else:
                st.info("Sem dados suficientes para esse target.")
                
    with colB:
        st.markdown("#### Performance Comparada (Aeródromos)")
        if f_target != 'todos' and not curr_df.empty:
            target_df = curr_df[curr_df['target'] == f_target]
            metric = 'auc' if 'auc' in target_df else 'r2'
            if metric in target_df.columns:
                p_df = target_df.groupby('aerodromo')[metric].mean().reset_index().sort_values(metric)
                fig_B = px.bar(p_df, x=metric, y='aerodromo', orientation='h', color=metric, color_continuous_scale="Blues")
                fig_B.update_layout(showlegend=False, xaxis_title=metric.upper(), yaxis_title="Aeródromo")
                st.plotly_chart(fig_B, use_container_width=True)
        else: st.write("Para renderizar a comparação direta de aeródromos, selecione um lote que possua dados e um target específico.")
        
    st.divider()
    
    st.markdown("### Busca de Hiperparâmetros (Dispersão)")
    
    colC1, colC2 = st.columns([1, 4])
    with colC1:
        param_opt = "param_max_depth"
        # Find which param to select based on user input (we list all param_ columns)
        param_cols = [c for c in df.columns if c.startswith("param_")]
        scatter_p = st.selectbox("Parâmetro Raio-X", param_cols, index=param_cols.index("param_learning_rate") if "param_learning_rate" in param_cols else 0)
    
    with colC2:
        if f_target != "todos":
            sc_df = filter_df(df, f_aero=f_aero, f_target=f_target, f_conj=f_conj)
            sc_m = 'auc' if sc_df['tipo'].iloc[0] == 'binario' else 'r2'
            sc_df = sc_df.dropna(subset=[scatter_p, sc_m])
            if not sc_df.empty:
                sc_fig = px.scatter(sc_df, x=scatter_p, y=sc_m, color='data_teste', size_max=10, hover_data=['aerodromo', 'conjunto', 'lote_idx' if 'lote_idx' in sc_df.columns else 'data_teste'])
                sc_fig.update_layout(title=f"Impacto do {scatter_p.replace('param_','')} no {sc_m.upper()}")
                st.plotly_chart(sc_fig, use_container_width=True)
            else: st.info("Sem dados validos ou parâmetro nulo/incompatível nas runs atuais.")
        else: st.warning("Selecione um Target.")


with tab3:
    st.markdown("### 🧮 Diagnóstico Aprofundado & Matriz de Confusão")
    st.markdown("*(Somente Classificação)*")
    
    if not df_class.empty:
        # Aggregate CM values
        tp = df_class['tp_calc'].sum()
        fp = df_class['fp_calc'].sum()
        fn = df_class['fn_calc'].sum()
        tn = df_class['tn_calc'].sum()
        
        has_cm = False
        if pd.notna(tp) and pd.notna(fp) and pd.notna(fn) and pd.notna(tn) and (tp+fp+fn+tn > 0):
            has_cm = True
            
        c_1, c_2 = st.columns([1, 1])
        
        with c_1:
            st.subheader("Matriz Resultante")
            if has_cm:
                total = tp+fp+fn+tn
                base = (tp+fn)/total if total > 0 else 0
                st.markdown(f"<span style='background:#0ea5e9; padding:5px 10px; border-radius:5px; color:white; font-size:0.8em;'>Base Real Média (Ocorrência do Evento): {(base*100):.1f}% ({int(tp+fn)}/{int(total)})</span>", unsafe_allow_html=True)
                
                cm_html = f"""
                <div class="cm-grid">
                    <div></div><div class="cm-header">Prevê POSITIVO</div><div class="cm-header">Prevê NEGATIVO</div>
                    <div class="cm-header" style="writing-mode: vertical-rl; transform: rotate(180deg);">Real POSITIVO</div>
                    <div class="cm-cell cm-tp"><span class="cm-label">TP (Acerto)</span>{int(tp)}</div>
                    <div class="cm-cell cm-fn"><span class="cm-label">FN (Erro - Omissão)</span>{int(fn)}</div>
                    <div class="cm-header" style="writing-mode: vertical-rl; transform: rotate(180deg);">Real NEGATIVO</div>
                    <div class="cm-cell cm-fp"><span class="cm-label">FP (Erro - Alarme Falso)</span>{int(fp)}</div>
                    <div class="cm-cell cm-tn"><span class="cm-label">TN (Acerto)</span>{int(tn)}</div>
                </div>
                """
                st.markdown(cm_html, unsafe_allow_html=True)
            else:
                st.info("Requer métricas base f1, accuracy e pos_real/pred completas para reverter a matriz matemática.")
                
        with c_2:
            st.subheader("Indicadores de Sensibilidade")
            if has_cm:
                prec = tp / (tp + fp) if (tp + fp) > 0 else 0
                rec = tp / (tp + fn) if (tp + fn) > 0 else 0
                spec = tn / (tn + fp) if (tn + fp) > 0 else 0
                
                barmdf = pd.DataFrame({
                    'Métrica': ['Precisão', 'Recall', 'Especificidade'],
                    'Valor': [prec, rec, spec],
                    'Cor': ['#8b5cf6', '#3b82f6', '#10b981']
                })
                
                bar_fig = px.bar(barmdf, x='Valor', y='Métrica', orientation='h', color='Métrica',
                                 color_discrete_map={'Precisão':'#8b5cf6', 'Recall':'#3b82f6', 'Especificidade':'#10b981'},
                                 range_x=[0, 1])
                bar_fig.update_layout(showlegend=False)
                st.plotly_chart(bar_fig, use_container_width=True)
                st.caption("""
                - **Precisão**: Quando o ML prevê chuva/vento, qual a chance de acertar?
                - **Recall**: Dos eventos que *realmente* aconteceram, quantos o ML pegou?
                - **Especificidade**: Das horas com bom tempo, quantas o ML corretamente rejeitou eventos falsos?
                """)
    else:
        st.info("Nenhuma classificação selecionada no filtro.")

st.divider()

# -----------------
# Leaderboard
# -----------------
st.subheader("Leaderboard Global (Melhor de Todos os Lotes)")
lb_df = filter_df(df, f_aero=f_aero, f_target=f_target, f_conj=f_conj)

c1, c2 = st.columns(2)
with c1:
    st.markdown("#### Top Classificação (AUC)")
    lb_class = lb_df[lb_df['tipo'] == 'binario'].dropna(subset=['auc']).sort_values('auc', ascending=False)
    if not lb_class.empty:
        best_c = lb_class.iloc[0]
        st.success(f"🏆 **{best_c['aerodromo']} - {best_c['target']}** | Lote: `{best_c['data_teste']}` | Conjunto: {best_c['conjunto']}\n\n**AUC**: {best_c['auc']:.4f}")
    else: st.write("Não há.")

with c2:
    st.markdown("#### Top Regressão (R²)")
    lb_reg = lb_df[lb_df['tipo'] == 'continuo'].dropna(subset=['r2']).sort_values('r2', ascending=False)
    if not lb_reg.empty:
        best_r = lb_reg.iloc[0]
        st.info(f"🎯 **{best_r['aerodromo']} - {best_r['target']}** | Lote: `{best_r['data_teste']}` | Conjunto: {best_r['conjunto']}\n\n**R²**: {best_r['r2']:.4f}")
    else: st.write("Não há.")
