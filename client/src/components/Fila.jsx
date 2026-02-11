import React from 'react';
// import './Fila.css'; // YA NO HACE FALTA SI PUSISTE TODO EN APP.CSS

const Fila = ({ titulo, peliculas, onClickPelicula }) => {
  if (!peliculas || peliculas.length === 0) return null;

  const getPosterUrl = (path) => {
    if (!path) return '/no-img.png';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w300${path}`;
  };

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
              src={peli.imagen_poster || '/no-img.png'}
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