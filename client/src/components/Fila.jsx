import React, { useRef } from 'react';
import './Fila.css'; // O App.css si usas uno global

const Fila = ({ titulo, peliculas, onClickPelicula }) => {
  const rowRef = useRef(null);

  // Manejo de teclas para TV (Enter abre la peli)
  const handleKeyDown = (e, peli) => {
    if (e.key === 'Enter') {
      onClickPelicula(peli);
    }
  };

  return (
    <div className="fila-container">
      <h2 className="fila-titulo">{titulo}</h2>

      {/* Contenedor con Scroll Horizontal */}
      <div className="fila-scroll" ref={rowRef}>
        {peliculas.map((peli) => (
          <div
            key={peli.id_tmdb || peli.id} // Usamos ID único
            className="movie-card"
            /* --- LÓGICA TV --- */
            tabIndex="0" // ¡VITAL! Permite que el control remoto "vea" la tarjeta
            onKeyDown={(e) => handleKeyDown(e, peli)} // Permite dar OK con el control
            /* --- LÓGICA CELULAR/MOUSE --- */
            onClick={() => onClickPelicula(peli)}
          >
            <img
              className="movie-img"
              src={
                peli.poster_path 
                  ? `https://image.tmdb.org/t/p/w300${peli.poster_path}` 
                  : 'https://via.placeholder.com/300x450?text=Sin+Imagen'
              }
              alt={peli.titulo}
              loading="lazy"
            />
            {/* Título opcional, visible solo al hacer foco en TV */}
            <div className="movie-overlay">
              <span className="movie-title">{peli.titulo}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Fila;