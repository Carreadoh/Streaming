import { db } from '../firebase.js'; 
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const limpiar = async () => {
    console.log("🧹 Limpiando visibilidad de todo el catálogo...");
    const snapshot = await getDocs(collection(db, "peliculas"));
    
    let contador = 0;
    for (const d of snapshot.docs) {
        // Ponemos todo en false por defecto
        await updateDoc(doc(db, "peliculas", d.id), {
            disponible_servidor: false
        });
        contador++;
    }
    console.log(`✅ Se resetearon ${contador} películas. Ahora corre el sincronizador.`);
};

limpiar();