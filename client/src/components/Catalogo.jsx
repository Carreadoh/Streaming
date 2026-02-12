import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { App as CapacitorApp } from '@capacitor/app'; 
import { ScreenOrientation } from '@capacitor/screen-orientation'; 
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; 

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const URL_SERVIDOR = 'https://cine.neveus.lat';

// Función segura fuera del componente
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
  { id: 'Crunchyroll', logo: 'https://m.media-amazon.com/images/I/41o03HyOYlL.png' },
  { id: 'Estrenos', logo: 'https://img.freepik.com/vector-premium/te-leche-boba-palomitas-maiz-dibujos-animados-gafas-pelicula_123553-304.jpg' },
];

const Catalogo = () => {
  const [usuario, setUsuario] = useState(null);
  const [infoUsuario, setInfoUsuario] = useState(null); 
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
  const inputBusquedaRef = useRef(null);

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

  // --- BOTÓN ATRÁS ---
  useEffect(() => {
    let backListener;
    const setupAppListener = async () => {
      try {
        backListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;
          if (verPeliculaCompleta) setVerPeliculaCompleta(false);
          else if (item) setItem(null);
          else if (menuAbierto) setMenuAbierto(false);
          else CapacitorApp.exitApp(); 
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

  // --- FOCO ---
  useEffect(() => {
    if (item && !verPeliculaCompleta && btnReproducirRef.current) {
      setTimeout(() => btnReproducirRef.current.focus(), 100);
    }
  }, [item, verPeliculaCompleta]);

  useEffect(() => {
    if (tipoContenido === 'buscador' && inputBusquedaRef.current) {
      setTimeout(() => inputBusquedaRef.current.focus(), 100);
    }
  }, [tipoContenido]);

  // --- ROTACIÓN ---
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

  // --- AUTH & INFO ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUsuario(user);
      if (user) {
        try {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setInfoUsuario(docSnap.data());
            }
        } catch (e) { console.error("Error info usuario", e); }
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
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

  // --- CARGA ---
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      try {
        const pSnap = await getDocs(collection(db, "peliculas"));
        const sSnap = await getDocs(collection(db, "series"));
        const combinados = [];
        pSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'movie', uniqueKey: `m_${d.id}`}));
        sSnap.forEach(d => combinados.push({id: d.id, ...d.data(), tipo: 'serie', uniqueKey: `s_${d.id}`}));
        
        // FILTRO ESTRICTO DE DUPLICADOS POR ID
        const unicos = combinados.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);
        
        setTodosLosItems(unicos);
        filtrar(unicos, null, '', 'todo');
      } catch (e) { console.error(e); }
    };
    cargar();
  }, [usuario]);

  // --- FILTRO ---
  const filtrar = (items, plat, busq, tipo) => {
    const agrupado = {};
    const busquedaNorm = normalizarTexto(busq);
    const platNorm = plat ? normalizarTexto(plat) : null;
    
    if (tipo === 'favoritos') agrupado['Favoritos'] = [];
    if (tipo === 'milista') agrupado['Mi Lista'] = [];
    if (tipo === 'buscador') agrupado['Resultados'] = [];

    items.forEach(p => {
      if (tipo === 'favoritos' && !favoritos.includes(p.id)) return;
      if (tipo === 'milista' && !miLista.includes(p.id)) return;
      if (tipo === 'cuenta') return;

      if (tipo === 'peliculas' && p.tipo !== 'movie') return;
      if (tipo === 'series' && p.tipo !== 'serie') return;
      
      const pPlat = p.plataforma_origen ? normalizarTexto(p.plataforma_origen) : '';
      if (platNorm && !pPlat.includes(platNorm)) return;
      
      const pTitulo = p.titulo ? normalizarTexto(p.titulo) : '';
      if (busquedaNorm && !pTitulo.includes(busquedaNorm)) return;

      if (tipo === 'favoritos') { agrupado['Favoritos'].push(p); return; }
      if (tipo === 'milista') { agrupado['Mi Lista'].push(p); return; }
      if (tipo === 'buscador') { agrupado['Resultados'].push(p); return; }

      // AQUÍ ESTABA EL ERROR DE DUPLICADOS:
      // Usamos Set para asegurar que no haya géneros repetidos en la misma película
      const generosUnicos = [...new Set(p.generos || ["General"])];
      
      generosUnicos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        // Verificación extra de seguridad
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
    } else if (tipo === 'cuenta') {
       setMenuAbierto(false);
    } else {
      filtrar(todosLosItems, plataformaActiva, busqueda, tipo);
    }
    setMenuAbierto(false);
  };

  const obtenerUrlVideo = () => {
    if (!item) return '';
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}.mp4`;
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

  if (loadingAuth) return <div className="loading-container"><div className="loading-spinner"></div></div>;

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
    <div className="catalogo-wrapper" style={{ backgroundColor: '#000', minHeight: '100vh', color: 'white' }}>
      
      {/* HEADER MÁS GRANDE */}
      {tipoContenido !== 'buscador' && (
        <header className="header-main" style={{ 
          backgroundColor: '#000', 
          borderBottom: '1px solid #111', 
          zIndex: 1000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 15px',
          paddingTop: 'env(safe-area-inset-top)', 
          // AUMENTADO DE 80px A 90px
          height: 'calc(90px + env(safe-area-inset-top))', 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0
        }}>
          
          <div style={{ width: '40px' }}>
            <button className="menu-btn" onClick={() => setMenuAbierto(!menuAbierto)} style={{ color: 'white', fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>☰</button>
          </div>
          
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img 
              src="/logo.png" 
              alt="StreamGo" 
              onClick={() => handleCambiarTipo('todo')} 
              // AUMENTADO A 80px
              style={{ height: '80px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer' }} 
            />
          </div>
          
          <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="search-btn-header" onClick={() => handleCambiarTipo('buscador')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <img src="/assets/icon-buscador.svg" alt="Buscar" style={{ width: '24px', height: '24px' }} />
            </button>
          </div>
          
          {menuAbierto && (
            <>
              <div className="menu-overlay" onClick={() => setMenuAbierto(false)}></div>
              <div className="menu-lateral" style={{ backgroundColor: '#000', paddingTop: 'env(safe-area-inset-top)' }}>
                <div className="menu-header" style={{ borderBottom: '1px solid #222' }}>
                  <h2>Menú</h2>
                  <button className="btn-cerrar-menu" onClick={() => setMenuAbierto(false)}>✕</button>
                </div>
                <nav className="menu-nav">
                  <button className={`menu-item-btn ${tipoContenido === 'todo' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('todo')}>
                    <img src="/assets/icon-inicio.svg" alt="" className="menu-icon-img" /> Inicio
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
                  <button className={`menu-item-btn ${tipoContenido === 'cuenta' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('cuenta')}>
                    <img src="/assets/icon-cuenta.svg" alt="" className="menu-icon-img" /> Cuenta
                  </button>
                  <button className="menu-item-btn cerrar-sesion" onClick={handleCerrarSesion}>
                    <img src="/assets/icon-cerrar.svg" alt="" className="menu-icon-img" /> Cerrar Sesión
                  </button>
                </nav>
              </div>
            </>
          )}
        </header>
      )}

      {/* CUERPO PRINCIPAL */}
      {/* PADDING AUMENTADO A 110px PARA COMPENSAR EL HEADER NUEVO */}
      <div className="filas-contenido" style={{ paddingTop: tipoContenido === 'buscador' ? '0' : 'calc(110px + env(safe-area-inset-top))', backgroundColor: '#000' }}>
        
        {/* PANTALLA CUENTA */}
        {tipoContenido === 'cuenta' && (
          <div className="cuenta-screen" style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
              minHeight: '60vh', textAlign: 'center', padding: '20px'
          }}>
              <div style={{ 
                  width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#222', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                  border: '2px solid #333'
              }}>
                  <img src="/assets/icon-cuenta.svg" alt="Usuario" style={{ width: '50px', height: '50px', filter: 'invert(1)' }} />
              </div>
              <h2 style={{ marginBottom: '10px', fontSize: '24px' }}>Mi Cuenta</h2>
              <p style={{ color: '#aaa', marginBottom: '30px', fontSize: '16px' }}>{usuario?.email}</p>
              
              <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '10px', width: '100%', maxWidth: '300px', border: '1px solid #222' }}>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '5px' }}>Estado de la suscripción</p>
                  <p style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>ACTIVO</p>
                  
                  {infoUsuario?.fecha_vencimiento && (
                    <div style={{ borderTop: '1px solid #333', marginTop: '10px', paddingTop: '10px' }}>
                        <p style={{ color: '#666', fontSize: '12px' }}>Vence el:</p>
                        <p style={{ color: '#fff', fontSize: '15px' }}>{new Date(infoUsuario.fecha_vencimiento).toLocaleDateString()}</p>
                    </div>
                  )}
              </div>
          </div>
        )}

        {/* BUSCADOR */}
        {tipoContenido === 'buscador' && (
          <div className="search-screen" style={{ width: '100%', minHeight: '100vh', background: '#000', zIndex: 999, position: 'relative' }}>
             <div className="search-header" style={{ 
                 padding: '20px 20px 30px 20px', 
                 paddingTop: 'calc(20px + env(safe-area-inset-top))', 
                 display: 'flex', alignItems: 'center', gap: '15px',
                 backgroundColor: '#000', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #333'
             }}>
               <button className="btn-back-search" onClick={() => handleCambiarTipo('todo')}
                 style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 5px' }}>
                 <img src="/assets/icon-atras.svg" alt="Atrás" style={{ width: '28px', height: '28px', filter: 'brightness(0) invert(1)' }} />
               </button>
               <div className="search-input-wrapper" style={{ position: 'relative', flex: 1 }}>
                 <input ref={inputBusquedaRef} type="text" placeholder="Buscar película, serie..." value={busqueda}
                   onChange={(e) => { setBusqueda(e.target.value); filtrar(todosLosItems, plataformaActiva, e.target.value, 'buscador'); }}
                   style={{ width: '100%', padding: '12px 45px 12px 20px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#000', color: 'white', fontSize: '16px', outline: 'none' }}
                 />
                 {busqueda && (
                   <button className="btn-clear-search" onClick={() => { setBusqueda(''); filtrar(todosLosItems, null, '', 'buscador'); inputBusquedaRef.current.focus(); }}
                     style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>✕</button>
                 )}
               </div>
             </div>
             <div className="search-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px', padding: '20px', marginTop: '20px' }}>
                {itemsFiltrados['Resultados']?.map(p => (
                    <div key={p.uniqueKey || p.id} onClick={() => setItem(p)} style={{cursor: 'pointer'}}>
                       <img src={getImagenUrl(p.imagen_poster)} alt={p.titulo} style={{width: '100%', borderRadius: '6px', aspectRatio: '2/3', objectFit: 'cover'}}/>
                       <p style={{marginTop: '6px', fontSize: '12px', color: '#ddd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p.titulo}</p>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* HOME / FILAS */}
        {tipoContenido !== 'buscador' && tipoContenido !== 'cuenta' && (
           <>
              {/* PLATAFORMAS (Se oculta en Favoritos/MiLista) */}
              {tipoContenido !== 'favoritos' && tipoContenido !== 'milista' && (
                <div className="filtros-container" style={{ marginBottom: '20px' }}>
                  {PLATAFORMAS.map(p => (
                    <div key={p.id} className={`btn-plat img-btn ${plataformaActiva === p.id ? 'activo' : ''}`}
                      onClick={() => { const nueva = plataformaActiva === p.id ? null : p.id; setPlataformaActiva(nueva); filtrar(todosLosItems, nueva, busqueda, tipoContenido); }}
                      tabIndex="0"
                    >
                      <img src={p.logo} alt={p.id} />
                    </div>
                  ))}
                </div>
              )}

              {/* TÍTULOS GRANDES PARA FAVORITOS Y MI LISTA */}
              {tipoContenido === 'favoritos' && (
                <h1 style={{ padding: '0 20px', fontSize: '30px', fontWeight: 'bold', marginBottom: '10px', color: 'white' }}>
                  Mis Favoritos
                </h1>
              )}
              {tipoContenido === 'milista' && (
                <h1 style={{ padding: '0 20px', fontSize: '30px', fontWeight: 'bold', marginBottom: '10px', color: 'white' }}>
                  Mi Lista
                </h1>
              )}

              {Object.keys(itemsFiltrados).sort().map(g => (
                <Fila key={g} titulo={g} peliculas={itemsFiltrados[g]} onClickPelicula={(p) => setItem(p)} />
              ))}
           </>
        )}
      </div>

      {/* PLAYER */}
      {verPeliculaCompleta && item && (
        <div className="player-overlay" style={{ background: '#000' }}>
          <button className="btn-volver-player" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          <VideoPlayer src={obtenerUrlVideo()} />
        </div>
      )}

      {/* MODAL */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#000', border: '1px solid #222', paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="modal-banner" style={{ backgroundImage: `url(${getImagenUrl(item.imagen_fondo || item.backdrop_path || item.poster_path)})` }}>
              <button className="btn-cerrar" onClick={() => setItem(null)}>✕</button>
            </div>
            <div className="modal-info">
              <h2>{item.titulo}</h2>
              <div className="modal-meta">
                {item.fecha_estreno && <span className="meta-tag">{item.fecha_estreno.split('-')[0]}</span>}
                {item.duracion && <span>{item.duracion} min</span>}
              </div>
              <p className="modal-desc" style={{ color: '#ccc' }}>{item.descripcion || item.overview}</p>
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
              <button ref={btnReproducirRef} className="btn-play-detalle" onClick={() => setVerPeliculaCompleta(true)} tabIndex="0">▶ REPRODUCIR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;