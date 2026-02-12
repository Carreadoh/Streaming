import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ src }) => {
  const [reproducir, setReproducir] = useState(false);

  useEffect(() => {
    console.log("🎬 Intentando cargar video:", src);
    setReproducir(false); // Resetea si cambia la peli
  }, [src]);

  return (
    <div className='player-wrapper' style={{ width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ReactPlayer
        key={src} // Clave para forzar recarga si cambia URL
        url={src}
        className='react-player'
        width='100%'
        height='100%'
        controls={true}
        
        // TRUCO ANTIBLOQUEO:
        // 1. No le damos play 'true' directo.
        // 2. Esperamos a onReady.
        playing={reproducir} 
        
        onReady={() => {
            console.log("✅ Video listo para arrancar. Dando Play...");
            setReproducir(true);
        }}

        onBuffer={() => console.log("⏳ Buffering (Cargando datos)...")}
        
        onStart={() => console.log("▶️ El video comenzó a reproducirse")}

        onError={(e) => {
            // Ignoramos el error de Abort (es ruido)
            if (e && e.name === 'AbortError') return;
            console.error("❌ ERROR CRÍTICO NO CARGA:", e);
            console.error("❌ Revisa si el archivo existe en:", src);
        }}

        config={{
          file: {
            attributes: {
              controlsList: 'nodownload',
              disablePictureInPicture: false,
              crossOrigin: "anonymous" // Importante para algunos servidores
            }
          }
        }}
      />
    </div>
  );
};

export default VideoPlayer;