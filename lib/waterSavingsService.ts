import { prisma } from "@/lib/prisma";

export interface WaterSavingsInput {
  farmId: number
  actualConsumption: number
}

export interface BaselineCalculation {
  wnb: number
  baselineType: 'PROXY' | 'HYBRID' | 'REAL'
  factors: {
    regionNorm: number
    weatherFactor: number
    realMonths: number
    proxyValue?: number
    realValue?: number
  }
}

export class WaterSavingsService {
  /**
   * Water Needs Baseline (WNB) hesapla
   */
  static async calculateBaseline(farmId: number): Promise<BaselineCalculation> {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: { 
        cooperative: { 
          include: { region: true } 
        }, 
        sensors: { 
          include: { readings: true } 
        } 
      }
    })
    
    if (!farm) {
      throw new Error(`Çiftlik bulunamadı (ID: ${farmId})`)
    }

    // Sensör verilerini analiz et
    const readings = farm.sensors.flatMap(s => s.readings)
    const uniqueMonths = new Set(readings.map(r => r.timestamp.getMonth()))
    const realMonths = uniqueMonths.size

    // Bölgesel norm ve hava faktörü (mock veriler)
    const regionNorm = 100 // m³/hektar
    const weatherFactor = 1.2 // Kuraklık faktörü

    let wnb = 0
    let baselineType: 'PROXY' | 'HYBRID' | 'REAL' = 'PROXY'
    let proxyValue: number | undefined
    let realValue: number | undefined

    if (realMonths === 0) {
      // PROXY: Hiç gerçek veri yok
      baselineType = 'PROXY'
      wnb = regionNorm * weatherFactor
      proxyValue = wnb
    } else if (realMonths < 12) {
      // HYBRID: Kısmi gerçek veri
      baselineType = 'HYBRID'
      const w = realMonths / 12
      proxyValue = regionNorm * weatherFactor
      realValue = readings.reduce((sum, r) => sum + r.value, 0) / readings.length || proxyValue
      wnb = (1 - w) * proxyValue + w * realValue
    } else {
      // REAL: Tam gerçek veri
      baselineType = 'REAL'
      const last3Years = readings.filter(r => 
        r.timestamp > new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
      )
      realValue = last3Years.reduce((sum, r) => sum + r.value, 0) / last3Years.length || regionNorm
      wnb = realValue * weatherFactor
    }

    return {
      wnb,
      baselineType,
      factors: {
        regionNorm,
        weatherFactor,
        realMonths,
        proxyValue,
        realValue
      }
    }
  }

  /**
   * Su tasarrufunu hesapla ve kaydet
   */
  static async calculateAndSaveSavings(input: WaterSavingsInput): Promise<{
    savings: any
    baseline: BaselineCalculation
    payment: number
    validation: {
      isValid: boolean
      warnings: string[]
    }
  }> {
    const { farmId, actualConsumption } = input

    // Baseline hesapla
    const baseline = await this.calculateBaseline(farmId)
    
    // Tasarrufu hesapla
    const savedM3 = Math.max(0, baseline.wnb - actualConsumption)
    const savingsPercentage = baseline.wnb > 0 ? (savedM3 / baseline.wnb) * 100 : 0
    
    // Ödeme hesapla (0.15 TL/m³)
    const payment = savedM3 * 0.15

    // Validasyon
    const validation = this.validateSavingsData({
      actualConsumption,
      baseline: baseline.wnb,
      savings: savedM3,
      savingsPercentage
    })

    // WaterSaving kaydı oluştur
    const savings = await prisma.waterSaving.create({
      data: {
        farmId,
        actualUsage: actualConsumption,
        baselineUsage: baseline.wnb,
        savings: savedM3,
        baselineType: baseline.baselineType
      }
    })

    return {
      savings,
      baseline,
      payment,
      validation
    }
  }

  /**
   * Su tasarrufu verilerini doğrula
   */
  private static validateSavingsData(data: {
    actualConsumption: number
    baseline: number
    savings: number
    savingsPercentage: number
  }): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = []
    let isValid = true

    // Negative consumption check
    if (data.actualConsumption < 0) {
      warnings.push("Negatif tüketim değeri")
      isValid = false
    }

    // Unusually high savings check
    if (data.savingsPercentage > 50) {
      warnings.push("Çok yüksek tasarruf oranı (>50%) - veri doğrulanmalı")
    }

    // Zero consumption check
    if (data.actualConsumption === 0) {
      warnings.push("Sıfır tüketim - sensör arızası olabilir")
    }

    // Baseline vs actual ratio check
    if (data.baseline > 0 && data.actualConsumption / data.baseline > 2) {
      warnings.push("Tüketim baseline'ın 2 katından fazla - anormalliği kontrol et")
    }

    return { isValid, warnings }
  }

  /**
   * Çiftliğin su tasarrufu geçmişini getir
   */
  static async getFarmSavingsHistory(farmId: number, months: number = 12): Promise<any[]> {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    return await prisma.waterSaving.findMany({
      where: {
        farmId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Bölgesel su tasarrufu istatistikleri
   */
  static async getRegionalSavingsStats(regionId: number): Promise<{
    totalSavings: number
    averageSavingsPercentage: number
    farmsCount: number
    baselineTypeDistribution: Record<string, number>
  }> {
    const farmsInRegion = await prisma.farm.findMany({
      where: {
        cooperative: { regionId }
      },
      include: {
        waterSavings: true
      }
    })

    const allSavings = farmsInRegion.flatMap(f => f.waterSavings)
    const totalSavings = allSavings.reduce((sum, s) => sum + s.savings, 0)
    
    const averageSavingsPercentage = allSavings.length > 0 
      ? allSavings.reduce((sum, s) => sum + (s.savings / s.baselineUsage * 100), 0) / allSavings.length
      : 0

    const baselineTypeDistribution = allSavings.reduce((acc, s) => {
      acc[s.baselineType] = (acc[s.baselineType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalSavings,
      averageSavingsPercentage,
      farmsCount: farmsInRegion.length,
      baselineTypeDistribution
    }
  }
}
