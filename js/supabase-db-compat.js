import { supabase } from './config.js';

const TABLE = 'qata_documents';

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getPath(obj, path) {
    return String(path || '').split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function normalizeTime(v) {
    if (v == null) return v;
    if (typeof v === 'number') return v;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? String(v) : t;
}

function makeDocSnap(row, fallbackId = '') {
    const exists = !!row;
    return {
        id: row?.id || fallbackId,
        exists: () => exists,
        data: () => exists ? clone(row.data || {}) : undefined
    };
}

function makeQuerySnap(rows = []) {
    const docs = rows.map(r => makeDocSnap(r));
    return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach(fn) { docs.forEach(fn); }
    };
}

function applyConstraints(rows, constraints = []) {
    let out = [...rows];
    for (const c of constraints) {
        if (c.type === 'where') {
            out = out.filter(row => {
                const actual = getPath(row.data, c.field);
                switch (c.op) {
                    case '==': return actual === c.value;
                    case '!=': return actual !== c.value;
                    case '>=': return actual >= c.value;
                    case '<=': return actual <= c.value;
                    case '>': return actual > c.value;
                    case '<': return actual < c.value;
                    case 'array-contains': return Array.isArray(actual) && actual.includes(c.value);
                    default: return true;
                }
            });
        }
    }
    const orders = constraints.filter(c => c.type === 'orderBy');
    if (orders.length) {
        out.sort((a, b) => {
            for (const o of orders) {
                let av = normalizeTime(getPath(a.data, o.field));
                let bv = normalizeTime(getPath(b.data, o.field));
                if (av == null) av = '';
                if (bv == null) bv = '';
                if (av < bv) return o.direction === 'desc' ? 1 : -1;
                if (av > bv) return o.direction === 'desc' ? -1 : 1;
            }
            return 0;
        });
    }
    return out;
}

async function fetchCollection(bucket) {
    const { data, error } = await supabase
        .from(TABLE)
        .select('bucket,id,data,created_at,updated_at')
        .eq('bucket', bucket);
    if (error) throw error;
    return data || [];
}

export function collection(_db, bucket) {
    return { kind: 'collection', bucket };
}

export function doc(_db, bucket, id) {
    return { kind: 'doc', bucket, id: String(id) };
}

export function query(collectionRef, ...constraints) {
    return { kind: 'query', collectionRef, constraints };
}

export function orderBy(field, direction = 'asc') {
    return { type: 'orderBy', field, direction };
}

export function where(field, op, value) {
    return { type: 'where', field, op, value };
}

export async function getDoc(ref) {
    const { data, error } = await supabase
        .from(TABLE)
        .select('bucket,id,data,created_at,updated_at')
        .eq('bucket', ref.bucket)
        .eq('id', ref.id)
        .maybeSingle();
    if (error) throw error;
    return makeDocSnap(data, ref.id);
}

export async function getDocs(ref) {
    const collectionRef = ref.kind === 'query' ? ref.collectionRef : ref;
    const constraints = ref.kind === 'query' ? ref.constraints : [];
    const rows = applyConstraints(await fetchCollection(collectionRef.bucket), constraints);
    return makeQuerySnap(rows);
}

export async function addDoc(collectionRef, payload) {
    const id = crypto.randomUUID();
    const { error } = await supabase.from(TABLE).insert({
        bucket: collectionRef.bucket,
        id,
        data: clone(payload || {})
    });
    if (error) throw error;
    return { id, bucket: collectionRef.bucket };
}

export async function setDoc(ref, payload, options = {}) {
    const incoming = clone(payload || {});
    if (options?.merge) {
        const snap = await getDoc(ref);
        const merged = snap.exists() ? { ...snap.data(), ...incoming } : incoming;
        const { error } = await supabase.from(TABLE).upsert({
            bucket: ref.bucket,
            id: ref.id,
            data: merged,
            updated_at: new Date().toISOString()
        }, { onConflict: 'bucket,id' });
        if (error) throw error;
        return;
    }
    const { error } = await supabase.from(TABLE).upsert({
        bucket: ref.bucket,
        id: ref.id,
        data: incoming,
        updated_at: new Date().toISOString()
    }, { onConflict: 'bucket,id' });
    if (error) throw error;
}

export async function updateDoc(ref, patch) {
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Documento no encontrado: ${ref.bucket}/${ref.id}`);
    const next = { ...snap.data(), ...clone(patch || {}) };
    const { error } = await supabase.from(TABLE)
        .update({ data: next, updated_at: new Date().toISOString() })
        .eq('bucket', ref.bucket)
        .eq('id', ref.id);
    if (error) throw error;
}

export async function deleteDoc(ref) {
    const { error } = await supabase.from(TABLE)
        .delete()
        .eq('bucket', ref.bucket)
        .eq('id', ref.id);
    if (error) throw error;
}

export function serverTimestamp() {
    return new Date().toISOString();
}

// Compatibilidad de lectura en tiempo casi real sin requerir configurar Realtime.
export function onSnapshot(ref, callback, onError = console.error) {
    let stopped = false;
    let previous = '';

    const refresh = async () => {
        if (stopped) return;
        try {
            const snap = await getDocs(ref);
            const signature = JSON.stringify(snap.docs.map(d => [d.id, d.data()]));
            if (signature !== previous) {
                previous = signature;
                callback(snap);
            }
        } catch (error) {
            onError?.(error);
        }
    };

    refresh();
    const timer = setInterval(refresh, 2500);
    return () => { stopped = true; clearInterval(timer); };
}

// Se conserva el nombre exportado para que un import antiguo falle de forma explícita.
export async function runTransaction() {
    throw new Error('runTransaction fue reemplazado por correlativos atómicos de Supabase (RPC).');
}
