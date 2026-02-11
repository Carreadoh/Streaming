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
      if (!playerRef.current) {
        playerRef.current = new Plyr(video, {
          // Reordenamos los controles para poner 'settings' (idioma) al lado de 'volume'
          controls: [
            'play-large', 
            'play', 
            'progress', 
            'current-time', 
            'mute', 
            'volume', 
            'settings', // El engranaje ahora está pegado al volumen
            'fullscreen'
          ],
          settings: ['audio', 'speed'], 
          iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg',
          i18n: { audio: 'Idioma', speed: 'Velocidad' },
        });
      }

      // Inyectar las pistas de audio para habilitar el menú de Inglés/Español
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
        /* Ocupar todo el ancho y alto del dispositivo */
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
          width: 100%;
          height: 100%;
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .video-wrapper.ready {
          opacity: 1;
        }

        :root {
          --plyr-color-main: #e50914 !important; /* Rojo */
        }

        .plyr {
          height: 100%;
          width: 100%;
        }

        /* Posicionamiento del botón de configuración al lado del volumen */
        .plyr__controls {
          background: linear-gradient(transparent, rgba(0,0,0,0.8)) !important;
          padding-bottom: 35px !important; /* Más espacio para evitar que se tape */
          gap: 5px; /* Espaciado entre botones */
        }

        /* Forzar que el menú de ajustes se abra hacia arriba y no se corte */
        .plyr__menu__container {
          bottom: 75px !important; 
          z-index: 1001;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;