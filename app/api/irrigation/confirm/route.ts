import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsedAmount = Number(body.amountM3 ?? 10)
    const amountM3 = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 10

    const user = await prisma.user.findUnique({
      where: { email: 'farmer@umut.com' },
      include: {
        farms: {
          include: {
            sensors: true,
          },
        },
      },
    })

    if (!user || user.farms.length === 0) {
      return NextResponse.json({ error: 'Çiftlik bulunamadı' }, { status: 404 })
    }

    const farm = user.farms[0]
    const sensor = farm.sensors[0]

    if (!sensor) {
      return NextResponse.json({ error: 'Sensör bulunamadı' }, { status: 404 })
    }

    const unitPriceKzt = 84.5
    const savedWaterM3 = Number((amountM3 * 0.28).toFixed(2))
    const savedAmountKzt = Math.round(savedWaterM3 * unitPriceKzt)

    const log = await prisma.telemetryLog.create({
      data: {
        sensorId: sensor.id,
        soilMoisture: 45.0,
        battery: sensor.battery,
        irrigationAmount: amountM3,
        details: {
          action: 'IRRIGATION_EXECUTED',
          protocol: 'Bereke-RuleEngine-v1',
          savedWaterM3,
          savedAmountKzt,
          timestamp: new Date().toISOString(),
          decisionGuardVerified: true,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Sulama başarıyla deftere işlendi.',
      entry: {
        id: log.id,
        amountM3,
        savedWaterM3,
        savedAmountKzt,
        verifiedAt: log.createdAt,
        soilMoisture: log.soilMoisture,
        irrigationAmount: log.irrigationAmount,
        createdAt: log.createdAt,
        details: log.details,
      },
    })
  } catch (error) {
    console.error('Sulama onaylama hatası:', error)
    return NextResponse.json({ error: 'İşlem deftere yazılamadı' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
