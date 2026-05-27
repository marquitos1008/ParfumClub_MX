// ============================================
// PEDIDOS ADMIN - JAVASCRIPT
// ============================================

const API_URL = 'http://localhost:3000/api';
let todosPedidos = [];
let pedidoActual = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAdmin()) return;
    await cargarPedidos();
});

function verificarAdmin() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario || usuario.rolId !== 1) {
        window.location.href = '../login.html';
        return false;
    }
    document.getElementById('nombre-admin').textContent = usuario.nombre;
    return true;
}

function cerrarSesion() {
    localStorage.removeItem('usuario');
    window.location.href = '../login.html';
}

// ============================================
// CARGAR PEDIDOS
// ============================================

async function cargarPedidos() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));

        const response = await fetch(`${API_URL}/admin/pedidos`, {
            headers: { 'user-id': usuario.id }
        });

        todosPedidos = await response.json();

        actualizarStats(todosPedidos);
        renderizarTabla(todosPedidos);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('tbody-pedidos').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: red;">
                    ❌ Error al cargar pedidos
                </td>
            </tr>
        `;
    }
}

// ============================================
// ESTADÍSTICAS
// ============================================

function actualizarStats(pedidos) {
    document.getElementById('stat-total').textContent = pedidos.length;
    document.getElementById('stat-pendientes').textContent =
        pedidos.filter(p => p.EstadoPedido === 'Pendiente').length;
    document.getElementById('stat-enviados').textContent =
        pedidos.filter(p => p.EstadoPedido === 'Enviado').length;
    document.getElementById('stat-entregados').textContent =
        pedidos.filter(p => p.EstadoPedido === 'Entregado').length;
}

// ============================================
// RENDERIZAR TABLA
// ============================================

function renderizarTabla(pedidos) {
    const tbody = document.getElementById('tbody-pedidos');

    if (pedidos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 50px; color: var(--gray);">
                    📭 No hay pedidos con estos filtros
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pedidos.map(pedido => {
        const fecha = new Date(pedido.FechaPedido).toLocaleDateString('es-MX', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        return `
            <tr>
                <td>
                    <strong style="color: var(--primary);">${pedido.NumeroPedido}</strong>
                </td>
                <td>
                    <strong>${pedido.NombreCliente}</strong>
                    <br>
                    <span style="font-size: 12px; color: var(--gray);">${pedido.Email}</span>
                </td>
                <td>${fecha}</td>
                <td style="text-align: center;">${pedido.TotalProductos}</td>
                <td>
                    <strong style="color: var(--primary);">
                        $${parseFloat(pedido.Total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                    </strong>
                </td>
                <td>
                    <span class="badge-estado badge-${pedido.EstadoPago}">
                        ${pedido.EstadoPago}
                    </span>
                </td>
                <td>
                    <span class="badge-estado badge-${pedido.EstadoPedido}">
                        ${pedido.EstadoPedido}
                    </span>
                </td>
                <td>
                    <div class="acciones-tabla">
                        <button class="btn-accion-tabla ver"
                                onclick="verDetallePedidoAdmin(${pedido.PedidoID})">
                            🔍 Ver / Editar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// VER Y EDITAR PEDIDO
// ============================================

async function verDetallePedidoAdmin(pedidoId) {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));

        const response = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
            headers: { 'user-id': usuario.id }
        });

        pedidoActual = await response.json();

        const fecha = new Date(pedidoActual.FechaPedido).toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const html = `
            <h2 style="font-size: 22px; color: var(--dark); margin-bottom: 20px;">
                🔍 Pedido: ${pedidoActual.NumeroPedido}
            </h2>

            <!-- Info del Cliente -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div style="background: #f9f9f9; padding: 15px; border-radius: 10px;">
                    <h4 style="font-size: 13px; color: var(--gray); margin-bottom: 10px;">CLIENTE</h4>
                    <p style="font-weight: 700;">${pedidoActual.Nombre} ${pedidoActual.Apellido}</p>
                    <p style="font-size: 13px; color: var(--gray);">${pedidoActual.Email}</p>
                    <p style="font-size: 13px; color: var(--gray);">${pedidoActual.Telefono || 'Sin teléfono'}</p>
                </div>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 10px;">
                    <h4 style="font-size: 13px; color: var(--gray); margin-bottom: 10px;">DIRECCIÓN</h4>
                    <p style="font-size: 13px;">${pedidoActual.Calle || ''} ${pedidoActual.NumeroExterior || ''}</p>
                    <p style="font-size: 13px;">${pedidoActual.Colonia || ''}, ${pedidoActual.Ciudad || ''}</p>
                    <p style="font-size: 13px;">${pedidoActual.Estado || ''} ${pedidoActual.CodigoPostal || ''}</p>
                </div>
            </div>

            <!-- Productos -->
            <div style="background: white; border: 1px solid #f0f0f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <h4 style="font-size: 14px; color: var(--dark); margin-bottom: 15px;">🛒 PRODUCTOS</h4>
                ${pedidoActual.Detalles.map(item => `
                    <div style="display: flex; align-items: center; gap: 15px; padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
                        <img src="${API_URL.replace('/api', '')}/imagenes/productos/${item.ImagenPrincipal}"
                             alt="${item.Nombre}"
                             style="width: 55px; height: 55px; object-fit: cover; border-radius: 8px;"
                             onerror="this.src='https://via.placeholder.com/55x55?text=Sin+Imagen'">
                        <div style="flex: 1;">
                            <p style="font-weight: 600; font-size: 14px;">${item.Nombre}</p>
                            <p style="font-size: 12px; color: var(--gray);">${item.NombreMarca} · ${item.SKU}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-weight: 600; color: var(--primary);">
                                $${(item.PrecioUnitario * item.Cantidad).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                            </p>
                            <p style="font-size: 12px; color: var(--gray);">
                                ${item.Cantidad} × $${parseFloat(item.PrecioUnitario).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                            </p>
                        </div>
                    </div>
                `).join('')}

                <!-- Totales -->
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #f0f0f0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                        <span>Subtotal:</span>
                        <span>$${parseFloat(pedidoActual.Subtotal).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                        <span>Envío:</span>
                        <span>${parseFloat(pedidoActual.CostoEnvio) === 0 ? 'GRATIS' : '$' + parseFloat(pedidoActual.CostoEnvio).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: var(--primary);">
                        <span>Total:</span>
                        <span>$${parseFloat(pedidoActual.Total).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>

            <!-- Formulario de Actualización -->
            <div class="form-actualizar-pedido">
                <h3>✏️ Actualizar Estado del Pedido</h3>

                <div class="form-grid-pedido">
                    <div>
                        <label>Estado del Pedido</label>
                        <select id="update-estado-pedido">
                            <option value="Pendiente" ${pedidoActual.EstadoPedido === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="Confirmado" ${pedidoActual.EstadoPedido === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                            <option value="Preparando" ${pedidoActual.EstadoPedido === 'Preparando' ? 'selected' : ''}>Preparando</option>
                            <option value="Enviado" ${pedidoActual.EstadoPedido === 'Enviado' ? 'selected' : ''}>Enviado</option>
                            <option value="Entregado" ${pedidoActual.EstadoPedido === 'Entregado' ? 'selected' : ''}>Entregado</option>
                            <option value="Cancelado" ${pedidoActual.EstadoPedido === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </div>

                    <div>
                        <label>Estado del Pago</label>
                        <select id="update-estado-pago">
                            <option value="Pendiente" ${pedidoActual.EstadoPago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="Pagado" ${pedidoActual.EstadoPago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                            <option value="Rechazado" ${pedidoActual.EstadoPago === 'Rechazado' ? 'selected' : ''}>Rechazado</option>
                        </select>
                    </div>

                    <div>
                        <label>Paquetería</label>
                        <select id="update-paqueteria">
                            <option value="">Sin asignar</option>
                            <option value="FedEx" ${pedidoActual.Paqueteria === 'FedEx' ? 'selected' : ''}>FedEx</option>
                            <option value="DHL" ${pedidoActual.Paqueteria === 'DHL' ? 'selected' : ''}>DHL</option>
                            <option value="Estafeta" ${pedidoActual.Paqueteria === 'Estafeta' ? 'selected' : ''}>Estafeta</option>
                            <option value="Paquetexpress" ${pedidoActual.Paqueteria === 'Paquetexpress' ? 'selected' : ''}>Paquetexpress</option>
                            <option value="J&T Express" ${pedidoActual.Paqueteria === 'J&T Express' ? 'selected' : ''}>J&T Express</option>
                            <option value="Mercado Envíos" ${pedidoActual.Paqueteria === 'Mercado Envíos' ? 'selected' : ''}>Mercado Envíos</option>
                        </select>
                    </div>

                    <div>
                        <label>Número de Guía</label>
                        <input type="text"
                               id="update-guia"
                               placeholder="Ej: 7489234567890"
                               value="${pedidoActual.GuiaRastreo || ''}">
                    </div>
                </div>

                <button class="btn-actualizar-pedido" onclick="actualizarPedido(${pedidoActual.PedidoID})">
                    💾 Guardar Cambios
                </button>
            </div>
        `;

        document.getElementById('contenido-modal-admin').innerHTML = html;
        document.getElementById('modal-pedido-admin').style.display = 'flex';

    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar detalle del pedido');
    }
}

// ============================================
// ACTUALIZAR PEDIDO
// ============================================

async function actualizarPedido(pedidoId) {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const btn = document.querySelector('.btn-actualizar-pedido');
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';

        const datos = {
            estadoPedido: document.getElementById('update-estado-pedido').value,
            estadoPago: document.getElementById('update-estado-pago').value,
            paqueteria: document.getElementById('update-paqueteria').value,
            guiaRastreo: document.getElementById('update-guia').value
        };

        const response = await fetch(`${API_URL}/admin/pedidos/${pedidoId}/estado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'user-id': usuario.id
            },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Pedido actualizado exitosamente');
            cerrarModal();
            await cargarPedidos();
        } else {
            alert('❌ Error: ' + data.error);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    } finally {
        const btn = document.querySelector('.btn-actualizar-pedido');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💾 Guardar Cambios';
        }
    }
}

// ============================================
// FILTROS Y BÚSQUEDA
// ============================================

function aplicarFiltros() {
    const estado = document.getElementById('filtro-estado').value;
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;

    let filtrados = [...todosPedidos];

    if (estado) {
        filtrados = filtrados.filter(p => p.EstadoPedido === estado);
    }

    if (desde) {
        filtrados = filtrados.filter(p =>
            new Date(p.FechaPedido) >= new Date(desde)
        );
    }

    if (hasta) {
        filtrados = filtrados.filter(p =>
            new Date(p.FechaPedido) <= new Date(hasta + 'T23:59:59')
        );
    }

    renderizarTabla(filtrados);
}

function buscarPedido(termino) {
    if (!termino.trim()) {
        renderizarTabla(todosPedidos);
        return;
    }

    const terminoLower = termino.toLowerCase();
    const filtrados = todosPedidos.filter(p =>
        p.NumeroPedido.toLowerCase().includes(terminoLower) ||
        p.NombreCliente.toLowerCase().includes(terminoLower) ||
        p.Email.toLowerCase().includes(terminoLower)
    );

    renderizarTabla(filtrados);
}

function limpiarFiltros() {
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-desde').value = '';
    document.getElementById('filtro-hasta').value = '';
    document.getElementById('buscar-pedido').value = '';
    renderizarTabla(todosPedidos);
}

// ============================================
// MODAL
// ============================================

function cerrarModal() {
    document.getElementById('modal-pedido-admin').style.display = 'none';
    pedidoActual = null;
}

document.getElementById('modal-pedido-admin').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
});