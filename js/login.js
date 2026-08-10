// Agregamos 'db' a la importación
import { auth, db } from '../js/config.js'; 
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Importamos las funciones necesarias de Firestore
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const btnIngresar = document.getElementById('btnIngresar');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        
        if (!email || !password) return;

        // Bloquear botón para evitar múltiples clics
        btnIngresar.disabled = true;
        btnIngresar.innerText = "VERIFICANDO...";
        if (errorMessage) errorMessage.style.display = 'none';

        try {
            // 1. Autenticación de credenciales
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Consulta de Rol en Firestore (Colección 'usuarios', Documento ID = UID)
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const rol = docSnap.data().rol;

                // 3. Redirección lógica según el rol encontrado
                if (rol === 'admin') {
                    window.location.href = 'page/menu.html';
                } else if (rol === 'editor') {
                    window.location.href = 'page/menu2.html';
                } else {
                    // Si el usuario existe pero no tiene un rol válido asignado
                    throw { code: 'auth/no-role' };
                }
            } else {
                // Si el usuario no existe en la colección de Firestore
                throw { code: 'auth/user-not-found-in-db' };
            }

        } catch (error) {
            btnIngresar.disabled = false;
            btnIngresar.innerText = "ENTRAR AL SISTEMA";
            
            if (errorMessage) {
                errorMessage.style.display = 'block';
                
                // Mantenemos tus validaciones y agregamos las nuevas para roles
                if (error.code === 'auth/invalid-credential') {
                    errorMessage.innerText = "Correo o contraseña incorrectos.";
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage.innerText = "Demasiados intentos. Intente más tarde.";
                } else if (error.code === 'auth/no-role') {
                    errorMessage.innerText = "El usuario no tiene un rol asignado.";
                } else if (error.code === 'auth/user-not-found-in-db') {
                    errorMessage.innerText = "Usuario no registrado en la base de datos.";
                } else {
                    errorMessage.innerText = "Error al intentar ingresar.";
                    console.error("Error completo:", error);
                }
            }
        }
    });
}