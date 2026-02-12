import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar'; // Opcional: para ocultar la barra superior

const VideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // --- 1. FORZAR MODO HORIZONTAL (LANDSCAPE) ---
    const lockOrientation = async () => {
      try {
        // Guardamos la orientación actual por si acaso
        await ScreenOrientation.lock({ orientation: 'landscape' });
        
        // Ocultar barra de estado (batería, hora) para efecto cine
        // Si no tienes @capacitor/status-bar instalado, borra esta línea
        await StatusBar.hide(); 
      } catch (error) {
        console.error("No se pudo rotar la pantalla (¿Estás en navegador web?):", error);
      }
    };

    lockOrientation();

    // --- 2. CONFIGURAR REPRODUCTOR ---
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{ src: src, type: 'video/mp4' }]
      });
      
      // Evento para cuando termina el video (Opcional)
      playerRef.current.on('ended', () => {
          // Podrías cerrar el player aquí automáticamente
      });

    } else {
      const player = playerRef.current;
      player.src({ src: src, type: 'video/mp4' });
    }

    // --- 3. LIMPIEZA AL SALIR (Volver a Vertical) ---
    return () => {
      const unlockOrientation = async () => {
        try {
          // Volver a vertical
          await ScreenOrientation.lock({ orientation: 'portrait' });
          // O desbloquear para que rote libre: await ScreenOrientation.unlock();
          
          // Mostrar barra de estado de nuevo
          await StatusBar.show();
        } catch (e) {}
      };

      unlockOrientation();

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div ref={videoRef} style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }} />
  );
};

export default VideoPlayer;