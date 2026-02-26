-- ============================================================
-- DMS Migration: Update dms_metadata + manage_schema RPC
-- Run this in your Supabase SQL Editor (SQL > New Query)
-- ============================================================

-- 1. Create or update dms_metadata table
CREATE TABLE IF NOT EXISTS public.dms_metadata (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  pg_table TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already existed without pg_table or created_at, add those columns:
ALTER TABLE public.dms_metadata ADD COLUMN IF NOT EXISTS pg_table TEXT;
ALTER TABLE public.dms_metadata ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill pg_table for old rows (set to the old ID-based name format)
UPDATE public.dms_metadata
SET pg_table = REPLACE(id, '-', '_')
WHERE pg_table IS NULL;

-- Make pg_table NOT NULL after backfill
ALTER TABLE public.dms_metadata ALTER COLUMN pg_table SET NOT NULL;

-- 2. Enable Row Level Security on dms_metadata
ALTER TABLE public.dms_metadata ENABLE ROW LEVEL SECURITY;

-- 3. Allow full access (no auth required; adjust if you add auth later)
DROP POLICY IF EXISTS "Allow all" ON public.dms_metadata;
CREATE POLICY "Allow all" ON public.dms_metadata
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Create the manage_schema RPC function (needed for DDL operations)
-- This runs as SECURITY DEFINER so it can execute DDL
CREATE OR REPLACE FUNCTION public.manage_schema(sql_query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Grant execute permission to anonymous users (for the app)
GRANT EXECUTE ON FUNCTION public.manage_schema(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.manage_schema(TEXT) TO authenticated;
