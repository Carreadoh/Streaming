import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Asegurate de tener el CSS en el index.html: <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  // --- Función auxiliar para sincronizar HLS con Plyr ---
  // Toma las pistas de HLS y las convierte al formato que Plyr necesita para mostrar el menú
  const updatePlyrSource = (hls, player, videoElement) => {
    if (!hls.audioTracks || hls.audioTracks.length === 0) return;

    const audioTracksPlyr = hls.audioTracks.map((track, index) => ({
      label: track.name || `Audio ${index + 1}`, // Nombre visible (ej: Espanol)
      language: track.lang || `lang${index}`,    // Código interno (ej: spa)
      active: track.default, // Si es el por defecto
    }));

    // Inyectamos la fuente nuevamente, ahora con las pistas de audio explícitas
    player.source = {
      type: 'video',
      title: 'Pelicula',
      sources: [{ src: src, type: 'application/x-mpegURL' }],
      // Aquí está la magia: le pasamos las pistas a Plyr
      tracks: audioTracksPlyr, 
    };

    // IMPORTANTE: Sincronizar el evento de cambio de Plyr hacia HLS.js
    player.on('languagechange', () => {
       // Buscamos el índice de la pista HLS que coincide con el idioma elegido en Plyr
       // Usamos una pequeña demora porque Plyr tarda unos ms en actualizar su estado interno
       setTimeout(() => {
          const selectedLang = player.language;
          const hlsIndex = hls.audioTracks.findIndex(t => t.lang === selectedLang);
          if (hlsIndex !== -1) {
             hls.audioTrack = hlsIndex;
             console.log(`🔊 Audio cambiado a pista HLS: ${hlsIndex} (${selectedLang})`);
          }
       }, 50);
    });
  };


  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // --- 1. Configuración Visual Base de Plyr ---
    const plyrOptions = {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
      settings: ['audio', 'quality', 'speed'], // 'audio' debe estar aquí
      i18n: {
        restart: 'Reiniciar', play: 'Reproducir', pause: 'Pausar', settings: 'Ajustes',
        audio: 'Idioma', quality: 'Calidad', speed: 'Velocidad',
      },
      autoplay: true,
    };

    // Inicializamos Plyr INMEDIATAMENTE para tener UI (sin audio tracks aún)
    if (!playerRef.current) {
      playerRef.current = new Plyr(video, plyrOptions);
    }
    const player = playerRef.current;


    // --- 2. Lógica HLS ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      // EVENTO CLAVE: Cuando HLS lee el mapa y encuentra los audios
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("✅ HLS cargado. Audios encontrados:", hls.audioTracks);
        // Llamamos a la función mágica que conecta los audios a Plyr
        updatePlyrSource(hls, player, video);
        video.play().catch(e => console.log("Autoplay bloqueado:", e));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.fatal) hls.destroy();
      });

    } else {
      // Caso MP4 nativo
      video.src = src;
    }

    // Limpieza
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [src]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <video ref={videoRef} className="plyr-react plyr" playsInline controls crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      
      <style>{`
        :root { --plyr-color-main: #e50914; --plyr-menu-background: rgba(20, 20, 20, 0.95); --plyr-menu-color: #fff; }
        .plyr__control--overlaid-action { background: rgba(229, 9, 20, 0.8); transform: scale(1.1); }
        .plyr__control--overlaid-action:hover { background: #e50914; }
        .plyr { width: 100%; height: 100%; }
        /* HE ELIMINADO LA LÍNEA QUE ROMPÍA EL MENÚ (.plyr__menu__container { bottom: ... })
           Plyr ahora calculará la posición automáticamente hacia arriba.
        */
      `}</style>
    </div>
  );
};

export default VideoPlayer;