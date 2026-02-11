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

    // Destruir instancias previas para evitar duplicados
    if (hlsRef.current) hlsRef.current.destroy();
    if (playerRef.current) playerRef.current.destroy();

    // Opciones visuales (Rojo y controles completos)
    const plyrOptions = {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'mute', 'volume', 'settings', 'pip', 'fullscreen'
      ],
      settings: ['audio', 'quality', 'speed'], // AUDIO PRIMERO
      i18n: {
        restart: 'Reiniciar', play: 'Reproducir', pause: 'Pausar', 
        settings: 'Ajustes', audio: 'Idioma', quality: 'Calidad', 
        speed: 'Velocidad', normal: 'Normal',
      },
      autoplay: true,
    };

    // --- FUNCIÓN DE INYECCIÓN DE AUDIO (EL "HACK") ---
    const injectAudioTracks = (hlsInstance) => {
      // Si no hay tracks o solo hay 1, no hacemos nada (Plyr ocultará el menú y está bien)
      if (!hlsInstance.audioTracks || hlsInstance.audioTracks.length < 2) return;

      console.log("🔊 Inyectando audios para Plyr:", hlsInstance.audioTracks);

      const fakeTracks = hlsInstance.audioTracks.map((track, index) => {
        return {
          id: index,
          kind: 'main',
          label: track.name || (index === 0 ? 'Español' : 'Inglés'), // Fallback de nombres
          language: track.lang || (index === 0 ? 'es' : 'en'),
          enabled: index === hlsInstance.audioTrack
        };
      });

      // 1. Definimos la propiedad audioTracks en el elemento de video
      Object.defineProperty(video, 'audioTracks', {
        get: () => fakeTracks,
        configurable: true
      });

      // 2. Conectamos el interruptor (Cuando Plyr cambia 'enabled', nosotros cambiamos HLS)
      fakeTracks.forEach((fakeTrack, index) => {
        Object.defineProperty(fakeTrack, 'enabled', {
          get: () => index === hlsInstance.audioTrack,
          set: (val) => {
            if (val) {
              console.log(`⚡ Cambio de audio a: ${fakeTrack.label}`);
              hlsInstance.audioTrack = index;
            }
          }
        });
      });
    };

    // --- INICIALIZACIÓN HLS ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      // ESPERAMOS A QUE SE PARSEEN LOS DATOS
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        
        // 1. Aplicamos el hack de audio
        injectAudioTracks(hls);

        // 2. Iniciamos Plyr AHORA (no antes)
        if (!playerRef.current) {
          playerRef.current = new Plyr(video, plyrOptions);
          
          // Fix para el bug de controles ocultos: Recalcular tamaño
          setTimeout(() => {
             setIsReady(true); // Muestra el contenedor limpio
          }, 100);
        }

        // Play
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
         if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      });

    } else {
      // Soporte Nativo (Safari)
      video.src = src;
      playerRef.current = new Plyr(video, plyrOptions);
      setIsReady(true);
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) playerRef.current.destroy();
    };
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