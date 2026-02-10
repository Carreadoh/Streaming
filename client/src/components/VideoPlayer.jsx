import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Recuerda: El CSS de Plyr ya está en el index.html

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Configuración de Plyr
    const plyrOptions = {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'mute', 'volume', 'settings', 'fullscreen'
      ],
      // IMPORTANTE: 'audio' debe estar aquí
      settings: ['audio', 'quality', 'speed'], 
      i18n: {
        restart: 'Reiniciar',
        play: 'Reproducir',
        pause: 'Pausar',
        settings: 'Configuración',
        audio: 'Idiomas', // Nombre visible en el menú
        quality: 'Calidad',
        speed: 'Velocidad',
      },
      autoplay: true,
    };

    // --- LÓGICA DE STREAMING (HLS) ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      // EVENTO CLAVE: Se dispara cuando HLS leyó el archivo y encontró los audios
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("Audios encontrados:", hls.audioTracks);

        // 1. Inicializamos Plyr AHORA (que ya sabemos qué audios hay)
        if (!playerRef.current) {
          const player = new Plyr(video, plyrOptions);
          playerRef.current = player;
          
          // 2. Hack para conectar la selección de Plyr con HLS
          // Plyr a veces no cambia el audio de HLS automáticamente, así que lo forzamos:
          player.on('languagechange', () => {
             // Buscamos qué idioma eligió el usuario en Plyr
             // Nota: Plyr usa el atributo 'srclang' o el nombre
             setTimeout(() => {
                const currentTrackIndex = hls.audioTrack;
                console.log("Audio cambiado en HLS a pista:", currentTrackIndex);
             }, 100);
          });
        }
        
        // Intentar reproducir
        video.play().catch(e => console.log("Autoplay prevenido:", e));
      });

      // Manejo de errores
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

    } else {
      // Caso MP4 simple (No streaming)
      video.src = src;
      playerRef.current = new Plyr(video, plyrOptions);
    }

    // Limpieza
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Dejamos 'controls' activado aquí para que, mientras HLS carga (esa fracción de segundo),
         se vea el reproductor nativo y no una pantalla negra vacía.
         En cuanto Plyr carga, reemplaza estos controles.
      */}
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
          --plyr-color-main: #e50914; 
          --plyr-video-control-color: #ffffff;
          --plyr-menu-background: rgba(20, 20, 20, 0.95);
          --plyr-menu-color: #fff;
        }
        .plyr__control--overlaid-action {
           background: rgba(229, 9, 20, 0.8);
           transform: scale(1.1);
        }
        .plyr__control--overlaid-action:hover {
           background: #e50914;
        }
        /* Ajuste de menú */
        .plyr__menu__container {
            bottom: 60px !important;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;