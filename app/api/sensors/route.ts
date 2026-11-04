export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const sensors = await prisma.sensor.findMany({
    include: {
      anomalies: { where: { resolvedAt: null } },
      farm: { include: { farmer: true } }
    }
  })
  return NextResponse.json(sensors)
}
