import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

const VideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();

    // --- 1. MODO CINE (Solo en App Nativa) ---
    const setupNativeView = async () => {
      if (isNative) {
        try {
          // Forzar horizontal
          await ScreenOrientation.lock({ orientation: 'landscape' });
          // Ocultar batería/hora
          await StatusBar.hide();
        } catch (error) {
          console.warn("Error configurando vista nativa:", error);
        }
      }
    };

    setupNativeView();

    // --- 2. CONFIGURAR REPRODUCTOR VIDEO.JS ---
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true,
        playbackRates: [0.5, 1, 1.5, 2],
        sources: [{ src: src, type: 'video/mp4' }]
      });

    } else {
      const player = playerRef.current;
      player.src({ src: src, type: 'video/mp4' });
    }

    // --- 3. LIMPIEZA AL SALIR ---
    return () => {
      const resetNativeView = async () => {
        if (isNative) {
          try {
            // Volver a vertical al cerrar la película
            await ScreenOrientation.lock({ orientation: 'portrait' });
            // Mostrar batería/hora de nuevo
            await StatusBar.show();
          } catch (e) {
            console.warn("Error reseteando vista nativa:", e);
          }
        }
      };

      resetNativeView();

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div 
      ref={videoRef} 
      className="video-container"
      style={{ 
        width: '100vw', 
        height: '100vh', 
        background: '#000', 
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999 
      }} 
    />
  );
};

export default VideoPlayer;