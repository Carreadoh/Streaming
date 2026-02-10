import { db } from '../firebase.js'; 
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import Client from 'ssh2-sftp-client';

const config = {
    host: '65.109.146.153',
    port: '22',
    username: 'root',
    password: 'Fm5Lcj%Va%kJwr' // Pon tu contraseña real aquí
};

const RUTA_REMOTA_PELICULAS = '/home/peliculas'; 

const sftp = new Client();

// Función de normalización "Técnica": quita basura y separa por palabras reales
const normalizar = (texto) => {
  if (!texto) return '';
  return texto.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita acentos
    .replace(/[^a-z0-9]/g, ' ') // Reemplaza todo lo raro por espacios
    .split(/\s+/) // Divide por espacios
    .filter(p => p.length > 0) // Quita huecos vacíos
    .join(' ')
    .trim();
};

const main = async () => {
    try {
        console.log("⏳ Descargando catálogo de Firebase...");
        const snapshot = await getDocs(collection(db, "peliculas"));
        const pelisDB = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log(`🔌 Conectando al servidor SFTP (IP: ${config.host})...`);
        await sftp.connect(config);
        
        console.log("📡 Listando archivos en el servidor...");
        const archivos = await sftp.list(RUTA_REMOTA_PELICULAS);
        
        let encontrados = 0;
        let errores = 0;
        let noEncontrados = [];

        for (const f of archivos) {
            // Solo procesar archivos de video
            if (f.type === 'd' || !f.name.match(/\.(mp4|mkv|avi|ts)$/i)) continue;

            // Limpiamos el nombre del archivo (quitamos extensión y normalizamos)
            const nombreBaseArchivo = f.name.replace(/\.[^/.]+$/, ""); 
            const archivoLimpio = normalizar(nombreBaseArchivo);
            
            // Lógica de coincidencia Inteligente
            const match = pelisDB.find(p => {
                const tituloBD = normalizar(p.titulo);
                
                // REGLA 1: Coincidencia exacta (La mejor)
                if (archivoLimpio === tituloBD) return true;

                // REGLA 2: Para títulos cortos (ej: "X"), solo aceptamos coincidencia exacta
                if (tituloBD.length < 3) return archivoLimpio === tituloBD;

                // REGLA 3: Si el archivo empieza con el título seguido de un espacio
                // (Evita que "X" coincida con "Oxford")
                if (archivoLimpio.startsWith(tituloBD + ' ')) return true;

                return false;
            });

            if (match) {
                console.log(`✅ VINCULADO: "${match.titulo}" <-> ${f.name}`);
                await updateDoc(doc(db, "peliculas", match.id), {
                    url_video: f.name,
                    disponible_servidor: true,
                    formato: f.name.split('.').pop() // Guardamos si es mp4 o mkv
                });
                encontrados++;
            } else {
                noEncontrados.push(f.name);
            }
        }

        await sftp.end();
        
        console.log("\n" + "=".repeat(50));
        console.log(`📊 RESUMEN DE SINCRONIZACIÓN`);
        console.log(`- Archivos en servidor: ${archivos.length}`);
        console.log(`- Vinculados con éxito: ${encontrados}`);
        console.log(`- Sin coincidencia:     ${noEncontrados.length}`);
        console.log("=".repeat(50));
        
        if (noEncontrados.length > 0) {
            console.log("\n⚠️ LOS SIGUIENTES ARCHIVOS NO ESTÁN EN TU WEB:");
            console.log("(Añade estas películas a Firebase para que se vinculen)");
            noEncontrados.forEach(n => console.log(`   ❌ ${n}`));
        }

    } catch (err) {
        console.error("❌ ERROR CRÍTICO:", err.message);
    }
};

main();