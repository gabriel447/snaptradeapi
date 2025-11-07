import { useMemo, useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressRAF = useRef(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorFriendly, setErrorFriendly] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', [])
  const apiToken = useMemo(() => import.meta.env.VITE_API_TOKEN || '', [])

  function onFileChange(e) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setResult(null)
    setError(null)
    if (f) {
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  function cancelSelection() {
    if (loading || analyzing) return
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)
    setAnalyzing(true)
    setProgress(0)

    const simulateProgress = () => new Promise((resolve) => {
      const totalMs = 8000
      const start = performance.now()
      const tick = (now) => {
        const pct = Math.min(100, Math.round(((now - start) / totalMs) * 100))
        setProgress(pct)
        if (pct < 100) {
          progressRAF.current = requestAnimationFrame(tick)
        } else {
          setTimeout(resolve, 400)
        }
      }
      progressRAF.current = requestAnimationFrame(tick)
    })

    const fetchAnalyze = async () => {
      if (!preview) throw new Error('Selecione uma imagem primeiro')
      const res = await fetch(`${apiBase}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
        },
        body: JSON.stringify({ imageBase64: preview, context: { timeframe: '1m' } })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao consultar API')
      }
      return data
    }

    try {
      const [data] = await Promise.all([fetchAnalyze(), simulateProgress()])
      setResult(data)
      setShowResult(true)
    } catch (err) {
      setError(err.message)
      setErrorFriendly('Ocorreu um erro. Tente novamente.')
      console.error(err)
      setShowErrorModal(true)
    } finally {
      if (progressRAF.current) cancelAnimationFrame(progressRAF.current)
      setAnalyzing(false)
      setLoading(false)
      // mantém seleção até o usuário decidir fechar o resultado
    }
  }

  // Oculta modal de erro após animação
  useEffect(() => {
    if (showErrorModal) {
      const t = setTimeout(() => setShowErrorModal(false), 4000)
      return () => clearTimeout(t)
    }
  }, [showErrorModal])

  function mapTrend(sinal) {
    if (sinal === 'COMPRAR') return 'Alta'
    if (sinal === 'VENDER') return 'Baixa'
    return 'Indecisa'
  }

  function mapVolatility(confianca) {
    const c = String(confianca || '').toLowerCase()
    if (c.includes('alta')) return 'Baixa' // alta confiança => baixa volatilidade
    if (c.includes('baixa')) return 'Alta'
    return 'Média'
  }

  function mapSuccessRate(confianca) {
    const c = String(confianca || '').toLowerCase()
    if (c.includes('alta')) return 85
    if (c.includes('baixa')) return 55
    return 70
  }

  function iconForSinal(sinal) {
    if (sinal === 'COMPRAR') return '⬆️'
    if (sinal === 'VENDER') return '⬇️'
    return '⏳'
  }

  return (
    <div className="page">
      <header className={"hero " + ((analyzing || showResult) ? 'hero-muted' : '')}>
        <h1 className="title">SnapTrade</h1>
        <p className="subtitle">Envie um print do seu gráfico para análise.</p>
      </header>

      <main className={"content " + (analyzing ? 'content-middle' : (showResult ? 'content-top' : ''))}>
        {!showResult && !analyzing && (
        <section className="card upload-card fade-in">
          {!preview && (
            <>
              <input id="fileInput" className="file-input" type="file" accept="image/*" onChange={onFileChange} />
              <label htmlFor="fileInput" className="picker">
                <div className="picker-icon" aria-hidden="true">📈</div>
                <div className="picker-text">
                  <h2>Selecionar Gráfico</h2>
                  {file && <span className="filename">{file.name}</span>}
                </div>
              </label>
            </>
          )}
          {preview && (
            <div className="preview with-close">
              <button
                type="button"
                className="preview-close"
                aria-label="Cancelar seleção"
                title="Cancelar"
                onClick={cancelSelection}
                disabled={loading || analyzing}
              >
                ×
              </button>
              <img src={preview} alt="Prévia do gráfico selecionado" />
            </div>
          )}
        </section>
        )}

        {!showResult && !analyzing && (
          <button className="primary" disabled={!preview || loading} onClick={handleAnalyze}>
            Analisar Agora
          </button>
        )}

        {/* Removido erro inferior para usar apenas modal no topo */}

        {result && showResult && (
          <section className="result-modal fade-in">
            <div className="result-modal-header">
              <h2>Resultado da Análise</h2>
            </div>

              <div
                className={
                  'result-cta ' +
                  (result.sinal === 'VENDER'
                    ? 'sell'
                    : result.sinal === 'COMPRAR'
                    ? 'buy'
                    : 'wait')
                }
              >
                <span className="cta-icon" aria-hidden="true">{iconForSinal(result.sinal)}</span>
                <span className="cta-text">{result.sinal}</span>
              </div>

              <div className="market-section">
                <div className="section-title">Dados do Mercado</div>
                <div className="info-row">
                  <span className="icon">📈</span>
                  <span className="label">Tendência</span>
                  <span className="value">{mapTrend(result.sinal)}</span>
                </div>
                <div className="info-row">
                  <span className="icon">⚡</span>
                  <span className="label">Volatilidade</span>
                  <span className="value">{mapVolatility(result.confianca)}</span>
                </div>
                <div className="info-row">
                  <span className="icon">🎯</span>
                  <span className="label">Taxa de Sucesso</span>
                  <span className="value success">{mapSuccessRate(result.confianca)}%</span>
                </div>
              </div>

              <button
                type="button"
                className="accordion-toggle"
                onClick={() => setShowAnalysis((v) => !v)}
                aria-expanded={showAnalysis}
                aria-label="Análise Completa"
                title="Análise Completa"
              >
                <span className="accordion-text">Análise Completa</span>
                <span className={"chevron-icon " + (showAnalysis ? 'open' : 'closed')} aria-hidden="true">
                  <svg className="chevron-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </button>
              {showAnalysis && (
                <div className="result-body">
                  <p className="result-explain">{result.explicacao}</p>
                </div>
              )}

              <div className="result-modal-actions">
                <button
                  type="button"
                  className="new-analysis"
                  onClick={() => { setShowResult(false); setResult(null); setFile(null); setPreview(null); setShowAnalysis(false); }}
                >
                  <span className="new-analysis-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 7h3l2-2h6l2 2h3v12H4V7zm8 2a5 5 0 110 10 5 5 0 010-10z" />
                      <circle cx="12" cy="14" r="3" />
                    </svg>
                  </span>
                  <span>Nova Análise</span>
                </button>
              </div>
          </section>
        )}
      </main>
      {showErrorModal && (
        <div className="error-modal">
          <div className="error-card">
            <strong>Erro</strong>
            <span className="error-msg">{errorFriendly}</span>
          </div>
        </div>
      )}
      {analyzing && (
        <section className="card analyzing-card fade-in" aria-live="polite">
          <h2 className="modal-title">Analisando Mercado</h2>
          <p className="modal-sub">Nosso algoritmo está processando os dados..</p>
          {[
            'IA analisando padrões complexos...',
            'Algoritmos processando dados...',
            'Rede neural deep learning...',
            'IA gerando predições avançadas...'
          ].map((label, i) => {
            const start = i * 25
            const end = start + 25
            const w = Math.max(0, Math.min(progress - start, 25)) / 25 * 100
            const done = progress >= end
            const colorClass = ['teal', 'purple', 'orange', 'pink'][i]
            return (
              <div className="step" key={i}>
                <div className="step-head">
                  <span>{label}</span>
                  {done && <span className="check">✓</span>}
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${colorClass}`} style={{ width: `${w}%` }} />
                </div>
              </div>
            )
          })}
          <div className="overall">Processando {progress}%</div>
        </section>
      )}
    </div>
  )
}

export default App