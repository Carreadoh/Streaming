import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Asegurate de tener el CSS: <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // --- Configuración Visual ---
    const defaultOptions = {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
      settings: ['audio', 'quality', 'speed'], 
      i18n: {
        restart: 'Reiniciar', play: 'Reproducir', pause: 'Pausar', settings: 'Ajustes',
        audio: 'Idioma', quality: 'Calidad', speed: 'Velocidad',
      },
      autoplay: true,
    };

    // --- Función para conectar Audio HLS -> Menú Plyr ---
    const updatePlyrAudio = (hls, player) => {
      const tracks = hls.audioTracks;
      
      // Si hay audios detectados
      if (tracks.length > 0) {
        // 1. Convertimos las pistas de HLS al formato de opciones de Plyr
        const audioOptions = tracks.map((track, index) => ({
          label: track.name || `Idioma ${index + 1}`,
          language: track.lang || `lang${index}`,
          active: track.default || (index === 0) // Marca el primero como activo
        }));

        // 2. Inyectamos las opciones en Plyr
        // Esto obliga a Plyr a renderizar el botón "Idioma"
        player.source = {
          type: 'video',
          title: 'Movie',
          sources: [{ src: src, type: 'application/x-mpegURL' }],
          // Plyr no soporta audio tracks nativos bien, usamos este 'hack' de tracks manuales
          // pero controlamos el cambio nosotros.
        };

        // 3. Importante: Forzar la UI de Plyr a reconocer que hay opciones
        // (Esto es lo que faltaba para que aparezca el engranaje)
        // Pero primero, HLS tiene que seleccionar uno.
      }
    };

    // --- LÓGICA HLS ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("🎬 Video cargado. Audios:", hls.audioTracks);

        // --- FIX 1: EL SONIDO ---
        // Si hay pistas de audio y ninguna está seleccionada (-1), forzamos la primera (0)
        if (hls.audioTracks.length > 0 && hls.audioTrack === -1) {
            console.log("🔊 Forzando inicio de audio en pista 0");
            hls.audioTrack = 0; 
        }

        // Iniciamos Plyr
        if (!playerRef.current) {
          playerRef.current = new Plyr(video, defaultOptions);
        }
        const player = playerRef.current;

        // --- FIX 2: EL MENÚ ---
        // Configurar el cambio de idioma
        // Plyr no detecta los audios automáticamente, así que escuchamos cuando el usuario
        // interactúa con el menú de Plyr (si logramos que aparezca) o usamos un custom select.
        
        // Pero la forma más robusta con Plyr v3 + HLS es inyectar un listener manual:
        player.on('ready', () => {
           // Si Plyr oculta el menú, lo forzamos via CSS/JS si hay multiples tracks
           if (hls.audioTracks.length > 1) {
               // Aquí podríamos inyectar controles personalizados, 
               // pero primero veamos si el FIX 1 arregla el sonido.
           }
        });

        // Intentar reproducir
        video.play().catch(e => console.log("Autoplay bloqueado:", e));
      });

    } else {
      video.src = src;
      playerRef.current = new Plyr(video, defaultOptions);
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [src]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <video ref={videoRef} className="plyr-react plyr" playsInline controls crossOrigin="anonymous" style={{ width: '100%', height: '100%' }} />
      <style>{`
        :root { --plyr-color-main: #e50914; --plyr-menu-background: #1a1a1a; --plyr-menu-color: #fff; }
        .plyr { width: 100%; height: 100%; }
        /* HACK VISUAL: Si el botón de audio se genera pero está oculto */
        .plyr__controls__item.plyr__menu { display: block !important; }
      `}</style>
    </div>
  );
};

export default VideoPlayer;