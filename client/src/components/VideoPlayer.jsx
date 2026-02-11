import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Configuración HLS
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (!playerRef.current) {
        playerRef.current = new Plyr(video, {
          // Controles simplificados para TV (Grandes y claros)
          controls: [
            'play-large', // Botón gigante en el medio
            'play', 
            'progress', 
            'current-time', 
            'duration',
            'settings', // Idioma
          ],
          settings: ['audio', 'speed'],
          // Traducción al español
          i18n: { audio: 'Audio / Idioma', speed: 'Velocidad', quality: 'Calidad' },
          // Desactivar tooltips que molestan en TV
          tooltips: { controls: false, seek: true },
          // Esconder controles después de 4 segundos
          hideControls: true,
          resetOnEnd: true,
        });
      }

      // --- INYECCIÓN DE IDIOMAS (Inglés/Español) ---
      if (hls.audioTracks.length > 1) {
        const audioOptions = hls.audioTracks.map((track, index) => ({
          label: track.name || (track.lang === 'es' ? 'Español Latino' : 'Inglés Original'),
          value: index,
        }));

        playerRef.current.setOptions({
          audio: {
            options: audioOptions,
            selected: hls.audioTrack,
            onChange: (index) => { hls.audioTrack = index; },
          },
        });
      }
      
      setIsReady(true);
      video.play().catch(() => {});
    });

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [src]);

  return (
    <div className="tv-player-container">
      <video ref={videoRef} className="plyr-react plyr" playsInline crossOrigin="anonymous" />
      
      {/* CSS INYECTADO SOLO PARA ESTE COMPONENTE EN MODO TV */}
      <style>{`
        .tv-player-container {
          width: 100vw;
          height: 100vh;
          background: #000;
          overflow: hidden;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
        }

        /* 1. CONTROLES GIGANTES PARA VER DE LEJOS */
        :root {
          --plyr-color-main: #e50914; /* Rojo Netflix */
          --plyr-range-thumb-height: 20px;
          --plyr-control-icon-size: 40px; /* Iconos más grandes */
          --plyr-font-size-base: 22px; /* Texto más grande */
        }

        .plyr__controls {
          padding: 40px 60px !important; /* Márgenes de seguridad para TV (Overscan) */
          background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.95)) !important;
          padding-bottom: 50px !important;
        }

        /* 2. BARRA DE PROGRESO MÁS GRUESA */
        .plyr__progress input[type=range], .plyr__volume input[type=range] {
           height: 10px !important; 
        }

        /* 3. MENÚ DE IDIOMA (Settings) */
        .plyr__menu__container {
          bottom: 110px !important; /* Subirlo para que no tape la barra */
          width: 350px !important; /* Menú ancho */
          background: rgba(20, 20, 20, 0.95) !important;
          border-radius: 8px;
        }

        .plyr__menu__container button {
            font-size: 20px !important; /* Texto de opciones gigante */
            padding: 15px !important;
        }

        /* Foco visible en los botones del player (Borde blanco) */
        .plyr__control:focus-visible, 
        .plyr__control:hover {
            background: rgba(255, 0, 0, 0.7) !important;
            transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;