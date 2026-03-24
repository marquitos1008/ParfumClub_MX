const API_URL = 'http://localhost:3000/api';
let usuario = null;

// Verificar sesión al cargar
window.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    cargarEstadisticas();
    cargarAlertasStock();
});

function verificarSesion() {
    const usuarioData = localStorage.getItem('usuario');
    
    if (!usuarioData) {
        window.location.href = '../login.html';
        return;
    }
    
    usuario = JSON.parse(usuarioData);
    
    // Verificar que sea admin
    if (usuario.rolId !== 1) {
        alert('Acceso denegado. Solo administradores.');
        window.location.href = '../index.html';
        return;
    }
    
    document.getElementById('admin-name').textContent = usuario.nombre + ' ' + usuario.apellido;
}

async function cargarEstadisticas() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: {
                'user-id': usuario.id
            }
        });
        
        const stats = await response.json();
        
        document.getElementById('stat-productos').textContent = stats.TotalProductos;
        document.getElementById('stat-clientes').textContent = stats.TotalClientes;
        document.getElementById('stat-pedidos').textContent = stats.TotalPedidos;
        document.getElementById('stat-ventas').textContent = '$' + parseFloat(stats.VentasTotales).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarAlertasStock() {
    try {
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();
        
        const productosAlerta = productos.filter(p => p.Stock <= p.StockMinimo);
        
        const container = document.getElementById('alertas-stock');
        
        if (productosAlerta.length === 0) {
            container.innerHTML = '<p style="color: var(--success);">✅ Todos los productos tienen stock suficiente</p>';
            return;
        }
        
        container.innerHTML = productosAlerta.map(p => `
            <div class="alert-item ${p.Stock === 0 ? 'critical' : ''}">
                <div>
                    <strong>${p.Nombre}</strong>
                    <p>Stock actual: ${p.Stock} | Mínimo: ${p.StockMinimo}</p>
                </div>
                <span>${p.Stock === 0 ? '🔴 Agotado' : '⚠️ Stock bajo'}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuario');
    window.location.href = '../login.html';
}
