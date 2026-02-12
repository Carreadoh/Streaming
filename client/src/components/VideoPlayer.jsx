import React from 'react';

const VideoPlayer = ({ src }) => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* Usamos la etiqueta estándar de HTML5 para probar */}
      <video 
        src={src} 
        controls 
        autoPlay 
        playsInline
        width="100%" 
        height="100%"
        style={{ maxHeight: '100vh' }}
        onError={(e) => console.error("❌ Error nativo:", e.nativeEvent)}
      >
        Tu navegador no soporta este video.
      </video>
    </div>
  );
};

export default VideoPlayer;