---
title: Query Tables with Geometry Columns
publishedOn: 2021-08-10
updatedOn: 2021-08-10
isPublished: true
topic: postgis
description: A query to return all tables with a geometry column
---

```sql
WITH columns AS (
  SELECT
    ns.nspname AS table_schema,
    class.relname AS table_name,
    attr.attname AS column_name,
    trim(leading '_' from tp.typname) AS type_name
  FROM pg_attribute attr
    JOIN pg_catalog.pg_class AS class ON class.oid = attr.attrelid
    JOIN pg_catalog.pg_namespace AS ns ON ns.oid = class.relnamespace
    JOIN pg_catalog.pg_type AS tp ON tp.oid = attr.atttypid
  WHERE NOT attr.attisdropped AND attr.attnum > 0)

SELECT
  f_table_schema AS schema_name,
  f_table_name AS table_name,
  f_geometry_column AS geometry_column,
  srid,
  type,
  COALESCE(
    jsonb_object_agg(columns.column_name, columns.type_name) FILTER (WHERE columns.column_name IS NOT NULL),
    '{}'::jsonb
  ) as properties
FROM geometry_columns
LEFT JOIN columns ON
  geometry_columns.f_table_schema = columns.table_schema AND
  geometry_columns.f_table_name = columns.table_name AND
  geometry_columns.f_geometry_column != columns.column_name
GROUP BY f_table_schema, f_table_name, f_geometry_column, srid, type;
```

## Usage

This query will return all tables and views in a PostgreSQL & PostGIS database that contain a geometry column.

The query returns the following columns:

* `schema_name`: the schema that the table belongs to.
* `table_name`: the name of the table or view.
* `geometry_column`: the name of the geometry column.
* `srid`: the SRID (spatial reference ID, EPSG code) that the geometry is projected in.
* `type`: the spatial type of the geometry column. For instance `POINT`, `POLYGON`, `MULTIPOLYGON`, etc.
* `properties`: a JSONB column with all the columns within the table. This is an object where the `key` is the name of the column and the `value` is the data type.

**Example output:**

```text
+---------------+----------------------+-------------------+--------+--------------+--------------------------------------------------------------------------------------------------------------+
| schema_name   | table_name           | geometry_column   | srid   | type         | properties                                                                                                   |
|---------------+----------------------+-------------------+--------+--------------+--------------------------------------------------------------------------------------------------------------|
| public        | hunt_unit_labels     | geom              | 4326   | POINT        | {"id": "int4", "display_name": "text"}                                                                       |
| public        | hunt_units           | geom              | 4326   | MULTIPOLYGON | {"id": "int4", "area": "numeric", "is_full": "bool", "is_open": "bool", "display_name": "text"}              |
| public        | public_landownership | geom              | 4326   | MULTIPOLYGON | {"id": "int4", "surface_mgmt_agency": "text"}                                                                |
| public        | wilderness           | geom              | 4326   | MULTIPOLYGON | {"id": "int4", "type": "text", "mgmt_agency": "text", "display_name": "text"}                                |
| public        | wmas                 | geom              | 4326   | MULTIPOLYGON | {"id": "int4", "display_name": "text"}                                                                       |
+---------------+----------------------+-------------------+--------+--------------+--------------------------------------------------------------------------------------------------------------+
```

I like to create a view (generally called `spatial_table_sources`) that way I can easily get this information. 

I'll use this query to dynamically generate vector tiles when I build APIs.

## References

This query was taken, nearly verbatim, from [Martin](https://github.com/urbica/martin/blob/master/src/scripts/get_table_sources.sql), a PostGIS vector tiles server.