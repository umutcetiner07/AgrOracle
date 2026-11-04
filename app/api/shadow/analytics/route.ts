export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  // hitRate: mock
  const hitRate = 78

  // complianceRate
  const totalAnomalies = await prisma.anomalyLog.count()
  const resolved = await prisma.anomalyLog.count({ where: { resolvedAt: { not: null } } })
  const complianceRate = totalAnomalies > 0 ? (resolved / totalAnomalies) * 100 : 0

  // anomalyPrecision
  const avgConfidence = await prisma.anomalyLog.aggregate({
    _avg: { confidenceScore: true }
  })
  const anomalyPrecision = (avgConfidence._avg.confidenceScore || 0) * 100

  return NextResponse.json({ hitRate, complianceRate, anomalyPrecision })
}
