import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase는 환경변수가 있을 때만 활성화. 없으면 정적 JSON 폴백(현 프로토타입).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const hasSupabase = !!supabase;
