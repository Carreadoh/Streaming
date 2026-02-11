import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// IMPORTANTE: Asegúrate de tener <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" /> en tu index.html

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // --- CONFIGURACIÓN VISUAL (ROJO Y CONTROLES) ---
    const plyrOptions = {
      // Color rojo se define en CSS, pero aquí aseguramos que los controles existan
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      // EL ORDEN DEL MENÚ DE ENGRANAJE
      settings: ['captions', 'audio', 'quality', 'speed'], 
      i18n: {
        restart: 'Reiniciar', play: 'Reproducir', pause: 'Pausar', 
        settings: 'Configuración', audio: 'Idioma', captions: 'Subtítulos',
        quality: 'Calidad', speed: 'Velocidad', normal: 'Normal',
      },
      // Activar subtítulos por defecto si existen
      captions: { active: true, language: 'es', update: true },
      autoplay: true,
    };

    // --- FUNCIÓN PARA ENGAÑAR A PLYR (POLYFILL DE AUDIO) ---
    // Esto hace que Plyr crea que el navegador tiene soporte nativo de audio tracks
    const polyfillAudioTracks = (hls) => {
      if (!hls.audioTracks || hls.audioTracks.length === 0) return;

      // Creamos un objeto que imita la API nativa de audioTracks del navegador
      const fakeAudioTracks = hls.audioTracks.map((track, index) => {
        return {
          id: index,
          kind: 'translation',
          label: track.name || `Idioma ${index + 1}`,
          language: track.lang || `lang-${index}`,
          enabled: index === hls.audioTrack // True si es el actual
        };
      });

      // Sobreescribimos la propiedad audioTracks del elemento video
      // Plyr lee esto para generar el menú
      Object.defineProperty(video, 'audioTracks', {
        get: () => fakeAudioTracks,
        configurable: true
      });

      // Interceptamos cuando Plyr intenta cambiar el audio
      // Plyr pondrá 'enabled = true' en una pista, nosotros detectamos cuál y avisamos a HLS
      fakeAudioTracks.forEach((fakeTrack, index) => {
        Object.defineProperty(fakeTrack, 'enabled', {
          get: () => index === hls.audioTrack,
          set: (value) => {
            if (value === true) {
              hls.audioTrack = index;
              console.log(`🔊 Audio cambiado a: ${fakeTrack.label}`);
            }
          }
        });
      });
    };

    // --- INICIALIZACIÓN ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("🎬 HLS Cargado. Pistas:", hls.audioTracks);

        // 1. Aplicamos el Hack para que aparezca el menú de audio
        polyfillAudioTracks(hls);

        // 2. Iniciamos Plyr DESPUÉS de aplicar el hack
        if (!playerRef.current) {
          playerRef.current = new Plyr(video, plyrOptions);
        }
        
        // Forzamos reproducción
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => console.log("Autoplay bloqueado por el navegador"));
        }
      });
      
      // Manejo de errores de red
      hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
          }
      });

    } else {
      // Soporte nativo (Safari o MP4)
      video.src = src;
      playerRef.current = new Plyr(video, plyrOptions);
    }

    // Limpieza
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [src]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        className="plyr-react plyr"
        playsInline
        controls // Dejamos controls nativos como fallback inicial
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* --- ESTILOS CSS FORZADOS (ROJO NETFLIX) --- */}
      <style>{`
        /* Color Principal Rojo */
        :root {
          --plyr-color-main: #e50914 !important; 
          --plyr-video-control-color: #ffffff;
        }

        /* Forzar que el menú de audio aparezca si Plyr intenta ocultarlo */
        .plyr__menu__container [data-plyr="audio"] {
            display: block !important;
        }

        /* Ajustes visuales del botón y slider */
        .plyr--full-ui input[type=range] {
            color: #e50914 !important;
        }
        .plyr__control--overlaid-action {
            background: rgba(229, 9, 20, 0.8) !important;
        }
        .plyr__control--overlaid-action:hover {
            background: #e50914 !important;
        }
        
        /* Asegurar que el video ocupe todo */
        .plyr {
            width: 100%;
            height: 100%;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;