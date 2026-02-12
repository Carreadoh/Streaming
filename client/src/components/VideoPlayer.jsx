import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();

    const setupNativeView = async () => {
      if (isNative) {
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
          await StatusBar.hide();
        } catch (error) {
          console.warn("Error nativo:", error);
        }
      }
    };

    setupNativeView();

    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: false, // CAMBIO: Ponemos false para manejar el tamaño nosotros
        muted: false, // CAMBIO: Aseguramos que no esté silenciado
        sources: [{ src: src, type: 'video/mp4' }]
      }, () => {
        // Truco para el sonido: Algunos navegadores necesitan que el usuario interactúe
        // Intentamos quitar el mute apenas cargue
        playerRef.current.muted(false);
      });

    }

    return () => {
      const resetNativeView = async () => {
        if (isNative) {
          try {
            await ScreenOrientation.lock({ orientation: 'portrait' });
            await StatusBar.show();
          } catch (e) {}
        }
      };
      resetNativeView();

      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div 
      style={{ 
        position: 'fixed', // CAMBIO: Flota sobre toda la app
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 9999, // CAMBIO: Por encima de cualquier menú
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default VideoPlayer;