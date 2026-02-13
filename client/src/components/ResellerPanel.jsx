import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminPanel.css'; // Usamos los mismos estilos del Admin

const URL_SERVIDOR = 'https://cine.neveus.lat';

const ResellerPanel = ({ onVolver }) => {
  // --- AUTH DEL REVENDEDOR ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Objeto del revendedor (id, creditos, etc)
  
  // Login Form
  const [emailLogin, setEmailLogin] = useState('');
  const [passLogin, setPassLogin] = useState('');
  const [error, setError] = useState('');

  // --- ESTADOS ---
  const [vista, setVista] = useState('dashboard');
  const [stats, setStats] = useState({ misClientes: 0, catalogo: 0, creditos: 0 });
  const [contenido, setContenido] = useState([]);
  const [misClientes, setMisClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Formulario Crear Cliente
  const [clientEmail, setClientEmail] = useState('');
  const [clientPass, setClientPass] = useState('');
  const [clientMeses, setClientMeses] = useState(1);
  const [msgAction, setMsgAction] = useState('');

  // --- LOGIN REVENDEDOR ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const res = await axios.post(`${URL_SERVIDOR}/auth.php`, {
            action: 'login',
            email: emailLogin,
            password: passLogin
        });

        if (res.data.success) {
            if (res.data.user.rol !== 'reseller') {
                setError("No tienes permisos de revendedor.");
            } else {
                setUser(res.data.user);
                setIsAuthenticated(true);
                // Cargar datos inmediatamente después del login
                setTimeout(() => cargarDatos(res.data.user), 100);
            }
        } else {
            setError(res.data.message);
        }
    } catch (e) { setError("Error de conexión"); }
    setLoading(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  // --- CARGAR DATOS ---
  const cargarDatos = async (usuarioActual) => {
    if (!usuarioActual) return;
    setLoading(true);
    try {
        // 1. Obtener Créditos Actualizados
        const resCreditos = await axios.post(`${URL_SERVIDOR}/auth.php`, {
            action: 'get_credits',
            id: usuarioActual.id
        });
        const creditosActuales = resCreditos.data.success ? resCreditos.data.creditos : usuarioActual.creditos;

        // 2. Obtener MIS Clientes
        const resClientes = await axios.post(`${URL_SERVIDOR}/auth.php`, {
            action: 'list',
            tipo: 'cliente',
            creador_id: usuarioActual.id // FILTRO CLAVE
        });
        const listaClientes = Array.isArray(resClientes.data) ? resClientes.data : [];

        // 3. Obtener Catálogo (Solo lectura)
        const resContenido = await axios.get(`${URL_SERVIDOR}/data.php`);
        const catalogo = Array.isArray(resContenido.data) ? resContenido.data : [];

        setStats({
            misClientes: listaClientes.length,
            catalogo: catalogo.length,
            creditos: creditosActuales
        });

        setMisClientes(listaClientes);
        setContenido(catalogo);
        // Actualizamos el usuario local con los créditos nuevos
        setUser(prev => ({ ...prev, creditos: creditosActuales }));

    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // --- CREAR CLIENTE ---
  const crearCliente = async (e) => {
    e.preventDefault();
    if (user.creditos < 1) {
        setMsgAction("❌ No tienes suficientes créditos.");
        return;
    }
    setMsgAction("⏳ Creando cliente...");

    try {
        const res = await axios.post(`${URL_SERVIDOR}/auth.php`, {
            action: 'register',
            rol_creador: 'reseller',
            creador_id: user.id, // ID del revendedor
            email: clientEmail,
            password: clientPass,
            meses: clientMeses
        });

        if (res.data.success) {
            setMsgAction("✅ " + res.data.message);
            setClientEmail('');
            setClientPass('');
            cargarDatos(user); // Recargar para ver descuento de créditos y nuevo cliente
        } else {
            setMsgAction("❌ " + res.data.message);
        }
    } catch (e) { setMsgAction("❌ Error de conexión"); }
  };

  // --- ELIMINAR CLIENTE ---
  const eliminarCliente = async (id) => {
    if(!window.confirm("¿Eliminar este cliente? (No se devuelven créditos)")) return;
    try {
        await axios.post(`${URL_SERVIDOR}/auth.php`, { action: 'delete', id: id });
        cargarDatos(user);
    } catch (e) { alert("Error"); }
  };

  const getContenidoVisible = () => {
    let items = contenido;
    if (searchTerm) {
      items = items.filter(i => (i.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return items; 
  };

  // --- RENDER: LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="login-dashboard-bg">
        <div className="login-card" style={{borderTop: '4px solid #8b5cf6'}}>
          <div style={{marginBottom: '20px', textAlign: 'center'}}>
             <img src="/logo.png" alt="Logo" style={{height: '80px', objectFit:'contain'}} />
          </div>
          <h2 style={{color:'white', marginBottom:'20px', textAlign: 'center'}}>Acceso Revendedor</h2>
          <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <input className="input-dark" type="text" placeholder="Email" value={emailLogin} onChange={e=>setEmailLogin(e.target.value)} />
            <input className="input-dark" type="password" placeholder="Contraseña" value={passLogin} onChange={e=>setPassLogin(e.target.value)} />
            <button className="btn-primary" type="submit" style={{backgroundColor: '#8b5cf6'}}>Entrar</button>
            {error && <p style={{color:'#ef4444', textAlign:'center', fontSize:'13px'}}>{error}</p>}
            <button type="button" onClick={onVolver} style={{background:'none', border:'none', color:'#999', cursor:'pointer', marginTop:'10px', textDecoration:'underline'}}>Volver a la App</button>
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
            <span style={{fontSize: '10px', color: '#8b5cf6', marginTop: '5px', letterSpacing: '1px'}}>RESELLER</span>
        </div>
        <nav className="nav-links">
          <button className={`nav-item ${vista==='dashboard'?'active':''}`} onClick={()=>setVista('dashboard')}><span>📊</span> Dashboard</button>
          <button className={`nav-item ${vista==='clientes'?'active':''}`} onClick={()=>setVista('clientes')}><span>👥</span> Mis Clientes</button>
          <button className={`nav-item ${vista==='catalogo'?'active':''}`} onClick={()=>setVista('catalogo')}><span>🎬</span> Catálogo</button>
          <button className="nav-item logout" onClick={handleLogout}><span>🚪</span> Salir</button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <h1>{vista.charAt(0).toUpperCase() + vista.slice(1)}</h1>
          </div>
          <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
              <div style={{background: '#8b5cf6', padding: '5px 15px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold'}}>
                  💰 {user?.creditos} Créditos
              </div>
              <button onClick={onVolver} style={{background: '#333', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer'}}>
                Ir a la App
              </button>
          </div>
        </header>

        {vista === 'clientes' ? (
          <div className="dashboard-split">
             <div className="section-card" style={{height: 'fit-content'}}>
                <h2>Crear Nuevo Cliente</h2>
                <p style={{fontSize: '12px', color: '#999', marginBottom: '15px'}}>Costo: 1 Crédito por cuenta creada.</p>
                <form onSubmit={crearCliente} className="import-form">
                    <div className="form-group"><label>Correo Cliente</label><input className="input-dark" type="email" required value={clientEmail} onChange={e=>setClientEmail(e.target.value)} /></div>
                    <div className="form-group"><label>Contraseña</label><input className="input-dark" type="text" required value={clientPass} onChange={e=>setClientPass(e.target.value)} /></div>
                    <div className="form-group">
                        <label>Servicio (Meses)</label>
                        <select className="select-dark" value={clientMeses} onChange={e=>setClientMeses(e.target.value)}>
                            <option value="1">1 Mes</option><option value="3">3 Meses</option><option value="6">6 Meses</option><option value="12">1 Año</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-primary" style={{backgroundColor: user?.creditos > 0 ? '#8b5cf6' : '#555'}} disabled={user?.creditos < 1}>
                        {user?.creditos > 0 ? 'Crear Cliente (-1 Crédito)' : 'Sin Créditos'}
                    </button>
                </form>
                {msgAction && <div className="import-status">{msgAction}</div>}
             </div>

             <div className="section-card">
                <h2>Mis Clientes Activos ({misClientes.length})</h2>
                <div className="table-container">
                    <table className="modern-table">
                        <thead>
                            <tr><th>Email</th><th>Vencimiento</th><th>Estado</th><th>Acción</th></tr>
                        </thead>
                        <tbody>
                            {misClientes.map(u => {
                                const vencimiento = new Date(u.fecha_vencimiento);
                                const hoy = new Date();
                                const vencido = vencimiento < hoy;
                                return (
                                    <tr key={u.id}>
                                        <td>{u.email}</td>
                                        <td>{vencimiento.toLocaleDateString()}</td>
                                        <td><span className={`status-badge ${vencido ? 'badge-serie' : 'badge-movie'}`}>{vencido ? 'VENCIDO' : 'ACTIVO'}</span></td>
                                        <td><button className="btn-icon" onClick={()=>eliminarCliente(u.id)}>🗑️</button></td>
                                    </tr>
                                )
                            })}
                            {misClientes.length === 0 && (
                                <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px', color: '#666'}}>Aún no tienes clientes.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        ) : vista === 'catalogo' ? (
          /* --- VISTA CATALOGO (SOLO LECTURA) --- */
          <div className="dashboard-split">
             <div className="section-card" style={{width:'100%'}}>
                <div className="section-header">
                    <h2>Catálogo Disponible</h2>
                    <input className="input-dark" placeholder="Buscar..." style={{width:'200px', padding:'8px'}} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                </div>
                <div className="table-container">
                    <table className="modern-table">
                        <thead><tr><th width="50">Img</th><th>Título</th><th>Tipo</th></tr></thead>
                        <tbody>
                            {getContenidoVisible().slice(0, 50).map((item) => (
                                <tr key={item.id}>
                                    <td><img src={item.poster || item.imagen_poster} alt="" className="poster-mini"/></td>
                                    <td style={{fontWeight:'500'}}>{item.titulo}</td>
                                    <td><span className={`status-badge ${item.tipo === 'movie' ? 'badge-movie' : 'badge-serie'}`}>{item.tipo}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        ) : (
          /* --- DASHBOARD --- */
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon-box" style={{background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6'}}>💰</div><div className="stat-info"><h3>Mis Créditos</h3><p className="value">{stats.creditos}</p></div></div>
            <div className="stat-card"><div className="stat-icon-box icon-green">👥</div><div className="stat-info"><h3>Mis Clientes</h3><p className="value">{stats.misClientes}</p></div></div>
            <div className="stat-card"><div className="stat-icon-box icon-blue">🎬</div><div className="stat-info"><h3>Catálogo</h3><p className="value">{stats.catalogo}</p></div></div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ResellerPanel;