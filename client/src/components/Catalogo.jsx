import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; // Usamos el CSS global

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const URL_SERVIDOR = 'https://cine.neveus.lat';

// Logos de plataformas
const PLATAFORMAS = [
  { id: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg' },
  { id: 'Disney', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/5EGT4P4UKRGAZPDR52FKJJW4YU.png' },
  { id: 'Amazon', logo: 'https://play-lh.googleusercontent.com/mZ6pRo5-NnrO9GMwFNrK5kShF0UrN5UOARVAw64_5aFG6NgEHSlq-BX5I8TEXtTOk9s' },
  { id: 'HBO', logo: 'https://frontend-assets.clipsource.com/60dedc6376ad9/hbo-60def166a1502/2024/08/03/66ae50c0ca12f_thumbnail.png' },
  { id: 'Paramount', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/FWS265CNEJEQHF53MCJQ3QR2PA.jpg' },
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
  const [busqueda, setBusqueda] = useState('');
  
  const [item, setItem] = useState(null); // Modal Item
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  const btnReproducirRef = useRef(null); // Para foco en TV

  // --- FUNCIÓN CLAVE PARA ARREGLAR FOTOS ---
  const getImagenUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/500x281?text=No+Image'; // Fallback
    if (path.startsWith('http')) return path; // Si ya es link completo, úsalo
    return `https://image.tmdb.org/t/p/original${path}`; // Si es ruta TMDB, agrégale el prefijo
  };

  // --- DETECCIÓN DE BOTÓN "ATRÁS" (CONTROL REMOTO) ---
  useEffect(() => {
    const handleBack = (e) => {
      // 10009 es el código "Back" en Tizen/WebOS/AndroidTV
      if (['Escape', 'Backspace'].includes(e.key) || e.keyCode === 10009) {
        if (verPeliculaCompleta) setVerPeliculaCompleta(false);
        else if (item) setItem(null);
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [item, verPeliculaCompleta]);

  // --- FOCO AUTOMÁTICO EN TV ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  // --- AUTH ---
  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setLoadingAuth(false);
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin('');
    try { await signInWithEmailAndPassword(getAuth(), email, password); } 
    catch (error) { setErrorLogin("Error de credenciales"); }
  };

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      try {
        // Carga Pelis
        const pSnap = await getDocs(collection(db, "peliculas"));
        // Carga Series (si tienes)
        const sSnap = await getDocs(collection(db, "series"));
        
        const combinados = [];
        pSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'movie'}));
        sSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'serie'}));

        setTodosLosItems(combinados);
        filtrar(combinados, null, '');
      } catch (e) { console.error(e); }
    };
    cargar();
  }, [usuario]);

  const filtrar = (items, plat, busq) => {
    const agrupado = {};
    items.forEach(p => {
      if (plat && !p.plataforma_origen?.toLowerCase().includes(plat.toLowerCase())) return;
      if (busq && !p.titulo?.toLowerCase().includes(busq.toLowerCase())) return;

      const generos = p.generos || ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        agrupado[g].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  const obtenerUrlVideo = () => {
    if (!item) return '';
    // Lógica Servidor HLS
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
  };

  if (loadingAuth) return <div className="loading">Cargando...</div>;

  if (!usuario) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <img src="/logo.svg" alt="Logo" className="login-logo"/>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus/>
          <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/>
          {errorLogin && <p className="error">{errorLogin}</p>}
          <button type="submit">Ingresar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="catalogo-wrapper">
      
      {/* HEADER */}
      <header className="header-main">
        <img src="/logo.svg" alt="StreamGo" className="logo-app" onClick={() => window.location.reload()} />
        
        {/* FILTROS PLATAFORMAS */}
        <div className="filtros-container">
          <div
            className={`btn-plat text-btn ${!plataformaActiva ? 'activo' : ''}`}
            onClick={() => { setPlataformaActiva(null); filtrar(todosLosItems, null, busqueda); }}
            tabIndex="0"
          >
            TODO
          </div>
          {PLATAFORMAS.map(p => (
            <div
              key={p.id}
              className={`btn-plat img-btn ${plataformaActiva === p.id ? 'activo' : ''}`}
              onClick={() => {
                const nueva = plataformaActiva === p.id ? null : p.id;
                setPlataformaActiva(nueva);
                filtrar(todosLosItems, nueva, busqueda);
              }}
              tabIndex="0"
            >
              <img src={p.logo} alt={p.id} />
            </div>
          ))}
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Buscar películas o series..."
            value={busqueda}
            onChange={(e) => {
              const nuevaBusqueda = e.target.value;
              setBusqueda(nuevaBusqueda);
              filtrar(todosLosItems, plataformaActiva, nuevaBusqueda);
            }}
            className="search-input"
            tabIndex="0"
          />
        </div>
      </header>

      {/* CONTENIDO */}
      <div className="filas-contenido">
        {Object.keys(itemsFiltrados).sort().map(g => (
          <Fila 
            key={g} 
            titulo={g} 
            peliculas={itemsFiltrados[g]} 
            onClickPelicula={(p) => setItem(p)} 
          />
        ))}
      </div>

      {/* REPRODUCTOR (TV & CELU) */}
      {verPeliculaCompleta && item && (
        <div className="player-overlay">
          <button className="btn-volver-player" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

      {/* MODAL DETALLE (Corrección de banner aquí) */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            {/* BANNER CON FUNCIÓN CORRECTIVA */}
            <div 
              className="modal-banner" 
              style={{ backgroundImage: `url(${getImagenUrl(item.imagen_fondo || item.backdrop_path || item.poster_path)})` }}
            >
              <button className="btn-cerrar" onClick={() => setItem(null)}>✕</button>
              
              {/* Botón Play sobre la imagen (Estilo Netflix) */}
              <button 
                ref={btnReproducirRef}
                className="btn-play-banner"
                onClick={() => setVerPeliculaCompleta(true)}
                tabIndex="0"
              >
                ▶ REPRODUCIR
              </button>
            </div>

            <div className="modal-info">
              <h2>{item.titulo}</h2>
              <p className="modal-desc">{item.descripcion || item.overview}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;