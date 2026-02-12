import React, { useEffect, useRef } from 'react';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();

    const setupNativeView = async () => {
      if (isNative) {
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
          await StatusBar.hide();
        } catch (e) {}
      }
    };

    setupNativeView();

    // --- FORZAR REPRODUCCIÓN ---
    if (videoRef.current) {
      const video = videoRef.current;

      // Intentar forzar el inicio apenas cargue suficiente buffer
      video.oncanplay = () => {
        video.play().catch(err => {
          console.log("Autoplay bloqueado, intentando con mute...");
          video.muted = true;
          video.play();
          // Una vez que arranca, intentamos quitar el mute
          setTimeout(() => { video.muted = false; }, 100);
        });
      };
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
    };
  }, [src]);

  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline // CRÍTICO: Evita que iOS/Android lo abran en su propio reproductor
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain' // Mantiene la relación de aspecto sin zoom
        }}
        // Quitamos controles nativos y ponemos los que vos quieras o ninguno
        controls={true} 
        // Desactivamos el botón de pantalla completa nativo (ya estamos en pantalla completa)
        controlsList="nofullscreen nodownload"
      />
      
      {/* Estilo para ocultar el botón de pantalla completa en Chrome/Android */}
      <style>{`
        video::-webkit-media-controls-fullscreen-button {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;