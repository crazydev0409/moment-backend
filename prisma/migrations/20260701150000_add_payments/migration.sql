-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "momentRequestId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "applicationFeeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'requires_payment',
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "stripeTransferId" TEXT,
    "failureReason" TEXT,
    "capturedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeConnectAccountId_key" ON "User"("stripeConnectAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_momentRequestId_key" ON "Payment"("momentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_payeeId_status_idx" ON "Payment"("payeeId", "status");

-- CreateIndex
CREATE INDEX "Payment_payerId_status_idx" ON "Payment"("payerId", "status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_momentRequestId_fkey" FOREIGN KEY ("momentRequestId") REFERENCES "MomentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
