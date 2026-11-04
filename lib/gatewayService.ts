import { prisma } from "@/lib/prisma"

export interface GatewaySensorInfo {
  batteryLevel: number
  captureRate: number
}

export interface GatewayStatusResult {
  gatewayId: number
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE'
  needsMaintenance: boolean
  heartbeatIntervalHours: number
}

export class GatewayService {
  static async updateHeartbeat(
    cooperativeId: number,
    sensorData?: Map<number, GatewaySensorInfo>
  ): Promise<GatewayStatusResult[]> {
    const gateways = await prisma.gatewayHealth.findMany({
      where: { cooperativeId }
    })

    if (!gateways || gateways.length === 0) {
      return []
    }

    const results: GatewayStatusResult[] = []
    const transactionOperations: any[] = []

    for (const gateway of gateways) {
      const data = sensorData?.get(gateway.id) || { batteryLevel: 100, captureRate: 100 }

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE' = 'HEALTHY'
      let needsMaintenance = false

      // Durum belirleme kuralları
      if (data.batteryLevel <= 5 || data.captureRate < 50) {
        status = 'CRITICAL'
        needsMaintenance = true
      } else if (data.batteryLevel <= 20) {
        status = 'WARNING'
        needsMaintenance = true
      }

      // Heartbeat aralığı kuralları (yalnızca batarya belirler)
      let heartbeatIntervalHours = 12
      if (data.batteryLevel > 60) {
        heartbeatIntervalHours = 6
      } else if (data.batteryLevel <= 5) {
        heartbeatIntervalHours = 24
      }

      results.push({
        gatewayId: gateway.id,
        status,
        needsMaintenance,
        heartbeatIntervalHours
      })

      const now = new Date()
      const nextHeartbeat = new Date(now.getTime() + heartbeatIntervalHours * 60 * 60 * 1000)

      transactionOperations.push(
        prisma.gatewayHealth.update({
          where: { id: gateway.id },
          data: {
            status,
            lastHeartbeatAt: now,
            nextHeartbeatAt: nextHeartbeat,
            heartbeatIntervalHours,
            lastHeartbeatResult: status
          }
        })
      )

      if (needsMaintenance) {
        const existingTicket = await prisma.maintenanceTicket.findFirst({
          where: {
            sensorId: gateway.id,
            status: 'OPEN'
          }
        })

        if (!existingTicket) {
          console.log(`Maintenance ticket created for Gateway ${gateway.id}`)
          transactionOperations.push(
            prisma.maintenanceTicket.create({
              data: {
                sensorId: gateway.id,
                userId: 'system',
                title: `Gateway ${gateway.id} Bakım Gerektiriyor`,
                description: `Durum: ${status}, Batarya: %${data.batteryLevel}, Yakalama: %${data.captureRate}`,
                status: 'OPEN',
                priority: status === 'CRITICAL' ? 'HIGH' : 'MEDIUM'
              }
            })
          )
        }
      }
    }

    if (transactionOperations.length > 0) {
      await prisma.$transaction(transactionOperations)
    }

    return results
  }

  static async getAllGatewaysStatus() {
    const gateways = await prisma.gatewayHealth.findMany()

    return {
      total: gateways.length,
      healthy: gateways.filter(g => g.status === 'HEALTHY').length,
      warning: gateways.filter(g => g.status === 'WARNING').length,
      critical: gateways.filter(g => g.status === 'CRITICAL').length,
      offline: gateways.filter(g => g.status === 'OFFLINE').length
    }
  }
}