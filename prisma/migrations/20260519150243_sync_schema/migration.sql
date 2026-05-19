/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `requests` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `departments` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "requests" DROP CONSTRAINT "requests_department_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_department_id_fkey";

-- DropIndex
DROP INDEX "categories_deleted_at_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "deleted_at",
ADD COLUMN     "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "requests" DROP COLUMN "department_id";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "department_id";

-- DropTable
DROP TABLE "departments";

-- CreateIndex
CREATE INDEX "categories_status_idx" ON "categories"("status");
