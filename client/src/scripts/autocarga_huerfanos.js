import { db } from '../firebase.js';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import axios from 'axios';

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';

// PEGA AQUÍ TU LISTA DE ARCHIVOS (Solo el nombre con extensión)
const ARCHIVOS_HUERFANOS = [
    "Nonnas.mp4", "96 minutos.mp4", "Aires de esperanza.mp4", "Samurái X_ El origen.mp4",
    "Las torres gemelas.mp4", "Escuadrón 6.mp4", "¡Qué duro es el amor!.mp4", "Caramelo.mp4",
    "Amor a primera visa.mp4", "50_50.mp4", "El Día Del Fin Del Mundo Migración (2026) Latino.mkv",
    "007_ El satánico Dr. No.mp4", "Imperdonable.mp4", "Duro de cuidar 2.mp4", "Mi año en Oxford.mp4",
    "Rascacielos en vivo.mp4", "Novocaine_ Sin dolor.mp4", "Corazones malheridos.mp4", "5 sangres.mp4",
    "De tal padre.mp4", "007_ Solo se vive dos veces.mp4", "Sobreviviendo el camino a casa.mp4",
    "Susurros mortales 3.mp4", "007_ Sin tiempo para morir.mp4", "Proyecto Extracción.mp4",
    "No me olvides.mp4", "Avengers_ Era de Ultrón de Marvel Studios.mp4", "Un golpe con estilo.mp4",
    "Susurros mortales 2.mp4", "El secuestro de 1993.mp4", "Pequeñas Grandes Amigas.mp4",
    "Hombres de honor.mp4", "Samurái X_ El fin.mp4", "Sweet Girl.mp4", "Bright.mp4",
    "Castillo de arena.mp4", "Viaje 2_ La isla misteriosa.mp4", "The Avengers_ Los Vengadores de Marvel Studios.mp4",
    "Susurros mortales.mp4", "007_ Desde Rusia con amor.mp4", "007_ Operación Trueno.mp4",
    "Max.mp4", "Venganza implacable.mp4", "El smoking.mp4",
    "Capitán América y el Soldado del Invierno de Marvel Studios.mp4", "Dragones del aire.mp4",
    "La trampa.mp4", "El estornino.mp4", "007 contra Goldfinger.mp4", "Juego de honor.mp4",
    "Y nadie más que tú.mp4", "Escolta.mp4", "Jadotville.mp4", "Operación hermanos.mp4",
    "Miss Simpatía.mp4", "Fuerza Trueno.mp4", "El camino largo.mp4", "En tierra de santos y pecadores.mp4",
    "Beirut.mp4", "Focus_ Maestros de la estafa.mp4", "Misión monedas.mp4", "Rescate imposible.mp4",
    "Más dura será la caída.mp4", "Dos locas en fuga.mp4", "Taxi.mp4", "Ant-Man & Wasp de Marvel Studios.mp4"
];

const limpiarNombreParaBusqueda = (nombre) => {
    return nombre.replace(/\.[^/.]+$/, "") // Quita extensión
        .replace(/_|-/g, ' ') // Cambia guiones por espacios
        .replace(/Marvel Studios|Latino|2025|2026/gi, '') // Quita etiquetas comunes
        .trim();
};

const cargarPelis = async () => {
    console.log(`🚀 Iniciando carga masiva de ${ARCHIVOS_HUERFANOS.length} películas...`);

    for (const archivo of ARCHIVOS_HUERFANOS) {
        const queryBusqueda = limpiarNombreParaBusqueda(archivo);
        
        try {
            // 1. Buscar en TMDB
            const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
                params: { api_key: TMDB_API_KEY, language: 'es-MX', query: queryBusqueda }
            });

            if (searchRes.data.results.length === 0) {
                console.log(`❌ No se encontró info para: ${queryBusqueda}`);
                continue;
            }

            const peliInfo = searchRes.data.results[0];

            // 2. Verificar si ya existe en Firebase (para no duplicar)
            const q = query(collection(db, "peliculas"), where("id_tmdb", "==", peliInfo.id.toString()));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
                console.log(`🟡 Ya existe en la web: ${peliInfo.title}`);
                continue;
            }

            // 3. Crear el objeto para Firebase
            const nuevaPeli = {
                id_tmdb: peliInfo.id.toString(),
                titulo: peliInfo.title,
                descripcion: peliInfo.overview,
                imagen_poster: `https://image.tmdb.org/t/p/w500${peliInfo.poster_path}`,
                imagen_fondo: `https://image.tmdb.org/t/p/original${peliInfo.backdrop_path}`,
                fecha_estreno: peliInfo.release_date,
                votos: peliInfo.vote_average,
                tipo: 'movie',
                plataforma_origen: 'Cine', // Por defecto
                url_video: archivo, // VÍNCULO DIRECTO AL ARCHIVO
                disponible_servidor: true
            };

            await addDoc(collection(db, "peliculas"), nuevaPeli);
            console.log(`✅ CARGADA: ${peliInfo.title}`);

        } catch (error) {
            console.error(`Error procesando ${archivo}:`, error.message);
        }
    }
    console.log("🏁 Proceso finalizado.");
};

cargarPelis();