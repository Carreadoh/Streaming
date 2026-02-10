import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import axios from 'axios';
import Fila from './Fila';
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

  const playerContainerRef = useRef(null);

  // --- LÓGICA DE SESIÓN ---
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
        organizarPorGeneros(dataUnica, null, '', 'todo'); 
      } catch (e) { 
        console.error(e);
        setItemsFiltrados({});
      }
    };
    obtenerDatos();
  }, [usuario]);

  // --- SOLUCIÓN TÉCNICA REPRODUCTOR ---
  useEffect(() => {
    if (verPeliculaCompleta && item && playerContainerRef.current) {
      const url = obtenerUrlVideo();
      playerContainerRef.current.innerHTML = `
        <media-player title="${item.titulo}" src="${url}" autoplay playsinline load="visible" crossorigin style="width: 100%; height: 100%; background-color: black;">
          <media-provider></media-provider>
          <media-video-layout></media-video-layout>
        </media-player>
      `;
    }
  }, [verPeliculaCompleta, item, capituloActual]);

  const organizarPorGeneros = (items, filtroPlataforma, textoBusqueda, filtroTipo) => {
    const agrupado = {};
    if (!items) return;
    items.forEach(p => {
      if (p.disponible_servidor !== true) return; 
      if (textoBusqueda) {
        const titulo = (p.titulo || "").toLowerCase();
        if (!titulo.includes(textoBusqueda.toLowerCase())) return;
      }
      if (filtroTipo && filtroTipo !== 'todo' && p.tipo !== filtroTipo) return;
      const origen = (p.plataforma_origen || "Otros").toLowerCase().trim();
      if (filtroPlataforma) {
        const pFiltro = filtroPlataforma.toLowerCase();
        let coincide = false;
        if (pFiltro === 'cine') { 
            if (origen === 'cine' || (Array.isArray(p.generos) && p.generos.includes('Estrenos'))) coincide = true; 
        }
        else if (origen.includes(pFiltro)) coincide = true;
        if (!coincide) return;
      }
      const listaGeneros = Array.isArray(p.generos) && p.generos.length > 0 ? p.generos : ["General"]; 
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

  const obtenerUrlVideo = () => {
    if (!item) return '';
    if (item.tipo === 'serie' || item.tipo === 'tv') {
        const key = `S${capituloActual.temp}E${capituloActual.cap}`;
        if (item.episodios_locales && item.episodios_locales[key]) {
            return `${URL_SERVIDOR}/series/${encodeURI(item.episodios_locales[key])}`;
        }
        return `${URL_SERVIDOR}/series/${item.id_tmdb}/S${capituloActual.temp}E${capituloActual.cap}.mp4`;
    }
    if (item.url_video) {
        return `${URL_SERVIDOR}/peliculas/${encodeURI(item.url_video)}`;
    }
    return `${URL_SERVIDOR}/peliculas/${item.id_tmdb}.mp4`;
  };

  if (loadingAuth) return <div className="loading-screen">Cargando...</div>;

  if (!usuario) {
    return (
      <div className="login-premium-bg">
        <div className="login-card">
          <div className="logo-login"><img src="/logo.svg" alt="Logo" /></div>
          <h2 className="login-title">Bienvenido</h2>
          <form onSubmit={handleLogin}>
            <input type="email" className="login-input" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" className="login-input" placeholder="Pass" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {errorLogin && <p className="error-text">{errorLogin}</p>}
            <button type="submit" className="btn-login-premium">Acceder</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogo-container">
      <header className="header-container">
        <div className="header-logo-wrapper"><img src="/logo.svg" alt="StreamGo" className="header-logo" onClick={() => window.location.reload()} /></div>
        <div className="profile-widget">
          <div className="profile-info"><span className="profile-name">Hola, {usuario.email.split('@')[0]}</span><span className="profile-status">Online</span></div>
          <div className="profile-avatar-circle">{usuario.email.charAt(0).toUpperCase()}</div>
          <div className="dropdown-menu"><button className="menu-item logout" onClick={() => getAuth().signOut()}>Cerrar Sesión</button></div>
        </div>
      </header>

      <div className="toolbar-container">
        <div className="plataformas-list">{PLATAFORMAS.map((plat) => (<div key={plat.id} className={`plat-btn ${plataformaActiva === plat.id ? 'active' : ''}`} onClick={() => togglePlataforma(plat.id)}><img src={plat.logo} alt={plat.id} /></div>))}</div>
        <div className="search-inline"><input type="text" className="search-input" placeholder="Buscar..." value={busqueda} onChange={handleBusqueda} /></div>
      </div>

      <div className="filtros-tipo-container">
        {['todo', 'movie', 'serie'].map(t => (<button key={t} className={`btn-filtro ${tipoSeleccionado === t ? 'activo' : ''}`} onClick={() => handleTipoChange(t)}>{t === 'todo' ? 'Todo' : t === 'movie' ? 'Películas' : 'Series'}</button>))}
      </div>

      <div className="filas-generos">
        {Object.keys(itemsFiltrados).sort().map((genero) => (<Fila key={genero} titulo={genero} peliculas={itemsFiltrados[genero]} onClickPelicula={abrirModal} />))}
      </div>

      {verPeliculaCompleta && item && (
        <div className="reproductor-overlay">
          <button className="btn-salir-cine" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          <div ref={playerContainerRef} className="player-wrapper-cine" />
        </div>
      )}

      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="video-area">
              <button className="btn-cerrar" onClick={cerrarModal}>✕</button>
              {trailerKey ? (
                <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0`} title="Trailer" allowFullScreen />
              ) : (
                <div className="placeholder-img" style={{backgroundImage: `url(${item.imagen_fondo})`}} onClick={() => setVerPeliculaCompleta(true)} />
              )}
            </div>
            <div className="info-container">
              <div className="netflix-logo">{item.plataforma_origen?.toUpperCase()}</div>
              <h2 className="titulo-principal">{item.titulo}</h2>
              <button className="btn-accion-full blanco" onClick={() => setVerPeliculaCompleta(true)}>▶ Reproducir</button>
              <p className="sinopsis">{item.descripcion}</p>
              {item.tipo === 'serie' && (
                <div className="tabs-container">
                  <div className="cabecera-episodios">
                    <select className="selector-temporada" value={temporadaSeleccionada} onChange={(e) => cargarEpisodiosDeTemporada(item.id_tmdb, e.target.value)}>
                      {numTemporadas.map(num => (<option key={num} value={num}>Temporada {num}</option>))}
                    </select>
                  </div>
                  <div className="lista-episodios">
                    {episodios.map(ep => (
                      <div className="episodio-item" key={ep.id} onClick={() => reproducirCapitulo(temporadaSeleccionada, ep.episode_number)}>
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