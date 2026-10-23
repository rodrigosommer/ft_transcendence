-- Records that an account has been through the first run setup screen.
-- Nullable with no default: every existing account is deliberately left
-- owing the screen, which is the same answer a brand new account gets.
ALTER TABLE "users" ADD COLUMN "onboarded_at" TIMESTAMP(3);
