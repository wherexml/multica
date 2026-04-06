-- Add password_hash column to user table
ALTER TABLE "user" ADD COLUMN password_hash VARCHAR(255);
