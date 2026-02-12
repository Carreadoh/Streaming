import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { App as CapacitorApp } from '@capacitor/app'; 
import { ScreenOrientation } from '@capacitor/screen-orientation'; 
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; 

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const URL_SERVIDOR = 'https://cine.neveus.lat';

// --- ARREGLO DEL BUSCADOR ---
// Definida fuera para que no de error
const normalizarTexto = (texto) => {
  return texto 
    ? String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() 
    : "";
};

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
  const [tipoContenido, setTipoContenido] = useState('todo'); 
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [item, setItem] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  const btnReproducirRef = useRef(null); 
  const inputBusquedaRef = useRef(null); // Ref para el input del buscador

  const [favoritos, setFavoritos] = useState(() => JSON.parse(localStorage.getItem('favoritos')) || []);
  const [miLista, setMiLista] = useState(() => JSON.parse(localStorage.getItem('miLista')) || []);

  const getImagenUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/500x281?text=No+Image'; 
    if (path.startsWith('http')) return path; 
    return `https://image.tmdb.org/t/p/original${path}`; 
  };

  const stateRef = useRef({ item, verPeliculaCompleta, menuAbierto });
  
  useEffect(() => {
    stateRef.current = { item, verPeliculaCompleta, menuAbierto };
  }, [item, verPeliculaCompleta, menuAbierto]);

  // --- LISTENER BOTÓN ATRÁS ---
  useEffect(() => {
    let backListener;
    const setupAppListener = async () => {
      try {
        backListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;
          
          if (verPeliculaCompleta) {
            setVerPeliculaCompleta(false);
          } else if (item) {
            setItem(null);
          } else if (menuAbierto) {
            setMenuAbierto(false);
          } else {
            CapacitorApp.exitApp(); 
          }
        });
      } catch (e) { console.log("Web mode"); }
    };
    setupAppListener();

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

  // --- FOCO EN TV ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  // --- FOCO EN BUSCADOR ---
  useEffect(() => {
    if (tipoContenido === 'buscador' && inputBusquedaRef.current) {
      setTimeout(() => inputBusquedaRef.current.focus(), 100);
    }
  }, [tipoContenido]);

  // --- ROTACIÓN AUTOMÁTICA ---
  useEffect(() => {
    const rotarPantalla = async () => {
      try {
        if (verPeliculaCompleta) {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        } else {
          await ScreenOrientation.lock({ orientation: 'portrait' });
        }
      } catch (e) {}
    };
    rotarPantalla();
  }, [verPeliculaCompleta]);

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
    const auth = getAuth();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { 
      if (email === 'admin@neveus.lat') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          return;
        } catch (e) {}
      }
      setErrorLogin("Error de credenciales"); 
    }
  };

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      try {
        const pSnap = await getDocs(collection(db, "peliculas"));
        const sSnap = await getDocs(collection(db, "series"));
        
        const combinados = [];
        // UniqueKey para evitar duplicados en listas planas
        pSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'movie', uniqueKey: `m_${d.id}`}));
        sSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'serie', uniqueKey: `s_${d.id}`}));

        // Filtro de IDs duplicados
        const unicos = combinados.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);

        setTodosLosItems(unicos);
        filtrar(unicos, null, '', 'todo');
      } catch (e) { console.error(e); }
    };
    cargar();
  }, [usuario]);

  // --- LÓGICA DE FILTRADO ---
  const filtrar = (items, plat, busq, tipo) => {
    const agrupado = {};
    const busquedaNorm = normalizarTexto(busq);
    const platNorm = plat ? normalizarTexto(plat) : null;
    
    // Inicializar secciones especiales
    if (tipo === 'favoritos') agrupado['Favoritos'] = [];
    if (tipo === 'milista') agrupado['Mi Lista'] = [];
    if (tipo === 'buscador') agrupado['Resultados'] = [];

    items.forEach(p => {
      if (tipo === 'favoritos' && !favoritos.includes(p.id)) return;
      if (tipo === 'milista' && !miLista.includes(p.id)) return;

      if (tipo === 'peliculas' && p.tipo !== 'movie') return;
      if (tipo === 'series' && p.tipo !== 'serie') return;
      
      // Filtro Plataforma
      const pPlat = p.plataforma_origen ? normalizarTexto(p.plataforma_origen) : '';
      if (platNorm && !pPlat.includes(platNorm)) return;
      
      // Filtro Buscador
      const pTitulo = p.titulo ? normalizarTexto(p.titulo) : '';
      if (busquedaNorm && !pTitulo.includes(busquedaNorm)) return;

      // Asignar a secciones planas
      if (tipo === 'favoritos') { agrupado['Favoritos'].push(p); return; }
      if (tipo === 'milista') { agrupado['Mi Lista'].push(p); return; }
      if (tipo === 'buscador') { agrupado['Resultados'].push(p); return; }

      // Asignar a filas por género
      const generos = p.generos || ["General"];
      generos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        if (!agrupado[g].find(existing => existing.id === p.id)) {
            agrupado[g].push(p);
        }
      });
    });
    setItemsFiltrados(agrupado);
  };

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
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
  };

  const toggleFavorito = (id) => {
    const nuevos = favoritos.includes(id) ? favoritos.filter(fid => fid !== id) : [...favoritos, id];
    setFavoritos(nuevos);
    localStorage.setItem('favoritos', JSON.stringify(nuevos));
  };

  const toggleMiLista = (id) => {
    const nuevos = miLista.includes(id) ? miLista.filter(lid => lid !== id) : [...miLista, id];
    setMiLista(nuevos);
    localStorage.setItem('miLista', JSON.stringify(nuevos));
  };

  // --- RENDER ---
  if (loadingAuth) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>;
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
      
      {/* HEADER (Solo se muestra si NO estamos buscando) */}
      {tipoContenido !== 'buscador' && (
        <header className="header-main">
          <button className="menu-btn" onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
          <img src="/logo.png" alt="StreamGo" className="logo-app" onClick={() => handleCambiarTipo('todo')} />
          <button className="search-btn-header" onClick={() => handleCambiarTipo('buscador')}>
            <img src="/assets/icon-buscador.svg" alt="Buscar" />
          </button>
          
          {menuAbierto && (
            <>
              <div className="menu-overlay" onClick={() => setMenuAbierto(false)}></div>
              <div className="menu-lateral">
                <div className="menu-header">
                  <h2>Menú</h2>
                  <button className="btn-cerrar-menu" onClick={() => setMenuAbierto(false)}>✕</button>
                </div>
                <nav className="menu-nav">
                  <button className={`menu-item-btn ${tipoContenido === 'todo' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('todo')}>Inicio</button>
                  <button className={`menu-item-btn ${tipoContenido === 'buscador' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('buscador')}>Buscador</button>
                  <button className={`menu-item-btn ${tipoContenido === 'peliculas' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('peliculas')}>Películas</button>
                  <button className={`menu-item-btn ${tipoContenido === 'series' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('series')}>Series</button>
                  <button className={`menu-item-btn ${tipoContenido === 'favoritos' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('favoritos')}>Mis Favoritos</button>
                  <button className={`menu-item-btn ${tipoContenido === 'milista' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('milista')}>Mi Lista</button>
                  <button className="menu-item-btn cerrar-sesion" onClick={handleCerrarSesion}>Cerrar Sesión</button>
                </nav>
              </div>
            </>
          )}
        </header>
      )}

      <div className="filas-contenido">
        
        {/* PANTALLA DE BÚSQUEDA (Restaurada con flecha y cruz) */}
        {tipoContenido === 'buscador' && (
          <div className="search-screen" style={{ width: '100%', minHeight: '100vh', background: '#141414', zIndex: 999, position: 'relative' }}>
             
             {/* HEADER DEL BUSCADOR */}
             <div className="search-header" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <button 
                 className="btn-back-search" 
                 onClick={() => handleCambiarTipo('todo')}
                 style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}
               >
                 ←
               </button>
               
               <div className="search-input-wrapper" style={{ position: 'relative', flex: 1 }}>
                 <input 
                   ref={inputBusquedaRef}
                   type="text" 
                   placeholder="Buscar película o serie..." 
                   value={busqueda}
                   onChange={(e) => {
                      const val = e.target.value;
                      setBusqueda(val);
                      filtrar(todosLosItems, plataformaActiva, val, 'buscador');
                   }}
                   style={{
                      width: '100%', padding: '12px 40px 12px 20px', borderRadius: '30px',
                      border: 'none', backgroundColor: '#333', color: 'white',
                      fontSize: '16px', outline: 'none'
                   }}
                 />
                 {busqueda && (
                   <button 
                     className="btn-clear-search" 
                     onClick={() => {
                       setBusqueda('');
                       filtrar(todosLosItems, null, '', 'buscador');
                       inputBusquedaRef.current.focus();
                     }}
                     style={{
                       position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                       background: 'none', border: 'none', color: '#999', fontSize: '18px', cursor: 'pointer'
                     }}
                   >
                     ✕
                   </button>
                 )}
               </div>
             </div>
             
             {/* RESULTADOS */}
             <div className="search-results-grid" style={{
                 display: 'grid', 
                 gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                 gap: '15px', 
                 padding: '0 20px 20px 20px'
             }}>
                {itemsFiltrados['Resultados'] && itemsFiltrados['Resultados'].length > 0 ? (
                  itemsFiltrados['Resultados'].map(p => (
                    <div key={p.uniqueKey || p.id} onClick={() => setItem(p)} style={{cursor: 'pointer'}}>
                       <img 
                           src={getImagenUrl(p.imagen_poster)} 
                           alt={p.titulo} 
                           style={{width: '100%', borderRadius: '8px', aspectRatio: '2/3', objectFit: 'cover'}}
                       />
                       <p style={{marginTop: '5px', fontSize: '13px', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                           {p.titulo}
                       </p>
                    </div>
                  ))
                ) : (
                  busqueda.length > 0 && <div style={{gridColumn: '1/-1', textAlign: 'center', color: '#666', marginTop: '20px'}}>No se encontraron resultados</div>
                )}
             </div>
          </div>
        )}

        {tipoContenido !== 'buscador' && (
           <>
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
           </>
        )}
      </div>

      {verPeliculaCompleta && item && (
        <div className="player-overlay">
          <button className="btn-volver-player" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

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