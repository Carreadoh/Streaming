import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1_Hd2K0xrkDc5ZZht-2WxTVE1hyWu04E",
  authDomain: "cuevanarg.firebaseapp.com",
  projectId: "cuevanarg",
  storageBucket: "cuevanarg.firebasestorage.app",
  messagingSenderId: "149062152720",
  appId: "1:149062152720:web:b25b096345629e7b4e5095"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const borrarColeccion = async (nombre) => {
  console.log(`🗑️ Borrando colección: ${nombre}...`);
  const ref = collection(db, nombre);
  const snapshot = await getDocs(ref);

  let cont = 0;
  for (const d of snapshot.docs) {
    await deleteDoc(doc(db, nombre, d.id));
    cont++;
  }
  console.log(`✅ Eliminados ${cont} documentos de ${nombre}.`);
};

const limpiar = async () => {
  await borrarColeccion("peliculas");
  await borrarColeccion("series");
  console.log("✨ ¡Base de datos LIMPIA! Ahora puedes cargar los datos correctos.");
};

limpiar();