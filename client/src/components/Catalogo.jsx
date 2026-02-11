import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; // Usamos el CSS global potente

const URL_SERVIDOR = 'https://cine.neveus.lat'; // Tu servidor de streaming

// Configuración de Plataformas (Iconos)
const PLATAFORMAS = [
  { id: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg' },
  { id: 'Disney', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/5EGT4P4UKRGAZPDR52FKJJW4YU.png' },
  { id: 'Amazon', logo: 'https://play-lh.googleusercontent.com/mZ6pRo5-NnrO9GMwFNrK5kShF0UrN5UOARVAw64_5aFG6NgEHSlq-BX5I8TEXtTOk9s' },
  { id: 'HBO', logo: 'https://frontend-assets.clipsource.com/60dedc6376ad9/hbo-60def166a1502/2024/08/03/66ae50c0ca12f_thumbnail.png' },
];

const Catalogo = () => {
  const [usuario, setUsuario] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformaActiva, setPlataformaActiva] = useState(null);
  
  // Estados de UI
  const [item, setItem] = useState(null); // Peli seleccionada (Modal)
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false); // Reproductor activo
  
  // Referencia para el foco automático en TV
  const btnReproducirRef = useRef(null);

  // --- 1. DETECCIÓN DE TECLA "ATRÁS" (CONTROL REMOTO) ---
  useEffect(() => {
    const handleBack = (e) => {
      // Códigos: Escape (PC), 10009 (Tizen/WebOS Back), 8 (Backspace)
      if (['Escape', 'Backspace'].includes(e.key) || e.keyCode === 10009) {
        if (verPeliculaCompleta) setVerPeliculaCompleta(false);
        else if (item) setItem(null);
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [item, verPeliculaCompleta]);

  // --- 2. FOCO AUTOMÁTICO AL ABRIR MODAL (TV) ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  // --- AUTENTICACIÓN Y CARGA DE DATOS ---
  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setLoadingAuth(false);
    });
  }, []);

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
      if (plat && !p.plataforma_origen?.includes(plat)) return;
      const generos = p.generos || ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        agrupado[g].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  const obtenerUrlVideo = () => {
    // Lógica para tu servidor HLS
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
  };

  if (loadingAuth) return <div className="loading">Cargando...</div>;
  if (!usuario) return <div className="login">Login... (Tu código de login acá)</div>;

  return (
    <div className="catalogo-wrapper">
      
      {/* HEADER: Se adapta solo por CSS */}
      <header className="header-main">
        <img src="/logo.svg" alt="StreamGo" className="logo" />
        
        <div className="filtros-container">
          <button 
            className={`btn-filtro ${!plataformaActiva ? 'activo' : ''}`}
            onClick={() => { setPlataformaActiva(null); filtrarYOrganizar(todosLosItems, null); }}
            tabIndex="0"
          >
            Todo
          </button>
          {PLATAFORMAS.map(p => (
            <button
              key={p.id}
              className={`btn-filtro ${plataformaActiva === p.id ? 'activo' : ''}`}
              onClick={() => { setPlataformaActiva(p.id); filtrarYOrganizar(todosLosItems, p.id); }}
              tabIndex="0"
            >
              {p.id}
            </button>
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

      {/* REPRODUCTOR (FULLSCREEN) */}
      {verPeliculaCompleta && item && (
        <div style={{position:'fixed', inset:0, zIndex:9999, background:'black'}}>
          <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

      {/* MODAL DETALLE */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)} 
             style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
          
          <div className="modal-content" onClick={e => e.stopPropagation()} 
               style={{background:'#1a1a1a', padding:'20px', borderRadius:'10px', maxWidth:'500px', width:'90%'}}>
            
            <h2>{item.titulo}</h2>
            <p>{item.descripcion}</p>
            
            <div style={{marginTop:'20px', display:'flex', gap:'10px'}}>
              <button 
                ref={btnReproducirRef} /* EL FOCO CAE ACÁ EN TV */
                className="btn-accion" 
                onClick={() => setVerPeliculaCompleta(true)}
                style={{padding:'10px 20px', background:'red', color:'white', border:'none', fontSize:'16px', cursor:'pointer'}}
                tabIndex="0"
              >
                ▶ Reproducir
              </button>
              <button 
                onClick={() => setItem(null)}
                style={{padding:'10px 20px', background:'#333', color:'white', border:'none', fontSize:'16px', cursor:'pointer'}}
                tabIndex="0"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;