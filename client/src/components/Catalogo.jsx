import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import axios from 'axios';
import Fila from './Fila';
import './Catalogo.css';

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';

// PROVEEDOR DE VIDEO
const PROVEEDOR_BASE = 'https://vidsrc.xyz/embed'; 

const PLATAFORMAS = [
  { id: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg' },
  { id: 'Disney', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
  { id: 'Amazon', logo: 'https://play-lh.googleusercontent.com/mZ6pRo5-NnrO9GMwFNrK5kShF0UrN5UOARVAw64_5aFG6NgEHSlq-BX5I8TEXtTOk9s' },
  { id: 'Apple', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg' },
  { id: 'HBO', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg' },
  { id: 'Paramount', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg' },
  { id: 'Crunchyroll', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.png' },
  { id: 'Cine', logo: 'https://cdn-icons-png.flaticon.com/512/3163/3163508.png' },
];

const Catalogo = () => {
  const [todosLosItems, setTodosLosItems] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState({});
  const [plataformaActiva, setPlataformaActiva] = useState(null); 
  const [busqueda, setBusqueda] = useState('');

  const [item, setItem] = useState(null); 
  const [trailerKey, setTrailerKey] = useState(null); 
  const [verPeliculaCompleta, setVerPeliculaCompleta] = useState(false);
  
  const playerRef = useRef(null);
  const [numTemporadas, setNumTemporadas] = useState([]); 
  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState(1);
  const [episodios, setEpisodios] = useState([]); 
  const [capituloActual, setCapituloActual] = useState({ temp: 1, cap: 1 }); 

  // Carga inicial de datos
  useEffect(() => {
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
        
        // --- AQUÍ ESTÁ EL CHIVATO ---
        // Esto filtrará los nombres repetidos y te mostrará la lista limpia en la consola
        const plataformasEncontradas = [...new Set(dataUnica.map(p => p.plataforma_origen))];
        console.log("📢 LISTA DE PLATAFORMAS EN BD:", plataformasEncontradas);
        // ----------------------------

        setTodosLosItems(dataUnica);
        organizarPorGeneros(dataUnica, null, ''); 
      } catch (e) { console.error(e); }
    };
    obtenerDatos();
  }, []);

  // Bloqueo de scroll body
  useEffect(() => {
    if (item) {
      document.body.classList.add('modal-abierto');
    } else {
      document.body.classList.remove('modal-abierto');
    }
    return () => { document.body.classList.remove('modal-abierto'); };
  }, [item]);

  const organizarPorGeneros = (items, filtroPlataforma, textoBusqueda) => {
    const agrupado = {};
    items.forEach(p => {
      // 1. Filtro por Texto (Buscador)
      if (textoBusqueda) {
        const titulo = p.titulo.toLowerCase();
        const busquedaLower = textoBusqueda.toLowerCase();
        if (!titulo.includes(busquedaLower)) return;
      }
      
      // 2. Normalización del Origen (Para evitar errores de mayúsculas/espacios)
      const origen = (p.plataforma_origen || "Otros").toLowerCase().trim();
      
      // 3. Filtro por Plataforma (Botones)
      if (filtroPlataforma) {
        const pFiltro = filtroPlataforma.toLowerCase();
        let coincide = false;
        
        if (pFiltro === 'cine') { 
            if (origen === 'cine' || p.generos?.includes('Estrenos')) coincide = true; 
        }
        else if (pFiltro === 'amazon') { 
            if (origen.includes('amazon') || origen.includes('prime')) coincide = true; 
        }
        else if (pFiltro === 'hbo') { 
            // Filtro flexible para HBO
            if (origen.includes('hbo') || origen.includes('max')) coincide = true; 
        }
        else { 
            if (origen.includes(pFiltro)) coincide = true; 
        }
        
        if (!coincide) return;
      }
      
      // 4. Agrupación por Géneros
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
    organizarPorGeneros(todosLosItems, plataformaActiva, texto);
  };

  const togglePlataforma = (idPlat) => {
    if (plataformaActiva === idPlat) {
      setPlataformaActiva(null);
      organizarPorGeneros(todosLosItems, null, busqueda); 
    } else {
      setPlataformaActiva(idPlat);
      organizarPorGeneros(todosLosItems, idPlat, busqueda); 
    }
  };

  useEffect(() => {
    if (verPeliculaCompleta && playerRef.current) {
      const elem = playerRef.current;
      if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
    }
  }, [verPeliculaCompleta]);

  const buscarTrailer = async (idTMDB, tipo) => {
    setTrailerKey(null); 
    try {
      const tipoContenido = tipo === 'serie' ? 'tv' : 'movie';
      const response = await axios.get(
        `https://api.themoviedb.org/3/${tipoContenido}/${idTMDB}/videos`, 
        { params: { api_key: TMDB_API_KEY, language: 'es-MX' } }
      );
      const videosEs = response.data.results;
      let video = videosEs.find(v => v.site === "YouTube" && v.type === "Trailer");
      if (!video) video = videosEs.find(v => v.site === "YouTube" && v.type === "Teaser");
      if (!video) {
        const responseEn = await axios.get(
          `https://api.themoviedb.org/3/${tipoContenido}/${idTMDB}/videos`, 
          { params: { api_key: TMDB_API_KEY } } 
        );
        const videosEn = responseEn.data.results;
        video = videosEn.find(v => v.site === "YouTube" && v.type === "Trailer");
      }
      if (video) setTrailerKey(video.key);
    } catch (error) { console.error("Error buscando video:", error); }
  };

  const cargarDetallesSerie = async (idTMDB) => {
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${idTMDB}`, {
        params: { api_key: TMDB_API_KEY, language: 'es-MX' }
      });
      const totalTemps = res.data.number_of_seasons;
      const arrayTemps = Array.from({ length: totalTemps }, (_, i) => i + 1);
      setNumTemporadas(arrayTemps);
      cargarEpisodiosDeTemporada(idTMDB, 1);
    } catch (error) { console.error("Error serie:", error); }
  };

  const cargarEpisodiosDeTemporada = async (idTMDB, numTemp) => {
    setEpisodios([]); 
    setTemporadaSeleccionada(numTemp);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${idTMDB}/season/${numTemp}`, {
        params: { api_key: TMDB_API_KEY, language: 'es-MX' }
      });
      setEpisodios(res.data.episodes);
    } catch (error) { console.error("Error episodios:", error); }
  };

  const abrirModal = (peli) => { 
    setItem(peli); 
    setVerPeliculaCompleta(false);
    buscarTrailer(peli.id_tmdb, peli.tipo);
    if (peli.tipo === 'serie') {
      setCapituloActual({ temp: 1, cap: 1 });
      cargarDetallesSerie(peli.id_tmdb);
    }
  };

  const cerrarModal = () => {
    setItem(null);
    setTrailerKey(null);
    setVerPeliculaCompleta(false);
    setEpisodios([]);
  };

  const reproducirCapitulo = (temp, cap) => {
    setCapituloActual({ temp, cap });
    setVerPeliculaCompleta(true);
  };

  return (
    <div className="catalogo-container">
      
      <div className="buscador-container">
        <div className="input-wrapper">
          <svg className="icono-lupa" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" className="input-buscador" placeholder="¿Qué quieres ver hoy?" value={busqueda} onChange={handleBusqueda} />
        </div>
      </div>

      <div className="seccion-streaming">
        <h3 className="titulo-seccion">Plataformas</h3>
        <div className="plataformas-scroll">
          {PLATAFORMAS.map((plat) => (
            <div key={plat.id} className={`plataforma-btn btn-${plat.id.toLowerCase()} ${plataformaActiva === plat.id ? 'activa' : ''}`} onClick={() => togglePlataforma(plat.id)}>
              <img src={plat.logo} alt={plat.id} />
            </div>
          ))}
        </div>
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
          <div style={{padding: '50px', textAlign: 'center', color: '#666'}}>
            {busqueda ? <p>No hay resultados para "{busqueda}"</p> : <p>Cargando catálogo...</p>}
          </div>
        )}
      </div>

      {verPeliculaCompleta && item && (
        <div className="reproductor-overlay" ref={playerRef}>
          <button className="btn-salir-cine" onClick={() => setVerPeliculaCompleta(false)}>← Volver</button>
          
          <iframe 
            src={item.tipo === 'serie' 
              ? `${PROVEEDOR_BASE}/tv/${item.id_tmdb}/${capituloActual.temp}/${capituloActual.cap}`
              : `${PROVEEDOR_BASE}/movie/${item.id_tmdb}`
            }
            title="Pelicula Completa" 
            allow="autoplay; fullscreen" 
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      )}

      {item && !verPeliculaCompleta && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="video-area">
              <button className="btn-cerrar" onClick={cerrarModal}>✕</button>
              {trailerKey ? (
                <div className="video-wrapper">
                  <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&loop=1&playlist=${trailerKey}`} title="Trailer" allow="autoplay; encrypted-media" allowFullScreen />
                  <div className="video-overlay-click" onClick={() => setVerPeliculaCompleta(true)}></div>
                </div>
              ) : (
                <div style={{backgroundImage: `url(${item.imagen_fondo})`, width:'100%', height:'100%', backgroundSize:'cover'}} onClick={() => setVerPeliculaCompleta(true)} />
              )}
            </div>
            
            <div className="info-container">
              <div className="netflix-logo">{item.plataforma_origen?.toUpperCase()}</div>
              <h2 className="titulo-principal">{item.titulo}</h2>
              <div className="meta-row">
                <span style={{color: '#46d369', fontWeight: 'bold'}}>98% para ti</span>
                <span>{item.fecha_estreno?.split('-')[0]}</span>
                <span className="hd-badge">HD</span>
                {item.tipo === 'serie' && <span>{numTemporadas.length} Temporadas</span>}
              </div>
              <button className="btn-accion-full blanco" onClick={() => setVerPeliculaCompleta(true)}><span>▶</span> Reproducir</button>
              <p className="sinopsis">{item.descripcion}</p>
              <div className="acciones-row">
                <div className="accion-item"><span className="accion-icon">+</span><span>Mi lista</span></div>
                <div className="accion-item"><span className="accion-icon">👍</span><span>Calificar</span></div>
                <div className="accion-item"><span className="accion-icon">🚀</span><span>Compartir</span></div>
              </div>

              {item.tipo === 'serie' && (
                <div className="tabs-container">
                  <div className="cabecera-episodios">
                    <div className="tab-header">Episodios</div>
                    <select className="selector-temporada" value={temporadaSeleccionada} onChange={(e) => cargarEpisodiosDeTemporada(item.id_tmdb, e.target.value)}>
                      {numTemporadas.map(num => (<option key={num} value={num}>Temporada {num}</option>))}
                    </select>
                  </div>
                  <div className="lista-episodios">
                    {episodios.length > 0 ? episodios.map(ep => (
                      <div className="episodio-item" key={ep.id} onClick={() => reproducirCapitulo(temporadaSeleccionada, ep.episode_number)}>
                        <div className="episodio-img-wrapper">
                          {ep.still_path ? (<img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={`Ep ${ep.episode_number}`} className="episodio-img"/>) : ( <div className="episodio-img" style={{background:'#333'}}></div> )}
                          <div className="preview-play" style={{width:30, height:30, fontSize:12, borderWidth:1}}>▶</div>
                        </div>
                        <div className="episodio-info">
                          <h4>{ep.episode_number}. {ep.name}</h4>
                          <span>{ep.runtime ? `${ep.runtime} min` : ''}</span>
                          <p style={{fontSize:'0.8rem', color:'#999', marginTop:5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{ep.overview}</p>
                        </div>
                      </div>
                    )) : (<p style={{color:'#666', padding:20}}>Cargando episodios...</p>)}
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