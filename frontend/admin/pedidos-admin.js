const API_URL = 'http://localhost:3000/api';
let usuario = null;
let pedidos = [];

window.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    cargarPedidos();
    cargarEstadisticas();
});

function verificarSesion() {
    const usuarioData = localStorage.getItem('usuario');
    
    if (!usuarioData) {
        window.location.href = '../login.html';
        return;
    }
    
    usuario = JSON.parse(usuarioData);
    
    if (usuario.rolId !== 1) {
        alert('Acceso denegado. Solo administradores.');
        window.location.href = '../index.html';
        return;
    }
    
    document.getElementById('admin-name').textContent = usuario.nombre + ' ' + usuario.apellido;
}

async function cargarPedidos() {
    try {
        const response = await fetch(`${API_URL}/admin/pedidos`, {
            headers: {
                'user-id': usuario.id
            }
        });
        
        if (response.ok) {
            pedidos = await response.json();
            mostrarPedidos(pedidos);
        } else {
            // Si no existe la ruta aún, mostrar mensaje
            console.log('Endpoint de pedidos aún no implementado');
        }
    } catch (error) {
        console.log('Los pedidos se implementarán en la fase 60%');
        // No mostrar error al usuario, solo dejar el mensaje por defecto
    }
}

function mostrarPedidos(lista) {
    const tbody = document.getElementById('tabla-pedidos');
    
    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                    <h3 style="color: var(--gray); font-size: 18px;">No hay pedidos aún</h3>
                    <p style="color: var(--gray); margin-top: 10px;">
                        Los pedidos aparecerán aquí cuando los clientes realicen compras
                    </p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = lista.map(p => {
        const estadoBadge = getEstadoBadge(p.EstadoPedido);
        const pagoBadge = getPagoBadge(p.EstadoPago);
        
        return `
            <tr>
                <td><strong>${p.NumeroPedido}</strong></td>
                <td>${p.NombreCliente}</td>
                <td>${formatearFecha(p.FechaPedido)}</td>
                <td><strong>$${parseFloat(p.Total).toFixed(2)}</strong></td>
                <td><span class="badge ${estadoBadge.clase}">${estadoBadge.texto}</span></td>
                <td><span class="badge ${pagoBadge.clase}">${pagoBadge.texto}</span></td>
                <td class="actions">
                    <button class="btn-success" onclick="verDetalle(${p.PedidoID})" title="Ver detalle">👁️</button>
                    <button class="btn-warning" onclick="cambiarEstado(${p.PedidoID})" title="Cambiar estado">✏️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getEstadoBadge(estado) {
    const badges = {
        'Pendiente': { clase: 'badge-warning', texto: '⏳ Pendiente' },
        'Confirmado': { clase: 'badge-info', texto: '✅ Confirmado' },
        'Preparando': { clase: 'badge-info', texto: '📦 Preparando' },
        'Enviado': { clase: 'badge-success', texto: '🚚 Enviado' },
        'Entregado': { clase: 'badge-success', texto: '✅ Entregado' },
        'Cancelado': { clase: 'badge-danger', texto: '❌ Cancelado' }
    };
    
    return badges[estado] || { clase: 'badge-warning', texto: estado };
}

function getPagoBadge(estado) {
    const badges = {
        'Pendiente': { clase: 'badge-warning', texto: '⏳ Pendiente' },
        'Pagado': { clase: 'badge-success', texto: '✅ Pagado' },
        'Rechazado': { clase: 'badge-danger', texto: '❌ Rechazado' }
    };
    
    return badges[estado] || { clase: 'badge-warning', texto: estado };
}

function formatearFecha(fecha) {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function cargarEstadisticas() {
    // Por ahora mostramos 0, se implementará con la funcionalidad real
    document.getElementById('pedidos-pendientes').textContent = '0';
    document.getElementById('pedidos-proceso').textContent = '0';
}

function filtrarPedidos() {
    const busqueda = document.getElementById('buscar-pedido').value.toLowerCase();
    const estado = document.getElementById('filtro-estado').value;
    const fechaDesde = document.getElementById('filtro-fecha-desde').value;
    const fechaHasta = document.getElementById('filtro-fecha-hasta').value;
    
    let pedidosFiltrados = pedidos;
    
    if (busqueda) {
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            p.NumeroPedido.toLowerCase().includes(busqueda) ||
            p.NombreCliente.toLowerCase().includes(busqueda)
        );
    }
    
    if (estado) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.EstadoPedido === estado);
    }
    
    if (fechaDesde) {
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            new Date(p.FechaPedido) >= new Date(fechaDesde)
        );
    }
    
    if (fechaHasta) {
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            new Date(p.FechaPedido) <= new Date(fechaHasta)
        );
    }
    
    mostrarPedidos(pedidosFiltrados);
}

function limpiarFiltros() {
    document.getElementById('buscar-pedido').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    mostrarPedidos(pedidos);
}

function verDetalle(pedidoId) {
    alert('Funcionalidad de detalle de pedido - Se implementará en la fase 60%');
}

function cambiarEstado(pedidoId) {
    alert('Funcionalidad de cambio de estado - Se implementará en la fase 60%');
}

function cerrarModal() {
    document.getElementById('modal-pedido').classList.remove('active');
}

function cerrarSesion() {
    localStorage.removeItem('usuario');
    window.location.href = '../login.html';
}