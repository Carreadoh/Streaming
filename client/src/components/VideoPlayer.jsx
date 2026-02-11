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

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });
    hlsRef.current = hls;

    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // 1. Inicializamos Plyr
      if (!playerRef.current) {
        playerRef.current = new Plyr(video, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
          settings: ['audio', 'speed'], 
          iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg',
          i18n: { audio: 'Idioma', speed: 'Velocidad' },
        });
      }

      // 2. FORZAR MENÚ DE AUDIO (Inglés/Español)
      // Esperamos un momento a que Plyr esté listo para recibir las opciones
      if (hls.audioTracks.length > 1) {
        const audioOptions = hls.audioTracks.map((track, index) => ({
          label: track.name || (track.lang === 'es' ? 'Español' : 'Inglés'),
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
      
      setIsReady(true);
      video.play().catch(() => console.log("Autoplay bloqueado"));
    });

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
        /* 1. Ocupar todo el dispositivo sin márgenes */
        .video-container {
          width: 100vw;
          height: 100vh;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .video-wrapper {
          width: 100%; /* Eliminado el max-width de 1280px */
          height: 100%;
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .video-wrapper.ready {
          opacity: 1;
        }

        /* 2. Estilos Visuales y Fix de Menú */
        :root {
          --plyr-color-main: #e50914 !important; /* Rojo Netflix */
        }

        .plyr {
          height: 100%;
          width: 100%;
        }

        /* Asegurar que los iconos sean visibles y el menú aparezca */
        .plyr__control svg {
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
        }

        .plyr__menu__container {
          bottom: 80px !important; /* Subimos el menú para que no lo tape nada */
          z-index: 1001;
        }

        /* Forzar que el botón de settings sea visible */
        .plyr__controls {
          background: linear-gradient(transparent, rgba(0,0,0,0.8)) !important;
          padding-bottom: 30px !important;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;