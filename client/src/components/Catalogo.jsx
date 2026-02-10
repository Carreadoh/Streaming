import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
import './Catalogo.css';

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';

// --- CONFIGURACIÓN DE TU SERVIDOR (NGINX) ---
// Cambia esto por la IP o Dominio de tu servidor de 70TB
// Ejemplo: 'http://192.168.1.50' o 'https://media.tudominio.com'
const URL_SERVIDOR = 'http://65.109.146.153';

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
  
  // Estado para filtro de tipo
  const [tipoSeleccionado, setTipoSeleccionado] = useState('todo'); // 'todo', 'movie', 'serie'

  const [busqueda, setBusqueda] = useState('');
  const [item, setItem] = useState(null); 
  const [trailerKey, setTrailerKey] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  
  const playerRef = useRef(null);
  const [numTemporadas, setNumTemporadas] = useState([]); 
  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState(1);
  const [episodios, setEpisodios] = useState([]); 
  const [capituloActual, setCapituloActual] = useState({ temp: 1, cap: 1 }); 

  // --- LOGICA DE SESIÓN ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === "admin@streamgo.com") { 
             setUsuario(user);
        } else {
             const userDocRef = doc(db, "usuarios", user.uid);
             const userDocSnap = await getDoc(userDocRef);
             if (userDocSnap.exists()) {
                 const userData = userDocSnap.data();
                 const fechaVencimiento = new Date(userData.fecha_vencimiento);
                 if (new Date() > fechaVencimiento) {
                     await signOut(auth);
                     setErrorLogin("Tu suscripción ha vencido.");
                     setUsuario(null);
                 } else {
                     setUsuario(user);
                 }
             } else {
                 await signOut(auth);
                 setErrorLogin("Cuenta no encontrada.");
                 setUsuario(null);
             }
        }
      } else {
        setUsuario(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    const auth = getAuth();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { setErrorLogin("Credenciales incorrectas."); }
  };

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!usuario) return;
    const obtenerDatos = async () => {
      const pelisRef = collection(db, "peliculas");
      const seriesRef = collection(db, "series");
      try {
        const [pelisSnap, seriesSnap] = await Promise.all([getDocs(pelisRef), getDocs(seriesRef)]);
        const mapaItems = new Map();
        [...pelisSnap.docs, ...seriesSnap.docs].forEach(doc => {
          const data = doc.data();
          mapaItems.set(data.id_tmdb, { id: doc.id, ...data });
        });
        const dataUnica = Array.from(mapaItems.values());
        setTodosLosItems(dataUnica);
        // Inicializar con 'todo'
        organizarPorGeneros(dataUnica, null, '', 'todo'); 
      } catch (e) { console.error(e); }
    };
    obtenerDatos();
  }, [usuario]);

  useEffect(() => {
    if (item) document.body.classList.add('modal-abierto');
    else document.body.classList.remove('modal-abierto');
    return () => { document.body.classList.remove('modal-abierto'); };
  }, [item]);

const organizarPorGeneros = (items, filtroPlataforma, textoBusqueda, filtroTipo) => {
    const agrupado = {};
    items.forEach(p => {
      if (!p.disponible_servidor) return; 

      if (textoBusqueda) {
        const titulo = p.titulo.toLowerCase();
        const busquedaLower = textoBusqueda.toLowerCase();
        if (!titulo.includes(busquedaLower)) return;
      }

      // 2. Filtro de Tipo (Pelicula vs Serie)
      if (filtroTipo && filtroTipo !== 'todo') {
        if (p.tipo !== filtroTipo) return;
      }

      // 3. Filtro de Plataforma
      const origen = (p.plataforma_origen || "Otros").toLowerCase().trim();
      if (filtroPlataforma) {
        const pFiltro = filtroPlataforma.toLowerCase();
        let coincide = false;
        if (pFiltro === 'cine') { if (origen === 'cine' || p.generos?.includes('Estrenos')) coincide = true; }
        else if (pFiltro === 'amazon') { if (origen.includes('amazon') || origen.includes('prime')) coincide = true; }
        else if (pFiltro === 'hbo') { if (origen.includes('hbo') || origen.includes('max')) coincide = true; }
        else { if (origen.includes(pFiltro)) coincide = true; }
        if (!coincide) return;
      }

      // Agrupación
      let listaGeneros = p.generos && p.generos.length > 0 ? p.generos : ["General"]; 
      listaGeneros.forEach(genero => {
        if (!agrupado[genero]) agrupado[genero] = [];
        agrupado[genero].push(p);
      });
    });
    setItemsFiltrados(agrupado);
  };

  const handleBusqueda = (e) => {
    const texto = e.target.value;
    setBusqueda(texto);
    organizarPorGeneros(todosLosItems, plataformaActiva, texto, tipoSeleccionado);
  };

  const togglePlataforma = (idPlat) => {
    if (plataformaActiva === idPlat) {
      setPlataformaActiva(null);
      organizarPorGeneros(todosLosItems, null, busqueda, tipoSeleccionado); 
    } else {
      setPlataformaActiva(idPlat);
      organizarPorGeneros(todosLosItems, idPlat, busqueda, tipoSeleccionado); 
    }
  };

  const handleTipoChange = (nuevoTipo) => {
    setTipoSeleccionado(nuevoTipo);
    organizarPorGeneros(todosLosItems, plataformaActiva, busqueda, nuevoTipo);
  };

  const buscarTrailer = async (idTMDB, tipo) => {
    setTrailerKey(null); 
    try {
      const tipoContenido = tipo === 'serie' ? 'tv' : 'movie';
      const response = await axios.get(`https://api.themoviedb.org/3/${tipoContenido}/${idTMDB}/videos`, { params: { api_key: TMDB_API_KEY, language: 'es-MX' } });
      const videosEs = response.data.results;
      let video = videosEs.find(v => v.site === "YouTube" && v.type === "Trailer");
      if (!video) video = videosEs.find(v => v.site === "YouTube" && v.type === "Teaser");
      if (!video) {
        const responseEn = await axios.get(`https://api.themoviedb.org/3/${tipoContenido}/${idTMDB}/videos`, { params: { api_key: TMDB_API_KEY } });
        const videosEn = responseEn.data.results;
        video = videosEn.find(v => v.site === "YouTube" && v.type === "Trailer");
      }
      if (video) setTrailerKey(video.key);
    } catch (error) { console.error("Error buscando video:", error); }
  };

  const cargarDetallesSerie = async (idTMDB) => {
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${idTMDB}`, { params: { api_key: TMDB_API_KEY, language: 'es-MX' } });
      setNumTemporadas(Array.from({ length: res.data.number_of_seasons }, (_, i) => i + 1));
      cargarEpisodiosDeTemporada(idTMDB, 1);
    } catch (error) { console.error("Error serie:", error); }
  };

  const cargarEpisodiosDeTemporada = async (idTMDB, numTemp) => {
    setEpisodios([]); 
    setTemporadaSeleccionada(numTemp);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${idTMDB}/season/${numTemp}`, { params: { api_key: TMDB_API_KEY, language: 'es-MX' } });
      setEpisodios(res.data.episodes);
    } catch (error) { console.error("Error episodios:", error); }
  };

  const abrirModal = (peli) => { 
    setItem(peli); 
    setVerPeliculaCompleta(false);
    buscarTrailer(peli.id_tmdb, peli.tipo);
    if (peli.tipo === 'serie') { setCapituloActual({ temp: 1, cap: 1 }); cargarDetallesSerie(peli.id_tmdb); }
  };

  const cerrarModal = () => { setItem(null); setTrailerKey(null); setVerPeliculaCompleta(false); setEpisodios([]); };
  const reproducirCapitulo = (temp, cap) => { setCapituloActual({ temp, cap }); setVerPeliculaCompleta(true); };

  // --- LÓGICA DE URL INTELIGENTE (Script Indexador + NGINX) ---
  const obtenerUrlVideo = () => {
    if (!item) return '';

    // 1. Caso SERIES
    if (item.tipo === 'serie' || item.tipo === 'tv') {
        const key = `S${capituloActual.temp}E${capituloActual.cap}`;
        
        if (item.episodios_locales && item.episodios_locales[key]) {
            return `${URL_SERVIDOR}/series/${encodeURI(item.episodios_locales[key])}`;
        }
        
        // Fallback: Si no está indexado, intenta adivinar (útil si la carpeta está limpia)
        return `${URL_SERVIDOR}/series/${item.id_tmdb}/S${capituloActual.temp}E${capituloActual.cap}.mp4`;
    }

    // 2. Caso PELÍCULAS
    if (item.url_video) {
        // Si el script guardó la ruta (ej: "Peliculas/Avatar.2009.mp4")
        return `${URL_SERVIDOR}/peliculas/${encodeURI(item.url_video)}`;
    }
    
    // Fallback películas
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}.mp4`;
  };

  if (loadingAuth) {
    return <div style={{height:'100vh', background:'#0f0f12', display:'flex', justifyContent:'center', alignItems:'center', color:'white'}}>Cargando...</div>;
  }

  // --- VISTA LOGIN ---
  if (!usuario) {
    return (
      <div className="login-premium-bg">
        <div className="login-card">
          <div style={{marginBottom: '20px', display: 'flex', justifyContent: 'center'}}>
             <img src="/logo.svg" alt="Logo" style={{height: '60px', objectFit: 'contain'}} />
          </div>
          <h2 className="login-title">Bienvenido</h2>
          <p className="login-subtitle">Ingresa tus credenciales</p>
          <form onSubmit={handleLogin}>
            <div className="input-group">
                <input type="email" className="login-input" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
                <input type="password" className="login-input" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {errorLogin && <p style={{color: '#ef4444', fontSize: '13px', margin:'10px 0'}}>{errorLogin}</p>}
            <button type="submit" className="btn-login-premium">Acceder</button>
          </form>
          <div className="login-footer">
            ¿Sin cuenta? 
            <a href="https://wa.me/5491124023668" target="_blank" rel="noopener noreferrer" style={{color: '#818cf8', textDecoration: 'none', fontWeight:'bold', marginLeft:'5px'}}>Suscríbete aquí</a>
          </div>
          <div style={{marginTop: '40px', fontSize: '11px', color: '#666'}}>
            Desarrollado por 
            <a href="https://foxapps.lat" target="_blank" rel="noopener noreferrer" style={{color: '#888', textDecoration: 'none', fontWeight:'bold', marginLeft: '4px'}}>Foxapps</a>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA CATÁLOGO ---
  return (
    <div className="catalogo-container">
      
      {/* HEADER */}
      <header className="header-container">
        <div className="header-logo-wrapper">
            <img src="/logo.svg" alt="StreamGo" className="header-logo" onClick={() => window.location.reload()} />
        </div>
        <div className="profile-widget">
          <div className="profile-info">
             <span className="profile-name">Hola, {usuario.email.split('@')[0]}</span>
             <span className="profile-status">Online</span>
          </div>
          <div className="profile-avatar-circle">
             {usuario.email.charAt(0).toUpperCase()}
          </div>
          <span className="profile-arrow">▼</span>
          <div className="dropdown-menu">
             <div className="menu-item" style={{cursor:'default', borderBottom:'1px solid #333', paddingBottom:'10px', marginBottom:'5px'}}>{usuario.email}</div>
             <button className="menu-item logout" onClick={() => getAuth().signOut()}>Cerrar Sesión</button>
          </div>
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="toolbar-container">
        {/* LISTA DE PLATAFORMAS */}
        <div className="plataformas-list">
          {PLATAFORMAS.map((plat) => (
            <div key={plat.id} className={`plat-btn ${plataformaActiva === plat.id ? 'active' : ''}`} onClick={() => togglePlataforma(plat.id)} title={plat.id}>
              <img src={plat.logo} alt={plat.id} />
            </div>
          ))}
        </div>

        {/* BUSCADOR */}
        <div className="search-inline">
           <span className="search-icon">🔍</span>
           <input type="text" className="search-input" placeholder="Buscar..." value={busqueda} onChange={handleBusqueda} />
        </div>
      </div>

      {/* FILTRO TIPO (PELICULAS / SERIES) */}
      <div className="filtros-tipo-container">
        <button className={`btn-filtro ${tipoSeleccionado === 'todo' ? 'activo' : ''}`} onClick={() => handleTipoChange('todo')}>Todo</button>
        <button className={`btn-filtro ${tipoSeleccionado === 'movie' ? 'activo' : ''}`} onClick={() => handleTipoChange('movie')}>Películas</button>
        <button className={`btn-filtro ${tipoSeleccionado === 'serie' ? 'activo' : ''}`} onClick={() => handleTipoChange('serie')}>Series</button>
      </div>

      <div className="filas-generos">
        {Object.keys(itemsFiltrados).length > 0 ? (
          <>
            {itemsFiltrados["Estrenos"] && (!plataformaActiva || plataformaActiva === 'Cine') && (
              <Fila key="Estrenos" titulo="🔥 Estrenos en Cine" peliculas={itemsFiltrados["Estrenos"]} onClickPelicula={abrirModal} />
            )}
            {Object.keys(itemsFiltrados).sort().map((genero) => {
              if (genero === "Estrenos" && (!plataformaActiva || plataformaActiva === 'Cine')) return null;
              return ( <Fila key={genero} titulo={genero} peliculas={itemsFiltrados[genero]} onClickPelicula={abrirModal} /> );
            })}
          </>
        ) : (
          <div style={{padding: '50px', textAlign: 'center', color: '#666'}}>{busqueda ? <p>Sin resultados</p> : <p>Cargando...</p>}</div>
        )}
      </div>

      {verPeliculaCompleta && item && (
        <div className="reproductor-overlay" ref={playerRef}>
          <button className="btn-salir-cine" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          
          {/* REPRODUCTOR NATIVO CONECTADO A TU SERVIDOR */}
          <video 
            controls 
            autoPlay 
            className="video-player-nativo"
            style={{ width: '100%', height: '100%', outline: 'none', backgroundColor: 'black' }}
            onError={(e) => console.log("Error cargando video. URL intentada:", e.target.src)}
          >
            <source src={obtenerUrlVideo()} type="video/mp4" />
            <source src={obtenerUrlVideo()} type="video/webm" />
            <source src={obtenerUrlVideo()} type="video/ogg" />
            <p style={{color:'white', padding: 20}}>
               El formato de video no es compatible con el navegador o el archivo no se encuentra en el servidor.
            </p>
          </video>

        </div>
      )}

      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="video-area">
              <button className="btn-cerrar" onClick={cerrarModal}>✕</button>
              {trailerKey ? (
                <iframe 
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=1&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&loop=1&playlist=${trailerKey}`} 
                  title="Trailer" 
                  allow="autoplay; encrypted-media" 
                  allowFullScreen 
                  style={{width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0}}
                />
              ) : (
                <div style={{backgroundImage: `url(${item.imagen_fondo})`, width:'100%', height:'100%', backgroundSize:'cover', backgroundPosition:'center top'}} onClick={() => setVerPeliculaCompleta(true)} />
              )}
            </div>
            
            <div className="info-container">
              <div className="netflix-logo">{item.plataforma_origen?.toUpperCase()}</div>
              <h2 className="titulo-principal">{item.titulo}</h2>
              <div className="meta-row"><span style={{color: '#46d369', fontWeight: 'bold'}}>98% para ti</span><span>{item.fecha_estreno?.split('-')[0]}</span><span className="hd-badge">HD</span>{item.tipo === 'serie' && <span>{numTemporadas.length} Temporadas</span>}</div>
              <button className="btn-accion-full blanco" onClick={() => setVerPeliculaCompleta(true)}><span>▶</span> Reproducir</button>
              <p className="sinopsis">{item.descripcion}</p>
              {item.tipo === 'serie' && (
                <div className="tabs-container">
                  <div className="cabecera-episodios"><div className="tab-header">Episodios</div><select className="selector-temporada" value={temporadaSeleccionada} onChange={(e) => cargarEpisodiosDeTemporada(item.id_tmdb, e.target.value)}>{numTemporadas.map(num => (<option key={num} value={num}>Temporada {num}</option>))}</select></div>
                  <div className="lista-episodios">{episodios.length > 0 ? episodios.map(ep => (<div className="episodio-item" key={ep.id} onClick={() => reproducirCapitulo(temporadaSeleccionada, ep.episode_number)}><div className="episodio-img-wrapper">{ep.still_path ? (<img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={`Ep ${ep.episode_number}`} className="episodio-img"/>) : ( <div className="episodio-img" style={{background:'#333'}}></div> )}<div className="preview-play">▶</div></div><div className="episodio-info"><h4>{ep.episode_number}. {ep.name}</h4><span>{ep.runtime ? `${ep.runtime} min` : ''}</span><p style={{fontSize:'0.8rem', color:'#999', marginTop:5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{ep.overview}</p></div></div>)) : (<p style={{color:'#666', padding:20}}>Cargando episodios...</p>)}</div>
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