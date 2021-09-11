---
title: User permissions query
publishedOn: 2021-09-10
updatedOn: 2021-09-10
isPublished: true
topic: postgres
description: Get a little more detail about a user's permissions
---

```sql
SELECT
  c.relacl,
  n.nspname AS schema,
  c.relname AS table,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    WHEN 'S' THEN 'sequence'
    WHEN 'f' THEN 'foreign table'
  END AS type
FROM pg_catalog.pg_class AS c
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE pg_catalog.array_to_string(c.relacl, E'\n') LIKE '%USER%';
```

## Usage

Replace `USER` with the name of the user you are interested in using.

`\dp` and `\dpp` are great for looking at user permission. Everyonce in a while I want some more information, or more cleanly displayed info. Or I might be using a CLI or database client that can't run `\dp` or `\dpp`. 