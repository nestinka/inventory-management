-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
    "smtp_user" TEXT,
    "smtp_password" TEXT,
    "mail_from" TEXT NOT NULL,
    "alert_recipients" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
