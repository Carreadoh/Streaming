import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import './Catalogo.css'; // Asegúrate de tener el CSS que te pasé antes

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const URL_SERVIDOR = 'https://cine.neveus.lat';

// Iconos simplificados para TV
const PLATAFORMAS = [
  { id: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg' },
  { id: 'Disney', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/5EGT4P4UKRGAZPDR52FKJJW4YU.png' },
  { id: 'Amazon', logo: 'https://play-lh.googleusercontent.com/mZ6pRo5-NnrO9GMwFNrK5kShF0UrN5UOARVAw64_5aFG6NgEHSlq-BX5I8TEXtTOk9s' },
  { id: 'HBO', logo: 'https://frontend-assets.clipsource.com/60dedc6376ad9/hbo-60def166a1502/2024/08/03/66ae50c0ca12f_thumbnail.png' },
];

const Catalogo = () => {
  const [usuario, setUsuario] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformaActiva, setPlataformaActiva] = useState(null); 
  const [tipoSeleccionado, setTipoSeleccionado] = useState('todo'); 
  const [busqueda, setBusqueda] = useState('');
  
  const [item, setItem] = useState(null); 
  const [trailerKey, setTrailerKey] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  
  const [numTemporadas, setNumTemporadas] = useState([]); 
  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState(1);
  const [episodios, setEpisodios] = useState([]); 
  const [capituloActual, setCapituloActual] = useState({ temp: 1, cap: 1 }); 

  // Referencia para el botón reproducir (Foco automático en TV)
  const btnReproducirRef = useRef(null);

  // --- 1. DETECCIÓN DE BOTÓN "ATRÁS" (CONTROL REMOTO) ---
  useEffect(() => {
    const handleBackBtn = (e) => {
      // KeyCode 10009 es "Back" en Tizen/WebOS, 27 es ESC, 8 es Backspace
      if (e.key === 'Escape' || e.keyCode === 10009 || e.key === 'Backspace') {
        if (verPeliculaCompleta) {
          setVerPeliculaCompleta(false);
        } else if (item) {
          setItem(null);
        }
      }
    };
    window.addEventListener('keydown', handleBackBtn);
    return () => window.removeEventListener('keydown', handleBackBtn);
  }, [item, verPeliculaCompleta]);

  // --- 2. FOCO AUTOMÁTICO AL ABRIR MODAL ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      // Pequeño delay para asegurar que el DOM cargó
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  // --- SESIÓN Y DATOS ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
         setUsuario(user);
         // Aquí iría tu lógica de validación de fecha, simplificada para el ejemplo
      } else { setUsuario(null); }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin('');
    try { await signInWithEmailAndPassword(getAuth(), email, password); } 
    catch (error) { setErrorLogin("Error de acceso."); }
  };

  useEffect(() => {
    if (!usuario) return;
    const obtenerDatos = async () => {
      try {
        const pelisSnap = await getDocs(collection(db, "peliculas"));
        const seriesSnap = await getDocs(collection(db, "series"));
        const mapaItems = new Map();
        [...pelisSnap.docs, ...seriesSnap.docs].forEach(doc => {
          const data = doc.data();
          mapaItems.set(data.id_tmdb, { id: doc.id, ...data });
        });
        const dataUnica = Array.from(mapaItems.values());
        setTodosLosItems(dataUnica);
        organizarPorGeneros(dataUnica, null, '', 'todo'); 
      } catch (e) { console.error(e); }
    };
    obtenerDatos();
  }, [usuario]);

  const organizarPorGeneros = (items, filtroPlat, busq, tipo) => {
    const agrupado = {};
    items.forEach(p => {
      if (p.disponible_servidor !== true) return; 
      if (busq && !(p.titulo || "").toLowerCase().includes(busq.toLowerCase())) return;
      if (tipo !== 'todo' && p.tipo !== tipo) return;
      if (filtroPlat && !p.plataforma_origen?.toLowerCase().includes(filtroPlat.toLowerCase())) return;

      const generos = Array.isArray(p.generos) && p.generos.length > 0 ? p.generos : ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        agrupado[g].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  const abrirModal = (p) => { 
    setItem(p); setVerPeliculaCompleta(false);
    // Lógica trailers y series (simplificada)
    if (p.tipo === 'serie') { 
        // Tu lógica de cargar temporadas...
        setNumTemporadas([1]); cargarEpisodios(p.id_tmdb, 1);
    }
  };

  const obtenerUrlVideo = () => {
    if (!item) return '';
    if (item.tipo === 'serie') {
      // Tu lógica de series...
      return `${URL_SERVIDOR}/series/${item.id_tmdb}/S${capituloActual.temp}E${capituloActual.cap}.mp4`; 
    }
    // HLS AUTOMÁTICO
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
  };

  // --- VISTAS ---
  if (loadingAuth) return <div className="loading">Cargando...</div>;

  if (!usuario) {
    return (
      <div className="login-premium-bg">
        <form onSubmit={handleLogin} className="login-card">
          <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          <input type="password" placeholder="Pass" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="catalogo-container">
      {/* HEADER SIMPLIFICADO PARA TV */}
      <header className="header-tv">
        <img src="/logo.svg" alt="Logo" className="logo-tv" />
        <div className="filtros-tv">
          {PLATAFORMAS.map(p => (
            <button 
              key={p.id} 
              className={`btn-plat-tv ${plataformaActiva === p.id ? 'active' : ''}`}
              onClick={() => {
                 const nueva = plataformaActiva === p.id ? null : p.id;
                 setPlataformaActiva(nueva);
                 organizarPorGeneros(todosLosItems, nueva, busqueda, tipoSeleccionado);
              }}
              tabIndex="0" // Foco
            >
              <img src={p.logo} alt={p.id} />
            </button>
          ))}
        </div>
      </header>

      {/* FILAS (Usando el Fila.jsx que te pasé antes) */}
      <div className="filas-wrapper">
        {Object.keys(itemsFiltrados).sort().map(g => (
           <Fila key={g} titulo={g} peliculas={itemsFiltrados[g]} onClickPelicula={abrirModal} />
        ))}
      </div>

      {/* REPRODUCTOR FULLSCREEN (Sin botón salir flotante, usa tecla Atrás) */}
      {verPeliculaCompleta && item && (
        <div className="player-fullscreen-tv">
           <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

      {/* MODAL DETALLE (ESTILO NETFLIX) */}
      {item && !verPeliculaCompleta && (
        <div className="modal-tv-overlay" onClick={() => setItem(null)}>
          <div className="modal-tv-content" onClick={e => e.stopPropagation()}>
            <div className="modal-tv-left">
                <h2>{item.titulo}</h2>
                <p>{item.descripcion}</p>
                <div className="modal-tv-actions">
                    <button 
                        ref={btnReproducirRef} // FOCO INICIAL AQUÍ
                        className="btn-play-tv" 
                        onClick={() => setVerPeliculaCompleta(true)}
                        tabIndex="0"
                    >
                        ▶ Reproducir
                    </button>
                    <button className="btn-close-tv" onClick={() => setItem(null)} tabIndex="0">
                        Cerrar
                    </button>
                </div>
            </div>
            <div className="modal-tv-right" style={{backgroundImage: `url(${item.imagen_fondo || item.poster_path})`}}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;