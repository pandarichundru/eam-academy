#!/usr/bin/env python3
"""Inventory, export, and validate EAM 11.6 SQL Server tables into data/<family>/<table>.json and data/manifest.json."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CONTAINER = os.environ.get("MSSQL_CONTAINER", "eam-mssql-restore")
DB_NAME = os.environ.get("MSSQL_DB", "EAM116_VAN")
SA_PASSWORD = os.environ.get("MSSQL_SA_PASSWORD", "")
ROW_LIMIT = 5000
FAMILIES = ["r5", "u5", "udf", "cor", "tx", "datalake", "other"]

# Verified UDF configuration and custom tables (including R5-/TX-prefixed UDF tables).
UDF_EXACT_TABLES = {
    "R5USERDEFINEDFIELDSETUP",
    "R5USERDEFINEDFIELDDEPENDENCIES",
    "R5USERDEFINEDFIELDLOVVALS",
    "R5UDFSCREENS",
    "R5UDFSCREENFIELDS",
    "R5TEMPREPORTUDF",
    "TXUSERDEFINEDFIELDSETUP",
    "TXUSERDEFINEDFIELDDEPENDENCIES",
    "R5CUSTOM",
    "R5CUSTOMTEXTS",
    "R5DDCUSTOMFIELDS",
    "R5MGCUSTOMFIELD",
    "R5EVALUATIONCUSTOMFLDPARAMS",
}

CLASSIFICATION_RULES = {
    "precedence": [
        "1. u5: table name starts with 'U5' (case-insensitive).",
        "2. udf: table name is in verified UDF/custom set (UDF_EXACT_TABLES) or starts with 'UDF' (case-insensitive).",
        "3. cor: table name starts with 'COR' (case-insensitive).",
        "4. datalake: table name starts with 'DATALAKE' (case-insensitive).",
        "5. r5: table name starts with 'R5' (case-insensitive) and was not matched by udf.",
        "6. tx: table name starts with 'TX' (case-insensitive) and was not matched by udf.",
        "7. other: all remaining tables (e.g. SEQ_*, ESB_*, O7*, DUAL, TABLECOUNT_MSSQL, V$SESSION, etc.).",
    ],
    "explicit_exceptions": sorted(UDF_EXACT_TABLES),
}

TYPE_REPRESENTATIONS = {
    "null": "JSON null",
    "nvarchar/varchar/ntext/nchar": "UTF-8 JSON string (Unicode preserved)",
    "int/smallint/tinyint": "JSON integer",
    "bigint": "JSON integer when within IEEE-754 safe range (|n| <= 9007199254740991), else exact decimal string",
    "numeric/decimal": "JSON integer when scale == 0 and precision <= 15, else exact decimal string",
    "float/real": "JSON number (or null if NaN/Infinity)",
    "date/datetime/datetime2/smalldatetime/datetimeoffset/time": "ISO-8601 string preserving fractional seconds",
    "binary/varbinary/image/timestamp": "Hex string prefixed with 0x (uppercase)",
}

BINARY_TYPES = {"binary", "varbinary", "image", "timestamp"}
DECIMAL_TYPES = {"numeric", "decimal"}
LOB_TYPES = {"ntext", "text", "image"}


def run_sql_json(query: str) -> list[dict]:
    if not SA_PASSWORD:
        raise RuntimeError("MSSQL_SA_PASSWORD environment variable is required.")
    sqlcmd = "/opt/mssql-tools18/bin/sqlcmd"
    cmd = [
        "docker", "exec", "-i", CONTAINER, sqlcmd,
        "-S", "localhost", "-U", "sa", "-P", SA_PASSWORD,
        "-C", "-d", DB_NAME, "-y", "0",
        "-Q", f"SET NOCOUNT ON; {query}",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"sqlcmd failed ({res.returncode}): {res.stderr}\n{res.stdout}")
    raw = "".join(line.rstrip("\r\n") for line in res.stdout.splitlines()).strip()
    if not raw:
        return []
    return json.loads(raw)


def classify_table(table_name: str) -> str:
    u = table_name.upper()
    if u.startswith("U5"):
        return "u5"
    if u in UDF_EXACT_TABLES or u.startswith("UDF"):
        return "udf"
    if u.startswith("COR"):
        return "cor"
    if u.startswith("DATALAKE"):
        return "datalake"
    if u.startswith("R5"):
        return "r5"
    if u.startswith("TX"):
        return "tx"
    return "other"


def safe_filename(schema_name: str, table_name: str, used: set[str]) -> str:
    def encode_ident(s: str) -> str:
        return re.sub(r"[^A-Za-z0-9_.-]", lambda m: f"_x{ord(m.group(0)):02x}_", s)

    base = encode_ident(table_name)
    candidate = f"{base}.json"
    if candidate.lower() in used or schema_name.lower() != "dbo":
        candidate = f"{encode_ident(schema_name)}__{base}.json"
    idx = 2
    while candidate.lower() in used:
        candidate = f"{encode_ident(schema_name)}__{base}_{idx}.json"
        idx += 1
    used.add(candidate.lower())
    return candidate


def quote_ident(ident: str) -> str:
    return "[" + ident.replace("]", "]]") + "]"


def build_select_expr(col: dict) -> str:
    cname = quote_ident(col["column_name"])
    dtype = col["data_type"].lower()
    if dtype in BINARY_TYPES:
        return f"CONVERT(varchar(max), {cname}, 1) AS {cname}"
    if dtype in DECIMAL_TYPES:
        scale = col.get("numeric_scale") or 0
        prec = col.get("numeric_precision") or 38
        if scale > 0 or prec > 15:
            return f"CASE WHEN {cname} IS NULL THEN NULL ELSE CONVERT(varchar(64), {cname}) END AS {cname}"
    if dtype == "bigint":
        # Preserve exact 64-bit integers outside JS safe integer range as strings
        return f"CASE WHEN {cname} IS NULL THEN NULL WHEN {cname} > 9007199254740991 OR {cname} < -9007199254740991 THEN CONVERT(varchar(32), {cname}) ELSE CONVERT(varchar(32), {cname}) END AS {cname}"
    return cname


def main() -> None:
    evidence = json.loads((DATA_DIR / "db-evidence.json").read_text())

    print("1. Querying INFORMATION_SCHEMA.TABLES and sys.tables reconciliation...")
    reconcile = run_sql_json("""
        SELECT
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE') AS info_schema_base_tables,
          (SELECT COUNT(*) FROM sys.tables) AS sys_tables_all,
          (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS sys_tables_user
        FOR JSON PATH;
    """)[0]
    print("Reconciliation:", reconcile)

    print("2. Querying exact COUNT_BIG(*) for all user tables...")
    counts_rows = run_sql_json("""
        CREATE TABLE #c (schema_name sysname, table_name sysname, row_cnt bigint);
        DECLARE @s sysname, @t sysname, @sql nvarchar(max);
        DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
          SELECT s.name, t.name
          FROM sys.tables t
          JOIN sys.schemas s ON t.schema_id = s.schema_id
          ORDER BY s.name, t.name;
        OPEN cur;
        FETCH NEXT FROM cur INTO @s, @t;
        WHILE @@FETCH_STATUS = 0
        BEGIN
          SET @sql = N'INSERT INTO #c VALUES (@s, @t, (SELECT COUNT_BIG(*) FROM ' + QUOTENAME(@s) + N'.' + QUOTENAME(@t) + N'));';
          EXEC sp_executesql @sql, N'@s sysname, @t sysname', @s = @s, @t = @t;
          FETCH NEXT FROM cur INTO @s, @t;
        END
        CLOSE cur; DEALLOCATE cur;
        SELECT schema_name, table_name, row_cnt FROM #c ORDER BY schema_name, table_name FOR JSON PATH;
    """)

    print(f"   Got {len(counts_rows)} tables.")

    print("3. Querying columns, primary keys, unique indexes, and foreign keys...")
    cols_rows = run_sql_json("""
        SELECT
          c.TABLE_SCHEMA AS schema_name,
          c.TABLE_NAME AS table_name,
          c.ORDINAL_POSITION AS ordinal_position,
          c.COLUMN_NAME AS column_name,
          c.DATA_TYPE AS data_type,
          c.IS_NULLABLE AS is_nullable,
          c.CHARACTER_MAXIMUM_LENGTH AS max_length,
          c.NUMERIC_PRECISION AS numeric_precision,
          c.NUMERIC_SCALE AS numeric_scale,
          c.DATETIME_PRECISION AS datetime_precision
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t
          ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
        FOR JSON PATH;
    """)

    pk_rows = run_sql_json("""
        SELECT
          s.name AS schema_name,
          t.name AS table_name,
          kc.name AS pk_name,
          c.name AS column_name,
          ic.key_ordinal AS key_ordinal
        FROM sys.key_constraints kc
        JOIN sys.tables t ON kc.parent_object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = kc.unique_index_id
        JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id
        WHERE kc.type = 'PK'
        ORDER BY s.name, t.name, ic.key_ordinal
        FOR JSON PATH;
    """)

    uk_rows = run_sql_json("""
        SELECT
          s.name AS schema_name,
          t.name AS table_name,
          i.name AS index_name,
          i.index_id AS index_id,
          c.name AS column_name,
          ic.key_ordinal AS key_ordinal
        FROM sys.indexes i
        JOIN sys.tables t ON i.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
        JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id
        WHERE i.is_unique = 1 AND i.is_primary_key = 0 AND i.has_filter = 0
        ORDER BY s.name, t.name, i.index_id, ic.key_ordinal
        FOR JSON PATH;
    """)

    fk_rows = run_sql_json("""
        SELECT
          fk.name AS fk_name,
          cs.name AS schema_name,
          ct.name AS table_name,
          cc.name AS column_name,
          ps.name AS ref_schema_name,
          pt.name AS ref_table_name,
          pc.name AS ref_column_name,
          fkc.constraint_column_id AS ordinal
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables ct ON fkc.parent_object_id = ct.object_id
        JOIN sys.schemas cs ON ct.schema_id = cs.schema_id
        JOIN sys.columns cc ON cc.object_id = ct.object_id AND cc.column_id = fkc.parent_column_id
        JOIN sys.tables pt ON fkc.referenced_object_id = pt.object_id
        JOIN sys.schemas ps ON pt.schema_id = ps.schema_id
        JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.referenced_column_id
        ORDER BY cs.name, ct.name, fk.name, fkc.constraint_column_id
        FOR JSON PATH;
    """)

    cols_by_tbl: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for c in cols_rows:
        cols_by_tbl[(c["schema_name"], c["table_name"])].append(c)

    pk_by_tbl: dict[tuple[str, str], list[str]] = defaultdict(list)
    for p in pk_rows:
        pk_by_tbl[(p["schema_name"], p["table_name"])].append(p["column_name"])

    uk_by_tbl: dict[tuple[str, str], dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for u in uk_rows:
        uk_by_tbl[(u["schema_name"], u["table_name"])][u["index_name"]].append(u["column_name"])

    fks_by_tbl: dict[tuple[str, str], list[dict]] = defaultdict(list)
    fk_group: dict[tuple[str, str, str], dict] = {}
    for f in fk_rows:
        key = (f["schema_name"], f["table_name"], f["fk_name"])
        if key not in fk_group:
            fk_group[key] = {
                "name": f["fk_name"],
                "ref_table": f"{f['ref_schema_name']}.{f['ref_table_name']}",
                "columns": [],
                "ref_columns": [],
            }
            fks_by_tbl[(f["schema_name"], f["table_name"])].append(fk_group[key])
        fk_group[key]["columns"].append(f["column_name"])
        fk_group[key]["ref_columns"].append(f["ref_column_name"])

    # Prepare family directories
    for fam in FAMILIES:
        (DATA_DIR / fam).mkdir(parents=True, exist_ok=True)

    family_totals = {
        fam: {"tables": 0, "populated_tables": 0, "source_rows": 0, "exported_rows": 0, "truncated_tables": 0}
        for fam in FAMILIES
    }
    used_files: dict[str, set[str]] = {fam: set() for fam in FAMILIES}
    manifest_tables = []

    print("\nFamily Inventory (pre-export):")
    for row in counts_rows:
        fam = classify_table(row["table_name"])
        family_totals[fam]["tables"] += 1
        src_cnt = int(row["row_cnt"])
        family_totals[fam]["source_rows"] += src_cnt
        if src_cnt > 0:
            family_totals[fam]["populated_tables"] += 1

    print(f"{'Family':<10} {'Tables':>8} {'Populated':>10} {'Source Rows':>14}")
    print("-" * 46)
    for fam in FAMILIES:
        ft = family_totals[fam]
        print(f"{fam:<10} {ft['tables']:>8} {ft['populated_tables']:>10} {ft['source_rows']:>14,}")
    print("-" * 46)
    print(f"{'TOTAL':<10} {sum(f['tables'] for f in family_totals.values()):>8} {sum(f['populated_tables'] for f in family_totals.values()):>10} {sum(f['source_rows'] for f in family_totals.values()):>14,}\n")

    print("4. Exporting all tables...")
    for idx, row in enumerate(counts_rows, 1):
        sch = row["schema_name"]
        tbl = row["table_name"]
        src_cnt = int(row["row_cnt"])
        fam = classify_table(tbl)
        fname = safe_filename(sch, tbl, used_files[fam])
        rel_path = f"data/{fam}/{fname}"
        key = (sch, tbl)
        cols = cols_by_tbl[key]
        pk = pk_by_tbl.get(key, [])
        uks = uk_by_tbl.get(key, {})
        first_uk = next(iter(uks.values()), []) if uks else []
        fks = fks_by_tbl.get(key, [])

        if pk:
            order_cols = pk
            ordering_desc = f"PRIMARY KEY ({', '.join(pk)})"
        elif first_uk:
            order_cols = first_uk
            ordering_desc = f"UNIQUE INDEX ({', '.join(first_uk)})"
        else:
            sortable = [c["column_name"] for c in cols if c["data_type"].lower() not in LOB_TYPES]
            order_cols = sortable[:4]
            ordering_desc = (
                f"KEYLESS DETERMINISTIC ({', '.join(order_cols)})"
                if order_cols else "KEYLESS HEAP ORDER"
            )

        if src_cnt == 0:
            exported_rows = []
        else:
            sel_list = ", ".join(build_select_expr(c) for c in cols)
            order_clause = (
                "ORDER BY " + ", ".join(quote_ident(c) for c in order_cols)
                if order_cols else ""
            )
            q = (
                f"SELECT TOP ({ROW_LIMIT}) {sel_list} "
                f"FROM {quote_ident(sch)}.{quote_ident(tbl)} "
                f"{order_clause} "
                f"FOR JSON PATH, INCLUDE_NULL_VALUES;"
            )
            exported_rows = run_sql_json(q)
            # Normalize bigint strings back to int when within JS safe integer range
            bigint_cols = {c["column_name"] for c in cols if c["data_type"].lower() == "bigint"}
            if bigint_cols:
                for r in exported_rows:
                    for bc in bigint_cols:
                        val = r.get(bc)
                        if isinstance(val, str):
                            ival = int(val)
                            if -9007199254740991 <= ival <= 9007199254740991:
                                r[bc] = ival

        exp_cnt = len(exported_rows)
        truncated = src_cnt > ROW_LIMIT
        expected_exp = min(src_cnt, ROW_LIMIT)
        if exp_cnt != expected_exp:
            raise RuntimeError(f"Export count mismatch for {sch}.{tbl}: got {exp_cnt}, expected {expected_exp}")

        family_totals[fam]["exported_rows"] += exp_cnt
        if truncated:
            family_totals[fam]["truncated_tables"] += 1

        col_meta = [
            {
                "name": c["column_name"],
                "ordinal": c["ordinal_position"],
                "sql_type": c["data_type"],
                "nullable": c["is_nullable"] == "YES",
                "max_length": c.get("max_length"),
                "precision": c.get("numeric_precision"),
                "scale": c.get("numeric_scale"),
            }
            for c in cols
        ]

        payload = {
            "schema": sch,
            "table": tbl,
            "full_name": f"{sch}.{tbl}",
            "family": fam,
            "source_rows": src_cnt,
            "exported_rows": exp_cnt,
            "truncated": truncated,
            "ordering": ordering_desc,
            "primary_key": pk,
            "foreign_keys": fks,
            "columns": col_meta,
            "rows": exported_rows,
        }
        (ROOT / rel_path).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

        manifest_tables.append({
            "schema": sch,
            "table": tbl,
            "full_name": f"{sch}.{tbl}",
            "family": fam,
            "export_path": rel_path,
            "source_rows": src_cnt,
            "exported_rows": exp_cnt,
            "truncated": truncated,
            "ordering": ordering_desc,
            "primary_key": pk,
            "foreign_keys": fks,
            "columns": col_meta,
        })
        if idx % 200 == 0 or idx == len(counts_rows):
            print(f"   Exported {idx}/{len(counts_rows)} tables...")

    manifest = {
        "backup": {
            "file": "116_van.bak",
            "bytes": evidence["bytes"],
            "sha256": evidence["sha256"],
            "database": DB_NAME,
            "row_limit_per_table": ROW_LIMIT,
        },
        "reconciliation": reconcile,
        "classification": CLASSIFICATION_RULES,
        "type_representations": TYPE_REPRESENTATIONS,
        "family_totals": family_totals,
        "totals": {
            "tables": sum(f["tables"] for f in family_totals.values()),
            "populated_tables": sum(f["populated_tables"] for f in family_totals.values()),
            "source_rows": sum(f["source_rows"] for f in family_totals.values()),
            "exported_rows": sum(f["exported_rows"] for f in family_totals.values()),
            "truncated_tables": sum(f["truncated_tables"] for f in family_totals.values()),
        },
        "tables": manifest_tables,
    }
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print("5. Validating all JSON exports against data/manifest.json...")
    for entry in manifest_tables:
        p = ROOT / entry["export_path"]
        data = json.loads(p.read_text())
        assert data["full_name"] == entry["full_name"], f"Name mismatch: {entry['full_name']}"
        assert data["family"] == entry["family"], f"Family mismatch: {entry['full_name']}"
        assert data["source_rows"] == entry["source_rows"], f"Source count mismatch: {entry['full_name']}"
        assert data["exported_rows"] == entry["exported_rows"] == len(data["rows"]), f"Export count mismatch: {entry['full_name']}"
        assert data["truncated"] == entry["truncated"], f"Truncated mismatch: {entry['full_name']}"
        assert len(data["columns"]) == len(entry["columns"]), f"Column count mismatch: {entry['full_name']}"
    print(f"Validated {len(manifest_tables)} JSON exports successfully!")
    print("Totals:", json.dumps(manifest["totals"], indent=2))


if __name__ == "__main__":
    main()
