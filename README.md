# XGBoost ML TAF Analytics - IACIT

Dashboard interativo desenvolvido para o monitoramento, avaliação e tuning de hiperparâmetros de modelos de Machine Learning (XGBoost) aplicados à previsão de mensagens meteorológicas aeronáuticas TAF (Terminal Aerodrome Forecast).

## 💡 Ideia e Motivação
Este projeto surgiu da necessidade de centralizar e facilitar a interpretação dos complexos ciclos de treinamento de modelos meteorológicos. A motivação principal é proporcionar uma **melhor visualização e rastreabilidade total** da relação entre a troca de hiperparâmetros (como `max_depth`, `learning_rate` e `n_estimators`) e a variação das métricas de performance. Em vez de analisar logs textuais isolados, o painel permite observar a evolução do modelo de forma comparativa e intuitiva através de uma interface gráfica dinâmica.

## 🤖 Desenvolvimento Assistido por IA
Projeto desenvolvido com o auxílio de ferramentas de **Inteligência Artificial (IA)** e "Vibe Coding", visando um produto de rápido desenolvimento e alto impacto para os trabalhos da equipe com Machine Learning.

## 🌐 Acesso Online e Como Usar

A aplicação está hospedada e pronta para uso no GitHub Pages:

🔗 **Acesse o Dashboard:** [https://danieldpereira.github.io/xgboost-paramTuner-projTAF/](https://danieldpereira.github.io/xgboost-paramTuner-projTAF/)

**Passo a passo para utilização:**
1. **Carregamento dos Dados:** Ao acessar o link, o sistema busca automaticamente o arquivo `historico_modelos_xgboost.csv`. Para analisar novos resultados, utilize o botão **"Importar Histórico de Lotes TAF (.csv)"**.
2. **Navegação Temporal:** Utilize os controles de navegação para alternar entre os diferentes lotes de execução registrados no histórico.
3. **Filtros Direcionados:** Refine a análise por **Aeródromo** (ex: SBPA, SBGR), **Conjunto** (Treino, Validação, Teste) ou **Target** específico.
4. **Análise Técnica:** Inspecione o diagnóstico de overfitting, a matriz de confusão e o impacto direto dos hiperparâmetros nos gráficos de dispersão.

## 🚀 Funcionalidades do Dashboard

- **Monitoramento de Múltiplos Targets**: Suporte para modelos de classificação (ex: `wx_ts`, `wx_ra`) e regressão (ex: `wind_speed_kt`, `vis_m`).
- **Diagnóstico de Overfitting**: Visualização do distanciamento de métricas entre os conjuntos de dados ao longo dos lotes.
- **Matriz de Confusão por Engenharia Reversa**: Cálculo automático de Precisão, Recall e Especificidade baseado no F1-Score e amostras reais/preditas.
- **Leaderboard de Performance**: Destaque instantâneo para os melhores modelos treinados no histórico.
- **Identidade IACIT**: Interface customizada com os padrões visuais da empresa (Navy Blue e Light Accent Blue).

## 🛠️ Tecnologias Utilizadas

**Frontend:**
- HTML5 & CSS3 (Layout via CSS Grid e Variáveis)
- Vanilla JavaScript (Manipulação de dados assíncronos)
- [Chart.js](https://www.chartjs.org/) (Renderização de gráficos)
- [PapaParse](https://www.papaparse.com/) (Parsing de CSV de alta performance)

## ⚙️ Como Executar Localmente (Para Desenvolvedores)

Para modificar o código fonte, é necessário um servidor local devido às restrições de segurança (CORS) do navegador ao ler arquivos CSV locais.

1. Clone o repositório:
   ```bash
   git clone https://github.com/DanielDPereira/xgboost-paramTuner-projTAF.git
   cd xgboost-paramTuner-projTAF
   ```

2. Inicie um servidor HTTP (Exemplo com Python):
   ```bash
   python -m http.server 8000
   ```

3. Acesse: `http://localhost:8000`

## 📊 Entendendo as Métricas

* **Modelos de Classificação:** Focados em AUC, F1-Score e equilíbrio entre Precisão/Recall. O sistema alerta automaticamente sobre amostras baixas (*n < 30*).
* **Modelos de Regressão:** Focados em R², MAE e RMSE. O painel identifica automaticamente a presença de *outliers* significativos nas predições.

---
*Desenvolvido para uso interno na [IACIT Soluções Tecnológicas S.A.](https://www.iacit.com.br/)*
