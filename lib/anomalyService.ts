import { prisma } from "@/lib/prisma"

export interface AnomalyCheckInput {
  sensorId: number
  type: string
  description: string
}

export interface ConfidenceScoreFactors {
  rainfallFactor: number
  neighborAnomalyFactor: number
  manualIrrigationFactor: number
  sensorBatteryFactor: number
  historicalAccuracyFactor: number
}

export class AnomalyService {
  /**
   * Calculate confidence score for anomaly detection
   * Returns a score between 0.0 and 1.0
   */
  static async calculateConfidenceScore(input: AnomalyCheckInput): Promise<{
    score: number
    factors: ConfidenceScoreFactors
    shouldAlert: boolean
  }> {
    const { sensorId, type } = input

    const sensor = await prisma.sensor.findUnique({
      where: { id: sensorId },
      include: { 
        farm: { 
          include: { 
            cooperative: { 
              include: { region: true } 
            } 
          } 
        } 
      }
    })
    
    if (!sensor) {
      throw new Error(`Sensör bulunamadı (ID: ${input.sensorId})`)
    }

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const regionId = sensor.farm.cooperative.regionId
    const coopId = sensor.farm.cooperativeId

    // Factor 1: Rainfall Check (0-1)
    const rainfall = await prisma.weatherLog.aggregate({
      where: { regionId, timestamp: { gte: threeHoursAgo } },
      _sum: { rainfall: true }
    })
    const rainfallFactor = (rainfall._sum.rainfall || 0) > 5 ? 0 : 1

    // Factor 2: Neighbor Anomaly Check (0-1)
    const recentAnomalies = await prisma.anomalyLog.count({
      where: {
        sensor: { farm: { cooperativeId: coopId } },
        type,
        createdAt: { gte: threeHoursAgo }
      }
    })
    const neighborAnomalyFactor = recentAnomalies >= 3 ? 0 : 1

    // Factor 3: Manual Irrigation Check (0-1)
    const manualIrrigationFactor = sensor.farm.manualIrrigationCount > 2 ? 0.5 : 1

    // Factor 4: Sensor Battery Check (0-1)
    const batteryFactor = (sensor.battery || 100) > 20 ? 1 : 0.5

    // Factor 5: Historical Accuracy (0-1)
    const historicalAnomalies = await prisma.anomalyLog.count({
      where: {
        sensorId,
        farmerResponse: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
    const historicalAccuracyFactor = historicalAnomalies > 0 ? 0.8 : 1

    const factors: ConfidenceScoreFactors = {
      rainfallFactor,
      neighborAnomalyFactor,
      manualIrrigationFactor,
      sensorBatteryFactor: batteryFactor,
      historicalAccuracyFactor
    }

    const weights = {
      rainfallFactor: 0.3,
      neighborAnomalyFactor: 0.25,
      manualIrrigationFactor: 0.2,
      sensorBatteryFactor: 0.15,
      historicalAccuracyFactor: 0.1
    }

    const score = Object.entries(factors).reduce((acc, [key, value]) => {
      return acc + (value * weights[key as keyof ConfidenceScoreFactors])
    }, 0)

    const shouldAlert = score >= 0.6

    return { score, factors, shouldAlert }
  }

  /**
   * Create anomaly log with calculated confidence score
   */
  static async createAnomaly(input: AnomalyCheckInput): Promise<{
    anomaly: any
    shouldAlert: boolean
    score: number
  }> {
    const { score, shouldAlert, factors } = await this.calculateConfidenceScore(input)

    if (shouldAlert) {
      const sensor = await prisma.sensor.findUnique({
        where: { id: input.sensorId },
        include: { farm: true }
      })

      if (sensor) {
        const anomaly = await prisma.anomalyLog.create({
          data: {
            sensorId: input.sensorId,
            type: input.type,
            description: input.description,
            confidenceScore: score,
            farmerId: sensor.farm.farmerId
          }
        })

        return { anomaly, shouldAlert, score }
      }
    }

    return { anomaly: null, shouldAlert, score }
  }

  /**
   * Update farmer response to anomaly
   */
  static async respondToAnomaly(
    anomalyId: number, 
    farmerId: string, 
    response: 'MANUAL_IRRIGATION' | 'CONFIRMED' | 'NO_RESPONSE'
  ): Promise<any> {
    const anomaly = await prisma.anomalyLog.findUnique({
      where: { id: anomalyId }
    })

    if (!anomaly) {
      throw new Error(`Anomali kaydı bulunamadı (ID: ${anomalyId})`)
    }

    if (anomaly.farmerId !== farmerId) {
      throw new Error("Bu anomaliye yanıt verme yetkiniz yok")
    }

    return await prisma.anomalyLog.update({
      where: { id: anomalyId },
      data: {
        farmerResponse: response,
        resolvedAt: new Date()
      }
    })
  }
}