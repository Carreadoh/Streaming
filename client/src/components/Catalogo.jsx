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
  { id: 'Crunchyroll', logo: 'https://static.crunchyroll.com/cxweb/assets/img/favicons/favicon-32x32.png' },
  { id: 'Estrenos', logo: 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png' },
];

const Catalogo = () => {
  const [usuario, setUsuario] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('admin@neveus.lat');
  const [password, setPassword] = useState('Fm5Lcj%Va%kJwr');
  const [errorLogin, setErrorLogin] = useState('');
  
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformasSeleccionadas, setPlataformasSeleccionadas] = useState([]);
  const [plataformaActiva, setPlataformaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipoContenido, setTipoContenido] = useState('todo'); // 'todo', 'peliculas', 'series'
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [item, setItem] = useState(null); // Modal Item
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  const btnReproducirRef = useRef(null); // Para foco en TV

  const [favoritos, setFavoritos] = useState(() => JSON.parse(localStorage.getItem('favoritos')) || []);
  const [miLista, setMiLista] = useState(() => JSON.parse(localStorage.getItem('miLista')) || []);

  // --- FUNCIÓN CLAVE PARA ARREGLAR FOTOS ---
  const getImagenUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/500x281?text=No+Image'; // Fallback
    if (path.startsWith('http')) return path; // Si ya es link completo, úsalo
    return `https://image.tmdb.org/t/p/original${path}`; // Si es ruta TMDB, agrégale el prefijo
  };

  // --- GESTIÓN ROBUSTA DEL BOTÓN ATRÁS ---
  const stateRef = useRef({ item, verPeliculaCompleta });
  
  useEffect(() => {
    stateRef.current = { item, verPeliculaCompleta };
  }, [item, verPeliculaCompleta]);

  useEffect(() => {
    let backListener;

    // 1. Listener Nativo de Android (Capacitor) - PRIORIDAD APK
    const setupAppListener = async () => {
      backListener = await App.addListener('backButton', ({ canGoBack }) => {
        const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;
        
        if (verPeliculaCompleta) {
          setVerPeliculaCompleta(false);
        } else if (item) {
          setItem(null);
        } else if (menuAbierto) {
          setMenuAbierto(false);
        } else {
          App.exitApp(); // Solo sale si no hay nada abierto
        }
      });
    };
    setupAppListener();

    // 2. Listener de Teclado (TV / PC)
    const handleKeyDown = (e) => {
      if (['Escape', 'Backspace'].includes(e.key) || e.keyCode === 10009) {
        const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;
        if (item || verPeliculaCompleta || menuAbierto) {
          e.preventDefault();
          if (verPeliculaCompleta) setVerPeliculaCompleta(false);
          else if (item) setItem(null);
          else if (menuAbierto) setMenuAbierto(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      if (backListener) backListener.remove();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

        // Eliminar duplicados por ID
        const unicos = combinados.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);

        setTodosLosItems(unicos);
        filtrar(unicos, null, '', 'todo');
      } catch (e) { console.error(e); }
    };
    cargar();
  }, [usuario]);

  const filtrar = (items, plat, busq, tipo) => {
    const agrupado = {};
    
    // Inicializar grupos únicos para secciones personales
    if (tipo === 'favoritos') agrupado['Favoritos'] = [];
    if (tipo === 'milista') agrupado['Mi Lista'] = [];
    if (tipo === 'buscador') agrupado['Resultados'] = [];

    items.forEach(p => {
      // Filtros de Listas Personales
      if (tipo === 'favoritos' && !favoritos.includes(p.id)) return;
      if (tipo === 'milista' && !miLista.includes(p.id)) return;

      // Filtrar por tipo de contenido
      if (tipo === 'peliculas' && p.tipo !== 'movie') return;
      if (tipo === 'series' && p.tipo !== 'serie') return;
      
      // Filtrar por plataforma
      if (plat && !p.plataforma_origen?.toLowerCase().includes(plat.toLowerCase())) return;
      
      // Filtrar por búsqueda (si hay texto)
      if (busq && !normalizarTexto(p.titulo).includes(normalizarTexto(busq))) return;

      // Agrupación única para Favoritos y Mi Lista (sin géneros)
      if (tipo === 'favoritos') {
        agrupado['Favoritos'].push(p);
        return;
      }
      if (tipo === 'milista') {
        agrupado['Mi Lista'].push(p);
        return;
      }
      if (tipo === 'buscador') {
        agrupado['Resultados'].push(p);
        return;
      }
      if (tipo === 'buscador') {
        agrupado['Resultados'].push(p);
        return;
      }

      const generos = p.generos || ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        agrupado[g].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  // Refrescar vista si cambian favoritos/lista y estamos en esa sección
  useEffect(() => {
    if (tipoContenido === 'favoritos' || tipoContenido === 'milista') {
      filtrar(todosLosItems, plataformaActiva, busqueda, tipoContenido);
    }
  }, [favoritos, miLista]);

  const handleCerrarSesion = () => {
    const auth = getAuth();
    auth.signOut();
    setMenuAbierto(false);
  };

  const handleCambiarTipo = (tipo) => {
    setTipoContenido(tipo);
    if (tipo === 'buscador') {
      setPlataformaActiva(null);
      setBusqueda('');
      filtrar(todosLosItems, null, '', 'buscador');
    } else {
      filtrar(todosLosItems, plataformaActiva, busqueda, tipo);
    }
    setMenuAbierto(false);
  };

  const obtenerUrlVideo = () => {
    if (!item) return '';
    // Lógica Servidor HLS
    const url = `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
    console.log('Video URL:', url);
    console.log('Item:', item);

    // Fallback para testing - video de prueba con CORS
    const testUrl = 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8';
    return testUrl; // Usando video de prueba para testing
  };

  const toggleFavorito = (id) => {
    const nuevos = favoritos.includes(id) 
      ? favoritos.filter(fid => fid !== id) 
      : [...favoritos, id];
    setFavoritos(nuevos);
    localStorage.setItem('favoritos', JSON.stringify(nuevos));
  };

  const toggleMiLista = (id) => {
    const nuevos = miLista.includes(id) 
      ? miLista.filter(lid => lid !== id) 
      : [...miLista, id];
    setMiLista(nuevos);
    localStorage.setItem('miLista', JSON.stringify(nuevos));
  };

  if (loadingAuth) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <img src="/logo.png" alt="Logo" className="login-logo"/>
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
        <button className="menu-btn" onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
        <img src="/logo.png" alt="StreamGo" className="logo-app" onClick={() => handleCambiarTipo('todo')} />
        <button className="search-btn-header" onClick={() => handleCambiarTipo('buscador')}>
          <img src="/assets/icon-buscador.svg" alt="Buscar" />
        </button>
        
        {/* MENÚ LATERAL */}
        {menuAbierto && (
          <>
            <div className="menu-overlay" onClick={() => setMenuAbierto(false)}></div>
            <div className="menu-lateral">
              <div className="menu-header">
                <h2>Menú</h2>
                <button className="btn-cerrar-menu" onClick={() => setMenuAbierto(false)}>✕</button>
              </div>
              <nav className="menu-nav">
                <button 
                  className={`menu-item-btn ${tipoContenido === 'todo' ? 'activo' : ''}`}
                  onClick={() => handleCambiarTipo('todo')}
                >
                  <img src="/assets/icon-inicio.svg" alt="" className="menu-icon-img" /> Inicio
                </button>
                <button 
                  className={`menu-item-btn ${tipoContenido === 'buscador' ? 'activo' : ''}`}
                  onClick={() => handleCambiarTipo('buscador')}
                >
                  <img src="/assets/icon-buscador.svg" alt="" className="menu-icon-img" /> Buscador
                </button>
                <button 
                  className={`menu-item-btn ${tipoContenido === 'peliculas' ? 'activo' : ''}`}
                  onClick={() => handleCambiarTipo('peliculas')}
                >
                  <img src="/assets/icon-peliculas.svg" alt="" className="menu-icon-img" /> Películas
                </button>
                <button 
                  className={`menu-item-btn ${tipoContenido === 'series' ? 'activo' : ''}`}
                  onClick={() => handleCambiarTipo('series')}
                >
                  <img src="/assets/icon-series.svg" alt="" className="menu-icon-img" /> Series
                </button>
                <button 
                  className={`menu-item-btn ${tipoContenido === 'favoritos' ? 'activo' : ''}`}
                  onClick={() => handleCambiarTipo('favoritos')}
                >
                  <img src="/assets/icon-favoritos.svg" alt="" className="menu-icon-img" /> Mis Favoritos
                </button>
                <button 
                  className={`menu-item-btn ${tipoContenido === 'milista' ? 'activo' : ''}`}
                  onClick={() => handleCambiarTipo('milista')}
                >
                  <img src="/assets/icon-milista.svg" alt="" className="menu-icon-img" /> Mi Lista
                </button>
                <button 
                  className="menu-item-btn cerrar-sesion"
                  onClick={handleCerrarSesion}
                >
                  <img src="/assets/icon-cerrar.svg" alt="" className="menu-icon-img" /> Cerrar Sesión
                </button>
              </nav>
            </div>
          </>
        )}
      </header>

      {/* CONTENIDO */}
      <div className="filas-contenido">
        
        {/* FILTROS PLATAFORMAS - DENTRO DEL BODY */}
        {tipoContenido !== 'favoritos' && tipoContenido !== 'milista' && (
          <div className="filtros-container">
          {PLATAFORMAS.map(p => (
            <div
              key={p.id}
              className={`btn-plat img-btn ${plataformaActiva === p.id ? 'activo' : ''}`}
              onClick={() => {
                const nueva = plataformaActiva === p.id ? null : p.id;
                setPlataformaActiva(nueva);
                filtrar(todosLosItems, nueva, busqueda, tipoContenido);
              }}
              tabIndex="0"
            >
              <img src={p.logo} alt={p.id} />
            </div>
          ))}
          </div>
        )}

        {Object.keys(itemsFiltrados).sort().map(g => (
          <Fila 
            key={g} 
            titulo={g} 
            peliculas={itemsFiltrados[g]} 
            onClickPelicula={(p) => setItem(p)} 
          />
        ))}
      </div>

      {/* PANTALLA DE BÚSQUEDA */}
      {tipoContenido === 'buscador' && (
        <div className="search-screen">
          <div className="search-header">
            <button className="btn-back-search" onClick={() => handleCambiarTipo('todo')}>←</button>
            <div className="search-input-wrapper">
              <input 
                type="text" 
                className="search-input-full"
                placeholder="Buscar películas, series..." 
                value={busqueda}
                autoFocus
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  filtrar(todosLosItems, null, e.target.value, 'buscador'); // Usar e.target.value directamente
                }}
              />
              {busqueda && (
                <button className="btn-clear-search" onClick={() => {
                  setBusqueda('');
                  filtrar(todosLosItems, null, '', 'buscador');
                }}>✕</button>
              )}
            </div>
          </div>
          <div className="search-results-grid">
            {itemsFiltrados['Resultados'] && itemsFiltrados['Resultados'].length > 0 ? (
              itemsFiltrados['Resultados'].map(p => (
                <div key={p.id} className="search-card-wrapper" onClick={() => setItem(p)}>
                  <div className="movie-card" style={{ width: '100%' }}>
                    <img src={getImagenUrl(p.imagen_poster)} alt={p.titulo} className="movie-img" loading="lazy" />
                  </div>
                  <span className="search-card-title">{p.titulo}</span>
                </div>
              ))
            ) : (
              <div className="no-results">{busqueda ? "No se encontraron resultados" : "Escribe para buscar..."}</div>
            )}
          </div>
        </div>
      )}

      {/* REPRODUCTOR (TV & CELU) */}
      {verPeliculaCompleta && item && (
        <div className="player-overlay">
          <button className="btn-volver-player" onClick={() => window.history.back()}>← Volver</button>
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
              <button className="btn-cerrar" onClick={() => window.history.back()}>✕</button>
            </div>

            <div className="modal-info">
              <h2>{item.titulo}</h2>
              
              <div className="modal-meta">
                {item.fecha_estreno && <span className="meta-tag">{item.fecha_estreno.split('-')[0]}</span>}
                {item.duracion && <span>{item.duracion} min</span>}
              </div>

              <p className="modal-desc">{item.descripcion || item.overview}</p>

              <div className="modal-actions">
                <button className={`action-btn ${favoritos.includes(item.id) ? 'activo' : ''}`}
                  onClick={() => toggleFavorito(item.id)}
                >
                  <img src="/assets/icon-favoritos.svg" alt="Favorito" />
                  <span>Favorito</span>
                </button>
                <button className={`action-btn ${miLista.includes(item.id) ? 'activo' : ''}`}
                  onClick={() => toggleMiLista(item.id)}
                >
                  <img src="/assets/icon-milista.svg" alt="Mi Lista" />
                  <span>Mi Lista</span>
                </button>
              </div>

              {item.generos && (
                <div className="modal-generos">
                  <span className="text-gray">Géneros: </span>
                  <span>{Array.isArray(item.generos) ? item.generos.join(', ') : item.generos}</span>
                </div>
              )}

              <button 
                ref={btnReproducirRef}
                className="btn-play-detalle"
                onClick={() => setVerPeliculaCompleta(true)}
                tabIndex="0"
              >
                ▶ REPRODUCIR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;