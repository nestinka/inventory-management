-- CreateTable
CREATE TABLE "notification_dedup" (
    "key" TEXT NOT NULL,
    "emitted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_dedup_pkey" PRIMARY KEY ("key")
);
