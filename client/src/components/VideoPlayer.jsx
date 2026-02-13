import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import './VideoPlayer.css';

// Icono Atrás
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="30px" height="30px">
    <path d="M0 0h24v24H0z" fill="none"/>
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
  </svg>
);

// Iconos Volumen
const VolumeUpIcon = () => <svg viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const VolumeOffIcon = () => <svg viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>;

const VideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // Arrancamos Muted para que Android deje reproducir
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  // --- 1. ROTACIÓN Y PANTALLA ---
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    const lock = async () => {
      if (isNative) {
        try { 
            await ScreenOrientation.lock({ orientation: 'landscape' }); 
            await StatusBar.hide(); 
        } catch(e) { console.warn(e); }
      }
    };
    lock();
    return () => {
      if (isNative) {
        ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => {});
        StatusBar.show().catch(() => {});
      }
    };
  }, []);

  // --- 2. LOGICA REPRODUCCIÓN ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Estrategia Android: Play Muted (Funciona 100%) -> Usuario activa sonido dsp
    const initPlay = async () => {
        try {
            video.muted = true; // Forzamos silencio inicial
            await video.play();
            setPlaying(true);
        } catch (e) {
            console.log("Autoplay falló incluso con mute", e);
        }
    };

    video.addEventListener('loadedmetadata', initPlay);
    video.addEventListener('waiting', () => setLoading(true));
    video.addEventListener('playing', () => setLoading(false));
    video.addEventListener('timeupdate', () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    });

    return () => video.removeEventListener('loadedmetadata', initPlay);
  }, [src]);

  // Manejo de inactividad
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  // Activa sonido y play/pause
  const handleMainAction = () => {
    const video = videoRef.current;
    if (!video) return;

    // Si está muteado (inicio), lo desmuteamos al primer toque
    if (muted) {
        video.muted = false;
        setMuted(false);
        video.volume = 1.0;
        resetControlsTimer();
        return;
    }

    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimer();
    }
  };

  const togglePlay = (e) => {
    e.stopPropagation(); // Evita conflictos
    const video = videoRef.current;

    if (muted) {
      video.muted = false;
      setMuted(false);
      video.volume = 1.0;
    }
    resetControlsTimer();

    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleBack = (e) => {
    e.stopPropagation(); // Importante para que no oculte controles al salir
    if (onClose) onClose();
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    resetControlsTimer();
  };

  const toggleMuteBtn = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="netflix-container" onClick={handleMainAction}>
      
      {/* BOTÓN ATRÁS (Capa Superior) */}
      <div className="netflix-back-circle" onClick={handleBack}>
        <BackIcon />
      </div>

      {/* VIDEO */}
      <video
        ref={videoRef}
        src={src}
        className="netflix-video"
        playsInline={true}
        webkit-playsinline="true"
        muted={true} // Obligatorio para autoplay inicial
      />

      {/* AVISO: TOCAR PARA SONIDO (Si sigue muteado) */}
      {muted && !loading && playing && (
        <div className="netflix-mute-overlay">
            <span>🔊 Toca para activar sonido</span>
        </div>
      )}

      {/* SPINNER ROJO */}
      {loading && (
        <div className="netflix-loader">
          <div className="spinner-red"></div>
        </div>
      )}

      {/* BOTÓN PLAY CENTRAL (Si está pausado) */}
      {!playing && !loading && (
        <div className="netflix-center-play" onClick={togglePlay}>
          <svg viewBox="0 0 24 24" fill="white" width="80px" height="80px">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}

      {/* CONTROLES */}
      <div className={`netflix-controls ${showControls ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        
        <div className="netflix-timeline">
           <input 
             type="range" min="0" max={duration} value={currentTime} onChange={handleSeek}
             style={{ backgroundSize: `${(currentTime / duration) * 100}% 100%` }} 
           />
        </div>

        <div className="netflix-buttons-row">
          <button onClick={togglePlay} className="control-btn">
            {playing ? 
               <svg viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : 
               <svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            }
          </button>
          
          <button onClick={toggleMuteBtn} className="control-btn">
            {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </button>

          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;