// ================================================================
// MediCare Pro — Configuration
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values
// Supabase → Project Settings → API
// ================================================================
window.APP_CONFIG = {
  SUPABASE_URL:      'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  APP_NAME:          'MediCare Pro',
  APP_VERSION:       '1.0.0',
  DB_NAME:           'medicare_pro_db',
  DB_VERSION:        1,
  SYNC_INTERVAL_MS:  30000,   // sync every 30s when online
  AUDIT_ENABLED:     true,
};
