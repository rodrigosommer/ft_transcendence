-- Display names become unique without regard to case: "Ada" and "ada" can no longer both exist.
--
-- The database runs with the C locale, whose lower() only folds ASCII. ICU's root collation folds
-- every alphabet ("É" and "é" too), so it is used whenever the server was built with ICU, which the
-- official postgres images are. Without it the index falls back to the plain lower().
--
-- Prisma cannot describe an index on an expression, so this one lives only here. If a later
-- 'prisma migrate dev' proposes to drop "users_display_name_ci_key", remove that line from the
-- generated migration.
DO $$
DECLARE
  collate_clause text := CASE
    WHEN EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu') THEN ' COLLATE "und-x-icu"'
    ELSE ''
  END;
BEGIN
  -- Accounts that already clash: the oldest keeps its name, every later one gets its id appended
  -- (cut so the result still fits the 24 character limit), so creating the index cannot fail.
  EXECUTE
    'UPDATE "users" AS u '
    || 'SET "display_name" = left(u."display_name", 23 - length(u."id"::text)) || ''_'' || u."id" '
    || 'WHERE EXISTS (SELECT 1 FROM "users" AS o '
    || 'WHERE lower(o."display_name"' || collate_clause || ') = lower(u."display_name"' || collate_clause || ') '
    || 'AND o."id" < u."id")';

  EXECUTE
    'CREATE UNIQUE INDEX "users_display_name_ci_key" ON "users" (lower("display_name"' || collate_clause || '))';
END
$$;
