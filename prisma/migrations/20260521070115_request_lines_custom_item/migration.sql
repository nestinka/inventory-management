-- DropForeignKey
ALTER TABLE "request_lines" DROP CONSTRAINT "request_lines_item_id_fkey";

-- AlterTable
ALTER TABLE "request_lines" ADD COLUMN     "custom_category_id" UUID,
ADD COLUMN     "custom_item_name" TEXT,
ADD COLUMN     "custom_unit" TEXT,
ALTER COLUMN "item_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_custom_category_id_fkey" FOREIGN KEY ("custom_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
