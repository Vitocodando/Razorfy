import { useEffect, useRef, useState } from 'react'
import type { Barbershop } from '../../../core/types'
import { parseConnectionCode, connectByCode } from '../../../core/api/client'
import { Icon, ErrorBanner } from '../../../core/ui/primitives'

// FEAT-074: conexão por código/QR (substitui busca aberta). RN02 case-insensitive (uppercase mask).
export function TenantDiscovery({ onSelect }: { onSelect: (t: Barbershop) => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  const submit = async (raw: string) => {
    const c = parseConnectionCode(raw)
    if (!c) { setError('Digite o código de conexão.'); return }
    setLoading(true)
    setError('')
    try {
      onSelect(await connectByCode(c))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center p-4">
      <main className="w-full max-w-[420px] flex flex-col items-center pt-10">
        <img alt="Razorfy" src="/razorfy.png" className="w-28 h-28 object-contain mb-4 drop-shadow-sm" />
        <h1 className="text-[24px] font-bold text-on-surface mb-1 text-center">Conecte-se à barbearia</h1>
        <p className="text-[14px] text-on-surface-variant mb-6 text-center">Informe o código de conexão ou escaneie o QR Code fornecido pela barbearia.</p>

        {scanning ? (
          <QrScanner
            onDetected={(text) => { setScanning(false); submit(text) }}
            onClose={() => setScanning(false)}
          />
        ) : (
          <>
            <form className="w-full" onSubmit={(e) => { e.preventDefault(); submit(code) }}>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="EX: BARBA55"
                maxLength={10}
                className="w-full h-14 px-4 mb-3 bg-surface-container-lowest border border-on-surface/15 rounded-xl text-[20px] tracking-[0.25em] font-bold text-center text-on-surface focus:outline-none focus:border-secondary uppercase"
              />
              {error && <div className="w-full mb-3"><ErrorBanner message={error} /></div>}
              <button
                type="submit"
                disabled={loading || !code}
                className="w-full h-12 rounded-xl bg-primary text-on-primary font-bold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Icon name="progress_activity" className="animate-spin text-[20px]" /> : 'Conectar'}
              </button>
            </form>
            <button
              onClick={() => { setError(''); setScanning(true) }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container text-on-surface text-[14px] font-semibold hover:bg-surface-container-high transition-colors"
            >
              <Icon name="qr_code_scanner" className="text-[20px]" />
              Escanear QR Code
            </button>
          </>
        )}
      </main>
    </div>
  )
}

// Scanner QR via BarcodeDetector nativo. Fallback gracioso: se indisponível, fecha e usa código manual.
function QrScanner({ onDetected, onClose }: { onDetected: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const BD = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    if (!BD) { setError('Câmera/leitor de QR não suportado neste navegador. Digite o código manualmente.'); return }
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const detector = new BD({ formats: ['qr_code'] })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) { onDetected(codes[0].rawValue); return }
          } catch { /* frame sem leitura */ }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões ou digite o código.')
      }
    })()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full flex flex-col items-center">
      {error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-8 border-2 border-white/80 rounded-xl pointer-events-none" />
        </div>
      )}
      <button
        onClick={onClose}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container text-on-surface text-[14px] font-semibold hover:bg-surface-container-high transition-colors"
      >
        <Icon name="keyboard" className="text-[20px]" />
        Digitar código
      </button>
    </div>
  )
}
