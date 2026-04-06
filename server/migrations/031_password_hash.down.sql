-- Remove password_hash column from user table
ALTER TABLE "user" DROP COLUMN IF EXISTS password_hash;
