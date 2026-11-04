import { prisma } from "@/lib/prisma"

export type DecisionStatus = 'REAL_TIME' | 'DELAYED' | 'SENSOR_OFFLINE' | 'NO_SENSORS' | 'DATA_QUALITY_ISSUES'

export interface DecisionGuardResult {
  can: boolean
  status: DecisionStatus
  lastReadingAt?: Date | null
}

export async function canDecide(farmId: number): Promise<DecisionGuardResult> {
  const sensors = await prisma.sensor.findMany({
    where: { farmId },
    select: { lastReadingAt: true }
  })

  if (!sensors || sensors.length === 0) {
    return { can: false, status: 'NO_SENSORS' }
  }

  // Sadece okuma tarihi olan sensörleri filtrele ve en güncelini bul
  const validSensors = sensors.filter(s => s.lastReadingAt !== null && s.lastReadingAt !== undefined)

  if (validSensors.length === 0) {
    return { can: false, status: 'DATA_QUALITY_ISSUES' }
  }

  // En güncel okumayı bul
  const mostRecentDate = validSensors.reduce((latest, current) => {
    const currentDate = new Date(current.lastReadingAt!)
    return currentDate > latest ? currentDate : latest
  }, new Date(0))

  const now = Date.now()
  const diffMinutes = (now - mostRecentDate.getTime()) / (1000 * 60)

  if (diffMinutes < 15) {
    return { can: true, status: 'REAL_TIME', lastReadingAt: mostRecentDate }
  } else if (diffMinutes <= 120) {
    return { can: true, status: 'DELAYED', lastReadingAt: mostRecentDate }
  } else {
    return { can: false, status: 'SENSOR_OFFLINE', lastReadingAt: mostRecentDate }
  }
}

export function getShadowMode(farmId: number): 'GHOST' | 'LEARNING' | 'FULL' {
  const mod = farmId % 3
  if (mod === 0) return 'GHOST'
  if (mod === 1) return 'LEARNING'
  return 'FULL'
}

export async function recordShadowDecision(
  farmId: number,
  mode: 'GHOST' | 'LEARNING' | 'FULL',
  decision: string
) {
  return await prisma.shadowDecision.create({
    data: {
      farmId,
      mode,
      decision
    }
  })
}