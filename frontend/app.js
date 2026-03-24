const API_URL = 'http://localhost:3000/api';

// ESTADO GLOBAL
let usuario = null;
let productos = [];
let productosFiltrados = [];
let carrito = [];
let favoritos = [];
let marcas = [];
let categorias = [];
let familias = [];

// ============================================
// INICIALIZACIÓN
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    cargarCatalogos();
    cargarProductos();
    cargarCarritoLocal();
    cargarFavoritosLocal();
    actualizarUI();
});

// ============================================
// GESTIÓN DE SESIÓN
// ============================================

function verificarSesion() {
    const usuarioData = localStorage.getItem('usuario');
    
    if (usuarioData) {
        usuario = JSON.parse(usuarioData);
        mostrarMenuUsuario();
    } else {
        mostrarMenuInvitado();
    }
}

function mostrarMenuUsuario() {
    const dropdown = document.getElementById('user-dropdown');
    const userIcon = document.getElementById('user-icon');
    
    userIcon.textContent = '👤';
    
    dropdown.innerHTML = `
        <div class="dropdown-header">
            <h4>${usuario.nombre} ${usuario.apellido}</h4>
            <p>${usuario.email}</p>
        </div>
        <ul class="dropdown-menu">
            ${usuario.rolId === 1 ? '<li onclick="irAdmin()">⚙️ Panel Admin</li>' : ''}
            <li onclick="irMisPedidos()">📦 Mis Pedidos</li>
            <li onclick="irMiCuenta()">👤 Mi Cuenta</li>
            <li onclick="irFavoritos()">❤️ Mis Favoritos</li>
            <div class="dropdown-divider"></div>
            <li onclick="cerrarSesion()" style="color: var(--danger);">🚪 Cerrar Sesión</li>
        </ul>
    `;
}

function mostrarMenuInvitado() {
    const dropdown = document.getElementById('user-dropdown');
    const userIcon = document.getElementById('user-icon');
    
    userIcon.textContent = '👤';
    
    dropdown.innerHTML = `
        <div class="dropdown-header">
            <h4>Modo Invitado</h4>
            <p>Inicia sesión para más funciones</p>
        </div>
        <ul class="dropdown-menu">
            <li onclick="irLogin()">🔐 Iniciar Sesión</li>
            <li onclick="irRegistro()">📝 Crear Cuenta</li>
            <div class="dropdown-divider"></div>
            <li onclick="irFavoritos()">❤️ Ver Favoritos</li>
        </ul>
    `;
}

function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        localStorage.removeItem('usuario');
        usuario = null;
        window.location.href = 'login.html';
    }
}

function irLogin() {
    window.location.href = 'login.html';
}

function irRegistro() {
    window.location.href = 'login.html';
    // Puedes agregar un parámetro para abrir directamente el formulario de registro
}

function irAdmin() {
    window.location.href = 'admin/dashboard.html';
}

function irMisPedidos() {
    alert('Funcionalidad de Pedidos próximamente');
}

function irMiCuenta() {
    alert('Funcionalidad de Mi Cuenta próximamente');
}

// ============================================
// CARGAR CATÁLOGOS
// ============================================

async function cargarCatalogos() {
    try {
        const [resMarcas, resCategorias, resFamilias] = await Promise.all([
            fetch(`${API_URL}/marcas`),
            fetch(`${API_URL}/categorias`),
            fetch(`${API_URL}/familias`)
        ]);
        
        marcas = await resMarcas.json();
        categorias = await resCategorias.json();
        familias = await resFamilias.json();
        
        // Llenar filtros
        const filtroMarca = document.getElementById('filtro-marca');
        filtroMarca.innerHTML = '<option value="">Todas las marcas</option>' +
            marcas.map(m => `<option value="${m.MarcaID}">${m.NombreMarca}</option>`).join('');
        
        const filtroCategoria = document.getElementById('filtro-categoria');
        filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>' +
            categorias.map(c => `<option value="${c.CategoriaID}">${c.NombreCategoria}</option>`).join('');
        
        const filtroFamilia = document.getElementById('filtro-familia');
        filtroFamilia.innerHTML = '<option value="">Todas las familias</option>' +
            familias.map(f => `<option value="${f.FamiliaID}">${f.NombreFamilia}</option>`).join('');
        
    } catch (error) {
        console.error('Error cargando catálogos:', error);
    }
}

// ============================================
// CARGAR Y MOSTRAR PRODUCTOS
// ============================================

async function cargarProductos() {
    try {
        const response = await fetch(`${API_URL}/productos`);
        productos = await response.json();
        productosFiltrados = productos;
        mostrarProductos(productosFiltrados);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('productos-grid').innerHTML = 
            '<p class="error">Error al cargar productos. Por favor, recarga la página.</p>';
    }
}

function mostrarProductos(lista) {
    const grid = document.getElementById('productos-grid');
    
    if (lista.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h3 style="font-size: 24px; color: var(--gray); margin-bottom: 10px;">
                    No se encontraron productos
                </h3>
                <p style="color: var(--gray);">Intenta ajustar los filtros</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = lista.map(p => {
        const precioFinal = p.PrecioDescuento || p.PrecioOriginal;
        const tieneDescuento = p.PrecioDescuento && p.PrecioDescuento < p.PrecioOriginal;
        const esFavorito = favoritos.includes(p.ProductoID);
        const sinStock = p.Stock === 0;
        
        return `
            <div class="producto-card" onclick="verDetalle(${p.ProductoID})">
                <!-- Badges -->
                <div class="producto-badges">
                    ${p.NuevoLanzamiento ? '<span class="producto-badge badge-nuevo">🆕 Nuevo</span>' : ''}
                    ${tieneDescuento ? `<span class="producto-badge badge-descuento">-${p.PorcentajeDescuento}%</span>` : ''}
                    ${p.Destacado ? '<span class="producto-badge badge-destacado">⭐ Destacado</span>' : ''}
                </div>
                
                <!-- Imagen -->
                <div class="producto-imagen">
                    <img src="${API_URL.replace('/api', '')}/imagenes/productos/${p.ImagenPrincipal}" 
                         alt="${p.Nombre}"
                         onerror="this.src='https://via.placeholder.com/300x300?text=Sin+Imagen'">
                    <button class="btn-favorito ${esFavorito ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorito(${p.ProductoID})">
                        ${esFavorito ? '❤️' : '🤍'}
                    </button>
                </div>
                
                <!-- Info -->
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

// ============================================
// BÚSQUEDA Y FILTROS
// ============================================

function buscarProductos() {
    const busqueda = document.getElementById('busqueda-global').value.toLowerCase();
    
    if (busqueda.trim() === '') {
        productosFiltrados = productos;
    } else {
        productosFiltrados = productos.filter(p => 
            p.Nombre.toLowerCase().includes(busqueda) ||
            p.NombreMarca.toLowerCase().includes(busqueda) ||
            (p.Descripcion && p.Descripcion.toLowerCase().includes(busqueda))
        );
    }
    
    document.getElementById('section-title').textContent = 
        busqueda.trim() ? `Resultados para "${busqueda}"` : 'Todos los Productos';
    
    mostrarProductos(productosFiltrados);
}

// Enter en búsqueda
document.getElementById('busqueda-global').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        buscarProductos();
    }
});

function toggleFiltros() {
    const filtros = document.getElementById('filtros-avanzados');
    filtros.classList.toggle('hidden');
}

async function aplicarFiltros() {
    const marca = document.getElementById('filtro-marca').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const familia = document.getElementById('filtro-familia').value;
    const precioMin = document.getElementById('precio-min').value;
    const precioMax = document.getElementById('precio-max').value;
    
    let url = `${API_URL}/productos/filtrar?`;
    if (marca) url += `marca=${marca}&`;
    if (categoria) url += `categoria=${categoria}&`;
    if (familia) url += `familia=${familia}&`;
    if (precioMin) url += `precioMin=${precioMin}&`;
    if (precioMax) url += `precioMax=${precioMax}&`;
    
    try {
        const response = await fetch(url);
        productosFiltrados = await response.json();
        mostrarProductos(productosFiltrados);
        
        document.getElementById('section-title').textContent = 'Productos Filtrados';
    } catch (error) {
        console.error('Error:', error);
    }
}

function limpiarFiltros() {
    document.getElementById('filtro-marca').value = '';
    document.getElementById('filtro-categoria').value = '';
    document.getElementById('filtro-familia').value = '';
    document.getElementById('precio-min').value = '';
    document.getElementById('precio-max').value = '';
    
    productosFiltrados = productos;
    mostrarProductos(productosFiltrados);
    document.getElementById('section-title').textContent = 'Todos los Productos';
}

function filtrarPorGenero(genero) {
    // Actualizar nav activo
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.target.classList.add('active');
    
    if (genero === '') {
        productosFiltrados = productos;
        document.getElementById('section-title').textContent = 'Todos los Productos';
    } else {
        productosFiltrados = productos.filter(p => p.Genero === genero);
        document.getElementById('section-title').textContent = `Perfumes para ${genero}`;
    }
    
    mostrarProductos(productosFiltrados);
}

function mostrarDestacados() {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.target.classList.add('active');
    
    productosFiltrados = productos.filter(p => p.Destacado);
    document.getElementById('section-title').textContent = '⭐ Productos Destacados';
    mostrarProductos(productosFiltrados);
}

function mostrarNuevos() {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.target.classList.add('active');
    
    productosFiltrados = productos.filter(p => p.NuevoLanzamiento);
    document.getElementById('section-title').textContent = '🆕 Nuevos Lanzamientos';
    mostrarProductos(productosFiltrados);
}

function verOfertas() {
    productosFiltrados = productos.filter(p => p.PrecioDescuento && p.PrecioDescuento < p.PrecioOriginal);
    document.getElementById('section-title').textContent = '🔥 Ofertas Especiales';
    mostrarProductos(productosFiltrados);
    
    // Scroll a productos
    document.querySelector('.productos-section').scrollIntoView({ behavior: 'smooth' });
}

function ordenarProductos() {
    const orden = document.getElementById('ordenar').value;
    
    switch(orden) {
        case 'precio-asc':
            productosFiltrados.sort((a, b) => {
                const precioA = a.PrecioDescuento || a.PrecioOriginal;
                const precioB = b.PrecioDescuento || b.PrecioOriginal;
                return precioA - precioB;
            });
            break;
        case 'precio-desc':
            productosFiltrados.sort((a, b) => {
                const precioA = a.PrecioDescuento || a.PrecioOriginal;
                const precioB = b.PrecioDescuento || b.PrecioOriginal;
                return precioB - precioA;
            });
            break;
        case 'nombre':
            productosFiltrados.sort((a, b) => a.Nombre.localeCompare(b.Nombre));
            break;
        case 'nuevos':
            productosFiltrados.sort((a, b) => new Date(b.FechaCreacion) - new Date(a.FechaCreacion));
            break;
        case 'destacados':
        default:
            productosFiltrados.sort((a, b) => b.Destacado - a.Destacado);
            break;
    }
    
    mostrarProductos(productosFiltrados);
}

// ============================================
// DETALLE DE PRODUCTO
// ============================================

async function verDetalle(productoId) {
    try {
        const response = await fetch(`${API_URL}/productos/${productoId}`);
        const producto = await response.json();
        
        const precioFinal = producto.PrecioDescuento || producto.PrecioOriginal;
        const tieneDescuento = producto.PrecioDescuento && producto.PrecioDescuento < producto.PrecioOriginal;
        const esFavorito = favoritos.includes(producto.ProductoID);
        const sinStock = producto.Stock === 0;
        
        // Recopilar todas las imágenes disponibles
        const imagenes = [];
        if (producto.ImagenPrincipal) imagenes.push(producto.ImagenPrincipal);
        if (producto.Imagen2) imagenes.push(producto.Imagen2);
        if (producto.Imagen3) imagenes.push(producto.Imagen3);
        if (producto.Imagen4) imagenes.push(producto.Imagen4);
        
        const contenido = `
            <div class="producto-detalle-container">
                <!-- GALERÍA DE IMÁGENES -->
                <div class="galeria-imagenes">
                    <!-- Imagen Principal -->
                    <div class="imagen-principal-container">
                        <img id="imagen-principal-detalle" 
                             class="imagen-principal-detalle"
                             src="${API_URL.replace('/api', '')}/imagenes/productos/${imagenes[0]}" 
                             alt="${producto.Nombre}"
                             onerror="this.src='https://via.placeholder.com/600x600?text=Sin+Imagen'">
                        <button class="btn-favorito-detalle ${esFavorito ? 'active' : ''}" 
                                onclick="event.stopPropagation(); toggleFavorito(${producto.ProductoID}); actualizarFavoritoDetalle(${producto.ProductoID});">
                            ${esFavorito ? '❤️' : '🤍'}
                        </button>
                    </div>
                    
                    <!-- Miniaturas -->
                    ${imagenes.length > 1 ? `
                        <div class="miniaturas-galeria">
                            ${imagenes.map((img, index) => `
                                <div class="miniatura-item ${index === 0 ? 'active' : ''}" 
                                     data-img="${API_URL.replace('/api', '')}/imagenes/productos/${img}"
                                     onclick="cambiarImagenPrincipal('${API_URL.replace('/api', '')}/imagenes/productos/${img}', this)">
                                    <img src="${API_URL.replace('/api', '')}/imagenes/productos/${img}" 
                                         alt="${producto.Nombre} - Vista ${index + 1}">
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <!-- INFORMACIÓN DEL PRODUCTO -->
                <div class="producto-info-detalle">
                    <!-- Badges -->
                    <div style="margin-bottom: 15px;">
                        ${producto.NuevoLanzamiento ? '<span class="producto-badge badge-nuevo" style="margin-right: 10px;">🆕 Nuevo</span>' : ''}
                        ${tieneDescuento ? `<span class="producto-badge badge-descuento">-${producto.PorcentajeDescuento}%</span>` : ''}
                        ${producto.Destacado ? '<span class="producto-badge badge-destacado" style="margin-left: 10px;">⭐ Destacado</span>' : ''}
                    </div>
                    
                    <!-- Marca -->
                    <div style="font-size: 14px; color: var(--gray); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 600;">
                        ${producto.NombreMarca}
                    </div>
                    
                    <!-- Nombre -->
                    <h2 style="font-size: 32px; color: var(--dark); margin-bottom: 20px; line-height: 1.2;">
                        ${producto.Nombre}
                    </h2>
                    
                    <!-- Tags informativos -->
                    <div style="display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap;">
                        <span class="detalle-tag">${producto.Genero}</span>
                        <span class="detalle-tag">${producto.Tamaño}</span>
                        <span class="detalle-tag">${producto.Concentracion}</span>
                        ${producto.NombreFamilia ? `<span class="detalle-tag">${producto.NombreFamilia}</span>` : ''}
                    </div>
                    
                    <!-- Precio -->
                    <div style="display: flex; align-items: baseline; gap: 15px; margin-bottom: 30px;">
                        <span style="font-size: 42px; font-weight: 700; color: var(--primary);">
                            $${parseFloat(precioFinal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        ${tieneDescuento ? `
                            <span style="font-size: 24px; color: var(--gray); text-decoration: line-through;">
                                $${parseFloat(producto.PrecioOriginal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        ` : ''}
                    </div>
                    
                    <!-- Descripción corta -->
                    ${producto.Descripcion ? `
                        <div style="margin-bottom: 25px;">
                            <p style="color: var(--dark); line-height: 1.7; font-size: 15px;">
                                ${producto.Descripcion}
                            </p>
                        </div>
                    ` : ''}
                    
                    <!-- Descripción larga -->
                    ${producto.DescripcionLarga ? `
                        <div style="margin-bottom: 30px; padding: 20px; background: var(--light-gray); border-radius: 12px;">
                            <p style="color: var(--dark); line-height: 1.8; font-size: 14px;">
                                ${producto.DescripcionLarga}
                            </p>
                        </div>
                    ` : ''}
                    
                    <!-- Notas Olfativas -->
                    ${producto.NotasSalida || producto.NotasCorazon || producto.NotasFondo ? `
                        <div style="margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, #f6f9fc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid var(--primary);">
                            <h3 style="font-size: 18px; margin-bottom: 20px; color: var(--dark); display: flex; align-items: center; gap: 10px;">
                                🌸 Notas Olfativas
                            </h3>
                            ${producto.NotasSalida ? `
                                <div style="margin-bottom: 15px;">
                                    <strong style="color: var(--primary); font-size: 14px; display: block; margin-bottom: 5px;">Salida:</strong>
                                    <p style="color: var(--dark); margin: 0; font-size: 14px;">${producto.NotasSalida}</p>
                                </div>
                            ` : ''}
                            ${producto.NotasCorazon ? `
                                <div style="margin-bottom: 15px;">
                                    <strong style="color: var(--primary); font-size: 14px; display: block; margin-bottom: 5px;">Corazón:</strong>
                                    <p style="color: var(--dark); margin: 0; font-size: 14px;">${producto.NotasCorazon}</p>
                                </div>
                            ` : ''}
                            ${producto.NotasFondo ? `
                                <div>
                                    <strong style="color: var(--primary); font-size: 14px; display: block; margin-bottom: 5px;">Fondo:</strong>
                                    <p style="color: var(--dark); margin: 0; font-size: 14px;">${producto.NotasFondo}</p>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <!-- Stock -->
                    <div style="margin-bottom: 25px; padding: 15px; background: ${sinStock ? '#fee2e2' : '#d1fae5'}; border-radius: 10px; border-left: 4px solid ${sinStock ? 'var(--danger)' : 'var(--success)'};">
                        <span style="font-weight: 600; font-size: 15px; color: ${sinStock ? 'var(--danger)' : '#065f46'};">
                            ${sinStock ? '❌ Producto Agotado' : `✅ ${producto.Stock} unidades disponibles`}
                        </span>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div style="display: flex; gap: 15px; margin-top: 30px;">
                        <button class="btn-agregar" 
                                style="flex: 1; padding: 18px; font-size: 18px; font-weight: 600;"
                                ${sinStock ? 'disabled' : ''}
                                onclick="${sinStock ? '' : `agregarAlCarrito(${producto.ProductoID}); mostrarNotificacion('✅ Producto agregado al carrito');`}">
                            ${sinStock ? '❌ Producto Agotado' : '🛒 Agregar al Carrito'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('detalle-contenido').innerHTML = contenido;
        document.getElementById('modal-detalle').classList.add('active');
        document.getElementById('overlay').classList.add('active');
        
        // Scroll al inicio del modal
        document.getElementById('modal-detalle').scrollTop = 0;
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar el detalle del producto');
    }
}

// Función para cambiar imagen principal
function cambiarImagenPrincipal(urlImagen, elemento) {
    const imgPrincipal = document.getElementById('imagen-principal-detalle');
    if (imgPrincipal) {
        // Efecto de transición
        imgPrincipal.style.opacity = '0';
        setTimeout(() => {
            imgPrincipal.src = urlImagen;
            imgPrincipal.style.opacity = '1';
        }, 200);
    }
    
    // Actualizar clase active en miniaturas
    document.querySelectorAll('.miniatura-item').forEach(item => {
        item.classList.remove('active');
    });
    if (elemento) {
        elemento.classList.add('active');
    }
}

// Actualizar botón de favorito en detalle
function actualizarFavoritoDetalle(productoId) {
    const esFavorito = favoritos.includes(productoId);
    const btn = document.querySelector('.btn-favorito-detalle');
    if (btn) {
        btn.textContent = esFavorito ? '❤️' : '🤍';
        if (esFavorito) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
    actualizarUI();
}

// ============================================
// CARRITO
// ============================================

function toggleCarrito() {
    const sidebar = document.getElementById('sidebar-carrito');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        renderizarCarrito();
    }
}

function agregarAlCarrito(productoId) {
    // Verificar si es invitado
    if (!usuario) {
        if (confirm('Debes iniciar sesión para agregar productos al carrito. ¿Deseas iniciar sesión ahora?')) {
            window.location.href = 'login.html';
        }
        return;
    }
    
    const producto = productos.find(p => p.ProductoID === productoId);
    
    if (!producto) return;
    
    const itemExistente = carrito.find(item => item.ProductoID === productoId);
    
    if (itemExistente) {
        if (itemExistente.cantidad < producto.Stock) {
            itemExistente.cantidad++;
        } else {
            alert('No hay más stock disponible');
            return;
        }
    } else {
        carrito.push({
            ProductoID: producto.ProductoID,
            Nombre: producto.Nombre,
            Marca: producto.NombreMarca,
            Precio: producto.PrecioDescuento || producto.PrecioOriginal,
            Imagen: producto.ImagenPrincipal,
            cantidad: 1,
            stockDisponible: producto.Stock
        });
    }
    
    guardarCarritoLocal();
    actualizarUI();
    
    // Notificación visual
    mostrarNotificacion('✅ Producto agregado al carrito');
}

function cambiarCantidad(productoId, cambio) {
    const item = carrito.find(i => i.ProductoID === productoId);
    
    if (!item) return;
    
    const nuevaCantidad = item.cantidad + cambio;
    
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(productoId);
        return;
    }
    
    if (nuevaCantidad > item.stockDisponible) {
        alert('No hay suficiente stock');
        return;
    }
    
    item.cantidad = nuevaCantidad;
    guardarCarritoLocal();
    renderizarCarrito();
    actualizarUI();
}

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.ProductoID !== productoId);
    guardarCarritoLocal();
    renderizarCarrito();
    actualizarUI();
}

function renderizarCarrito() {
    const container = document.getElementById('carrito-items');
    
    if (carrito.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--gray);">
                <div style="font-size: 64px; margin-bottom: 15px;">🛒</div>
                <h3>Tu carrito está vacío</h3>
                <p style="margin-top: 10px;">Agrega productos para comenzar</p>
            </div>
        `;
        document.getElementById('carrito-total').textContent = '$0.00';
        return;
    }
    
    container.innerHTML = carrito.map(item => `
        <div class="carrito-item">
            <img src="${API_URL.replace('/api', '')}/imagenes/productos/${item.Imagen}" 
                 alt="${item.Nombre}"
                 class="carrito-item-imagen"
                 onerror="this.src='https://via.placeholder.com/80'">
            <div class="carrito-item-info">
                <div class="carrito-item-nombre">${item.Nombre}</div>
                <div style="font-size: 12px; color: var(--gray); margin-bottom: 5px;">${item.Marca}</div>
                <div class="carrito-item-precio">$${parseFloat(item.Precio).toFixed(2)}</div>
                <div class="carrito-item-cantidad">
                    <button class="cantidad-btn" onclick="cambiarCantidad(${item.ProductoID}, -1)">−</button>
                    <span style="min-width: 30px; text-align: center; font-weight: 600;">${item.cantidad}</span>
                    <button class="cantidad-btn" onclick="cambiarCantidad(${item.ProductoID}, 1)">+</button>
                    <button class="btn-eliminar" onclick="eliminarDelCarrito(${item.ProductoID})">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    const total = carrito.reduce((sum, item) => sum + (item.Precio * item.cantidad), 0);
    document.getElementById('carrito-total').textContent = '$' + total.toFixed(2);
}

function procederCompra() {
    if (!usuario) {
        alert('Debes iniciar sesión para realizar una compra');
        window.location.href = 'login.html';
        return;
    }
    
    if (carrito.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }
    
    alert('Funcionalidad de Checkout próximamente\n\n' + 
          'Total a pagar: ' + document.getElementById('carrito-total').textContent);
}

function guardarCarritoLocal() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

function cargarCarritoLocal() {
    const carritoGuardado = localStorage.getItem('carrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
    }
}

// ============================================
// FAVORITOS
// ============================================

function toggleFavorito(productoId) {
    const index = favoritos.indexOf(productoId);
    
    if (index > -1) {
        favoritos.splice(index, 1);
        mostrarNotificacion('💔 Eliminado de favoritos');
    } else {
        favoritos.push(productoId);
        mostrarNotificacion('❤️ Agregado a favoritos');
    }
    
    guardarFavoritosLocal();
    actualizarUI();
    
    // Recargar vista si estamos en detalle
    const modal = document.getElementById('modal-detalle');
    if (modal.classList.contains('active')) {
        verDetalle(productoId);
    }
}

function irAFavoritos() {
    if (favoritos.length === 0) {
        alert('No tienes productos favoritos aún');
        return;
    }
    
    productosFiltrados = productos.filter(p => favoritos.includes(p.ProductoID));
    document.getElementById('section-title').textContent = '❤️ Mis Favoritos';
    mostrarProductos(productosFiltrados);
    
    // Scroll a productos
    document.querySelector('.productos-section').scrollIntoView({ behavior: 'smooth' });
    
    // Cerrar menú de usuario
    document.getElementById('user-dropdown').classList.add('hidden');
}

function guardarFavoritosLocal() {
    localStorage.setItem('favoritos', JSON.stringify(favoritos));
}

function cargarFavoritosLocal() {
    const favoritosGuardados = localStorage.getItem('favoritos');
    if (favoritosGuardados) {
        favoritos = JSON.parse(favoritosGuardados);
    }
}

// ============================================
// ACTUALIZAR UI
// ============================================

function actualizarUI() {
    // Actualizar badge carrito
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('badge-carrito').textContent = totalItems;
    
    // Actualizar badge favoritos
    document.getElementById('badge-favoritos').textContent = favoritos.length;
}

// ============================================
// UTILIDADES
// ============================================

function cerrarTodo() {
    document.getElementById('sidebar-carrito').classList.remove('active');
    document.getElementById('modal-detalle').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('user-dropdown').classList.add('hidden');
}

function mostrarNotificacion(mensaje) {
    // Crear notificación toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--dark);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 9999;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = mensaje;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const userBtn = document.querySelector('.user-menu .icon-btn');
    
    if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// Animaciones CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Cerrar modal al hacer click en el fondo
document.getElementById('modal-detalle').addEventListener('click', function(e) {
    if (e.target === this) {
        cerrarDetalle();
    }
});

// Cerrar con tecla ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal-detalle');
        if (modal.classList.contains('active')) {
            cerrarDetalle();
        }
    }
});