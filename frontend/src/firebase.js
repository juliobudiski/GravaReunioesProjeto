import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// As chaves do seu projeto Synapse
const firebaseConfig = {
  apiKey: "AIzaSyCpiMjrEaDTmRuDx4f_ncYkIFTWdYspagA",
  authDomain: "synapse-51ee9.firebaseapp.com",
  projectId: "synapse-51ee9",
  storageBucket: "synapse-51ee9.firebasestorage.app",
  messagingSenderId: "803443670280",
  appId: "1:803443670280:web:e26295aae50a1aa2e3c0bd",
  measurementId: "G-RN11R64EHC"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa a Autenticação
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Função pronta para ser usada no botão de Login
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Erro no login do Google:", error);
    throw error;
  }
};

// Função de Sair
export const logout = async () => {
  await signOut(auth);
};
