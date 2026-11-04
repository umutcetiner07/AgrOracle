CREATE TABLE "TelemetryLog" (
    "id" TEXT NOT NULL,
    "sensorId" INTEGER NOT NULL,
    "soilMoisture" DOUBLE PRECISION NOT NULL,
    "battery" DOUBLE PRECISION,
    "irrigationAmount" DOUBLE PRECISION NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TelemetryLog"
ADD CONSTRAINT "TelemetryLog_sensorId_fkey"
FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
