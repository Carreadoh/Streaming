import React from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ src }) => {
  return (
    <div className='player-wrapper' style={{ width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ReactPlayer
        url={src}
        className='react-player'
        width='100%'
        height='100%'
        controls={true} // Controles nativos (Play, Pausa, Volumen, Pantalla completa)
        playing={true}  // Autoplay al abrir
        
        // Configuración optimizada para MP4
        config={{
          file: {
            attributes: {
              controlsList: 'nodownload', // Opcional: Oculta el botón de descarga nativo
              disablePictureInPicture: false,
              preload: 'metadata' // Carga info rápida antes de bajar todo el video
            }
          }
        }}

        // Manejo de errores básico
        onError={(e) => console.log("Error al reproducir:", e)}
      />
    </div>
  );
};

export default VideoPlayer;