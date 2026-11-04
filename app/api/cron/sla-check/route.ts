export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const activeAlerts = await prisma.weatherAlert.count({
    where: { active: true }
  })

  if (activeAlerts > 0) {
    await prisma.contract.updateMany({
      data: { slaFrozen: true }
    })
  }

  return NextResponse.json({ status: 'SLA checked' })
}
