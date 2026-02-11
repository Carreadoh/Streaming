const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// --- CONFIGURACIÓN ---
const DIRECTORIO_VIDEOS = './peliculas'; // CAMBIA ESTO a la ruta de tus videos (ej: 'D:/Peliculas')
const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const EXTENSIONES = ['.mp4', '.mkv', '.avi', '.m3u8', '.mov'];

// Delay para evitar ban de API (500ms entre archivos)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const limpiarNombre = (nombreArchivo) => {
  // Quita extension, puntos, guiones bajos y años entre parentesis para buscar limpio
  let nombre = nombreArchivo.replace(/\.[^/.]+$/, ""); // Quitar extensión
  nombre = nombre.replace(/[._]/g, " "); // Puntos y guiones a espacios
  nombre = nombre.replace(/\(\d{4}\)/g, ""); // Quitar años (2024)
  return nombre.trim();
};

const buscarEnTMDB = async (nombreArchivo) => {
  const query = limpiarNombre(nombreArchivo);
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es-MX`;
    const res = await axios.get(url);
    
    if (res.data.results && res.data.results.length > 0) {
      // Devolvemos la mejor coincidencia
      return res.data.results[0]; 
    }
    return null;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.error("⚠️ RATE LIMIT: TMDB nos pausó. Esperando 5 segundos...");
      await delay(5000);
      return buscarEnTMDB(nombreArchivo); // Reintentar
    }
    console.error(`❌ Error buscando "${query}":`, error.message);
    return null;
  }
};

const procesarArchivos = async () => {
  console.log(`📂 Escaneando directorio: ${DIRECTORIO_VIDEOS}`);
  
  try {
    const items = await fs.readdir(DIRECTORIO_VIDEOS);

    // 1. PRIMERO: SACAR ARCHIVOS DE CARPETAS VACÍAS O MAL NOMBRADAS (APLANAR)
    // Esto arregla el problema de las "carpetas vacías" o mal generadas
    console.log("--- 🧹 Fase 1: Rescatando archivos perdidos ---");
    for (const item of items) {
        const rutaCompleta = path.join(DIRECTORIO_VIDEOS, item);
        const stats = await fs.stat(rutaCompleta);

        if (stats.isDirectory()) {
            const contenidoCarpeta = await fs.readdir(rutaCompleta);
            if (contenidoCarpeta.length === 0) {
                console.log(`🗑️ Borrando carpeta vacía: ${item}`);
                await fs.rmdir(rutaCompleta);
            } else {
                // Si hay archivos adentro, sácalos a la raíz para reprocesarlos bien
                for (const subItem of contenidoCarpeta) {
                    const rutaSub = path.join(rutaCompleta, subItem);
                    const destinoRaiz = path.join(DIRECTORIO_VIDEOS, subItem);
                    if (EXTENSIONES.includes(path.extname(subItem).toLowerCase())) {
                        console.log(`⬆️ Sacando archivo: ${subItem}`);
                        await fs.move(rutaSub, destinoRaiz, { overwrite: true });
                    }
                }
                // Intentar borrar carpeta (si quedó vacía)
                try { await fs.rmdir(rutaCompleta); } catch(e) {} 
            }
        }
    }

    // 2. SEGUNDO: PROCESAR TODO BIEN
    console.log("\n--- 🎬 Fase 2: Organizando Biblioteca (Modo Lento y Seguro) ---");
    const archivosRaiz = await fs.readdir(DIRECTORIO_VIDEOS);
    
    for (const archivo of archivosRaiz) {
      const ext = path.extname(archivo).toLowerCase();
      if (!EXTENSIONES.includes(ext)) continue;

      const rutaArchivo = path.join(DIRECTORIO_VIDEOS, archivo);
      
      console.log(`🔍 Buscando datos para: ${archivo}`);
      
      const datosTMDB = await buscarEnTMDB(archivo);
      await delay(300); // Pausa vital para que TMDB no falle

      let nombreCarpeta;

      if (datosTMDB) {
        // FORMATO ESTÁNDAR: "Título (Año)"
        const year = datosTMDB.release_date ? datosTMDB.release_date.split('-')[0] : '????';
        // Limpiamos caracteres ilegales para carpetas de Windows/Linux (: / \ etc)
        const tituloSanitized = datosTMDB.title.replace(/[<>:"/\\|?*]/g, '');
        nombreCarpeta = `${tituloSanitized} (${year})`;
      } else {
        console.warn(`⚠️ No encontrado en TMDB: ${archivo}. Usando nombre original.`);
        nombreCarpeta = `_DESCONOCIDO_${path.basename(archivo, ext)}`;
      }

      const rutaCarpetaDestino = path.join(DIRECTORIO_VIDEOS, nombreCarpeta);

      // Crear carpeta
      await fs.ensureDir(rutaCarpetaDestino);

      // Mover archivo y renombrar al estandar "Titulo.ext" o dejar nombre original
      const rutaDestinoFinal = path.join(rutaCarpetaDestino, archivo); // Mantenemos nombre archivo, movemos a carpeta
      
      try {
          await fs.move(rutaArchivo, rutaDestinoFinal, { overwrite: true });
          console.log(`✅ Movido: ${nombreCarpeta}`);
      } catch (err) {
          console.error(`🔥 Error moviendo ${archivo}: ${err.message}`);
      }
    }

    console.log("\n✨ ¡Proceso terminado! Revisá la carpeta.");

  } catch (error) {
    console.error("Error fatal:", error);
  }
};

procesarArchivos();