import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; 

const URL_SERVIDOR = 'https://cine.neveus.lat'; 

const PLATAFORMAS = [
  { id: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg' },
  { id: 'Disney', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/5EGT4P4UKRGAZPDR52FKJJW4YU.png' },
  { id: 'Amazon', logo: 'https://play-lh.googleusercontent.com/mZ6pRo5-NnrO9GMwFNrK5kShF0UrN5UOARVAw64_5aFG6NgEHSlq-BX5I8TEXtTOk9s' },
  { id: 'HBO', logo: 'https://frontend-assets.clipsource.com/60dedc6376ad9/hbo-60def166a1502/2024/08/03/66ae50c0ca12f_thumbnail.png' },
  { id: 'Paramount', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/FWS265CNEJEQHF53MCJQ3QR2PA.jpg' },
  { id: 'Apple', logo: 'https://i.blogs.es/a1d8ea/apple-tv/1200_900.jpeg' },
];

const Catalogo = () => {
  const [usuario, setUsuario] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformaActiva, setPlataformaActiva] = useState(null);
  
  // Estados UI
  const [item, setItem] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false); 
  
  const btnReproducirRef = useRef(null);

  // --- HELPER PARA IMÁGENES (CORRECCIÓN) ---
  const getImagenUrl = (path) => {
    if (!path) return '/no-banner.jpg'; // Imagen por defecto si no hay nada
    if (path.startsWith('http')) return path; // Si ya es link completo, usarlo
    return `https://image.tmdb.org/t/p/original${path}`; // Si es de TMDB, agregar prefijo
  };

  // --- CONTROL REMOTO (BACK BUTTON) ---
  useEffect(() => {
    const handleBack = (e) => {
      if (['Escape', 'Backspace'].includes(e.key) || e.keyCode === 10009) {
        if (verPeliculaCompleta) setVerPeliculaCompleta(false);
        else if (item) setItem(null);
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [item, verPeliculaCompleta]);

  // --- FOCO AUTOMÁTICO EN MODAL (TV) ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setLoadingAuth(false);
    });
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!usuario) return;
    const cargarContenido = async () => {
      try {
        const pSnapshot = await getDocs(collection(db, "peliculas"));
        const data = pSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTodosLosItems(data);
        filtrarYOrganizar(data, null);
      } catch (e) { console.error(e); }
    };
    cargarContenido();
  }, [usuario]);

  const filtrarYOrganizar = (items, plat) => {
    const agrupado = {};
    items.forEach(p => {
      // Filtro flexible: si la peli dice "Netflix" y el filtro es "Netflix", pasa.
      if (plat && !p.plataforma_origen?.toLowerCase().includes(plat.toLowerCase())) return;
      
      const generos = p.generos || ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        agrupado[g].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  const obtenerUrlVideo = () => {
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
  };

  if (loadingAuth) return <div className="loading">Cargando...</div>;
  
  // LOGIN SIMPLE (Mantenemos tu lógica o diseño de login aquí)
  if (!usuario) return <div className="login-screen">Inicia sesión...</div>; 

  return (
    <div className="catalogo-wrapper">
      
      {/* HEADER: LOGO + FILTROS DE PLATAFORMAS (IMÁGENES) */}
      <header className="header-main">
        <img src="/logo.svg" alt="StreamGo" className="logo-app" />
        
        <div className="filtros-plataformas">
          {/* Botón "TODO" */}
          <button 
            className={`btn-plat-item text-btn ${!plataformaActiva ? 'activo' : ''}`}
            onClick={() => { setPlataformaActiva(null); filtrarYOrganizar(todosLosItems, null); }}
            tabIndex="0"
          >
            TODO
          </button>

          {/* Botones de Logos */}
          {PLATAFORMAS.map(p => (
            <div 
              key={p.id}
              className={`btn-plat-item img-btn ${plataformaActiva === p.id ? 'activo' : ''}`}
              onClick={() => { 
                  const nueva = plataformaActiva === p.id ? null : p.id;
                  setPlataformaActiva(nueva); 
                  filtrarYOrganizar(todosLosItems, nueva); 
              }}
              tabIndex="0" // Foco para TV
              role="button"
            >
              <img src={p.logo} alt={p.id} />
            </div>
          ))}
        </div>
      </header>

      {/* LISTA DE FILAS */}
      <div className="contenido-principal">
        {Object.keys(itemsFiltrados).sort().map(genero => (
          <Fila 
            key={genero} 
            titulo={genero} 
            peliculas={itemsFiltrados[genero]} 
            onClickPelicula={(p) => setItem(p)}
          />
        ))}
      </div>

      {/* REPRODUCTOR FULLSCREEN */}
      {verPeliculaCompleta && item && (
        <div className="player-overlay">
          <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

      {/* MODAL DETALLE (CORREGIDO IMAGEN FONDO) */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            {/* IMAGEN DE FONDO (BANNER) */}
            <div 
                className="modal-banner"
                style={{
                    backgroundImage: `url(${getImagenUrl(item.imagen_fondo || item.backdrop_path || item.poster_path)})`
                }}
            >
                <button className="btn-cerrar-modal" onClick={() => setItem(null)}>✕</button>
            </div>

            <div className="modal-info">
                <h2>{item.titulo}</h2>
                <p className="modal-desc">{item.descripcion}</p>
                
                <div className="modal-actions">
                <button 
                    ref={btnReproducirRef} 
                    className="btn-play" 
                    onClick={() => setVerPeliculaCompleta(true)}
                    tabIndex="0"
                >
                    ▶ REPRODUCIR
                </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;