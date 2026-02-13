import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminPanel.css';

const URL_SERVIDOR = 'https://cine.neveus.lat';

const AdminPanel = ({ onVolver, isReseller = false }) => {
  // --- AUTH LOCAL ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // --- ESTADOS ---
  const [vista, setVista] = useState('dashboard');
  const [stats, setStats] = useState({ peliculas: 0, series: 0, usuarios: 0, revendedores: 0 });
  const [contenido, setContenido] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [revendedores, setRevendedores] = useState([]); // Nueva lista
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Estados Formularios Clientes
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [mesesSuscripcion, setMesesSuscripcion] = useState(1);
  
  // Estados Formularios Revendedores
  const [newResellerEmail, setNewResellerEmail] = useState('');
  const [newResellerPass, setNewResellerPass] = useState('');
  const [newResellerCredits, setNewResellerCredits] = useState(10); // Default 10 creditos

  const [msgUsuario, setMsgUsuario] = useState('');

  const ADMIN_USER = 'admin';
  const ADMIN_PASS = '1234';

  const handleLogin = async (e) => {
    e.preventDefault();

    // --- LOGIN REVENDEDOR ---
    if (isReseller) {
        try {
            const res = await axios.post(`${URL_SERVIDOR}/auth.php`, {
                action: 'login',
                email: username,
                password: password
            });
            if (res.data.success) {
                if (res.data.user.rol !== 'reseller' && res.data.user.rol !== 'admin') {
                    setError('No tienes permisos de revendedor');
                    return;
                }
                setIsAuthenticated(true);
                setCurrentUser(res.data.user);
                localStorage.setItem('admin_session', JSON.stringify(res.data.user));
                setError('');
                cargarTodo(res.data.user.id);
            } else {
                setError(res.data.message || 'Credenciales incorrectas');
            }
        } catch (err) { setError('Error de conexión'); }
        return;
    }

    // --- LOGIN ADMIN ---
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const adminUser = { id: 'admin', rol: 'admin', email: ADMIN_USER };
      setIsAuthenticated(true);
      setCurrentUser(adminUser);
      localStorage.setItem('admin_session', JSON.stringify(adminUser));
      setError('');
      cargarTodo();
    } else {
      setError('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_session');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  // --- CARGA DE DATOS ---
  const cargarTodo = async (resellerId = null) => {
    setLoading(true);
    try {
      // 1. Clientes
      const payloadClientes = { action: 'list', tipo: 'cliente' };
      const activeId = resellerId || (currentUser ? currentUser.id : null);
      
      if (isReseller && activeId) {
          payloadClientes.creador_id = activeId;
      }
      const resClientes = await axios.post(`${URL_SERVIDOR}/auth.php`, payloadClientes);
      const listaClientes = Array.isArray(resClientes.data) ? resClientes.data : [];

      // 2. Revendedores (NUEVO)
      const resRevendedores = await axios.post(`${URL_SERVIDOR}/auth.php`, { action: 'list', tipo: 'reseller' });
      const listaRevendedores = Array.isArray(resRevendedores.data) ? resRevendedores.data : [];

      // 3. Contenido
      const resData = await axios.get(`${URL_SERVIDOR}/data.php`);
      const dataServidor = Array.isArray(resData.data) ? resData.data.map(item => ({
        ...item,
        tipo: item.tipo || 'movie'
      })) : [];

      // 4. Stats
      const totalPelis = dataServidor.filter(i => i.tipo === 'movie').length;
      const totalSeries = dataServidor.filter(i => i.tipo === 'serie').length;

      setStats({ 
        peliculas: totalPelis, 
        series: totalSeries, 
        usuarios: listaClientes.length,
        revendedores: listaRevendedores.length
      });

      setContenido(dataServidor);
      setUsuarios(listaClientes);
      setRevendedores(listaRevendedores);

    } catch (error) { 
        console.error("Error cargando datos:", error); 
    }
    setLoading(false);
  };

  // --- PERSISTENCIA DE SESIÓN (F5) ---
  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session) {
        try {
            const user = JSON.parse(session);
            // Validar que la sesión coincida con el modo actual (admin vs reseller)
            if (isReseller && user.rol !== 'reseller') return;
            if (!isReseller && user.rol !== 'admin') return;

            if (!isAuthenticated) {
                setIsAuthenticated(true);
                setCurrentUser(user);
                cargarTodo(user.id);
            }
        } catch (e) { localStorage.removeItem('admin_session'); }
    }
  }, [isReseller]);

  const eliminarItem = (id, coleccion) => {
    alert(`Para eliminar este item, borra el archivo .mp4 en /home/${coleccion} en tu VPS.`);
  };

  // --- CREAR CLIENTE FINAL ---
  const crearUsuarioCliente = async (e) => {
    e.preventDefault();
    setMsgUsuario("⏳ Creando cliente...");

    try {
        const payload = {
            action: 'register',
            email: newUserEmail,
            password: newUserPass,
            meses: mesesSuscripcion
        };

        if (isReseller && currentUser) {
            payload.creador_id = currentUser.id;
            payload.rol_creador = 'reseller';
        }
        const res = await axios.post(`${URL_SERVIDOR}/auth.php`, payload);

        if (res.data.success) {
            setMsgUsuario("✅ " + res.data.message);
            setNewUserEmail('');
            setNewUserPass('');
            cargarTodo();
        } else {
            setMsgUsuario("❌ " + res.data.message);
        }
    } catch (error) { setMsgUsuario("❌ Error de conexión"); }
  };

  // --- CREAR REVENDEDOR (NUEVO) ---
  const crearRevendedor = async (e) => {
    e.preventDefault();
    setMsgUsuario("⏳ Creando revendedor...");

    try {
        const res = await axios.post(`${URL_SERVIDOR}/auth.php`, {
            action: 'create_reseller',
            email: newResellerEmail,
            password: newResellerPass,
            creditos: newResellerCredits
        });

        if (res.data.success) {
            setMsgUsuario("✅ " + res.data.message);
            setNewResellerEmail('');
            setNewResellerPass('');
            cargarTodo();
        } else {
            setMsgUsuario("❌ " + res.data.message);
        }
    } catch (error) { setMsgUsuario("❌ Error de conexión"); }
  };

  const eliminarUsuario = async (id) => {
    if(!window.confirm("¿Eliminar usuario de la base de datos?")) return;
    try {
        await axios.post(`${URL_SERVIDOR}/auth.php`, { action: 'delete', id: id });
        cargarTodo();
    } catch (e) { alert("Error"); }
  }

  const getContenidoVisible = () => {
    let items = contenido;
    if (vista === 'peliculas') items = contenido.filter(i => i.tipo === 'movie');
    if (vista === 'series') items = contenido.filter(i => i.tipo === 'serie');
    
    if (searchTerm) {
      items = items.filter(i => 
        (i.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(i.id).includes(searchTerm)
      );
    }
    return items; 
  };

  if (!isAuthenticated) {
    return (
      <div className="login-dashboard-bg">
        <div className="login-card">
          <div style={{marginBottom: '30px', display: 'flex', justifyContent: 'center'}}>
             <img src="/logo.png" alt="Logo" style={{height: '150px', objectFit:'contain'}} />
          </div>
          <h2 style={{color:'white', marginBottom:'20px', textAlign: 'center'}}>{isReseller ? 'Reseller Panel' : 'Admin Panel'}</h2>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <input className="input-dark" type="text" placeholder="Usuario" value={username} onChange={e=>setUsername(e.target.value)} />
            <input className="input-dark" type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="btn-primary" type="submit">Entrar</button>
            {error && <p style={{color:'#ef4444', fontSize:'13px', textAlign: 'center'}}>{error}</p>}
            <button type="button" onClick={onVolver} style={{background:'transparent', border:'none', color:'#999', cursor:'pointer', marginTop:'10px', textDecoration:'underline'}}>Volver a la App</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="logo-area" style={{justifyContent: 'center'}}>
          <img src="/logo.png" alt="Logo" style={{width: '100%', maxWidth:'120px'}} />
        </div>
        <nav className="nav-links">
          <button className={`nav-item ${vista==='dashboard'?'active':''}`} onClick={()=>setVista('dashboard')}><span>📊</span> Dashboard</button>
          <button className={`nav-item ${vista==='peliculas'?'active':''}`} onClick={()=>setVista('peliculas')}><span>🎬</span> Películas</button>
          <button className={`nav-item ${vista==='series'?'active':''}`} onClick={()=>setVista('series')}><span>📺</span> Series</button>
          <button className={`nav-item ${vista==='usuarios'?'active':''}`} onClick={()=>setVista('usuarios')}><span>👥</span> Usuarios</button>
          {/* NUEVO BOTÓN REVENDEDORES */}
          {!isReseller && (
            <button className={`nav-item ${vista==='revendedores'?'active':''}`} onClick={()=>setVista('revendedores')}><span>💼</span> Revendedores</button>
          )}
          <button className="nav-item logout" onClick={handleLogout}><span>🚪</span> Salir</button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <h1>{vista.charAt(0).toUpperCase() + vista.slice(1)}</h1>
          </div>
          <button onClick={onVolver} style={{background: '#333', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer'}}>
            Ir a la App
          </button>
        </header>

        {/* --- VISTA REVENDEDORES (NUEVA) --- */}
        {vista === 'revendedores' ? (
             <div className="dashboard-split">
             <div className="section-card" style={{height: 'fit-content'}}>
                <h2>Crear Revendedor</h2>
                <form onSubmit={crearRevendedor} className="import-form">
                    <div className="form-group">
                        <label>Email Revendedor</label>
                        <input className="input-dark" type="email" required value={newResellerEmail} onChange={e=>setNewResellerEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input className="input-dark" type="text" required value={newResellerPass} onChange={e=>setNewResellerPass(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Créditos (Usuarios)</label>
                        <input className="input-dark" type="number" required value={newResellerCredits} onChange={e=>setNewResellerCredits(e.target.value)} />
                    </div>
                    <button type="submit" className="btn-primary" style={{backgroundColor: '#8b5cf6'}}>Crear Revendedor</button>
                </form>
                {msgUsuario && <div className="import-status">{msgUsuario}</div>}
             </div>

             <div className="section-card">
                <h2>Lista de Revendedores ({revendedores.length})</h2>
                <div className="table-container">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Créditos</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {revendedores.map(u => (
                                <tr key={u.id}>
                                    <td>{u.email}</td>
                                    <td>
                                        <span className="meta-tag" style={{background: '#8b5cf6', color: 'white', padding: '4px 8px', borderRadius: '4px'}}>
                                            {u.creditos} Créditos
                                        </span>
                                    </td>
                                    <td><span className="status-badge badge-movie">ACTIVO</span></td>
                                    <td>
                                        <button className="btn-icon" onClick={()=>eliminarUsuario(u.id)}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        ) : vista === 'usuarios' ? (
          /* --- VISTA USUARIOS (CLIENTES) --- */
          <div className="dashboard-split">
             <div className="section-card" style={{height: 'fit-content'}}>
                <h2>Crear Nuevo Cliente</h2>
                <form onSubmit={crearUsuarioCliente} className="import-form">
                    <div className="form-group"><label>Correo</label><input className="input-dark" type="email" required value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} /></div>
                    <div className="form-group"><label>Contraseña</label><input className="input-dark" type="text" required value={newUserPass} onChange={e=>setNewUserPass(e.target.value)} /></div>
                    <div className="form-group">
                        <label>Servicio</label>
                        <select className="select-dark" value={mesesSuscripcion} onChange={e=>setMesesSuscripcion(e.target.value)}>
                            <option value="1">1 Mes</option><option value="3">3 Meses</option><option value="6">6 Meses</option><option value="12">1 Año</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-primary">Crear Usuario</button>
                </form>
                {msgUsuario && <div className="import-status">{msgUsuario}</div>}
             </div>

             <div className="section-card">
                <h2>Clientes Finales ({usuarios.length})</h2>
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
                                    <tr key={u.id}>
                                        <td>{u.email}</td>
                                        <td>{vencimiento.toLocaleDateString()}</td>
                                        <td><span className={`status-badge ${vencido ? 'badge-serie' : 'badge-movie'}`}>{vencido ? 'VENCIDO' : 'ACTIVO'}</span></td>
                                        <td><button className="btn-icon" onClick={()=>eliminarUsuario(u.id)}>🗑️</button></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        ) : (
          /* --- VISTA DASHBOARD / CONTENIDO --- */
          <>
             {vista === 'dashboard' && (
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-icon-box icon-blue">🎬</div><div className="stat-info"><h3>Pelis</h3><p className="value">{stats.peliculas}</p></div></div>
                  <div className="stat-card"><div className="stat-icon-box icon-purple">📺</div><div className="stat-info"><h3>Series</h3><p className="value">{stats.series}</p></div></div>
                  <div className="stat-card"><div className="stat-icon-box icon-green">👥</div><div className="stat-info"><h3>Usuarios</h3><p className="value">{stats.usuarios}</p></div></div>
                  <div className="stat-card"><div className="stat-icon-box" style={{background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6'}}>💼</div><div className="stat-info"><h3>Resellers</h3><p className="value">{stats.revendedores}</p></div></div>
                </div>
             )}

             <div className="dashboard-split">
                <div className="section-card" style={{width:'100%'}}>
                    <div className="section-header">
                        <h2>Contenido {vista === 'dashboard' ? 'Reciente' : ''}</h2>
                        <input className="input-dark" placeholder="Buscar título o ID..." style={{width:'200px', padding:'8px'}} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    </div>
                    <div className="table-container">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th width="50">Img</th>
                                    <th>Título</th>
                                    <th>ID</th>
                                    <th>Tipo</th>
                                    <th style={{textAlign:'right'}}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getContenidoVisible().slice(0, 50).map((item) => (
                                    <tr key={item.id}>
                                        <td><img src={item.poster || item.imagen_poster} alt="" className="poster-mini"/></td>
                                        <td style={{fontWeight:'500'}}>{item.titulo}</td>
                                        <td style={{color: '#888', fontFamily:'monospace'}}>{item.id}</td>
                                        <td><span className={`status-badge ${item.tipo === 'movie' ? 'badge-movie' : 'badge-serie'}`}>{item.tipo}</span></td>
                                        <td style={{textAlign:'right'}}>
                                            <button className="btn-icon" onClick={() => eliminarItem(item.id, item.coleccion)} title="Gestionar en VPS">📂</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;