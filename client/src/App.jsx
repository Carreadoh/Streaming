import Catalogo from './components/Catalogo';
import './App.css';

function App() {

  return (
    <div className="App">
      {/* Mantenemos tu Header porque se veía bien */}
      <header style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
        <h1>Cuevanarg</h1>
        <p>Sistema creado por Foxapps 🦊</p>
      </header>

      {/* Aquí renderizamos todo el poder de tu nueva lógica */}
      <main>
        <Catalogo />
      </main>
    </div>
  );
}

export default App;