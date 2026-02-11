import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Asegúrate de tener el CSS: <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);
  
  // Estado para saber si estamos listos para mostrar el reproductor
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // 1. Inicializamos Plyr con el color rojo
      const player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['audio', 'speed'], // Forzamos que 'audio' esté en el menú
        i18n: { audio: 'Idioma', speed: 'Velocidad' }
      });

      // 2. EL HACK DEFINITIVO: Inyectamos los idiomas en el menú de Plyr
      if (hls.audioTracks.length > 1) {
        const audioOptions = hls.audioTracks.map((track, index) => ({
          label: track.name || `Idioma ${index + 1}`,
          value: index,
        }));

        // Actualizamos las opciones de Plyr manualmente
        player.setOptions({
          audio: {
            options: audioOptions,
            selected: hls.audioTrack,
            onChange: (index) => {
              hls.audioTrack = index;
              console.log("Cambiando audio a:", hls.audioTracks[index].name);
            },
          },
        });
      }
      
      video.play();
    });

    return () => hls.destroy();
  }, [src]);

  return (
    // CONTENEDOR FIX: height: 100vh o fixed para asegurar que no se corte
    <div style={{ width: '100%', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Wrapper de video */}
      <div style={{ width: '100%', maxWidth: '100%', opacity: isReady ? 1 : 0, transition: 'opacity 0.5s' }}>
          <video
            ref={videoRef}
            className="plyr-react plyr"
            playsInline
            controls
            crossOrigin="anonymous"
            style={{ width: '100%', height: 'auto' }}
          />
      </div>

      <style>{`
        /* ROJO NETFLIX */
        :root {
          --plyr-color-main: #e50914 !important;
          --plyr-video-control-color: #ffffff;
        }
        
        /* FORZAR VISIBILIDAD DEL MENÚ DE AUDIO */
        /* Esto obliga al botón a aparecer aunque Plyr quiera ocultarlo */
        .plyr__menu__container [data-plyr="audio"] {
            display: block !important;
        }

        /* ARREGLO DE CONTROLES OCULTOS */
        /* Aseguramos que la barra de control tenga espacio y esté encima */
        .plyr__controls {
            padding-bottom: 20px !important;
            z-index: 1000 !important;
        }
        
        /* Ajuste para que el menú no se corte por abajo */
        .plyr__menu__container {
            bottom: 50px !important; 
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;