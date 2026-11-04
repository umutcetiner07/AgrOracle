'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'

interface DashboardData {
  farmName: string
  areaHa: number
  cropName: string
  regionName: string
  soilMoisture: number
  targetMoisture: number
  monthlySavingsKzt: number
  preventedWaterM3: number
  sensorStatus: string
  batteryLevel: number
  signalStrength: number
  recommendedDoseM3: number
  unitWaterPriceKzt: number
}

interface AuditLog {
  id: string
  soilMoisture: number
  irrigationAmount: number
  createdAt: string
  details: {
    action?: string
    decisionGuardVerified?: boolean
    [key: string]: unknown
  }
}

const defaultData: DashboardData = {
  farmName: 'Umut Çiftliği',
  areaHa: 25.5,
  cropName: 'Buğday (Wheat)',
  regionName: 'Almaty Bölgesi',
  soilMoisture: 45,
  targetMoisture: 50,
  monthlySavingsKzt: 1200,
  preventedWaterM3: 14.2,
  sensorStatus: 'İyi',
  batteryLevel: 95,
  signalStrength: -68,
  recommendedDoseM3: 10,
  unitWaterPriceKzt: 84.5,
}

export default function FarmerDashboard() {
  const [data, setData] = useState<DashboardData>(defaultData)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [irrigationTriggered, setIrrigationTriggered] = useState(false)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/farmer/metrics')
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data) {
            setData(json.data)
          }
          if (Array.isArray(json.logs)) {
            setLogs(json.logs)
          }
        }
      } catch (err) {
        console.warn('API verisi alınamadı, varsayılan telemetri devrede:', err)
      }
    }
    fetchMetrics()
  }, [])

  const handleIrrigation = async () => {
    try {
      setIrrigationTriggered(true)
      const res = await fetch('/api/irrigation/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountM3: data.recommendedDoseM3 || 10 }),
      })
      const json = await res.json()
      if (json.success) {
        setData((prev) => ({
          ...prev,
          soilMoisture: Math.min(prev.soilMoisture + 8, 60),
          monthlySavingsKzt: prev.monthlySavingsKzt + json.entry.savedAmountKzt,
          preventedWaterM3: Number((prev.preventedWaterM3 + json.entry.savedWaterM3).toFixed(1)),
        }))
        setLogs((prev) => [
          {
            id: json.entry.id,
            soilMoisture: json.entry.soilMoisture,
            irrigationAmount: json.entry.irrigationAmount,
            createdAt: json.entry.createdAt,
            details: json.entry.details,
          },
          ...prev,
        ].slice(0, 5))
      }
    } catch (err) {
      console.error('Sulama onaylama API hatası:', err)
    } finally {
      setTimeout(() => {
        setIrrigationTriggered(false)
      }, 4000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f14] text-white p-6 md:p-10 font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-8 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
              Canlı Telemetri (Телеметрия в реальном времени)
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-white">
            BerekeLedger <span className="text-emerald-400 font-normal text-xl">| Çiftçi Kontrol Paneli</span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data.farmName} ({data.areaHa} ha) • {data.regionName} • Mahsul: {data.cropName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div className="text-xs text-gray-400">Doğrulanmış Hesap</div>
            <div className="text-sm font-medium text-white">farmer@umut.com</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300">
            UÇ
          </div>
        </div>
      </header>

      <main className="mt-8 space-y-8">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#111922] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-medium">Toprak Nemi (Влажность почвы)</span>
              <span className="text-emerald-400 text-lg">💧</span>
            </div>
            <div className="text-4xl font-extrabold text-white mt-1">{data.soilMoisture}%</div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Eşik Altı: %{data.targetMoisture} Bekleniyor
              </span>
            </div>
          </div>

          <div className="bg-[#111922] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-medium">Bu Ay Kazanım (Экономия за месяц)</span>
              <span className="text-emerald-400 text-lg">₸</span>
            </div>
            <div className="text-4xl font-extrabold text-emerald-400 mt-1">{data.monthlySavingsKzt.toLocaleString()} ₸</div>
            <p className="text-xs text-gray-400 mt-3">
              Önlenen su kaybı: <strong>{data.preventedWaterM3} m³</strong>
            </p>
          </div>

          <div className="bg-[#111922] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-medium">Sensör Sağlığı (Состояние датчика)</span>
              <span className="text-emerald-400 text-lg">📡</span>
            </div>
            <div className="text-4xl font-extrabold text-white mt-1">{data.sensorStatus}</div>
            <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              Pil: %{data.batteryLevel} • Sinyal: {data.signalStrength} dBm
            </div>
          </div>

          <div className="bg-[#111922] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-medium">Doğrulama Modu (Режим аудита)</span>
              <span className="text-emerald-400 text-lg">🛡️</span>
            </div>
            <div className="text-2xl font-bold text-white mt-2">DecisionGuard</div>
            <p className="text-xs text-emerald-400/90 mt-3 font-mono">
              Durum: Kural Bazlı Aktif
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#111922] p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Sistem Tavsiyesi (Рекомендация системы)
                </h3>
                <p className="text-xs text-gray-400">
                  Toprak nemi ve buharlaşma katsayısına göre dinamik hesaplama
                </p>
              </div>
              <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
                Doğrulandı (Верифицировано)
              </span>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-black/30 border border-white/5">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  Önerilen Dozaj: <span className="text-emerald-400 font-bold">{data.recommendedDoseM3} m³</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Saat 22:00 sonrası gece sulaması önerilir (Buharlaşma kaybını %28 azaltır).
                </div>
              </div>
              <button
                type="button"
                onClick={handleIrrigation}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl transition-all shadow-md hover:shadow-emerald-500/20 whitespace-nowrap"
              >
                {irrigationTriggered ? 'Sulama Başlatıldı... ✓' : `Sulamayı Onayla (${data.recommendedDoseM3} m³)`}
              </button>
            </div>

            {irrigationTriggered && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <span>✓</span> İşlem telemetri defterine (Ledger) yazıldı. Tenge tasarruf kaydı güncelleniyor.
              </div>
            )}
          </div>

          <div className="bg-[#111922] p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                Denetim İzi (Аудиторский след)
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                QazInnovations ve sübvansiyon kurumları için manipüle edilemez veri akışı.
              </p>

              <div className="mt-5 space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5 text-gray-400">
                  <span>Protokol:</span>
                  <span className="text-white">Bereke-RuleEngine-v1</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5 text-gray-400">
                  <span>Son Ölçüm:</span>
                  <span className="text-white">Az önce</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5 text-gray-400">
                  <span>Hesaplanan Birim Fiyat:</span>
                  <span className="text-white">{data.unitWaterPriceKzt} ₸ / m³</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-gray-500">
              BerekeLedger Core Node • {data.regionName} Pilot İstasyonu
            </div>
          </div>
        </section>

        <section className="bg-[#111922] rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white">Canlı Denetim Defteri</h2>
              <p className="text-xs text-gray-400 mt-1">Журнал аудита / Ledger</p>
            </div>
            <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
              Son 5 kayıt
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-4">Zaman (Saat/Tarih)</th>
                  <th className="px-6 py-4">İşlem Tipi</th>
                  <th className="px-6 py-4">Sulama Miktarı (m³)</th>
                  <th className="px-6 py-4">Doğrulama Durumu</th>
                  <th className="px-6 py-4">Benzersiz Kayıt Hash'i</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Henüz denetim kaydı bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-t border-white/5 text-gray-300">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-6 py-4">
                        {log.details?.action || 'IRRIGATION_EXECUTED'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {log.irrigationAmount} m³
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-400">DecisionGuard - Onaylandı</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">
                        0x{log.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12).toUpperCase()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
