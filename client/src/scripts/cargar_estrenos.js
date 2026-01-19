import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import axios from 'axios';

// --- TUS CREDENCIALES ---
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

// Mapa de géneros para convertir IDs numéricos a texto
const obtenerGenerosTexto = async () => {
  const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=es-MX`;
  const res = await axios.get(url);
  const mapa = {};
  res.data.genres.forEach(g => mapa[g.id] = g.name);
  return mapa;
};

const cargarEstrenosCine = async () => {
  console.log("🍿 Buscando películas actualmente en Cines...");

  const mapaGeneros = await obtenerGenerosTexto();

  // Pedimos la cartelera actual (Now Playing)
  // region=MX ayuda a obtener fechas de estreno latinas precisas
  const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=es-MX&page=1&region=MX`;
  
  try {
    const res = await axios.get(url);
    const peliculas = res.data.results;

    console.log(`🎬 Se encontraron ${peliculas.length} estrenos en cartelera.\n`);

    for (const peli of peliculas) {
      if (!peli.poster_path || !peli.overview) continue;

      // Convertir géneros
      const generosReales = peli.genre_ids.map(id => mapaGeneros[id]).filter(Boolean);
      
      // TRUCO: A los estrenos les vamos a agregar la categoría "Estrenos" 
      // para que aparezcan en una fila especial si quieres.
      if (!generosReales.includes("Estrenos")) generosReales.unshift("Estrenos");

      const nuevoDoc = {
        id_tmdb: peli.id,
        titulo: peli.title,
        descripcion: peli.overview,
        imagen_poster: `https://image.tmdb.org/t/p/w500${peli.poster_path}`,
        imagen_fondo: `https://image.tmdb.org/t/p/original${peli.backdrop_path}`,
        fecha_estreno: peli.release_date,
        rating: peli.vote_average,
        tipo: 'movie',
        plataforma_origen: "Cine", // Para que se sepa que es de cine
        generos: generosReales
      };

      // Guardamos en la colección "peliculas"
      await setDoc(doc(db, "peliculas", `peli_${peli.id}`), nuevoDoc);
      console.log(`✅ Agregada cartelera: ${peli.title}`);
    }

  } catch (error) {
    console.error("Error cargando estrenos:", error);
  }

  console.log("\n✨ ¡Cartelera actualizada!");
};

cargarEstrenosCine();