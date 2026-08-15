/** Compatibilidad mínima con la API de Auth que usaba el ERP. */
function mapUser(user) {
    if (!user) return null;
    return {
        uid: user.id,
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {}
    };
}

function firebaseLikeError(error) {
    const e = new Error(error?.message || 'Error de autenticación');
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('invalid login') || msg.includes('invalid credentials')) e.code = 'auth/invalid-credential';
    else if (msg.includes('rate limit') || msg.includes('too many')) e.code = 'auth/too-many-requests';
    else e.code = error?.code || 'auth/error';
    e.original = error;
    return e;
}

export async function signInWithEmailAndPassword(auth, email, password) {
    const { data, error } = await auth._client.signInWithPassword({ email, password });
    if (error) throw firebaseLikeError(error);
    auth.currentUser = mapUser(data.user);
    return { user: auth.currentUser };
}

export async function signOut(auth) {
    const { error } = await auth._client.signOut();
    if (error) throw firebaseLikeError(error);
    auth.currentUser = null;
}

export function onAuthStateChanged(auth, callback) {
    let active = true;
    let lastKey = Symbol('initial');

    const emit = (user) => {
        if (!active) return;
        const mapped = mapUser(user || null);
        const key = mapped?.uid || null;
        if (key === lastKey) return;
        lastKey = key;
        auth.currentUser = mapped;
        callback(mapped);
    };

    auth._client.getSession().then(({ data, error }) => {
        if (error) console.warn('No se pudo recuperar la sesión:', error);
        emit(data?.session?.user || null);
    });

    const { data: listener } = auth._client.onAuthStateChange((_event, session) => {
        emit(session?.user || null);
    });

    return () => {
        active = false;
        listener?.subscription?.unsubscribe?.();
    };
}
