import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { App } from '@capacitor/app';
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
  { id: 'Crunchyroll', logo: 'https://static.crunchyroll.com/cxweb/assets/img/favicons/favicon-32x32.png' },
  { id: 'Estrenos', logo: 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png' },
];

const Catalogo = () => {
  // --- ESTADO Y REFERENCIAS ---
  // Eliminamos usuario, loadingAuth, email, password, errorLogin

  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformasSeleccionadas, setPlataformasSeleccionadas] = useState([]);
  const [plataformaActiva, setPlataformaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipoContenido, setTipoContenido] = useState('todo'); 
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [item, setItem] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  const btnReproducirRef = useRef(null); 

  const [favoritos, setFavoritos] = useState(() => JSON.parse(localStorage.getItem('favoritos')) || []);
  const [miLista, setMiLista] = useState(() => JSON.parse(localStorage.getItem('miLista')) || []);

  const getImagenUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/500x281?text=No+Image';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/original${path}`;
  };

  // --- GESTIÓN DEL BOTÓN ATRÁS (NATIVO ANDROID + TV) ---
  const stateRef = useRef({ item, verPeliculaCompleta, menuAbierto });
  
  useEffect(() => {
    stateRef.current = { item, verPeliculaCompleta, menuAbierto };
  }, [item, verPeliculaCompleta, menuAbierto]);

  useEffect(() => {
    // A. Listener Nativo de Android (Capacitor)
    const setupAppListener = async () => {
        const listener = await App.addListener('backButton', ({ canGoBack }) => {
            const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;

            if (verPeliculaCompleta) {
                setVerPeliculaCompleta(false); // Cierra video
            } else if (item) {
                setItem(null); // Cierra modal detalle
            } else if (menuAbierto) {
                setMenuAbierto(false); // Cierra menú lateral
            } else {
                App.exitApp(); // Si no hay nada abierto, sale de la app
            }
        });
        return listener;
    };

    // B. Listener de Teclado (Para TV - Control Remoto)
    const handleTVBack = (event) => {
        if (['Escape', 'Backspace'].includes(event.key) || event.keyCode === 10009) {
            const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;
            if (verPeliculaCompleta) setVerPeliculaCompleta(false);
            else if (item) setItem(null);
            else if (menuAbierto) setMenuAbierto(false);
        }
    };

    const backListenerPromise = setupAppListener();
    window.addEventListener('keydown', handleTVBack);

    return () => {
        backListenerPromise.then(listener => listener.remove());
        window.removeEventListener('keydown', handleTVBack);
    };
  }, []);

  // --- FOCO AUTOMÁTICO EN TV ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  // --- CARGA DE DATOS (YA NO DEPENDE DE USUARIO) ---
  useEffect(() => {
    // Eliminamos la verificación if (!usuario) return;
    const cargar = async () => {
      try {
        const pSnap = await getDocs(collection(db, "peliculas"));
        const sSnap = await getDocs(collection(db, "series"));
        
        const combinados = [];
        pSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'movie'}));
        sSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'serie'}));

        setTodosLosItems(combinados);
        filtrar(combinados, null, '', 'todo');
      } catch (e) { console.error(e); }
    };
    cargar();
  }, []); // Dependencias vacías ahora

  const filtrar = (items, plat, busq, tipo) => {
    const agrupado = {};
    if (tipo === 'favoritos') agrupado['Favoritos'] = [];
    if (tipo === 'milista') agrupado['Mi Lista'] = [];

    items.forEach(p => {
      if (tipo === 'favoritos' && !favoritos.includes(p.id)) return;
      if (tipo === 'milista' && !miLista.includes(p.id)) return;
      if (tipo === 'peliculas' && p.tipo !== 'movie') return;
      if (tipo === 'series' && p.tipo !== 'serie') return;
      if (plat && !p.plataforma_origen?.toLowerCase().includes(plat.toLowerCase())) return;
      if (busq && !p.titulo?.toLowerCase().includes(busq.toLowerCase())) return;

      if (tipo === 'favoritos') { agrupado['Favoritos'].push(p); return; }
      if (tipo === 'milista') { agrupado['Mi Lista'].push(p); return; }

      const generos = p.generos || ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        agrupado[g].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  useEffect(() => {
    if (tipoContenido === 'favoritos' || tipoContenido === 'milista') {
      filtrar(todosLosItems, plataformaActiva, busqueda, tipoContenido);
    }
  }, [favoritos, miLista]);

  // handleCerrarSesion eliminado

  const handleCambiarTipo = (tipo) => {
    setTipoContenido(tipo);
    setMenuAbierto(false);
    filtrar(todosLosItems, plataformaActiva, busqueda, tipo);
  };

  const obtenerUrlVideo = () => {
    if (!item) return '';
    const url = `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
    return url;
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

  // Eliminamos los bloques de loadingAuth y !usuario (login)

  return (
    <div className="catalogo-wrapper">
      
      <header className="header-main">
        <button className="menu-btn" onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
        <img src="/logo.svg" alt="StreamGo" className="logo-app" onClick={() => handleCambiarTipo('todo')} />
        
        {menuAbierto && (
          <>
            <div className="menu-overlay" onClick={() => setMenuAbierto(false)}></div>
            <div className="menu-lateral">
              <div className="menu-header">
                <h2>Menú</h2>
                <button className="btn-cerrar-menu" onClick={() => setMenuAbierto(false)}>✕</button>
              </div>
              <nav className="menu-nav">
                <button className={`menu-item-btn ${tipoContenido === 'todo' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('todo')}>
                  <img src="/assets/icon-inicio.svg" alt="" className="menu-icon-img" /> Inicio
                </button>
                <button className={`menu-item-btn ${tipoContenido === 'buscador' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('buscador')}>
                  <img src="/assets/icon-buscador.svg" alt="" className="menu-icon-img" /> Buscador
                </button>
                <button className={`menu-item-btn ${tipoContenido === 'peliculas' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('peliculas')}>
                  <img src="/assets/icon-peliculas.svg" alt="" className="menu-icon-img" /> Películas
                </button>
                <button className={`menu-item-btn ${tipoContenido === 'series' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('series')}>
                  <img src="/assets/icon-series.svg" alt="" className="menu-icon-img" /> Series
                </button>
                <button className={`menu-item-btn ${tipoContenido === 'favoritos' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('favoritos')}>
                  <img src="/assets/icon-favoritos.svg" alt="" className="menu-icon-img" /> Mis Favoritos
                </button>
                <button className={`menu-item-btn ${tipoContenido === 'milista' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('milista')}>
                  <img src="/assets/icon-milista.svg" alt="" className="menu-icon-img" /> Mi Lista
                </button>
                {/* Botón Cerrar Sesión eliminado */}
              </nav>
            </div>
          </>
        )}
      </header>

      <div className="filas-contenido">
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
          <Fila key={g} titulo={g} peliculas={itemsFiltrados[g]} onClickPelicula={(p) => setItem(p)} />
        ))}
      </div>

      {/* REPRODUCTOR */}
      {verPeliculaCompleta && item && (
        <div className="player-overlay">
          <button className="btn-volver-player" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

      {/* MODAL DETALLE */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-banner" style={{ backgroundImage: `url(${getImagenUrl(item.imagen_fondo || item.backdrop_path || item.poster_path)})` }}>
              <button className="btn-cerrar" onClick={() => setItem(null)}>✕</button>
            </div>

            <div className="modal-info">
              <h2>{item.titulo}</h2>
              <div className="modal-meta">
                {item.fecha_estreno && <span className="meta-tag">{item.fecha_estreno.split('-')[0]}</span>}
                {item.duracion && <span>{item.duracion} min</span>}
              </div>
              <p className="modal-desc">{item.descripcion || item.overview}</p>

              <div className="modal-actions">
                <button className={`action-btn ${favoritos.includes(item.id) ? 'activo' : ''}`} onClick={() => toggleFavorito(item.id)}>
                  <img src="/assets/icon-favoritos.svg" alt="Favorito" />
                  <span>Favorito</span>
                </button>
                <button className={`action-btn ${miLista.includes(item.id) ? 'activo' : ''}`} onClick={() => toggleMiLista(item.id)}>
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

              <button ref={btnReproducirRef} className="btn-play-detalle" onClick={() => setVerPeliculaCompleta(true)} tabIndex="0">
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