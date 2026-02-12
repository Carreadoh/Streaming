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
        controls={true} // Muestra los controles nativos
        playing={true}  // Autoplay
        config={{
          file: {
            forceHLS: true, // Forzamos que detecte que es un m3u8
            attributes: {
              crossOrigin: "anonymous", // Ayuda con problemas de permisos (CORS)
              disablePictureInPicture: false,
            },
            hlsOptions: {
              // Esto ayuda si el video tiene errores leves de codificación
              enableWorker: true,
              lowLatencyMode: true,
            }
          }
        }}
        onError={(e) => console.log("Error del reproductor:", e)}
      />
    </div>
  );
};

export default VideoPlayer;