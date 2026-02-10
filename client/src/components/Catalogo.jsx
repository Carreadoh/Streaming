import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
import VideoPlayer from './VideoPlayer'; // Asegúrate de tener aquí el código de Plyr+HLS
import './Catalogo.css';

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';
const URL_SERVIDOR = 'https://cine.neveus.lat';

const PLATAFORMAS = [
  { id: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg' },
  { id: 'Disney', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/5EGT4P4UKRGAZPDR52FKJJW4YU.png' },
  { id: 'Amazon', logo: 'https://play-lh.googleusercontent.com/mZ6pRo5-NnrO9GMwFNrK5kShF0UrN5UOARVAw64_5aFG6NgEHSlq-BX5I8TEXtTOk9s' },
  { id: 'Apple', logo: 'https://i.blogs.es/a1d8ea/apple-tv/1200_900.jpeg' },
  { id: 'HBO', logo: 'https://frontend-assets.clipsource.com/60dedc6376ad9/hbo-60def166a1502/2024/08/03/66ae50c0ca12f_thumbnail.png' },
  { id: 'Paramount', logo: 'https://cloudfront-us-east-1.images.arcpublishing.com/infobae/FWS265CNEJEQHF53MCJQ3QR2PA.jpg' },
  { id: 'Crunchyroll', logo: 'https://sm.ign.com/ign_latam/cover/c/crunchyrol/crunchyroll_xkv2.jpg' },
  { id: 'Cine', logo: 'https://cdn-icons-png.flaticon.com/512/3163/3163508.png' },
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

  // --- SESIÓN Y DATOS ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === "admin@streamgo.com") { setUsuario(user); } 
        else {
             const userDocRef = doc(db, "usuarios", user.uid);
             const userDocSnap = await getDoc(userDocRef);
             if (userDocSnap.exists()) {
                 const userData = userDocSnap.data();
                 const fechaVencimiento = new Date(userData.fecha_vencimiento);
                 if (new Date() > fechaVencimiento) {
                     await signOut(auth); setErrorLogin("Tu suscripción ha vencido."); setUsuario(null);
                 } else { setUsuario(user); }
             }
        }
      } else { setUsuario(null); }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Bloqueo de scroll mejorado para modo cine
  useEffect(() => {
    if (verPeliculaCompleta) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [verPeliculaCompleta]);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin('');
    try { await signInWithEmailAndPassword(getAuth(), email, password); } 
    catch (error) { setErrorLogin("Credenciales incorrectas."); }
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

  const handleBusqueda = (e) => {
    setBusqueda(e.target.value);
    organizarPorGeneros(todosLosItems, plataformaActiva, e.target.value, tipoSeleccionado);
  };

  const buscarTrailer = async (id, tipo) => {
    setTrailerKey(null);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/${tipo === 'serie' ? 'tv' : 'movie'}/${id}/videos`, { params: { api_key: TMDB_API_KEY, language: 'es-MX' } });
      const video = res.data.results.find(v => v.type === "Trailer");
      if (video) setTrailerKey(video.key);
    } catch (e) { console.error(e); }
  };

  const cargarEpisodios = async (id, num) => {
    setEpisodios([]); setTemporadaSeleccionada(num);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${num}`, { params: { api_key: TMDB_API_KEY, language: 'es-MX' } });
      setEpisodios(res.data.episodes);
    } catch (e) { console.error(e); }
  };

  const abrirModal = (p) => { 
    setItem(p); setVerPeliculaCompleta(false); buscarTrailer(p.id_tmdb, p.tipo);
    if (p.tipo === 'serie') { 
      axios.get(`https://api.themoviedb.org/3/tv/${p.id_tmdb}`, { params: { api_key: TMDB_API_KEY, language: 'es-MX' } })
      .then(r => { setNumTemporadas(Array.from({length: r.data.number_of_seasons}, (_, i) => i+1)); cargarEpisodios(p.id_tmdb, 1); });
    }
  };

  // --- LÓGICA DE URL DE VIDEO (HLS ACTIVADO) ---
  const obtenerUrlVideo = () => {
    if (!item) return '';
    
    // Series (Mantenemos lógica actual, o se puede adaptar a HLS si también tienes carpetas)
    if (item.tipo === 'serie') {
      const key = `S${capituloActual.temp}E${capituloActual.cap}`;
      return item.episodios_locales?.[key] 
        ? `${URL_SERVIDOR}/series/${encodeURI(item.episodios_locales[key])}` 
        : `${URL_SERVIDOR}/series/${item.id_tmdb}/${key}.mp4`;
    }

    // PELÍCULAS: Forzar ruta a carpeta HLS
    // Estructura: /peliculas/[ID_TMDB]/master.m3u8
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}/master.m3u8`;
  };

  if (loadingAuth) return <div className="loading">Cargando...</div>;

  if (!usuario) {
    return (
      <div className="login-premium-bg">
        <div className="login-card">
          <img src="/logo.svg" alt="Logo" style={{height: '60px', marginBottom: '20px'}} />
          <h2 className="login-title">Bienvenido</h2>
          <form onSubmit={handleLogin}>
            <input type="email" className="login-input" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" className="login-input" placeholder="Pass" value={password} onChange={e => setPassword(e.target.value)} required />
            {errorLogin && <p style={{color: '#ef4444'}}>{errorLogin}</p>}
            <button type="submit" className="btn-login-premium">Acceder</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogo-container">
      <header className="header-container" style={{position: 'relative', justifyContent: 'space-between'}}>
        <div style={{width: '200px', display: 'none', visibility: 'hidden'}} className="desktop-spacer"></div>
        <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center'}}>
            <img src="/logo.svg" className="header-logo" onClick={() => window.location.reload()} style={{cursor: 'pointer', height: '40px'}} />
        </div>
        <div className="profile-widget" style={{marginLeft: 'auto', zIndex: 2}}>
          <div className="profile-info">
            <span className="profile-name">Hola, {usuario.email.split('@')[0]}</span>
            <span className="profile-status">Online</span>
          </div>
          <div className="profile-avatar-circle">{usuario.email.charAt(0).toUpperCase()}</div>
          <div className="dropdown-menu">
            <button className="menu-item logout" onClick={() => getAuth().signOut()}>Cerrar Sesión</button>
          </div>
        </div>
      </header>

      <div className="toolbar-container">
        <div className="plataformas-list">
          {PLATAFORMAS.map(p => (
            <div key={p.id} className={`plat-btn ${plataformaActiva === p.id ? 'active' : ''}`} onClick={() => {
              const nueva = plataformaActiva === p.id ? null : p.id;
              setPlataformaActiva(nueva);
              organizarPorGeneros(todosLosItems, nueva, busqueda, tipoSeleccionado);
            }}><img src={p.logo} alt={p.id} /></div>
          ))}
        </div>
        <div className="search-inline">
          <input type="text" className="search-input" placeholder="Buscar..." value={busqueda} onChange={handleBusqueda} />
        </div>
      </div>

      <div className="filtros-tipo-container">
        {['todo', 'movie', 'serie'].map(t => (
          <button key={t} className={`btn-filtro ${tipoSeleccionado === t ? 'activo' : ''}`} onClick={() => {
            setTipoSeleccionado(t);
            organizarPorGeneros(todosLosItems, plataformaActiva, busqueda, t);
          }}>{t === 'todo' ? 'Todo' : t === 'movie' ? 'Películas' : 'Series'}</button>
        ))}
      </div>

      <div className="filas-generos">
        {Object.keys(itemsFiltrados).sort().map(g => (
           <Fila key={g} titulo={g} peliculas={itemsFiltrados[g]} onClickPelicula={abrirModal} />
        ))}
      </div>

      {/* REPRODUCTOR PLYR MODERNO */}
      {verPeliculaCompleta && item && (
        <div className="reproductor-overlay" 
            style={{
              position: 'fixed', inset: 0, width: '100vw', height: '100vh',
              backgroundColor: 'black', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden'
            }}>
          
          <button className="btn-salir-cine" onClick={() => setVerPeliculaCompleta(false)} 
            style={{
              position: 'absolute', top: 30, left: 30, zIndex: 10002,
              background: 'rgba(0,0,0,0.6)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.3)', 
              padding: '10px 20px', 
              fontSize: '16px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              backdropFilter: 'blur(4px)'
            }}>
            ← Volver
          </button>
          
          <div style={{ width: '100%', height: '100%' }}>
            <VideoPlayer src={obtenerUrlVideo()} />
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={() => setItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="video-area">
              <button className="btn-cerrar" onClick={() => setItem(null)}>✕</button>
              {trailerKey ? (
                <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0`} style={{width:'100%', height:'100%', border:0}} allowFullScreen />
              ) : (
                <div className="placeholder-img" style={{backgroundImage: `url(${item.imagen_fondo})`, width:'100%', height:'100%', backgroundSize:'cover'}} onClick={() => setVerPeliculaCompleta(true)} />
              )}
            </div>
            <div className="info-container">
              <h2 className="titulo-principal">{item.titulo}</h2>
              <button className="btn-accion-full blanco" onClick={() => setVerPeliculaCompleta(true)}>▶ Reproducir</button>
              <p className="sinopsis">{item.descripcion}</p>
              
              {item.tipo === 'serie' && (
                <div className="tabs-container">
                  <div className="cabecera-episodios">
                    <select value={temporadaSeleccionada} onChange={e => cargarEpisodios(item.id_tmdb, e.target.value)}>
                      {numTemporadas.map(n => <option key={n} value={n}>Temporada {n}</option>)}
                    </select>
                  </div>
                  <div className="lista-episodios">
                    {episodios.map(ep => (
                      <div className="episodio-item" key={ep.id} onClick={() => { setCapituloActual({temp: temporadaSeleccionada, cap: ep.episode_number}); setVerPeliculaCompleta(true); }}>
                        <div className="episodio-img-wrapper">{ep.still_path ? <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt="ep" /> : <div className="no-img" />}</div>
                        <div className="episodio-info"><h4>{ep.episode_number}. {ep.name}</h4><p>{ep.overview}</p></div>
                      </div>
                    ))}
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