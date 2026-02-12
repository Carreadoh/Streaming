// VideoPlayer.jsx (Versión Definitiva)
import React from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ src }) => {
  return (
    <div className='player-wrapper' style={{ width: '100%', height: '100%', background: 'black' }}>
      <ReactPlayer
        url={src}
        width='100%'
        height='100%'
        controls={true}
        playing={true}
        // Esta línea es clave: fuerza a usar el reproductor nativo del archivo
        config={{ file: { forceVideo: true } }} 
        onError={(e) => console.log("Error:", e)}
      />
    </div>
  );
};
export default VideoPlayer;