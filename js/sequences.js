import { supabase } from './config.js';

export async function siguienteCorrelativo(tipo) {
    const { data, error } = await supabase.rpc('qata_next_sequence', { p_type: String(tipo).toUpperCase() });
    if (error) throw error;
    return String(data || '');
}

export async function cargarCorrelativos() {
    const { data, error } = await supabase
        .from('qata_sequences')
        .select('document_type,prefix,suffix,next_number,padding,updated_at')
        .order('document_type');
    if (error) throw error;
    return data || [];
}

export async function guardarCorrelativo(tipo, { prefix = '', suffix = '', nextNumber = 1, padding = 4 } = {}) {
    const { data, error } = await supabase.rpc('qata_set_sequence', {
        p_type: String(tipo).toUpperCase(),
        p_prefix: String(prefix || ''),
        p_suffix: String(suffix || ''),
        p_next_number: Math.max(1, Number(nextNumber || 1)),
        p_padding: Math.min(12, Math.max(1, Number(padding || 4)))
    });
    if (error) throw error;
    return data;
}

export function vistaPreviaCorrelativo({ prefix = '', suffix = '', next_number = 1, nextNumber, padding = 4 } = {}) {
    const n = Number(nextNumber ?? next_number ?? 1);
    return `${prefix}${String(n).padStart(Number(padding || 4), '0')}${suffix}`;
}
