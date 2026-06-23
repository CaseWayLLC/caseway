import { createClient } from "@supabase/supabase-js";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment",
  );
}

// Browser auth client. The anon key is safe to expose; it grants nothing on its
// own (data tables are RLS deny-by-default and all DB/storage access is
// server-mediated). Verification is done by entering an email code (OTP), so we
// don't parse tokens out of the URL.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// The generated API client attaches `Authorization: Bearer <token>` to every
// request when a token getter is registered (and skips it when none is
// available). getSession() returns the current, auto-refreshed access token
// from local storage, so protected API routes see the JWT and public reads
// simply send no auth header. Registered once at module load.
setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});
