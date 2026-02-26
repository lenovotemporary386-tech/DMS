import { createClient } from '@supabase/supabase-js';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY in .env');
}

// ── Use Vite/Vercel proxy to bypass DNS issues ─────────────────────────────────────
// Instead of the user's browser trying to resolve the Supabase domain (which fails 
// on many ISPs due to stale DNS caching or blocking), we proxy requests through our 
// own domain. Vite handles this locally, and vercel.json handles it in production.
const supabaseUrl = window.location.origin + '/supabase-api';

console.log(`[Supabase] Mode: PROXIED via ${supabaseUrl}`);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: { eventsPerSecond: 10 },
    },
});

// ── Table helpers ──────────────────────────────────────────────────────────────

/** Fetch all rows from a named table */
export async function fetchTable(tableName: string) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    return data ?? [];
}

/** Insert a single row into a table */
export async function insertRow(tableName: string, row: Record<string, unknown>) {
    const { error } = await supabase.from(tableName).insert(row);
    if (error) throw error;
}

/** Update rows matching a filter */
export async function updateRow(
    tableName: string,
    matchCol: string,
    matchVal: unknown,
    updates: Record<string, unknown>
) {
    const { error } = await supabase.from(tableName).update(updates).eq(matchCol, matchVal);
    if (error) throw error;
}

/** Delete rows matching a filter */
export async function deleteRow(
    tableName: string,
    matchCol: string,
    matchVal: unknown
) {
    const { error } = await supabase.from(tableName).delete().eq(matchCol, matchVal);
    if (error) throw error;
}
