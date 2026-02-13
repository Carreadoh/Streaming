import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const DIRECTORIO_VIDEOS = 'D:/Sistemas/Streaming/peliculas'; 

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const EXTENSIONES = ['.mp4', '.mkv', '.avi', '.mov', '.m3u8'];

// --- SETUP INICIAL ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Delay para evitar ban de API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const limpiarNombre = (nombreArchivo) => {
  let nombre = nombreArchivo.replace(/\.[^/.]+$/, ""); 
  nombre = nombre.replace(/[._]/g, " "); 
  nombre = nombre.replace(/\(\d{4}\)/g, ""); 
  // Limpieza agresiva de tags de torrents
  nombre = nombre.replace(/1080p|720p|4k|x264|x265|bluray|web-dl|hdr|h264|h265|aac|5.1/gi, ""); 
  return nombre.trim();
};

const buscarEnTMDB = async (nombreArchivo) => {
  const query = limpiarNombre(nombreArchivo);
  if (!query) return null;

  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es-MX`;
    const res = await axios.get(url);
    
    if (res.data.results && res.data.results.length > 0) {
      return res.data.results[0]; 
    }
    return null;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log("⚠️ TMDB pide calma (Rate Limit). Esperando 5 seg...");
      await delay(5000);
      return buscarEnTMDB(nombreArchivo); 
    }
    return null;
  }
};

const procesarArchivos = async () => {
  console.log(`📂 Escaneando directorio: ${DIRECTORIO_VIDEOS}`);
  
  try {
    if (!fs.existsSync(DIRECTORIO_VIDEOS)) {
        console.error(`❌ Error FATAL: La carpeta no existe en: ${DIRECTORIO_VIDEOS}`);
        console.error(`   Asegurate de editar la constante DIRECTORIO_VIDEOS en el script.`);
        return;
    }

    const items = await fs.readdir(DIRECTORIO_VIDEOS);

    console.log("--- 🧹 Fase 1: Rescatando archivos de carpetas viejas ---");
    for (const item of items) {
        const rutaCompleta = path.join(DIRECTORIO_VIDEOS, item);
        const stats = await fs.stat(rutaCompleta);

        if (stats.isDirectory()) {
            const contenido = await fs.readdir(rutaCompleta);
            if (contenido.length === 0) {
                await fs.rmdir(rutaCompleta); // Borrar vacía
            } else {
                // Sacar archivos a la raíz
                for (const subItem of contenido) {
                    const rutaSub = path.join(rutaCompleta, subItem);
                    const destinoRaiz = path.join(DIRECTORIO_VIDEOS, subItem);
                    
                    // Si es video, subtitulo o nfo, moverlo
                    if (EXTENSIONES.includes(path.extname(subItem).toLowerCase()) || subItem.endsWith('.srt') || subItem.endsWith('.nfo')) {
                        console.log(`⬆️ Rescatando: ${subItem}`);
                        await fs.move(rutaSub, destinoRaiz, { overwrite: true });
                    }
                }
                // Intentar borrar carpeta (ahora vacía)
                try { await fs.rmdir(rutaCompleta); } catch(e) {} 
            }
        }
    }

    console.log("\n--- 🎬 Fase 2: Organizando Biblioteca ---");
    // Volver a leer el directorio ya "aplanado"
    const archivosRaiz = await fs.readdir(DIRECTORIO_VIDEOS);
    
    for (const archivo of archivosRaiz) {
      const ext = path.extname(archivo).toLowerCase();
      // Ignorar lo que no sea video
      if (!EXTENSIONES.includes(ext)) continue;

      const rutaArchivo = path.join(DIRECTORIO_VIDEOS, archivo);
      
      console.log(`🔍 Procesando: ${archivo}`);
      
      const datosTMDB = await buscarEnTMDB(archivo);
      await delay(300); // Pausa necesaria para la API

      let nombreCarpeta;

      if (datosTMDB) {
        const year = datosTMDB.release_date ? datosTMDB.release_date.split('-')[0] : '????';
        const tituloLimpio = datosTMDB.title.replace(/[<>:"/\\|?*]/g, ''); 
        nombreCarpeta = `${tituloLimpio} (${year})`;
      } else {
        console.warn(`⚠️ No identificado: ${archivo} -> Se mueve a carpeta _MANUAL`);
        nombreCarpeta = `_MANUAL_${path.basename(archivo, ext)}`;
      }

      const rutaCarpetaDestino = path.join(DIRECTORIO_VIDEOS, nombreCarpeta);

      // Crear carpeta destino
      await fs.ensureDir(rutaCarpetaDestino);

      // Mover video
      const rutaDestinoFinal = path.join(rutaCarpetaDestino, archivo);
      
      // Evitar mover sobre sí mismo
      if (rutaArchivo !== rutaDestinoFinal) {
          await fs.move(rutaArchivo, rutaDestinoFinal, { overwrite: true });
          console.log(`✅ Guardado en: ${nombreCarpeta}`);
      }
    }

    console.log("\n✨ ¡Listo! Biblioteca reparada.");

  } catch (error) {
    console.error("Error fatal:", error);
  }
};

procesarArchivos();