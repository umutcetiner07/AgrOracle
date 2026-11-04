import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'farmer@umut.com' },
      include: {
        farms: {
          include: {
            cropType: true,
            sensors: true,
            cooperative: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    })

    if (!user || user.farms.length === 0) {
      return NextResponse.json({ error: 'Çiftlik bulunamadı' }, { status: 404 })
    }

    const farm = user.farms[0]
    const sensor = farm.sensors[0]

    const calculatedSavingsWater = Number((farm.areaHa * 0.55).toFixed(1))
    const calculatedSavingsKzt = Math.round(calculatedSavingsWater * 84.5)
    const logs = await prisma.telemetryLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        soilMoisture: true,
        irrigationAmount: true,
        createdAt: true,
        details: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        farmName: farm.name,
        areaHa: farm.areaHa,
        cropName: farm.cropType?.name || 'Buğday',
        regionName: farm.cooperative?.region?.name || 'Almaty Region',
        soilMoisture: 45,
        targetMoisture: 50,
        monthlySavingsKzt: calculatedSavingsKzt,
        preventedWaterM3: calculatedSavingsWater,
        sensorStatus: sensor ? 'İyi' : 'Bağlantı Yok',
        batteryLevel: sensor?.battery ?? 95,
        signalStrength: -68,
        recommendedDoseM3: 10,
        unitWaterPriceKzt: 84.5,
      },
      logs,
    })
  } catch (error) {
    console.error('API Hatası:', error)
    return NextResponse.json({ error: 'Veri çekme hatası' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
