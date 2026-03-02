import { supabase } from './supabase';
import { SheetData, SheetRow } from '../types';

// ── Connection state ─────────────────────────────────────────────────────────
let _isConnected = false;
let _connectionChecked = false;

/**
 * Convert a user-given table name to a safe Postgres identifier.
 * e.g. "My Contacts!" → "my_contacts"
 */
export function getPgTableName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')   // non-alphanumeric → underscore
        .replace(/^_+|_+$/g, '')        // trim leading/trailing underscores
        .substring(0, 63)               // Postgres max identifier length
        || 'table_' + Date.now();       // fallback if name is empty after sanitize
}

export async function checkSupabaseConnection(): Promise<boolean> {
    if (_connectionChecked) return _isConnected;
    try {
        const { error } = await supabase.from('dms_metadata').select('id').limit(1);
        if (!error) {
            _isConnected = true;
        } else {
            // 42P01 = table doesn't exist yet, PGRST116/205 = schema cache issue
            // All of these mean we CAN talk to Supabase; the table just may not exist yet
            const tableNotFoundCodes = ['42P01', 'PGRST116', 'PGRST205'];
            _isConnected = tableNotFoundCodes.includes(error.code ?? '');
        }
    } catch {
        _isConnected = false;
    }
    _connectionChecked = true;
    console.log(`[Supabase] Connection: ${_isConnected ? '✅ ONLINE' : '❌ OFFLINE (using localStorage)'}`);
    return _isConnected;
}

export function isConnected(): boolean {
    return _isConnected;
}

// ── Local Storage helpers (Fallback) ─────────────────────────────────────────
const LS_KEY = 'dms_sheets_data';

export function saveToLocalStorage(sheets: SheetData[]): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(sheets));
    } catch (e) {
        console.warn('[LocalStorage] Failed to save:', e);
    }
}

export function loadFromLocalStorage(): SheetData[] {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('dms_sheets_backup');
    if (saved) {
        try {
            const parsed = JSON.parse(saved) as SheetData[];
            // Patch missing IDs in legacy local storage data
            return parsed.map(sheet => ({
                ...sheet,
                data: sheet.data.map(row => ({
                    ...row,
                    id: row.id || crypto.randomUUID()
                }))
            }));
        } catch (e) {
            console.error('Failed to parse local backup', e);
        }
    }
    return [];
}

// ── Supabase Schema Init ──────────────────────────────────────────────────────

export async function initSupabaseSchema(): Promise<void> {
    if (!_isConnected) return;
    // Ensure the dms_metadata table exists (created by the migration SQL)
    const { error: metaErr } = await supabase.from('dms_metadata').select('id').limit(1);
    const tableNotFoundCodes = ['42P01', 'PGRST205'];
    if (metaErr && tableNotFoundCodes.includes(metaErr.code ?? '')) {
        console.warn('[Supabase] dms_metadata table not found. Please run the migration SQL in your Supabase SQL editor:\n\n' +
            `CREATE TABLE IF NOT EXISTS public.dms_metadata (\n` +
            `  id TEXT PRIMARY KEY,\n` +
            `  table_name TEXT NOT NULL,\n` +
            `  pg_table TEXT NOT NULL,\n` +
            `  columns JSONB NOT NULL DEFAULT '[]'\n` +
            `);\n` +
            `ALTER TABLE public.dms_metadata ENABLE ROW LEVEL SECURITY;\n` +
            `CREATE POLICY "Allow all" ON public.dms_metadata FOR ALL USING (true) WITH CHECK (true);\n`
        );
        _isConnected = false;
    }
}

// ── DDL Execution via manage_schema RPC ──────────────────────────────────────

/** Execute raw SQL statements via the manage_schema RPC sequentially */
async function execSqlStatements(sqls: string[]): Promise<void> {
    if (!_isConnected) return;
    for (const sql of sqls) {
        console.log('[Supabase DDL]', sql);
        const { error } = await supabase.rpc('manage_schema', { sql_query: sql });
        if (error) {
            console.error('[Supabase DDL Error] Failed executing:', sql, error);
            throw error;
        }
    }
}

// ── Load All Sheets from Supabase ─────────────────────────────────────────────

/** Load all sheets and their data from Supabase */
export async function loadSheetsFromSupabase(): Promise<SheetData[] | null> {
    if (!_isConnected) return loadFromLocalStorage();

    try {
        // 1. Load all metadata rows
        const { data: meta, error: metaErr } = await supabase
            .from('dms_metadata')
            .select('*')
            .order('created_at', { ascending: true });

        if (metaErr) throw metaErr;
        if (!meta || meta.length === 0) return [];

        const sheets: SheetData[] = [];

        // 2. For each sheet, load rows from the real Postgres table
        for (const sm of meta) {
            const pgTable = sm.pg_table as string;
            const { data: rows, error: rowErr } = await supabase.from(pgTable).select('*');

            if (rowErr) {
                if (rowErr.code !== '42P01') {
                    console.warn(`[Supabase] Failed to load rows from "${pgTable}"`, rowErr);
                }
                // Table may have been dropped; skip and continue
                continue;
            }

            let finalColumns = sm.columns as string[];
            if (rows && rows.length > 0) {
                // Auto-detect actual columns from Postgres data to catch external Supabase UI changes
                finalColumns = Object.keys(rows[0]).filter(k => k !== 'id');
                // Update metadata if columns diverged (e.g. user added/deleted columns in Supabase UI)
                if (JSON.stringify(finalColumns) !== JSON.stringify(sm.columns)) {
                    supabase.from('dms_metadata').update({ columns: finalColumns }).eq('id', sm.id);
                }
            }

            sheets.push({
                id: sm.id,
                name: sm.table_name || 'Untitled Sheet',
                columns: finalColumns,
                data: rows ? rows.map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })) : [],
            });
        }

        saveToLocalStorage(sheets);
        return sheets;
    } catch (e) {
        console.error('[Supabase] Load failed:', e);
        return loadFromLocalStorage();
    }
}

// ── Table DDL Operations ──────────────────────────────────────────────────────

/** Update the table name in metadata (renaming display name and actual pg table) */
export async function syncRenameTable(sheetId: string, newName: string): Promise<void> {
    if (!_isConnected) return;
    try {
        const { data, error: fetchErr } = await supabase
            .from('dms_metadata')
            .select('pg_table')
            .eq('id', sheetId)
            .single();

        if (fetchErr || !data) return;
        const oldPgTable = data.pg_table as string;
        let newPgTable = getPgTableName(newName);

        if (oldPgTable !== newPgTable) {
            await execSqlStatements([`ALTER TABLE public."${oldPgTable}" RENAME TO "${newPgTable}"`]);
            console.log(`[Supabase] Renamed postgres table from ${oldPgTable} to ${newPgTable}`);
        } else {
            newPgTable = oldPgTable;
        }

        await supabase.from('dms_metadata').update({
            table_name: newName,
            pg_table: newPgTable
        }).eq('id', sheetId);

        console.log(`[Supabase] Renamed table metadata to: ${newName}`);
    } catch (e) {
        console.error('[Supabase] syncRenameTable failed', e);
    }
}

/** Create a new native Postgres table using the sheet's display name as the table name */
export async function syncCreateTable(sheet: SheetData): Promise<void> {
    if (!_isConnected) return;

    // Derive a safe postgres table name from the user-given name
    const pgTableName = getPgTableName(sheet.name);

    try {
        // Build column definitions; all user columns are TEXT
        const colDefs = sheet.columns.map(c => `"${c}" TEXT`).join(',\n  ');
        let createSql = `CREATE TABLE IF NOT EXISTS public."${pgTableName}" (\n  id TEXT PRIMARY KEY`;
        if (colDefs) createSql += `,\n  ${colDefs}`;
        createSql += `\n)`;

        // Execute DDL before writing metadata (so table exists before we reference it)
        await execSqlStatements([
            createSql,
            `ALTER TABLE public."${pgTableName}" ENABLE ROW LEVEL SECURITY`,
            `CREATE POLICY "Allow all" ON public."${pgTableName}" FOR ALL USING (true) WITH CHECK (true)`,
            `ALTER PUBLICATION supabase_realtime ADD TABLE public."${pgTableName}"`
        ]);

        // Store metadata (including the actual pg_table name)
        const { error: metaErr } = await supabase.from('dms_metadata').insert({
            id: sheet.id,
            table_name: sheet.name,
            pg_table: pgTableName,
            columns: sheet.columns,
        });
        if (metaErr) throw metaErr;

        console.log(`[Supabase] Created table: ${pgTableName}`);
    } catch (e) {
        console.error('[Supabase] syncCreateTable failed', e);
    }
}

/** Drop a native Postgres table */
export async function syncDeleteTable(sheetId: string): Promise<void> {
    if (!_isConnected) return;
    try {
        // Get the pg_table name from metadata first
        const { data, error: fetchErr } = await supabase
            .from('dms_metadata')
            .select('pg_table')
            .eq('id', sheetId)
            .single();

        if (fetchErr || !data) {
            console.warn('[Supabase] Could not find metadata for sheet', sheetId);
            return;
        }

        const pgTableName = data.pg_table as string;

        // Drop the actual table FIRST so we don't leave orphaned tables if drop fails
        await execSqlStatements([`DROP TABLE IF EXISTS public."${pgTableName}"`]);
        console.log(`[Supabase] Dropped table: ${pgTableName}`);

        // Delete metadata second
        const { error: delErr } = await supabase.from('dms_metadata').delete().eq('id', sheetId);
        if (delErr) throw delErr;
    } catch (e) {
        console.error('[Supabase] syncDeleteTable failed', e);
    }
}

/** Add a column to an existing native Postgres table */
export async function syncAddColumn(sheetId: string, columns: string[], newColName: string): Promise<void> {
    if (!_isConnected) return;
    try {
        const { data, error: fetchErr } = await supabase
            .from('dms_metadata')
            .select('pg_table')
            .eq('id', sheetId)
            .single();

        if (fetchErr || !data) return;
        const pgTableName = data.pg_table as string;

        await execSqlStatements([`ALTER TABLE public."${pgTableName}" ADD COLUMN IF NOT EXISTS "${newColName}" TEXT`]);
        await supabase.from('dms_metadata').update({ columns }).eq('id', sheetId);
    } catch (e) {
        console.error('[Supabase] syncAddColumn failed', e);
    }
}

/** Delete a column from an existing native Postgres table */
export async function syncDeleteColumn(sheetId: string, columns: string[], colNameToDrop: string): Promise<void> {
    if (!_isConnected) return;
    try {
        const { data, error: fetchErr } = await supabase
            .from('dms_metadata')
            .select('pg_table')
            .eq('id', sheetId)
            .single();

        if (fetchErr || !data) return;
        const pgTableName = data.pg_table as string;

        await execSqlStatements([`ALTER TABLE public."${pgTableName}" DROP COLUMN IF EXISTS "${colNameToDrop}"`]);
        await supabase.from('dms_metadata').update({ columns }).eq('id', sheetId);
    } catch (e) {
        console.error('[Supabase] syncDeleteColumn failed', e);
    }
}

/** Rename a column in an existing native Postgres table */
export async function syncRenameColumn(sheetId: string, columns: string[], oldName: string, newName: string): Promise<void> {
    if (!_isConnected) return;
    try {
        const { data, error: fetchErr } = await supabase
            .from('dms_metadata')
            .select('pg_table')
            .eq('id', sheetId)
            .single();

        if (fetchErr || !data) return;
        const pgTableName = data.pg_table as string;

        await execSqlStatements([`ALTER TABLE public."${pgTableName}" RENAME COLUMN "${oldName}" TO "${newName}"`]);
        await supabase.from('dms_metadata').update({ columns }).eq('id', sheetId);
    } catch (e) {
        console.error('[Supabase] syncRenameColumn failed', e);
    }
}

// ── Row CRUD Operations ───────────────────────────────────────────────────────

async function getPgTableForSheet(sheetId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('dms_metadata')
        .select('pg_table')
        .eq('id', sheetId)
        .single();
    if (error || !data) return null;
    return data.pg_table as string;
}

export async function syncUpsertRow(sheetId: string, rowData: any): Promise<void> {
    if (!_isConnected) return;
    try {
        const pgTableName = await getPgTableForSheet(sheetId);
        if (!pgTableName) return;
        const { error } = await supabase.from(pgTableName).upsert(rowData);
        if (error) throw error;
    } catch (e) {
        console.error('[Supabase] syncUpsertRow failed', e);
    }
}

export async function syncDeleteRow(sheetId: string, rowId: string): Promise<void> {
    if (!_isConnected) return;
    try {
        const pgTableName = await getPgTableForSheet(sheetId);
        if (!pgTableName) return;
        const { error } = await supabase.from(pgTableName).delete().eq('id', rowId);
        if (error) throw error;
    } catch (e) {
        console.error('[Supabase] syncDeleteRow failed', e);
    }
}

export async function syncUpdateValue(sheetId: string, rowId: string, columnName: string, newValue: any): Promise<void> {
    if (!_isConnected) return;
    try {
        const pgTableName = await getPgTableForSheet(sheetId);
        if (!pgTableName) return;
        const { error } = await supabase.from(pgTableName).update({ [columnName]: newValue }).eq('id', rowId);
        if (error) throw error;
    } catch (e) {
        console.error('[Supabase] syncUpdateValue failed', e);
    }
}
