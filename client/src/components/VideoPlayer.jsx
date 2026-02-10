import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// El CSS de Plyr debe estar en tu index.html: <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // 1. Configuración Visual de Plyr
    const plyrOptions = {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'mute', 'volume', 'settings', 'fullscreen'
      ],
      settings: ['audio', 'quality', 'speed'], 
      i18n: {
        restart: 'Reiniciar',
        play: 'Reproducir',
        pause: 'Pausar',
        settings: 'Configuración',
        audio: 'Idiomas',
        quality: 'Calidad',
        speed: 'Velocidad',
      },
      autoplay: true,
    };

    // 2. Inicializamos Plyr INMEDIATAMENTE (para que se vean los botones y el negro no esté vacío)
    playerRef.current = new Plyr(video, plyrOptions);

    // 3. Lógica de Streaming (HLS)
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      // Cuando HLS detecta los idiomas/calidades
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("Stream cargado. Pistas:", data.levels);
        // Intentar reproducir
        video.play().catch(e => console.log("Autoplay bloqueado:", e));
      });

      // Si ocurre un error, que no muera en silencio
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.error("Error fatal HLS:", data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("Intentando recuperar red...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Intentando recuperar media...");
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

    } else {
      // Soporte nativo o MP4 directo
      video.src = src;
    }

    // Limpieza al desmontar
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
      {/* Agregamos 'controls' al tag video como respaldo de emergencia */}
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
        /* Forzar que el contenedor ocupe todo el espacio */
        .plyr {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;