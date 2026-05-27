// ============================================
// MIS PEDIDOS - JAVASCRIPT
// ============================================

const API_URL = 'http://localhost:3000/api';
let todosMisPedidos = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAutenticacion()) return;
    await cargarMisPedidos();
});

function verificarAutenticacion() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ============================================
// CARGAR PEDIDOS
// ============================================

async function cargarMisPedidos() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));

        const response = await fetch(`${API_URL}/pedidos/usuario/${usuario.id}`);
        todosMisPedidos = await response.json();

        renderizarPedidos(todosMisPedidos);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('lista-pedidos').innerHTML = `
            <div class="pedidos-vacios">
                <div class="icono">❌</div>
                <h3>Error al cargar pedidos</h3>
                <p>Intenta recargar la página</p>
            </div>
        `;
    }
}

// ============================================
// RENDERIZAR PEDIDOS
// ============================================

function renderizarPedidos(pedidos) {
    const contenedor = document.getElementById('lista-pedidos');

    if (pedidos.length === 0) {
        contenedor.innerHTML = `
            <div class="pedidos-vacios">
                <div class="icono">📦</div>
                <h3>No tienes pedidos aún</h3>
                <p>¡Explora nuestro catálogo y haz tu primera compra!</p>
                <br>
                <a href="index.html" style="
                    padding: 14px 30px;
                    background: var(--primary);
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: 700;
                ">Ver Catálogo</a>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = pedidos.map(pedido => {
        const fecha = new Date(pedido.FechaPedido).toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
            <div class="pedido-card ${pedido.EstadoPedido}">
                <div class="pedido-header-card">
                    <div>
                        <div class="pedido-numero">${pedido.NumeroPedido}</div>
                        <div class="pedido-fecha">📅 ${fecha}</div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <span class="badge-estado badge-${pedido.EstadoPedido}">${pedido.EstadoPedido}</span>
                        <span class="badge-estado badge-${pedido.EstadoPago}" style="font-size: 12px;">
                            ${pedido.EstadoPago === 'Pagado' ? '✅' : pedido.EstadoPago === 'Pendiente' ? '⏳' : '❌'} ${pedido.EstadoPago}
                        </span>
                    </div>
                </div>

                ${generarTracking(pedido.EstadoPedido)}

                ${pedido.GuiaRastreo ? `
                    <div class="guia-rastreo">
                        <p>📦 Paquetería: <strong>${pedido.Paqueteria || 'N/A'}</strong></p>
                        <p>🔍 Guía: <strong>${pedido.GuiaRastreo}</strong></p>
                    </div>
                ` : ''}

                <div class="pedido-footer">
                    <div class="pedido-total">
                        <span>Total: </span>
                        $${parseFloat(pedido.Total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        <span style="font-size: 13px; color: var(--gray);">
                            (${pedido.TotalProductos} producto${pedido.TotalProductos !== 1 ? 's' : ''})
                        </span>
                    </div>
                    <div class="pedido-acciones">
                        <button class="btn-ver-detalle" onclick="verDetallePedido(${pedido.PedidoID})">
                            🔍 Ver Detalle
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// TRACKING VISUAL
// ============================================

function generarTracking(estadoActual) {
    const pasos = [
        { estado: 'Pendiente', icono: '📝', texto: 'Pedido' },
        { estado: 'Confirmado', icono: '✅', texto: 'Confirmado' },
        { estado: 'Preparando', icono: '📦', texto: 'Preparando' },
        { estado: 'Enviado', icono: '🚚', texto: 'Enviado' },
        { estado: 'Entregado', icono: '🏠', texto: 'Entregado' }
    ];

    if (estadoActual === 'Cancelado') {
        return `
            <div class="tracking-container">
                <div style="text-align: center; color: #ef4444; font-weight: 700; padding: 15px;">
                    ❌ Pedido Cancelado
                </div>
            </div>
        `;
    }

    const indiceActual = pasos.findIndex(p => p.estado === estadoActual);

    return `
        <div class="tracking-container">
            <div class="tracking-steps">
                ${pasos.map((paso, index) => {
                    let clase = '';
                    if (index < indiceActual) clase = 'completado';
                    else if (index === indiceActual) clase = 'activo';
                    return `
                        <div class="tracking-step ${clase}">
                            <div class="tracking-icono">${paso.icono}</div>
                            <div class="tracking-texto">${paso.texto}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// VER DETALLE DEL PEDIDO
// ============================================

async function verDetallePedido(pedidoId) {
    try {
        const response = await fetch(`${API_URL}/pedidos/${pedidoId}`);
        const pedido = await response.json();

        const fecha = new Date(pedido.FechaPedido).toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const html = `
            <h2 style="font-size: 24px; color: var(--dark); margin-bottom: 25px;">
                🔍 Detalle del Pedido
            </h2>

            <!-- Info general -->
            <div class="detalle-seccion">
                <h3>📋 Información General</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <p style="font-size: 13px; color: var(--gray);">Número de Pedido</p>
                        <p style="font-weight: 700; color: var(--dark);">${pedido.NumeroPedido}</p>
                    </div>
                    <div>
                        <p style="font-size: 13px; color: var(--gray);">Fecha</p>
                        <p style="font-weight: 600;">${fecha}</p>
                    </div>
                    <div>
                        <p style="font-size: 13px; color: var(--gray);">Estado del Pedido</p>
                        <span class="badge-estado badge-${pedido.EstadoPedido}">${pedido.EstadoPedido}</span>
                    </div>
                    <div>
                        <p style="font-size: 13px; color: var(--gray);">Estado del Pago</p>
                        <span class="badge-estado badge-${pedido.EstadoPago}">${pedido.EstadoPago}</span>
                    </div>
                    <div>
                        <p style="font-size: 13px; color: var(--gray);">Método de Pago</p>
                        <p style="font-weight: 600;">${pedido.MetodoPago}</p>
                    </div>
                    ${pedido.GuiaRastreo ? `
                    <div>
                        <p style="font-size: 13px; color: var(--gray);">Guía de Rastreo</p>
                        <p style="font-weight: 700; color: var(--primary);">${pedido.GuiaRastreo}</p>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Dirección -->
            <div class="detalle-seccion">
                <h3>📍 Dirección de Envío</h3>
                <p style="font-weight: 600; color: var(--dark);">${pedido.Nombre} ${pedido.Apellido}</p>
                <p style="color: var(--gray);">
                    ${pedido.Calle} ${pedido.NumeroExterior || ''}${pedido.NumeroInterior ? ' Int. ' + pedido.NumeroInterior : ''}
                </p>
                <p style="color: var(--gray);">
                    ${pedido.Colonia || ''}, ${pedido.Ciudad}, ${pedido.Estado} ${pedido.CodigoPostal}
                </p>
                ${pedido.Referencias ? `<p style="color: var(--gray); font-size: 13px; margin-top: 5px;">📝 ${pedido.Referencias}</p>` : ''}
            </div>

            <!-- Productos -->
            <div class="detalle-seccion">
                <h3>🛒 Productos</h3>
                ${pedido.Detalles.map(item => `
                    <div class="detalle-producto-row">
                        <img src="${API_URL.replace('/api', '')}/imagenes/productos/${item.ImagenPrincipal}"
                             alt="${item.Nombre}"
                             onerror="this.src='https://via.placeholder.com/60x60?text=Sin+Imagen'">
                        <div class="detalle-producto-row-info">
                            <h4>${item.Nombre}</h4>
                            <p>${item.NombreMarca} · SKU: ${item.SKU}</p>
                            <p>Cantidad: ${item.Cantidad}</p>
                        </div>
                        <div class="detalle-producto-row-precio">
                            $${(item.PrecioUnitario * item.Cantidad).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Totales -->
            <div class="detalle-seccion">
                <h3>💰 Resumen de Pago</h3>
                <div class="detalle-totales">
                    <div class="detalle-total-linea">
                        <span>Subtotal</span>
                        <span>$${parseFloat(pedido.Subtotal).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                    ${pedido.Descuento > 0 ? `
                    <div class="detalle-total-linea" style="color: var(--success);">
                        <span>Descuento</span>
                        <span>-$${parseFloat(pedido.Descuento).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                    ` : ''}
                    <div class="detalle-total-linea">
                        <span>Costo de Envío</span>
                        <span>${parseFloat(pedido.CostoEnvio) === 0 ? 'GRATIS' : '$' + parseFloat(pedido.CostoEnvio).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="detalle-total-linea total-final">
                        <span>Total</span>
                        <span>$${parseFloat(pedido.Total).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('detalle-pedido-contenido').innerHTML = html;
        document.getElementById('modal-pedido').style.display = 'flex';

    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar detalle del pedido');
    }
}

function cerrarModalPedido() {
    document.getElementById('modal-pedido').style.display = 'none';
}

// Cerrar modal al hacer click fuera
document.getElementById('modal-pedido').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalPedido();
});

// ============================================
// FILTRAR PEDIDOS
// ============================================

function filtrarPedidos(estado, boton) {
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    boton.classList.add('active');

    if (estado === 'todos') {
        renderizarPedidos(todosMisPedidos);
    } else {
        const filtrados = todosMisPedidos.filter(p => p.EstadoPedido === estado);
        renderizarPedidos(filtrados);
    }
}