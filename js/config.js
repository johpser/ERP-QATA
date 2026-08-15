import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/**
 * QATA ERP — conexión Supabase
 *
 * Para vincular un proyecto Supabase nuevo solo debes pegar 2 valores:
 *   1) SUPABASE_URL
 *   2) SUPABASE_PUBLISHABLE_KEY (o la anon key legacy)
 *
 * NUNCA pongas aquí una Secret Key / service_role.
 */
const SUPABASE_URL = "https://szxygzpdbfxivaauvwvl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PmN7yMwYDWd8bDm6-YD47w_p04Slutq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Objetos de compatibilidad para conservar el resto del ERP sin reescribir su lógica.
export const db = supabase;
export const auth = {
    _client: supabase.auth,
    currentUser: null
};

export function supabaseConfigurado() {
    return !SUPABASE_URL.includes('PEGA_AQUI') && !SUPABASE_PUBLISHABLE_KEY.includes('PEGA_AQUI');
}
