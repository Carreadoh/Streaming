import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Catalogo from './components/Catalogo';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Ruta Principal: El Catálogo se encarga de su propio diseño */}
          <Route path="/" element={<Catalogo />} />

          {/* Ruta Admin */}
          <Route path="/admin" element={<AdminPanel />} />

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;