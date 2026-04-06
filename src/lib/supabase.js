import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Create a .env file from .env.example and fill in your project credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    heartbeatIntervalMs: 15000,       // detect dead sockets faster (default 30s)
    reconnectAfterMs: (tries) =>      // aggressive reconnect: 200ms → 1s → 2s → 5s cap
      Math.min(200 * Math.pow(2, tries), 5000),
  },
})
