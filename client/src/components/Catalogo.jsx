import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore'; 
import { App as CapacitorApp } from '@capacitor/app'; 
import { ScreenOrientation } from '@capacitor/screen-orientation'; 
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import AdminPanel from './AdminPanel';
import axios from 'axios';
import '../App.css'; 

const URL_SERVIDOR = 'https://cine.neveus.lat';

// --- UTILIDADES ---
const normalizarTexto = (texto) => {
  return texto 
    ? String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() 
    : "";
};

const cortarTexto = (texto, limite = 150) => {
  if (!texto) return "Sin descripción.";
  if (texto.length <= limite) return texto;
  return texto.substring(0, limite) + "...";
};

const limpiarNombreCapitulo = (nombreArchivo, numCapitulo) => {
  if (!nombreArchivo) return `Episodio ${numCapitulo}`;
  const sinExt = nombreArchivo.replace(/\.[^/.]+$/, "");
  // Busca patrones como S01E01 o 1x01
  const match = sinExt.match(/([sS]\d{1,2}[eE]\d{1,2}|\d{1,2}x\d{1,2})/);
  if (match) {
    // Toma lo que hay después del patrón (ej: despues de S01E01)
    const resto = sinExt.substring(match.index + match[0].length);
    const limpio = resto.replace(/^[._\-\s]+/, "").replace(/_/g, " ").trim();
    if (limpio) return limpio;
  }
  return `Episodio ${numCapitulo}`;
};

const obtenerDuracionCapitulo = (cap, item) => {
  if (cap.duracion) return `${cap.duracion} min`;
  
  // Fallback: Promedio de la serie o runtime general
  let duracion = item.duracion_promedio || item.runtime;
  if (Array.isArray(duracion)) duracion = duracion[0];
  
  if (duracion) return `${duracion} min`;
  return null;
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
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformaActiva, setPlataformaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipoContenido, setTipoContenido] = useState(() => {
    if (window.location.pathname.startsWith('/admin')) return 'admin';
    if (window.location.pathname.startsWith('/reseller')) return 'reseller';
    return 'todo';
  }); 
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [item, setItem] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  const btnReproducirRef = useRef(null); 
  const inputBusquedaRef = useRef(null);

  // --- REFERENCIAS Y ESTADOS PARA EL TRAILER ---
  const iframeRef = useRef(null); // Referencia al iframe de youtube
  const [isMuted, setIsMuted] = useState(false); // Estado del sonido (false = con sonido)

  const [favoritos, setFavoritos] = useState(() => JSON.parse(localStorage.getItem('favoritos')) || []);
  const [miLista, setMiLista] = useState(() => JSON.parse(localStorage.getItem('miLista')) || []);

  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState(1);
  useEffect(() => {
    if (item && item.tipo === 'serie' && item.seasons) {
        const primeraTemp = Object.keys(item.seasons)[0];
        setTemporadaSeleccionada(Number(primeraTemp));
    } else {
        setIsMuted(false);
    }
  }, [item]);

  const getImagenUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/500x281?text=No+Image'; 
    if (path.startsWith('http')) return path; 
    return path; 
  };

  const stateRef = useRef({ item, verPeliculaCompleta, menuAbierto });
  
  useEffect(() => {
    stateRef.current = { item, verPeliculaCompleta, menuAbierto };
    // Cuando cambiamos de item, reseteamos el estado de silencio (queremos que arranque con sonido)
    if (item) setIsMuted(false);
  }, [item, verPeliculaCompleta, menuAbierto]);

  // --- BLOQUEAR SCROLL BODY ---
  useEffect(() => {
    if (item || menuAbierto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [item, menuAbierto]);

  // --- BOTÓN ATRÁS (HARDWARE) ---
  useEffect(() => {
    let backListener;
    const setupAppListener = async () => {
      try {
        backListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          const { item, verPeliculaCompleta, menuAbierto } = stateRef.current;
          if (verPeliculaCompleta) setVerPeliculaCompleta(false);
          else if (item) setItem(null);
          else if (menuAbierto) setMenuAbierto(false);
          else if (tipoContenido === 'buscador') handleCambiarTipo('todo');
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

  // --- AUTH ---
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('usuario_sesion');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setUsuario(user);
      }
    } catch (e) {
      console.error("Error al cargar sesión", e);
    }
      setLoadingAuth(false);

    // Asegurar que el dispositivo tenga un ID único y persistente
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        try {
            deviceId = crypto.randomUUID();
        } catch (e) {
            deviceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        localStorage.setItem('device_id', deviceId);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    const emailForApi = username.includes('@') ? username : `${username}@neveus.lat`;

    try {
        const deviceId = localStorage.getItem('device_id');
        const res = await axios.post(`${URL_SERVIDOR}/auth.php`, {
            action: 'login',
            email: emailForApi,
            password: password,
            deviceId: deviceId // Enviar ID del dispositivo
        });

        if (res.data.success && res.data.user) {
            const user = res.data.user;
            setUsuario(user);
            localStorage.setItem('usuario_sesion', JSON.stringify(user));
        } else {
            setErrorLogin(res.data.message || "Error de credenciales.");
        }
    } catch (error) {
        setErrorLogin("Error de conexión o credenciales inválidas.");
    }
  };

  // --- CARGA DESDE EL SERVIDOR ---
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      try {
        const response = await fetch(`${URL_SERVIDOR}/data.php`);
        const data = await response.json();
        
        const items = data.map(p => {
            let rawGeneros = p.generos || p.genres || p.categoria || "Otros";
            let arrayGeneros = Array.isArray(rawGeneros)
                ? rawGeneros
                : String(rawGeneros).split(',').map(g => g.trim());

            arrayGeneros = arrayGeneros.filter(g => g && g !== "General");
            if (arrayGeneros.length === 0) arrayGeneros = ["Otros"];

            return {
                ...p,
                uniqueKey: `p_${p.id}`,
                tipo: p.tipo || 'movie',
                imagen_poster: p.poster,
                generos: arrayGeneros,
                trailer_key: p.trailer_key // Aseguramos que pase el trailer
            };
        });

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

      const generosUnicos = [...new Set(p.generos)];
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

  const handleCerrarSesion = async () => {
    const deviceId = localStorage.getItem('device_id');
    const userId = usuario?.id;

    if (userId && deviceId) {
        try {
            // Notificar al servidor que este dispositivo está cerrando sesión
            await axios.post(`${URL_SERVIDOR}/auth.php`, {
                action: 'logout',
                userId: userId,
                deviceId: deviceId
            });
        } catch (error) {
            console.error("Error al notificar cierre de sesión al servidor:", error);
        }
    }

    setUsuario(null);
    localStorage.removeItem('usuario_sesion');
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
    return item.video_url; 
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

  // --- CONTROL DE VOLUMEN TRAILER ---
  const toggleMuteTrailer = (e) => {
    e.stopPropagation();
    const nuevoEstado = !isMuted;
    setIsMuted(nuevoEstado);
    if (iframeRef.current) {
        // Usamos postMessage para hablar con la API de YouTube
        const comando = nuevoEstado ? 'mute' : 'unMute';
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: comando,
            args: []
        }), '*');
    }
  };

  if (loadingAuth) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  if (!usuario && tipoContenido !== 'admin' && tipoContenido !== 'reseller') {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <img src="/logo.png" alt="Logo" className="login-logo"/>
          <input type="text" placeholder="Usuario" value={username} onChange={e=>setUsername(e.target.value)} autoFocus autoComplete="off"/>
          <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/>
          {errorLogin && <p className="error">{errorLogin}</p>}
          <button type="submit">Ingresar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="catalogo-wrapper" style={{ backgroundColor: '#000', minHeight: '100vh', color: 'white' }}>
      
      {/* HEADER */}
      {tipoContenido !== 'buscador' && tipoContenido !== 'admin' && tipoContenido !== 'reseller' && (
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
                  <button className={`menu-item-btn ${tipoContenido === 'todo' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('todo')}>
                    <img src="/assets/icon-inicio.svg" className="menu-icon-img" alt="Inicio" />
                    Inicio
                  </button>
                  <button className={`menu-item-btn ${tipoContenido === 'peliculas' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('peliculas')}>
                    <img src="/assets/icon-peliculas.svg" className="menu-icon-img" alt="Películas" />
                    Películas
                  </button>
                  <button className={`menu-item-btn ${tipoContenido === 'series' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('series')}>
                    <img src="/assets/icon-series.svg" className="menu-icon-img" alt="Series" />
                    Series
                  </button>
                  <button className={`menu-item-btn ${tipoContenido === 'favoritos' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('favoritos')}>
                    <img src="/assets/icon-corazon.svg" className="menu-icon-img" alt="Favoritos" />
                    Favoritos
                  </button>
                  <button className={`menu-item-btn ${tipoContenido === 'milista' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('milista')}>
                    <img src="/assets/icon-milista.svg" className="menu-icon-img" alt="Mi Lista" />
                    Mi Lista
                  </button>
                  <button className={`menu-item-btn ${tipoContenido === 'cuenta' ? 'activo' : ''}`} onClick={() => handleCambiarTipo('cuenta')}>
                    <img src="/assets/icon-cuenta.svg" className="menu-icon-img" alt="Cuenta" />
                    Cuenta
                  </button>
                  <button className="menu-item-btn cerrar-sesion" onClick={handleCerrarSesion}>
                    <img src="/assets/icon-cerrar.svg" className="menu-icon-img" alt="Cerrar" />
                    Cerrar Sesión
                  </button>
                </nav>
              </div>
            </>
          )}
        </header>
      )}

      {/* CONTENIDO */}
      <div className="filas-contenido" style={{ paddingTop: (tipoContenido === 'buscador' || tipoContenido === 'admin' || tipoContenido === 'reseller') ? '0' : 'calc(115px + env(safe-area-inset-top))', backgroundColor: '#000' }}>
        
        {tipoContenido === 'cuenta' && (
          <div className="cuenta-screen" style={{ textAlign: 'center', padding: '50px 20px' }}>
              <h2>Mi Cuenta</h2>
              <p style={{color: '#aaa', marginBottom: '30px'}}>{usuario?.email?.replace('@neveus.lat', '') || 'Usuario'}</p>
              <div style={{ backgroundColor: '#111', padding: '20px 30px', borderRadius: '10px', marginTop: '20px', maxWidth: '400px', margin: '20px auto' }}>
                  <p style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '25px', fontSize: '1.1rem', borderBottom: '1px solid #222', paddingBottom: '20px' }}>SUSCRIPCIÓN ACTIVA</p>
                  
                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                          <span style={{ color: '#aaa', display: 'block', fontSize: '14px', marginBottom: '5px' }}>Vencimiento</span>
                          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {usuario?.fecha_vencimiento ? new Date(usuario.fecha_vencimiento).toLocaleString() : 'No disponible'}
                          </span>
                      </div>
                      <div>
                          <span style={{ color: '#aaa', display: 'block', fontSize: '14px', marginBottom: '5px' }}>Dispositivos en uso</span>
                          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {Array.isArray(usuario?.active_devices) ? usuario.active_devices.length : 0} / {usuario?.limite_dispositivos || 1}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
        )}

        {tipoContenido === 'buscador' && (
          <div className="search-screen">
             <div className="search-header" style={{ display: 'flex', padding: '20px', gap: '15px', alignItems: 'center', paddingTop: 'env(safe-area-inset-top)' }}>
               <button onClick={() => handleCambiarTipo('todo')} style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center' }}>
                 <img src="/assets/icon-atras.svg" alt="Atrás" style={{ width: '28px', height: '28px' }} />
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

        {(tipoContenido === 'admin' || tipoContenido === 'reseller') && (
            <AdminPanel onVolver={() => handleCambiarTipo('todo')} isReseller={tipoContenido === 'reseller'} />
        )}

        {tipoContenido !== 'buscador' && tipoContenido !== 'cuenta' && tipoContenido !== 'admin' && tipoContenido !== 'reseller' && (
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

      {/* MODAL DETALLE CON TRAILER Y SERIES */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            {/* --- BANNER / TRAILER --- */}
            <div className="modal-banner" style={{ 
                 backgroundImage: !item.trailer_key ? `url(${getImagenUrl(item.imagen_poster)})` : 'none', 
                 backgroundColor: '#000',
                 aspectRatio: '16/9',
                 position: 'relative',
                 overflow: 'hidden'
            }}>
              {item.trailer_key ? (
                <>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                        <iframe
                        ref={iframeRef}
                        style={{ width: '100%', height: '100%', border: 'none', transform: 'scale(1.35)', transformOrigin: 'center center' }}
                        src={`https://www.youtube.com/embed/${item.trailer_key}?autoplay=1&mute=0&enablejsapi=1&controls=0&loop=1&playlist=${item.trailer_key}&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`}
                        title="Trailer"
                        allow="autoplay; encrypted-media"
                        />
                    </div>
                    <button onClick={toggleMuteTrailer} style={{ position: 'absolute', bottom: '15px', right: '15px', zIndex: 20, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <img src={isMuted ? "/assets/icon-sonido-off.svg" : "/assets/icon-sonido-on.svg"} alt="Volumen" style={{ width: '20px', height: '20px', filter: 'invert(0)' }} />
                    </button>
                </>
              ) : (
                <button className="btn-cerrar" onClick={() => setItem(null)}>✕</button>
              )}
              {item.trailer_key && <button className="btn-cerrar" style={{zIndex: 30}} onClick={() => setItem(null)}>✕</button>}
            </div>

            {/* --- INFO --- */}
            <div className="modal-info">
              <h2>{item.titulo}</h2>
              
              <div className="modal-meta" style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                 {item.fecha_estreno && <span className="meta-tag" style={{background: '#333', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>{item.fecha_estreno.split('-')[0]}</span>}
                 {item.plataforma_origen && <span className="meta-tag" style={{background: '#333', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>{item.plataforma_origen}</span>}
                 {item.tipo === 'serie' && <span className="meta-tag" style={{background: '#e50914', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>SERIE</span>}
              </div>
              
              <p style={{ color: '#bbb', fontSize: '14px', marginBottom: '15px' }}>{cortarTexto(item.sinopsis || item.descripcion)}</p>
              
              <div className="modal-actions">
                <button className="action-btn" onClick={() => toggleFavorito(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <img src={favoritos.includes(item.id) ? "/assets/icon-corazon-lleno.svg" : "/assets/icon-corazon.svg"} alt="Favorito" style={{ width: '24px', height: '24px' }} onError={(e) => {e.target.style.display='none'}} />
                  <span>Favorito</span>
                </button>

                <button className="action-btn" onClick={() => toggleMiLista(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <img src={miLista.includes(item.id) ? "/assets/icon-check.svg" : "/assets/icon-milista.svg"} alt="Lista" style={{ width: '24px', height: '24px' }} onError={(e) => {e.target.style.display='none'}} />
                  <span>Mi Lista</span>
                </button>
              </div>
              
              {/* --- LÓGICA DE REPRODUCCIÓN: PELICULA vs SERIE --- */}
              {item.tipo !== 'serie' ? (
                  // ES PELÍCULA: Botón grande
                  <button ref={btnReproducirRef} className="btn-play-detalle" onClick={() => setVerPeliculaCompleta(true)}>▶ REPRODUCIR</button>
              ) : (
                  // ES SERIE: Selector de Caps
                  <div className="serie-selector" style={{ marginTop: '30px' }}>
                      
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: 'white' }}>Episodios</h3>
                      
                      {/* TABS TEMPORADAS */}
                      <div className="temporadas-tabs" style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '0', marginBottom: '20px', borderBottom: '1px solid #333' }}>
                          {item.seasons && Object.keys(item.seasons).map(numTemp => (
                              <button 
                                key={numTemp}
                                onClick={() => setTemporadaSeleccionada(Number(numTemp))}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: temporadaSeleccionada === Number(numTemp) ? '3px solid #e50914' : '3px solid transparent',
                                    color: temporadaSeleccionada === Number(numTemp) ? 'white' : '#999',
                                    padding: '10px 5px',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'color 0.2s'
                                }}
                              >
                                  Temporada {numTemp}
                              </button>
                          ))}
                      </div>

                      {/* LISTA CAPÍTULOS */}
                      <div className="episodios-lista">
                          {item.seasons && item.seasons[temporadaSeleccionada] ? (
                              item.seasons[temporadaSeleccionada].map(cap => (
                                  <div 
                                    key={cap.nombre_archivo} 
                                    onClick={() => {
                                        const capituloItem = { ...item, video_url: cap.video_url };
                                        setItem(capituloItem); 
                                        setVerPeliculaCompleta(true);
                                    }}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '15px',
                                        padding: '15px 0', borderBottom: '1px solid #222', cursor: 'pointer' 
                                    }}
                                  >
                                      {/* THUMBNAIL */}
                                      <div style={{ position: 'relative', width: '130px', aspectRatio: '16/9', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#333' }}>
                                          <img src={getImagenUrl(item.imagen_fondo || item.imagen_poster)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                              <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                                                  <span style={{ fontSize: '12px', color: 'white', marginLeft: '2px' }}>▶</span>
                                              </div>
                                          </div>
                                      </div>

                                      {/* INFO */}
                                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <h4 style={{ margin: 0, fontSize: '14px', color: 'white', fontWeight: 'bold' }}>
                                              {cap.capitulo}. {limpiarNombreCapitulo(cap.nombre_archivo, cap.capitulo)}
                                          </h4>
                                          {obtenerDuracionCapitulo(cap, item) && (
                                            <span style={{ fontSize: '12px', color: '#999' }}>{obtenerDuracionCapitulo(cap, item)}</span>
                                          )}
                                          {(cap.descripcion || cap.overview) && (
                                              <p style={{ fontSize: '12px', color: '#aaa', margin: '4px 0 0 0', lineHeight: '1.3' }}>{cortarTexto(cap.descripcion || cap.overview, 130)}</p>
                                          )}
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <p style={{color: '#666', textAlign: 'center', padding: '20px'}}>No hay capítulos disponibles.</p>
                          )}
                      </div>
                  </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;