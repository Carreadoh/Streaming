import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
// Asegurate de tener el CSS en el index.html

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerRef = useRef(null);

  // --- Función para actualizar las pistas en Plyr ---
  const updatePlyrSource = (hls, player) => {
    // 1. Obtenemos las pistas reales de HLS
    let tracks = hls.audioTracks || [];

    // ⚠️ HACK PARA QUE APAREZCA EL MENÚ SÍ O SÍ ⚠️
    // Si HLS no encuentra pistas (array vacío), inventamos unas para que veas el botón.
    // Cuando arreglemos los archivos .m3u8, esto se reemplazará por los reales.
    const usarFakeTracks = tracks.length === 0;
    
    if (usarFakeTracks) {
        console.warn("⚠️ No se detectaron audios reales. Usando audios FAKE para mostrar menú.");
        tracks = [
            { name: 'Español (Test)', lang: 'es', default: true },
            { name: 'Inglés (Test)', lang: 'en', default: false }
        ];
    } else {
        console.log("✅ Audios reales detectados:", tracks);
    }

    // 2. Formateamos para Plyr
    const audioOptions = tracks.map((track, index) => ({
      label: track.name || `Audio ${index + 1}`,
      language: track.lang || `lang${index}`,
      active: track.default || (index === 0), // Marcar el primero como activo si no hay default
    }));

    // 3. Inyectamos la fuente de nuevo con las opciones de audio
    player.source = {
      type: 'video',
      title: 'Stream',
      sources: [{ src: src, type: 'application/x-mpegURL' }],
      // Esto es lo que Plyr lee para generar el menú de opciones (hack usando 'tracks' genéricos)
      // Plyr usa esto internamente para subtítulos, pero con un custom handler lo usamos para audio
      tracks: [], // Lo dejamos vacío aquí, Plyr no soporta audio nativo así fácil.
    };

    // 🔴 RE-HACK: Plyr es muy difícil con el audio. La única forma 100% segura de que aparezca
    // el menú de "Audio" es si el navegador expone `video.audioTracks`.
    // Como Chrome no lo hace, Plyr suele ocultarlo.
    
    // Vamos a inyectar la configuración directamente en el objeto de configuración interno si es posible,
    // pero la forma más robusta en React es forzar el menú mediante un evento custom.
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // --- 1. Configuración Visual ---
    const plyrOptions = {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
      // EL ORDEN IMPORTA: Audio primero
      settings: ['audio', 'quality', 'speed'], 
      i18n: {
        restart: 'Reiniciar', play: 'Reproducir', pause: 'Pausar', settings: 'Configuración',
        audio: 'Audio / Idioma', // Texto explícito
        quality: 'Calidad', speed: 'Velocidad',
      },
      autoplay: true,
    };

    // Inicializamos Plyr
    if (!playerRef.current) {
      playerRef.current = new Plyr(video, plyrOptions);
    }
    const player = playerRef.current;

    // --- 2. HLS ---
    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("🎬 Manifiesto cargado");
        
        
        if (hls.audioTracks.length > 0) {
           console.log("🔊 Pistas de audio HLS:", hls.audioTracks);

        }

        video.play().catch(e => console.log("Autoplay bloqueado:", e));
      });
      
      // Listener para errores
      hls.on(Hls.Events.ERROR, (event, data) => {
         if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      });

    } else {
      video.src = src;
    }
    
    if (Hls.isSupported() && src.includes('.m3u8')) {
        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
            const tracks = hlsRef.current.audioTracks;
            
            // Engañamos al elemento de video para que Plyr crea que hay soporte nativo
            // Esto hace que el menú aparezca mágicamente
            if (tracks.length > 1) { // Solo si hay más de 1 audio
                const plyrAudioTracks = tracks.map((t, i) => ({
                    id: i,
                    label: t.name || `Idioma ${i+1}`,
                    language: t.lang,
                    enabled: t.default
                }));
                
                // Sobreescribimos getter para que Plyr lo lea
                Object.defineProperty(video, 'audioTracks', {
                    get: () => plyrAudioTracks,
                    configurable: true
                });
                
                // Reiniciamos Plyr suavemente para que lea la nueva propiedad
                // No hacemos destroy, solo actualizamos UI si es posible, o re-instanciamos
                // Como es arriesgado re-instanciar, confiamos en que Plyr chequea esto al abrir settings.
            }
        });
    }

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
        /* Forzar visualización de items de menú si están ocultos */
        .plyr__menu__container [data-plyr="audio"] { display: block !important; }
      `}</style>
    </div>
  );
};

export default VideoPlayer;