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

    // 1. Configuración de HLS
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });
    hlsRef.current = hls;

    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // 2. Inicialización de Plyr (Solo si no existe)
      if (!playerRef.current) {
        playerRef.current = new Plyr(video, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
          settings: ['audio', 'speed'],
          // FIX ICONOS INVISIBLES: Forzamos el CDN oficial
          iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg',
          i18n: { audio: 'Idioma', speed: 'Velocidad' },
          tooltips: { controls: true, seek: true }
        });

        // 3. Inyección de Audios
        if (hls.audioTracks.length > 1) {
          const audioOptions = hls.audioTracks.map((track, index) => ({
            label: track.name || `Idioma ${index + 1}`,
            value: index,
          }));

          playerRef.current.setOptions({
            audio: {
              options: audioOptions,
              selected: hls.audioTrack,
              onChange: (index) => {
                hls.audioTrack = index;
              },
            },
          });
        }
      }
      
      setIsReady(true);
      video.play().catch(() => console.log("Autoplay bloqueado"));
    });

    // Limpieza al desmontar
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [src]);

  return (
    <div className="video-container">
      <div className={`video-wrapper ${isReady ? 'ready' : ''}`}>
        <video
          ref={videoRef}
          className="plyr-react plyr"
          playsInline
          crossOrigin="anonymous"
        />
      </div>

      <style>{`
        .video-container {
          width: 100%;
          height: 100vh;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .video-wrapper {
          width: 100%;
          max-width: 1280px; /* Opcional: limita el ancho máximo */
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .video-wrapper.ready {
          opacity: 1;
        }

        /* ROJO NETFLIX */
        :root {
          --plyr-color-main: #e50914 !important;
        }

        /* FIX CONTROLES: Asegura que Plyr se mantenga dentro del wrapper */
        .plyr {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        /* Evitar que los controles se desplacen a mitad de pantalla */
        .plyr__controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding-top: 40px !important; /* Degradado para que se vea mejor */
          background: linear-gradient(transparent, rgba(0,0,0,0.7)) !important;
        }

        /* Forzar visibilidad de iconos si el SVG falla localmente */
        .plyr__control svg {
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
        }

        .plyr__menu__container {
          bottom: 60px !important;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;