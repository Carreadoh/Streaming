import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ src }) => {
  // Estado para controlar la reproducción de forma segura
  const [reproducir, setReproducir] = useState(false);

  // Resetear estado si cambia el src
  useEffect(() => {
    setReproducir(false);
  }, [src]);

  return (
    <div className='player-wrapper' style={{ width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ReactPlayer
        key={src} // Forzar recreación si cambia el video
        url={src}
        className='react-player'
        width='100%'
        height='100%'
        controls={true}
        
        // TRUCO: No ponemos 'true' directo. Esperamos a que esté listo.
        playing={reproducir} 
        
        // Cuando el video ya cargó los metadatos y está listo, ahí damos play
        onReady={() => setReproducir(true)}
        
        config={{
          file: {
            forceHLS: true,
            attributes: {
              crossOrigin: "anonymous",
              disablePictureInPicture: false,
              controlsList: 'nodownload' // Opcional: Para que no descarguen fácil
            },
            hlsOptions: {
              enableWorker: true,
              lowLatencyMode: true,
            }
          }
        }}
        
        // Filtramos el error AbortError para que no ensucie la consola
        onError={(e) => {
          if (e && e.name === 'AbortError') {
            // Ignorar error de interrupción (usuario cerró rápido)
            return;
          }
          console.log("Error del reproductor:", e);
        }}
      />
    </div>
  );
};

export default VideoPlayer;