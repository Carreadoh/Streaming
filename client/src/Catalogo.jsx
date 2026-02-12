import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { App as CapacitorApp } from '@capacitor/app'; 
import Fila from './Fila';
import VideoPlayer from './VideoPlayer';
import '../App.css'; 

const URL_SERVIDOR = 'https://cine.neveus.lat';

/* ✅ MOVIDA FUERA DEL COMPONENTE */
const normalizarTexto = (texto) => {
  return texto 
    ? String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
};

const Catalogo = () => {

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

  const [favoritos, setFavoritos] = useState(() => 
    JSON.parse(localStorage.getItem('favoritos')) || []
  );
  const [miLista, setMiLista] = useState(() => 
    JSON.parse(localStorage.getItem('miLista')) || []
  );

  /* ---------------- CARGA DE DATOS ---------------- */

  useEffect(() => {
    const cargar = async () => {
      try {
        const pSnap = await getDocs(collection(db, "peliculas"));
        const sSnap = await getDocs(collection(db, "series"));
        
        const combinados = [];
        
        pSnap.forEach(d => {
          combinados.push({ id: d.id, ...d.data(), tipo: 'movie' });
        });
        
        sSnap.forEach(d => {
          combinados.push({ id: d.id, ...d.data(), tipo: 'serie' });
        });

        setTodosLosItems(combinados);
        filtrar(combinados, null, '', 'todo');
      } catch (e) { 
        console.error(e); 
      }
    };
    cargar();
  }, []);

  /* ---------------- FILTRO CORREGIDO ---------------- */

  const filtrar = (items, plat, busq, tipo) => {
    const agrupado = {};

    if (tipo === 'favoritos') agrupado['Favoritos'] = [];
    if (tipo === 'milista') agrupado['Mi Lista'] = [];

    const busquedaNorm = normalizarTexto(busq);
    const platNorm = plat ? normalizarTexto(plat) : null;

    items.forEach(p => {

      // Categoría
      if (tipo === 'favoritos' && !favoritos.includes(p.id)) return;
      if (tipo === 'milista' && !miLista.includes(p.id)) return;
      if (tipo === 'peliculas' && p.tipo !== 'movie') return;
      if (tipo === 'series' && p.tipo !== 'serie') return;

      // Plataforma
      const pPlataforma = normalizarTexto(p.plataforma_origen || '');
      if (platNorm && !pPlataforma.includes(platNorm)) return;

      // 🔎 BUSCADOR MEJORADO (titulo + descripcion + overview)
      const textoBusqueda = normalizarTexto(
        `${p.titulo || ''} ${p.descripcion || ''} ${p.overview || ''}`
      );

      if (busquedaNorm && !textoBusqueda.includes(busquedaNorm)) return;

      // Agrupar por géneros
      const generos = p.generos || ["General"];
      const generosUnicos = [...new Set(generos)];

      generosUnicos.forEach(g => {
        if (!agrupado[g]) agrupado[g] = [];
        if (!agrupado[g].some(x => x.id === p.id)) {
          agrupado[g].push(p);
        }
      });
    });

    setItemsFiltrados(agrupado);
  };

  /* ---------------- BUSCADOR ---------------- */

  useEffect(() => {
    if (tipoContenido === 'buscador' && inputBusquedaRef.current) {
      inputBusquedaRef.current.focus();
    }
  }, [tipoContenido]);

  const handleCambiarTipo = (tipo) => {
    setTipoContenido(tipo);
    setMenuAbierto(false);
    const nuevaBusqueda = tipo === 'buscador' ? busqueda : '';
    setBusqueda(nuevaBusqueda);
    filtrar(todosLosItems, plataformaActiva, nuevaBusqueda, tipo);
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="catalogo-wrapper">

      {tipoContenido === 'buscador' && (
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
          <input
            ref={inputBusquedaRef}
            type="text"
            placeholder="Buscar película o serie..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              filtrar(todosLosItems, plataformaActiva, e.target.value, tipoContenido);
            }}
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: '15px',
              borderRadius: '30px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              fontSize: '16px',
              outline: 'none',
              textAlign: 'center'
            }}
          />
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
  );
};

export default Catalogo;
