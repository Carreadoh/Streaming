import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Asegúrate de que el CSS de Plyr esté en tu index.html

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // --- 1. CONFIGURACIÓN VISUAL (ROJO NETFLIX + OPCIONES) ---
    const plyrOptions = {
      // Definimos los controles que queremos ver
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      // AQUÍ ESTÁ LA CLAVE: Orden del menú
      settings: ['captions', 'audio', 'quality', 'speed'], 
      i18n: {
        restart: 'Reiniciar', play: 'Reproducir', pause: 'Pausar', 
        settings: 'Ajustes', audio: 'Audio', captions: 'Subtítulos',
        quality: 'Calidad', speed: 'Velocidad', normal: 'Normal',
        disabled: 'Desactivado', enabled: 'Activado'
      },
      // Forzar subtítulos activados si existen
      captions: { active: true, update: true, language: 'auto' },
      autoplay: true,
    };

    // --- 2. LA MAGIA: PUENTE ENTRE HLS Y PLYR ---
    // Esta función conecta los cables sueltos para que el audio sea instantáneo
    const conectarPistas = (hls, player) => {
      
      // A) Inyectar AUDIOS al menú de Plyr
      if (hls.audioTracks.length > 0) {
        // Creamos un objeto falso que imita al navegador
        const audioTracksFake = hls.audioTracks.map((t, i) => ({
          id: i,
          kind: 'main',
          label: t.name || `Idioma ${i+1}`,
          language: t.lang || `lang-${i}`,
          enabled: i === hls.audioTrack
        }));

        // Engañamos a Plyr para que crea que es nativo
        Object.defineProperty(video, 'audioTracks', {
          get: () => audioTracksFake,
          configurable: true
        });

        // Escuchamos cuando Plyr intenta cambiar el audio (UI -> HLS)
        // Plyr modifica la propiedad .enabled de la pista
        audioTracksFake.forEach((track, index) => {
           Object.defineProperty(track, 'enabled', {
             get: () => index === hls.audioTrack,
             set: (val) => {
               if (val) {
                 console.log(`⚡ Audio cambiado instantáneamente a: ${track.label}`);
                 hls.audioTrack = index; // Cambio inmediato
               }
             }
           });
        });
      }

      // B) Inyectar SUBTÍTULOS (Si no hay archivo, forzamos uno "Auto")
      // Nota: Si no tienes un .vtt, esto mostrará el botón pero no saldrá texto real.
      // Chrome en PiP usa "Live Caption" (IA local), eso no se puede forzar en web,
      // pero podemos dejar el botón listo para cuando subas subtítulos.
    };

    // --- 3. INICIALIZACIÓN ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ 
        enableWorker: true, 
        lowLatencyMode: true,
        backBufferLength: 90 
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Iniciamos Plyr
        if (!playerRef.current) {
          playerRef.current = new Plyr(video, plyrOptions);
        }
        
        // Ejecutamos la conexión de pistas inmediatamente
        conectarPistas(hls, playerRef.current);

        // Forzamos play
        video.play().catch(() => {});
      });

      // Recuperación de errores
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
           if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
           else hls.destroy();
        }
      });

    } else {
      // Soporte nativo (Safari)
      video.src = src;
      playerRef.current = new Plyr(video, plyrOptions);
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [src]);

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
      <style>{`
        :root {
          --plyr-color-main: #e50914 !important; /* ROJO */
          --plyr-video-control-color: #ffffff;
        }
        /* Forzamos que el menú de audio y subtítulos se muestre */
        .plyr__menu__container [data-plyr="audio"],
        .plyr__menu__container [data-plyr="captions"] {
            display: block !important;
        }
        .plyr--full-ui input[type=range] {
            color: #e50914 !important;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;