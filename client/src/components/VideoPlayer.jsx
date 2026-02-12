import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css'; // Estilos base obligatorios

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // Asegurarse de que el elemento video existe
    if (!videoRef.current) return;

    // Si el reproductor no existe, lo creamos
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered'); // Botón play al medio
      videoRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true, // Se adapta al tamaño del contenedor
        sources: [{
          src: src,
          type: 'video/mp4'
        }],
        // Opciones avanzadas de UX
        userActions: {
          hotkeys: true // Teclas de flecha para adelantar/atrasar
        },
        playbackRates: [0.5, 1, 1.5, 2] // Velocidad de reproducción
      }, () => {
        console.log('✅ Player listo y cargado');
      });

    } else {
      // Si ya existe, solo actualizamos la URL (para cambiar de peli rápido)
      const player = playerRef.current;
      player.src({ src: src, type: 'video/mp4' });
    }
  }, [src, videoRef]);

  // Limpieza al salir (Evita fugas de memoria en la App)
  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={videoRef} 
      style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }} 
    />
  );
};

export default VideoPlayer;