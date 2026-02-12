import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore'; // Solo dejamos lo necesario para info de usuario
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { App as CapacitorApp } from '@capacitor/app'; 
import { ScreenOrientation } from '@capacitor/screen-orientation'; 
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; 

const URL_SERVIDOR = 'https://cine.neveus.lat';

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
    return path; // El script ahora nos da la URL completa de TMDB
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

  // --- AUTH & INFO (Firebase se queda para usuarios) ---
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

  // --- CARGA DESDE EL SERVIDOR (NUEVA LÓGICA) ---
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      try {
        // Fetch al JSON generado por tu script PHP
        const response = await fetch(`${URL_SERVIDOR}/data.php`);
        const data = await response.json();
        
        // El script ya nos da los objetos limpios
        const items = data.map(p => ({
            ...p,
            uniqueKey: `p_${p.id}`,
            // Si el script no envía tipo, asumimos movie por defecto
            tipo: p.tipo || 'movie',
            imagen_poster: p.poster // El script usa 'poster'
        }));

        setTodosLosItems(items);
        filtrar(items, null, '', 'todo');
      } catch (e) { 
          console.error("Error cargando catálogo del server", e); 
      }
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

      const generosUnicos = [...new Set(p.generos || ["General"])];
      
      generosUnicos.forEach(g => {
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
    } else if (tipo === 'cuenta') {
        setMenuAbierto(false);
    } else {
      filtrar(todosLosItems, plataformaActiva, busqueda, tipo);
    }
    setMenuAbierto(false);
  };

  // --- URL DE VIDEO DIRECTA DEL JSON ---
  const obtenerUrlVideo = () => {
    if (!item) return '';
    return item.video_url; // El script ya nos da la URL completa
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
      
      {/* HEADER */}
      {tipoContenido !== 'buscador' && (
        <header className="header-main" style={{ 
          backgroundColor: '#000', borderBottom: '1px solid #111', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '0 15px', paddingTop: 'env(safe-area-inset-top)', 
          height: 'calc(90px + env(safe-area-inset-top))', 
          position: 'fixed', top: 0, left: 0, right: 0
        }}>
          <div style={{ width: '40px' }}>
            <button className="menu-btn" onClick={() => setMenuAbierto(!menuAbierto)} style={{ color: 'white', fontSize: '24px', background: 'none', border: 'none' }}>☰</button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <img src="/logo.png" alt="StreamGo" onClick={() => handleCambiarTipo('todo')} style={{ height: '80px', cursor: 'pointer' }} />
          </div>
          <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="search-btn-header" onClick={() => handleCambiarTipo('buscador')} style={{ background: 'none', border: 'none' }}>
              <img src="/assets/icon-buscador.svg" alt="Buscar" style={{ width: '24px', height: '24px' }} />
            </button>
          </div>
          
          {menuAbierto && (
            <>
              <div className="menu-overlay" onClick={() => setMenuAbierto(false)}></div>
              <div className="menu-lateral" style={{ backgroundColor: '#000' }}>
                <div className="menu-header">
                  <h2>Menú</h2>
                  <button className="btn-cerrar-menu" onClick={() => setMenuAbierto(false)}>✕</button>
                </div>
                <nav className="menu-nav">
                  <button className={`menu-item-btn ${tipoContenido === 'todo' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('todo')}>Inicio</button>
                  <button className={`menu-item-btn ${tipoContenido === 'peliculas' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('peliculas')}>Películas</button>
                  <button className={`menu-item-btn ${tipoContenido === 'series' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('series')}>Series</button>
                  <button className={`menu-item-btn ${tipoContenido === 'favoritos' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('favoritos')}>Favoritos</button>
                  <button className={`menu-item-btn ${tipoContenido === 'milista' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('milista')}>Mi Lista</button>
                  <button className={`menu-item-btn ${tipoContenido === 'cuenta' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('cuenta')}>Cuenta</button>
                  <button className="menu-item-btn cerrar-sesion" onClick={handleCerrarSesion}>Cerrar Sesión</button>
                </nav>
              </div>
            </>
          )}
        </header>
      )}

      {/* CONTENIDO */}
      <div className="filas-contenido" style={{ paddingTop: tipoContenido === 'buscador' ? '0' : '110px', backgroundColor: '#000' }}>
        
        {tipoContenido === 'cuenta' && (
          <div className="cuenta-screen" style={{ textAlign: 'center', padding: '50px 20px' }}>
              <h2>Mi Cuenta</h2>
              <p>{usuario?.email}</p>
              <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
                  <p style={{ color: '#4ade80' }}>SUSCRIPCIÓN ACTIVA</p>
                  {infoUsuario?.fecha_vencimiento && <p>Vence: {new Date(infoUsuario.fecha_vencimiento).toLocaleDateString()}</p>}
              </div>
          </div>
        )}

        {tipoContenido === 'buscador' && (
          <div className="search-screen">
             <div className="search-header" style={{ display: 'flex', padding: '20px', gap: '15px' }}>
               <button onClick={() => handleCambiarTipo('todo')} style={{ background: 'none', border: 'none' }}>
                 <img src="/assets/icon-atras.svg" alt="Atrás" style={{ width: '28px', filter: 'invert(1)' }} />
               </button>
               <input ref={inputBusquedaRef} type="text" placeholder="Buscar..." value={busqueda}
                 onChange={(e) => { setBusqueda(e.target.value); filtrar(todosLosItems, null, e.target.value, 'buscador'); }}
                 style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#222', color: 'white', border: 'none' }}
               />
             </div>
             <div className="search-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '15px', padding: '20px' }}>
                {itemsFiltrados['Resultados']?.map(p => (
                    <div key={p.uniqueKey} onClick={() => setItem(p)}>
                       <img src={getImagenUrl(p.imagen_poster)} alt={p.titulo} style={{width: '100%', borderRadius: '8px'}}/>
                    </div>
                ))}
             </div>
          </div>
        )}

        {tipoContenido !== 'buscador' && tipoContenido !== 'cuenta' && (
            <>
              {tipoContenido !== 'favoritos' && tipoContenido !== 'milista' && (
                <div className="filtros-container">
                  {PLATAFORMAS.map(p => (
                    <div key={p.id} className={`btn-plat img-btn ${plataformaActiva === p.id ? 'activo' : ''}`}
                      onClick={() => { const nueva = plataformaActiva === p.id ? null : p.id; setPlataformaActiva(nueva); filtrar(todosLosItems, nueva, busqueda, tipoContenido); }}>
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

      {/* PLAYER */}
      {verPeliculaCompleta && item && (
        <div className="player-overlay">
          <VideoPlayer src={obtenerUrlVideo()} onClose={() => setVerPeliculaCompleta(false)} />
        </div>
      )}

      {/* MODAL DETALLE */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-banner" style={{ backgroundImage: `url(${getImagenUrl(item.imagen_poster)})` }}>
              <button className="btn-cerrar" onClick={() => setItem(null)}>✕</button>
            </div>
            <div className="modal-info">
              <h2>{item.titulo}</h2>
              <p>{item.sinopsis || item.descripcion}</p>
              <div className="modal-actions">
                <button className="action-btn" onClick={() => toggleFavorito(item.id)}>Favorito</button>
                <button className="action-btn" onClick={() => toggleMiLista(item.id)}>Mi Lista</button>
              </div>
              <button ref={btnReproducirRef} className="btn-play-detalle" onClick={() => setVerPeliculaCompleta(true)}>▶ REPRODUCIR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;