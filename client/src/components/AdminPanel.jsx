import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app"; 
import axios from 'axios';
import './AdminPanel.css';

const TMDB_API_KEY = '7e0bf7d772854c500812f0348782872c';

// Configuración para crear usuarios sin cerrar sesión (si fuera necesario)
const firebaseConfig = {
  apiKey: "AIzaSyA1_Hd2K0xrkDc5ZZht-2WxTVE1hyWu04E",
  authDomain: "cuevanarg.firebaseapp.com",
  projectId: "cuevanarg",
  storageBucket: "cuevanarg.firebasestorage.app",
  messagingSenderId: "149062152720",
  appId: "1:149062152720:web:b25b096345629e7b4e5095"
};

const AdminPanel = ({ onVolver }) => {
  // --- ESTADO DE AUTENTICACIÓN LOCAL ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // --- ESTADOS DEL DASHBOARD ---
  const [vista, setVista] = useState('dashboard');
  const [stats, setStats] = useState({ peliculas: 0, series: 0, usuarios: 0 });
  const [contenido, setContenido] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [nuevoId, setNuevoId] = useState('');
  const [tipoAgregado, setTipoAgregado] = useState('movie');
  const [mensaje, setMensaje] = useState('');

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [mesesSuscripcion, setMesesSuscripcion] = useState(1);
  const [msgUsuario, setMsgUsuario] = useState('');

  // Credenciales quemadas
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = '1234';

  // --- LOGIN LOCAL ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      setIsAuthenticated(true);
      setError('');
      cargarTodo();
    } else {
      setError('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const cargarTodo = async () => {
    setLoading(true);
    try {
      // Contenido
      const pelisRef = collection(db, "peliculas");
      const seriesRef = collection(db, "series");
      const usuariosRef = collection(db, "usuarios"); // Nueva colección personalizada

      const [pelisSnap, seriesSnap, usuariosSnap] = await Promise.all([
        getDocs(pelisRef), 
        getDocs(seriesRef),
        getDocs(usuariosRef)
      ]);
      
      setStats({ 
        peliculas: pelisSnap.size, 
        series: seriesSnap.size,
        usuarios: usuariosSnap.size
      });

      const listaPelis = pelisSnap.docs.map(d => ({ id: d.id, ...d.data(), coleccion: 'peliculas' }));
      const listaSeries = seriesSnap.docs.map(d => ({ id: d.id, ...d.data(), coleccion: 'series' }));
      const listaUsuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setContenido([...listaPelis, ...listaSeries]);
      setUsuarios(listaUsuarios);

    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const eliminarItem = async (id, coleccion) => {
    if (!window.confirm("¿Eliminar contenido?")) return;
    try {
      await deleteDoc(doc(db, coleccion, id));
      cargarTodo();
    } catch (e) { alert("Error al eliminar"); }
  };

  const importarDesdeTMDB = async (e) => {
    e.preventDefault();
    setMensaje("⏳ Conectando...");
    try {
      const endpoint = tipoAgregado === 'movie' ? 'movie' : 'tv';
      const url = `https://api.themoviedb.org/3/${endpoint}/${nuevoId}?api_key=${TMDB_API_KEY}&language=es-MX`;
      const res = await axios.get(url);
      const data = res.data;
      
      const coleccion = tipoAgregado === 'movie' ? 'peliculas' : 'series';
      const prefijo = tipoAgregado === 'movie' ? 'p_' : 's_';
      const generos = data.genres ? data.genres.map(g => g.name) : ["General"];

      await setDoc(doc(db, coleccion, `${prefijo}${data.id}`), {
        id_tmdb: data.id,
        titulo: data.title || data.name,
        descripcion: data.overview,
        imagen_poster: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
        imagen_fondo: `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
        fecha_estreno: data.release_date || data.first_air_date,
        tipo: tipoAgregado,
        plataforma_origen: "Agregado Manual",
        generos: generos,
        video_url: '', 
        trailer_key: '' 
      });

      setMensaje(`✅ Importado: ${data.title || data.name}`);
      setNuevoId('');
      cargarTodo();
    } catch (error) { setMensaje("❌ ID no encontrado."); }
  };

  const crearUsuarioCliente = async (e) => {
    e.preventDefault();
    setMsgUsuario("⏳ Creando usuario...");

    // Usamos una app secundaria para no desloguear al admin (aunque sea local, evita conflictos con el Auth global)
    let secondaryApp;
    try {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    } catch(e) {
        // Si ya existe, ignoramos
    }

    try {
      const secondaryAuth = getAuth(secondaryApp);
      // 1. Crear en Authentication
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPass);
      const user = userCredential.user;

      // 2. Calcular Vencimiento
      const fechaVencimiento = new Date();
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + parseInt(mesesSuscripcion));

      // 3. Guardar en Firestore (Colección 'usuarios')
      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        email: user.email,
        fecha_creacion: new Date().toISOString(),
        fecha_vencimiento: fechaVencimiento.toISOString(),
        activo: true
      });

      await signOut(secondaryAuth); // Cerramos la sesión secundaria inmediatamente
      setMsgUsuario(`✅ Usuario creado. Vence: ${fechaVencimiento.toLocaleDateString()}`);
      setNewUserEmail('');
      setNewUserPass('');
      cargarTodo();

    } catch (error) {
      console.error(error);
      setMsgUsuario("❌ Error: " + error.message);
    }
  };

  const eliminarUsuario = async (uid) => {
    if(!window.confirm("Esto eliminará el acceso del usuario. ¿Seguro?")) return;
    try {
        await deleteDoc(doc(db, "usuarios", uid));
        // Nota: El usuario sigue en Auth, pero al no estar en Firestore, el Login lo rechazará (ver siguiente paso).
        cargarTodo();
    } catch (e) { alert("Error"); }
  }

  const getContenidoVisible = () => {
    if (vista === 'peliculas') return contenido.filter(i => i.tipo === 'movie');
    if (vista === 'series') return contenido.filter(i => i.tipo === 'serie');
    return contenido; // Dashboard muestra mezcla
  };

  // --- RENDER: LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="login-dashboard-bg">
        <div className="login-card">
          <div style={{marginBottom: '20px', textAlign: 'center'}}>
             <img src="/logo.png" alt="Logo" style={{height: '80px', objectFit:'contain'}} />
          </div>
          <h2 style={{color:'white', marginBottom:'20px', textAlign: 'center'}}>Admin Panel</h2>
          
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <input 
                className="input-dark" 
                type="text" 
                placeholder="Usuario" 
                value={username} 
                onChange={e=>setUsername(e.target.value)}
            />
            <input 
                className="input-dark" 
                type="password" 
                placeholder="Contraseña" 
                value={passwordLogin} 
                onChange={e=>setPassword(e.target.value)}
            />
            <button className="btn-primary" type="submit">Entrar</button>
            
            {error && <p style={{color:'#ef4444', fontSize:'13px', textAlign: 'center'}}>{error}</p>}
            
            <button 
                type="button" 
                onClick={onVolver}
                style={{background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', marginTop: '10px', textDecoration: 'underline'}}
            >
                Volver a la App
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo-area" style={{justifyContent: 'center'}}>
          <img src="/logo.png" alt="Logo" style={{width: '100%', maxWidth:'120px'}} />
        </div>
        
        <nav className="nav-links">
          <button className={`nav-item ${vista==='dashboard'?'active':''}`} onClick={()=>setVista('dashboard')}><span>📊</span> Dashboard</button>
          <button className={`nav-item ${vista==='peliculas'?'active':''}`} onClick={()=>setVista('peliculas')}><span>🎬</span> Películas</button>
          <button className={`nav-item ${vista==='series'?'active':''}`} onClick={()=>setVista('series')}><span>📺</span> Series</button>
          <button className={`nav-item ${vista==='usuarios'?'active':''}`} onClick={()=>setVista('usuarios')}><span>👥</span> Usuarios</button>
          <button className="nav-item logout" onClick={handleLogout}><span>🚪</span> Salir</button>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <h1>{vista.charAt(0).toUpperCase() + vista.slice(1)}</h1>
          </div>
          <button onClick={onVolver} style={{background: '#333', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer'}}>
            Ir a la App
          </button>
        </header>

        {/* VISTA: USUARIOS */}
        {vista === 'usuarios' ? (
          <div className="dashboard-split">
             <div className="section-card" style={{height: 'fit-content'}}>
                <h2>Crear Nuevo Cliente</h2>
                <form onSubmit={crearUsuarioCliente} className="import-form">
                    <div className="form-group">
                        <label>Correo Electrónico</label>
                        <input className="input-dark" type="email" required value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input className="input-dark" type="text" required value={newUserPass} onChange={e=>setNewUserPass(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Meses de Servicio</label>
                        <select className="select-dark" value={mesesSuscripcion} onChange={e=>setMesesSuscripcion(e.target.value)}>
                            <option value="1">1 Mes</option>
                            <option value="3">3 Meses</option>
                            <option value="6">6 Meses</option>
                            <option value="12">1 Año</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-primary">Crear Usuario</button>
                </form>
                {msgUsuario && <div className="import-status">{msgUsuario}</div>}
             </div>

             {/* LISTA DE USUARIOS */}
             <div className="section-card">
                <h2>Clientes Activos</h2>
                <div className="table-container">
                    <table className="modern-table">
                        <thead>
                            <tr><th>Email</th><th>Vencimiento</th><th>Estado</th><th>Acción</th></tr>
                        </thead>
                        <tbody>
                            {usuarios.map(u => {
                                const vencimiento = new Date(u.fecha_vencimiento);
                                const hoy = new Date();
                                const vencido = vencimiento < hoy;
                                return (
                                    <tr key={u.uid}>
                                        <td>{u.email}</td>
                                        <td>{vencimiento.toLocaleDateString()}</td>
                                        <td>
                                            <span className={`status-badge ${vencido ? 'badge-serie' : 'badge-movie'}`}>
                                                {vencido ? 'VENCIDO' : 'ACTIVO'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn-icon" onClick={()=>eliminarUsuario(u.uid)}>🗑️</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        ) : (
          <>
             {vista === 'dashboard' && (
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-icon-box icon-blue">🎬</div><div className="stat-info"><h3>Pelis</h3><p className="value">{stats.peliculas}</p></div></div>
                  <div className="stat-card"><div className="stat-icon-box icon-purple">📺</div><div className="stat-info"><h3>Series</h3><p className="value">{stats.series}</p></div></div>
                  <div className="stat-card"><div className="stat-icon-box icon-green">👥</div><div className="stat-info"><h3>Usuarios</h3><p className="value">{stats.usuarios}</p></div></div>
                </div>
             )}

             <div className="dashboard-split">
                {/* TABLA DE CONTENIDO */}
                <div className="section-card">
                    <div className="section-header">
                        <h2>Contenido {vista === 'dashboard' ? 'Reciente' : ''}</h2>
                    </div>
                    <div className="table-container">
                        <table className="modern-table">
                            <thead><tr><th width="50">Img</th><th>Título</th><th>Tipo</th><th style={{textAlign:'right'}}>Acción</th></tr></thead>
                            <tbody>
                                {getContenidoVisible().slice(0, 50).map((item) => (
                                    <tr key={item.id}>
                                        <td><img src={item.imagen_poster} alt="" className="poster-mini"/></td>
                                        <td style={{fontWeight:'500'}}>{item.titulo}</td>
                                        <td><span className={`status-badge ${item.tipo === 'movie' ? 'badge-movie' : 'badge-serie'}`}>{item.tipo}</span></td>
                                        <td style={{textAlign:'right'}}><button className="btn-icon" onClick={() => eliminarItem(item.id, item.coleccion)}>🗑️</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="section-card" style={{height:'fit-content'}}>
                    <h2>Importar desde TMDB</h2>
                    <form onSubmit={importarDesdeTMDB} className="import-form">
                        <div className="form-group">
                            <label>ID de TMDB</label>
                            <input type="text" className="input-dark" placeholder="Ej: 1399" value={nuevoId} onChange={e => setNuevoId(e.target.value)}/>
                        </div>
                        <div className="form-group">
                            <label>Tipo</label>
                            <select className="select-dark" value={tipoAgregado} onChange={e => setTipoAgregado(e.target.value)}>
                                <option value="movie">Película</option>
                                <option value="serie">Serie</option>
                            </select>
                        </div>
                        <button type="submit" className="btn-primary">Importar</button>
                    </form>
                    {mensaje && <div className="import-status">{mensaje}</div>}
                </div>
             </div>
          </>
        )}

      </main>
    </div>
  );
};

export default AdminPanel;
