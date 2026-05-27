// ============================================
// FAVORITOS - JAVASCRIPT
// ============================================

const API_URL = 'http://localhost:3000/api';
let todosFavoritos = [];
let favoritosFiltrados = [];

document.addEventListener('DOMContentLoaded', async () => {
    cargarFavoritos();
});

async function cargarFavoritos() {
    try {
        const favoritosIds = JSON.parse(localStorage.getItem('favoritos')) || [];

        if (favoritosIds.length === 0) {
            mostrarSinFavoritos();
            return;
        }

        // Cargar todos los productos
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();

        // Filtrar solo favoritos
        todosFavoritos = productos.filter(p => favoritosIds.includes(p.ProductoID));
        favoritosFiltrados = [...todosFavoritos];

        renderizarFavoritos(favoritosFiltrados);

    } catch (error) {
        console.error('Error:', error);
        mostrarError();
    }
}

function mostrarSinFavoritos() {
    document.getElementById('favoritos-grid').innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
            <div style="font-size: 80px; margin-bottom: 20px;">💔</div>
            <h3 style="font-size: 24px; color: var(--dark); margin-bottom: 10px;">
                No tienes productos favoritos
            </h3>
            <p style="color: var(--gray); margin-bottom: 20px;">
                Explora nuestro catálogo y agrega tus favoritos
            </p>
            <a href="index.html" style="
                padding: 14px 30px;
                background: var(--primary);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 700;
                display: inline-block;
            ">Ver Catálogo</a>
        </div>
    `;
}

function mostrarError() {
    document.getElementById('favoritos-grid').innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
            <div style="font-size: 80px; margin-bottom: 20px;">❌</div>
            <h3 style="font-size: 24px; color: var(--dark); margin-bottom: 10px;">
                Error al cargar favoritos
            </h3>
            <p style="color: var(--gray);">
                Intenta recargar la página
            </p>
        </div>
    `;
}

function renderizarFavoritos(productos) {
    const grid = document.getElementById('favoritos-grid');

    if (productos.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h3 style="color: var(--gray);">No hay productos en esta categoría</h3>
            </div>
        `;
        return;
    }

    grid.innerHTML = productos.map(p => {
        const precioFinal = p.PrecioDescuento || p.PrecioOriginal;
        const tieneDescuento = p.PrecioDescuento && p.PrecioDescuento < p.PrecioOriginal;
        const sinStock = p.Stock === 0;

        return `
            <div class="producto-card" onclick="verDetalle(${p.ProductoID})">
                <div class="producto-badges">
                    ${p.NuevoLanzamiento ? '<span class="producto-badge badge-nuevo">🆕 Nuevo</span>' : ''}
                    ${tieneDescuento ? `<span class="producto-badge badge-descuento">-${p.PorcentajeDescuento}%</span>` : ''}
                    ${p.Destacado ? '<span class="producto-badge badge-destacado">⭐ Destacado</span>' : ''}
                </div>

                <div class="producto-imagen">
                    <img src="${API_URL.replace('/api', '')}/imagenes/productos/${p.ImagenPrincipal}" 
                         alt="${p.Nombre}"
                         onerror="this.src='https://via.placeholder.com/300x300?text=Sin+Imagen'">
                    <button class="btn-favorito active" 
                            onclick="event.stopPropagation(); toggleFavorito(${p.ProductoID}); location.reload();">
                        ❤️
                    </button>
                </div>

                <div class="producto-info">
                    <div class="producto-marca">${p.NombreMarca}</div>
                    <h3 class="producto-nombre">${p.Nombre}</h3>

                    <div class="producto-detalles">
                        <span class="detalle-tag">${p.Genero}</span>
                        <span class="detalle-tag">${p.Tamaño}</span>
                        <span class="detalle-tag">${p.Concentracion}</span>
                    </div>

                    <div class="producto-precio">
                        <span class="precio-actual">$${parseFloat(precioFinal).toFixed(2)}</span>
                        ${tieneDescuento ? `<span class="precio-original">$${parseFloat(p.PrecioOriginal).toFixed(2)}</span>` : ''}
                    </div>

                    <div class="producto-acciones">
                        <button class="btn-agregar" 
                                ${sinStock ? 'disabled' : ''}
                                onclick="event.stopPropagation(); ${sinStock ? '' : `agregarAlCarrito(${p.ProductoID})`}">
                            ${sinStock ? '❌ Agotado' : '🛒 Agregar'}
                        </button>
                        <button class="btn-ver-mas" onclick="event.stopPropagation(); verDetalle(${p.ProductoID})">
                            👁️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarFavoritos(genero, boton) {
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    boton.classList.add('active');

    if (genero === 'todos') {
        favoritosFiltrados = [...todosFavoritos];
    } else {
        favoritosFiltrados = todosFavoritos.filter(p => p.Genero === genero);
    }

    renderizarFavoritos(favoritosFiltrados);
}

function ordenarFavoritosPrecio(boton) {
    favoritosFiltrados.sort((a, b) => {
        const precioA = a.PrecioDescuento || a.PrecioOriginal;
        const precioB = b.PrecioDescuento || b.PrecioOriginal;
        return precioA - precioB;
    });

    renderizarFavoritos(favoritosFiltrados);
    boton.style.background = 'var(--primary)';
    boton.style.color = 'white';
}