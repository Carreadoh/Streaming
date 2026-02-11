import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Asegúrate de tener el CSS en index.html: <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />

const VideoPlayer = ({ src, subtitleSrc }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Configuración base de Plyr
    const defaultOptions = {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'mute', 'volume', 'captions', 'settings', 'fullscreen'
      ],
      settings: ['captions', 'audio', 'quality', 'speed'], // Orden del menú
      i18n: {
        restart: 'Reiniciar',
        play: 'Reproducir',
        pause: 'Pausar',
        settings: 'Configuración',
        audio: 'Idioma',
        captions: 'Subtítulos',
        quality: 'Calidad',
        speed: 'Velocidad',
        disabled: 'Desactivado',
        enabled: 'Activado',
      },
      captions: { active: true, update: true, language: 'es' }, // Subtítulos activos por defecto si existen
      autoplay: true,
    };

    // --- Función para inyectar pistas a Plyr ---
    const updatePlyrState = (hls, player) => {
      // 1. Preparamos los audios detectados por HLS
      const audioTracks = hls.audioTracks.map((track, index) => ({
        label: track.name || `Audio ${index + 1}`,
        language: track.lang || `lang-${index}`,
        active: track.default || index === hls.audioTrack, // Marca el activo
      }));

      // 2. Preparamos los subtítulos (Si pasaste un .vtt externo)
      const tracks = [];
      
      // Si tenemos audios, los agregamos como "tracks" personalizados para que Plyr genere el menú
      // Plyr usa un formato específico en su objeto 'source' para generar menús
      
      // NOTA: Para cambiar el source sin reiniciar el video, usamos un objeto source nuevo
      // preservando el tiempo actual si es posible, pero Plyr v3 suele reiniciar al cambiar source.
      // Por eso, lo hacemos SOLO al inicio (MANIFEST_PARSED).
      
      const plyrSource = {
        type: 'video',
        title: 'Pelicula',
        sources: [
          {
            src: src,
            type: 'application/x-mpegURL',
          },
        ],
        // Aquí inyectamos los audios para que aparezca el menú "Idioma"
        // Plyr usa la propiedad 'tracks' generalmente para VTT, pero manipularemos el UI después
        // O usamos el hack de inyección de opciones.
        
        // Si hay subtítulo externo (.vtt), lo agregamos aquí
        tracks: subtitleSrc ? [
          {
            kind: 'captions',
            label: 'Español',
            srclang: 'es',
            src: subtitleSrc,
            default: true,
          }
        ] : [],
      };

      // Asignamos el source
      player.source = plyrSource;

      // 3. HACK CRÍTICO PARA EL AUDIO
      // Plyr no soporta nativamente el cambio de pistas de audio HLS via UI en Chrome.
      // Tenemos que interceptar el evento de Plyr y mandarlo a HLS.
      
      // Sin embargo, la forma más limpia en React es dejar que Plyr renderice y nosotros
      // usamos el API de HLS.js. Como Plyr borra las opciones de audio si no detecta soporte nativo,
      // la única forma de tener el botón es inyectar controles custom o usar un plugin.
      
      // PERO, intentemos exponer las pistas a Plyr mediante un getter falso en el elemento video
      // Esto suele engañar a Plyr para que muestre el botón.
      if (hls.audioTracks.length > 1) {
          const fakeAudioTracks = hls.audioTracks.map((t, i) => ({
              id: i,
              label: t.name,
              language: t.lang,
              enabled: i === hls.audioTrack,
              kind: 'main'
          }));
          
          // Sobreescribimos la propiedad audioTracks del elemento video HTML5
          // para que Plyr crea que el navegador lo soporta
          Object.defineProperty(video, 'audioTracks', {
              get: () => fakeAudioTracks,
              configurable: true
          });
      }
    };

    // --- INICIALIZACIÓN ---
    
    // 1. Iniciamos HLS primero
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("🎬 HLS Cargado. Audios:", hls.audioTracks);

        // 2. Iniciamos Plyr DESPUÉS de cargar HLS
        if (!playerRef.current) {
           playerRef.current = new Plyr(video, defaultOptions);
        }
        const player = playerRef.current;

        // Intentamos configurar el audio trick
        if (hls.audioTracks.length > 1) {
             // Listener para cambio de idioma en Plyr
             // Plyr dispara 'languagechange' cuando cambia subtítulos o audio
             // Necesitamos mapear la UI de Plyr al HLS
             
             // FORZAMOS LA UI:
             // Como Plyr es muy estricto, si no ve pistas nativas, no muestra el botón.
             // La opción más robusta hoy día es crear el botón manualmente o usar el hack de defineProperty arriba.
             updatePlyrState(hls, player);
        }
        
        video.play().catch(() => {});
      });
      
      // Sincronizar cambio de audio (Si logramos que aparezca el botón)
      // Si el usuario cambia el idioma en el menú de Plyr
      // Plyr intentará cambiar 'video.audioTracks[i].enabled = true'
      // Nosotros escuchamos ese cambio? No, Plyr lo hace interno.
      
      // Alternativa: Escuchar evento de Plyr
      if (playerRef.current) {
          playerRef.current.on('languagechange', () => {
              // Este evento es genérico.
              // Lo ideal es verificar qué idioma seleccionó Plyr y actualizar HLS.
              setTimeout(() => {
                  const currentLang = playerRef.current.language; // 'es' o 'en'
                  const trackIndex = hls.audioTracks.findIndex(t => t.lang && t.lang.startsWith(currentLang));
                  if (trackIndex !== -1) {
                      hls.audioTrack = trackIndex;
                      console.log("🔊 Audio cambiado a:", hls.audioTracks[trackIndex].name);
                  }
              }, 100);
          });
      }

    } else {
      // Soporte nativo
      video.src = src;
      playerRef.current = new Plyr(video, defaultOptions);
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [src, subtitleSrc]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        className="plyr-react plyr"
        playsInline
        controls
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default VideoPlayer;