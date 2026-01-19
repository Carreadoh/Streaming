// server/index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// DATOS SIMULADOS (Más adelante vendrán de una Base de Datos Real)
const peliculas = [
    { id: 1, titulo: "Inception", anio: 2010, director: "Christopher Nolan", imagen: "https://via.placeholder.com/300x450?text=Inception" },
    { id: 2, titulo: "The Matrix", anio: 1999, director: "Lana Wachowski", imagen: "https://via.placeholder.com/300x450?text=The+Matrix" },
    { id: 3, titulo: "Interstellar", anio: 2014, director: "Christopher Nolan", imagen: "https://via.placeholder.com/300x450?text=Interstellar" },
    { id: 4, titulo: "Parasite", anio: 2019, director: "Bong Joon-ho", imagen: "https://via.placeholder.com/300x450?text=Parasite" },
    { id: 5, titulo: "The Godfather", anio: 1972, director: "Francis Ford Coppola", imagen: "https://via.placeholder.com/300x450?text=Godfather" },
    { id: 6, titulo: "Pulp Fiction", anio: 1994, director: "Quentin Tarantino", imagen: "https://via.placeholder.com/300x450?text=Pulp+Fiction" },
];

app.get('/', (req, res) => {
    res.send('API de Películas funcionando');
});

// NUEVA RUTA: Devolver películas
app.get('/api/peliculas', (req, res) => {
    res.json(peliculas);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor de películas en http://localhost:${PORT}`);
});