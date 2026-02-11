# Íconos del Menú - Instrucciones

Coloca tus íconos PNG en esta carpeta `/public/assets/` con los siguientes nombres:

## Nombres de Archivos Requeridos:

1. **icon-inicio.png** - Ícono para "Inicio"
2. **icon-buscador.png** - Ícono para "Buscador"
3. **icon-peliculas.png** - Ícono para "Películas"
4. **icon-series.png** - Ícono para "Series"
5. **icon-favoritos.png** - Ícono para "Mis Favoritos"
6. **icon-milista.png** - Ícono para "Mi Lista"
7. **icon-cerrar.png** - Ícono para "Cerrar Sesión"

## Especificaciones:

- **Formato**: PNG con fondo transparente
- **Tamaño recomendado**: 24x24 píxeles o 48x48 píxeles
- **Color**: Cualquier color (se convertirán automáticamente a blanco mediante CSS)
- **Estilo**: Simples y minimalistas

## Notas:

- Los íconos se mostrarán en **blanco** automáticamente gracias al filtro CSS
- El ícono de "Cerrar Sesión" se mostrará en **rojo** (#ff4444)
- Si necesitas cambiar los nombres de los archivos, edita las rutas en:
  - `client/src/components/Catalogo.jsx` (líneas con `<img src="/assets/icon-...`)

## Ejemplo de Estructura:

```
client/public/assets/
├── icon-inicio.png
├── icon-buscador.png
├── icon-peliculas.png
├── icon-series.png
├── icon-favoritos.png
├── icon-milista.png
└── icon-cerrar.png
