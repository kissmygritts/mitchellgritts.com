---
title: jsonb_build_object
publishedOn: 2021-08-11
updatedOn: 2021-08-11
isPublished: true
topic: postgres
description: Build a JSON object with postgres
---

```sql
SELECT jsonb_build_object('a', 1234);
-- output: { "a": 123 }
```

There are two variants of this function that do the same thing but the return object type is different. `json_build_object` returns `json` and `jsonb_build_object` return `jsonb` ([about the `json` and `jsonb` types in PostgreSQL](https://www.postgresql.org/docs/13/datatype-json.html)). I tend to use `jsonb` exclusively, so all examples moving forward will use the `jsonb` variant.

## Usage

`jsonb_build_object` takes a comma separated list of arguments and generates a `jsonb` object. The general pattern here is the arguments come in pairs. The first argument is the key and the next argument is the value. A few examples:

```sql
SELECT jsonb_build_object('a', 1234);
-- output: { "a": 123 }

SELECT jsonb_build_object('a', 1234, 'name', 'alex');
-- output: { "a": 123, "name": 'alex' }
```

Or more complex examples: 

```sql
SELECT jsonb_build_object(
  'name', 'alex',
  'phone_numbers', ARRAY['111-111-1111', '222-222-2222']
);
-- output:
-- {
--   "name": "alex",
--   "phone_numbers": ["111-111-1111", "222-222-2222"]
-- }

SELECT jsonb_build_object(
  'name', 'alex',
  'phone_numbers', jsonb_build_object(
    'home', '111-111-1111',
    'cell', '222-222-2222'
  )
);
-- output:
-- {
--   "name": "alex",
--   "phone_numbers": {
--     "home": "111-111-1111",
--     "cell": "222-222-2222"
--    }
-- }
```

A cool feature of `jsonb` and the functions that work with `jsonb` is automatic conversion to `jsonb`. We've already seen an example of this above with the `ARRAY` data type. For example, the PostGIS extension includes a method to convert geometries to GeoJSON. The follow takes advantage of that built in conversion:

```sql
SELECT jsonb_build_object('coords', ST_GeomFromText('POINT(-71.064544 42.28787)'));
-- output: 
-- {
--   "coords": {
--     "type": "Point",
--     "coordinates": [-71.064544, 42.28787]
--   }
-- }
```

## References

* [Postgres Docs](https://www.postgresql.org/docs/current/functions-json.html#FUNCTIONS-JSON-CREATION-TABLE)
* [Cut out the Middle Tier: Generating JSON Directly from Postgres](https://blog.crunchydata.com/blog/generating-json-directly-from-postgres)