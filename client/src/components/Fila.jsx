import React, { useRef } from 'react';

const Fila = ({ titulo, peliculas, onClickPelicula }) => {
  const filaRef = useRef(null);

  const manejarScroll = (direccion) => {
    if (filaRef.current) {
      const { scrollLeft, clientWidth } = filaRef.current;
      const scrollAmount = direccion === 'izquierda' 
        ? scrollLeft - clientWidth 
        : scrollLeft + clientWidth;

      filaRef.current.scrollTo({
        left: scrollAmount,
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div className="fila-container">
      <h2 className="fila-titulo">{titulo}</h2>
      
      <div className="fila-wrapper">
        <button 
          className="flecha flecha-izquierda" 
          onClick={() => manejarScroll('izquierda')}>
          ‹
        </button>
        <div className="fila-posters" ref={filaRef}>
          {peliculas.map((peli) => (
            <div 
              key={peli.id_tmdb} 
              className="fila-poster"
              onClick={() => onClickPelicula(peli)}
            >
              <img src={peli.imagen_poster} alt={peli.titulo} />
            </div>
          ))}
        </div>

        <button 
          className="flecha flecha-derecha" 
          onClick={() => manejarScroll('derecha')}>
          ›
        </button>
      </div>
    </div>
  );
};

export default Fila;