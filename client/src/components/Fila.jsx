import React from 'react';
// import './Fila.css'; // YA NO HACE FALTA SI PUSISTE TODO EN APP.CSS

const Fila = ({ titulo, peliculas, onClickPelicula }) => {
  if (!peliculas || peliculas.length === 0) return null;

  return (
    <div className="fila-container">
      <h2 className="fila-titulo">{titulo}</h2>
      
      <div className="fila-scroll">
        {peliculas.map((peli) => (
          <div
            key={peli.id_tmdb || peli.id}
            className="movie-card"
            /* LÓGICA TV: Permitir foco y detectar Enter */
            tabIndex="0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onClickPelicula(peli);
            }}
            /* LÓGICA CELULAR: Click normal */
            onClick={() => onClickPelicula(peli)}
          >
            <img
              className="movie-img"
              src={peli.poster_path ? `https://image.tmdb.org/t/p/w300${peli.poster_path}` : '/no-img.png'}
              alt={peli.titulo}
              loading="lazy"
            />
            {/* Título solo visible en TV al enfocar */}
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