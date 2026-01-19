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

const PROVEEDORES = [
  { id: 8, nombre: 'Netflix' },
  { id: 337, nombre: 'Disney' },
  { id: 119, nombre: 'Amazon' },
  { id: 350, nombre: 'Apple' },
  { id: 384, nombre: 'HBO' },
  { id: 531, nombre: 'Paramount' },
  { id: 283, nombre: 'Crunchyroll' }
];

// ESTRATEGIA HÍBRIDA:
// 3 páginas de "Lo Nuevo" + 3 páginas de "Los Clásicos/Famosos"
// Total = 120 títulos POR PLATAFORMA (aprox 840 en total)
const PAGINAS_POR_ESTRATEGIA = 3; 

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const obtenerGeneros = async (tipo) => {
  const url = `https://api.themoviedb.org/3/genre/${tipo}/list?api_key=${TMDB_API_KEY}&language=es-MX`;
  const res = await axios.get(url);
  const mapa = {};
  res.data.genres.forEach(g => mapa[g.id] = g.name);
  return mapa;
};

const cargarContenidoInteligente = async () => {
  console.log("🚀 INICIANDO CARGA 'ALL-STARS' (Nuevas + Famosas)...");

  const genPelis = await obtenerGeneros('movie');
  const genSeries = await obtenerGeneros('tv');

  for (const prov of PROVEEDORES) {
    console.log(`\n========================================`);
    console.log(`📥 PROCESANDO: ${prov.nombre}`);
    console.log(`========================================`);

    // Definimos las dos estrategias de ordenamiento
    const estrategias = [
      { nombre: "Tendencia", sort: "popularity.desc" },
      { nombre: "Famosas Historicas", sort: "vote_count.desc" } // <--- ESTO TRAE "THE RAIN", "DARK", ETC.
    ];

    for (const est of estrategias) {
      console.log(`   👉 Estrategia: ${est.nombre}`);

      // --- PELÍCULAS ---
      for (let page = 1; page <= PAGINAS_POR_ESTRATEGIA; page++) {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=es-MX&sort_by=${est.sort}&watch_region=AR&with_watch_providers=${prov.id}&page=${page}`;
        try {
          const res = await axios.get(url);
          for (const p of res.data.results) {
            if (!p.poster_path) continue;
            await setDoc(doc(db, "peliculas", `p_${p.id}`), {
              id_tmdb: p.id,
              titulo: p.title,
              descripcion: p.overview,
              imagen_poster: `https://image.tmdb.org/t/p/w500${p.poster_path}`,
              imagen_fondo: `https://image.tmdb.org/t/p/original${p.backdrop_path}`,
              fecha_estreno: p.release_date,
              tipo: 'movie',
              plataforma_origen: prov.nombre,
              generos: p.genre_ids.map(id => genPelis[id]).filter(Boolean)
            });
          }
        } catch (e) {}
        await esperar(100);
      }

      // --- SERIES ---
      for (let page = 1; page <= PAGINAS_POR_ESTRATEGIA; page++) {
        const url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&sort_by=${est.sort}&watch_region=AR&with_watch_providers=${prov.id}&page=${page}`;
        try {
          const res = await axios.get(url);
          for (const s of res.data.results) {
            if (!s.poster_path) continue;
            await setDoc(doc(db, "series", `s_${s.id}`), {
              id_tmdb: s.id,
              titulo: s.name,
              descripcion: s.overview,
              imagen_poster: `https://image.tmdb.org/t/p/w500${s.poster_path}`,
              imagen_fondo: `https://image.tmdb.org/t/p/original${s.backdrop_path}`,
              fecha_estreno: s.first_air_date,
              tipo: 'serie',
              plataforma_origen: prov.nombre,
              generos: s.genre_ids.map(id => genSeries[id]).filter(Boolean)
            });
          }
        } catch (e) {}
        await esperar(100);
      }
    }
  }

  console.log("\n✨ ¡CARGA COMPLETA! Ahora tienes tendencias y clásicos.");
};

cargarContenidoInteligente();