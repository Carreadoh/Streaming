import React from 'react';
// CAMBIO CLAVE: Usamos HashRouter en lugar de BrowserRouter
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Catalogo from './components/Catalogo';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Catalogo />} />

          <Route path="/admin" element={<AdminPanel />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;