import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import axios from 'axios';

// --- TUS CREDENCIALES DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA1_Hd2K0xrkDc5ZZht-2WxTVE1hyWu04E",
  authDomain: "cuevanarg.firebaseapp.com",
  projectId: "cuevanarg",
  storageBucket: "cuevanarg.firebasestorage.app",
  messagingSenderId: "149062152720",
  appId: "1:149062152720:web:b25b096345629e7b4e5095"
};

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const actualizarColeccion = async (nombreColeccion, tipoTMDB) => {
  console.log(`\n🔄 Iniciando actualización de: ${nombreColeccion.toUpperCase()}...`);
  const ref = collection(db, nombreColeccion);
  const snapshot = await getDocs(ref);

  if (snapshot.empty) {
    console.log("No hay documentos en esta colección.");
    return;
  }

  let actualizados = 0;

  for (const documento of snapshot.docs) {
    const data = documento.data();
    const idTmdb = data.id_tmdb;
    
    if (!idTmdb) continue;

    try {
      const url = `https://api.themoviedb.org/3/${tipoTMDB}/${idTmdb}?api_key=${TMDB_API_KEY}&language=es-MX`;
      const res = await axios.get(url);
      
      const generosReales = res.data.genres.map(g => g.name);

      const docRef = doc(db, nombreColeccion, documento.id);
      await updateDoc(docRef, {
        generos: generosReales
      });

      console.log(`✅ ${data.titulo}: [${generosReales.join(", ")}]`);
      actualizados++;

    } catch (error) {
      console.error(`❌ Error con ${data.titulo}:`, error.message);
    }
    
    await new Promise(r => setTimeout(r, 200)); 
  }

  console.log(`✨ Terminada colección ${nombreColeccion}: ${actualizados} actualizados.`);
};

const correr = async () => {
  await actualizarColeccion("peliculas", "movie");
  await actualizarColeccion("series", "tv");
  console.log("\n🚀 ¡TODO LISTO! Base de datos actualizada con géneros reales.");
  process.exit();
};

correr();