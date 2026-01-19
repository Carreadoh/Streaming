import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// PEGA AQUÍ LA MISMA CONFIGURACIÓN QUE USASTE EN EL SCRIPT
const firebaseConfig = {
  apiKey: "AIzaSyA1_Hd2K0xrkDc5ZZht-2WxTVE1hyWu04E",
  authDomain: "cuevanarg.firebaseapp.com",
  projectId: "cuevanarg",
  storageBucket: "cuevanarg.firebasestorage.app",
  messagingSenderId: "149062152720",
  appId: "1:149062152720:web:b25b096345629e7b4e5095"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);