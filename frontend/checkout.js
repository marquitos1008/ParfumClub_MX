// ============================================
// CHECKOUT.JS - COMPLETO CON STRIPE
// ============================================

const API_URL = 'http://localhost:3000/api';
let stripe;
let cardElement;
let direccionSeleccionada = null;
let metodoPagoSeleccionado = 'Tarjeta';
let carrito = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAutenticacion()) return;
    cargarCarritoLocal();
    await cargarResumenPedido();
    await cargarDirecciones();
    await inicializarStripe();
    configurarEventos();
});

function verificarAutenticacion() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        alert('Debes iniciar sesión para realizar una compra');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function cargarCarritoLocal() {
    carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    if (carrito.length === 0) {
        alert('Tu carrito está vacío');
        window.location.href = 'index.html';
    }
}

// ============================================
// INICIALIZAR STRIPE
// ============================================

async function inicializarStripe() {
    try {
        const response = await fetch(`${API_URL}/stripe-public-key`);
        const { publicKey } = await response.json();
        
        stripe = Stripe(publicKey);
        
        const elements = stripe.elements();
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    '::placeholder': { color: '#aab7c4' }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            }
        });
        
        cardElement.mount('#card-element');
        
        cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
        
    } catch (error) {
        console.error('Error al inicializar Stripe:', error);
    }
}

// ============================================
// CARGAR RESUMEN
// ============================================

async function cargarResumenPedido() {
    let subtotal = 0;
    let htmlProductos = '';
    
    for (const item of carrito) {
        const precio = item.Precio || item.precioUnitario || 0;
        const itemSubtotal = precio * item.cantidad;
        subtotal += itemSubtotal;
        
        htmlProductos += `
            <div class="resumen-producto-item">
                <img src="${API_URL.replace('/api', '')}/imagenes/productos/${item.ImagenPrincipal || 'placeholder.jpg'}" 
                     alt="${item.Nombre}"
                     onerror="this.src='https://via.placeholder.com/60x60?text=Sin+Imagen'">
                <div class="resumen-producto-info">
                    <h4>${item.Nombre}</h4>
                    <p>Cantidad: ${item.cantidad}</p>
                    <span class="resumen-producto-precio">$${precio.toFixed(2)} × ${item.cantidad}</span>
                </div>
            </div>
        `;
    }
    
    document.getElementById('resumen-productos').innerHTML = htmlProductos;
    
    const envio = subtotal >= 1500 ? 0 : 150;
    const total = subtotal + envio;
    
    document.getElementById('resumen-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('resumen-envio').textContent = envio === 0 ? 'GRATIS' : `$${envio.toFixed(2)}`;
    document.getElementById('resumen-total').textContent = `$${total.toFixed(2)}`;
}

// ============================================
// DIRECCIONES
// ============================================

async function cargarDirecciones() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const response = await fetch(`${API_URL}/direcciones/usuario/${usuario.id}`);
        const direcciones = await response.json();
        
        const contenedor = document.getElementById('direcciones-guardadas');
        
        if (direcciones.length === 0) {
            contenedor.innerHTML = '<p style="color: #666; padding: 20px; text-align: center;">No tienes direcciones guardadas. Agrega una nueva.</p>';
            return;
        }
        
        contenedor.innerHTML = direcciones.map((dir, index) => `
            <div class="direccion-card ${dir.EsPredeterminada ? 'selected' : ''}" 
                 data-id="${dir.DireccionID}"
                 onclick="seleccionarDireccion(${dir.DireccionID}, this)">
                ${dir.EsPredeterminada ? '<span class="badge-predeterminada">Predeterminada</span>' : ''}
                <h4>${dir.NombreCompleto}</h4>
                <p>${dir.Calle} ${dir.NumeroExterior}${dir.NumeroInterior ? ' Int. ' + dir.NumeroInterior : ''}</p>
                <p>${dir.Colonia}, ${dir.Ciudad}, ${dir.Estado} ${dir.CodigoPostal}</p>
                <p>📞 ${dir.Telefono}</p>
                ${dir.Referencias ? `<p style="margin-top: 8px; color: #666; font-size: 13px;">📝 ${dir.Referencias}</p>` : ''}
            </div>
        `).join('');
        
        const predeterminada = direcciones.find(d => d.EsPredeterminada);
        if (predeterminada) {
            direccionSeleccionada = predeterminada.DireccionID;
            document.getElementById('btn-continuar-pago').disabled = false;
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function seleccionarDireccion(direccionId, elemento) {
    document.querySelectorAll('.direccion-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    elemento.classList.add('selected');
    direccionSeleccionada = direccionId;
    
    document.getElementById('btn-continuar-pago').disabled = false;
}

function mostrarFormularioDireccion() {
    document.getElementById('formulario-direccion').style.display = 'block';
    window.scrollTo({ top: document.getElementById('formulario-direccion').offsetTop - 100, behavior: 'smooth' });
}

function ocultarFormularioDireccion() {
    document.getElementById('formulario-direccion').style.display = 'none';
    document.getElementById('form-direccion').reset();
}

// Guardar nueva dirección
document.getElementById('form-direccion').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    
    const nuevaDireccion = {
        usuarioId: usuario.id,
        nombreCompleto: document.getElementById('dir-nombre').value,
        telefono: document.getElementById('dir-telefono').value,
        calle: document.getElementById('dir-calle').value,
        numeroExterior: document.getElementById('dir-num-ext').value,
        numeroInterior: document.getElementById('dir-num-int').value || null,
        colonia: document.getElementById('dir-colonia').value,
        ciudad: document.getElementById('dir-ciudad').value,
        estado: document.getElementById('dir-estado').value,
        codigoPostal: document.getElementById('dir-cp').value,
        referencias: document.getElementById('dir-referencias').value || null,
        esPredeterminada: document.getElementById('dir-predeterminada').checked
    };
    
    try {
        const response = await fetch(`${API_URL}/direcciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaDireccion)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Dirección guardada exitosamente');
            ocultarFormularioDireccion();
            await cargarDirecciones();
        } else {
            alert('Error al guardar dirección');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
});

// ============================================
// NAVEGACIÓN
// ============================================

function continuarAPago() {
    if (!direccionSeleccionada) {
        alert('Por favor selecciona una dirección de envío');
        return;
    }
    
    document.getElementById('seccion-direccion').style.display = 'none';
    document.getElementById('seccion-pago').style.display = 'block';
    actualizarPasos(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverADireccion() {
    document.getElementById('seccion-pago').style.display = 'none';
    document.getElementById('seccion-confirmacion').style.display = 'none';
    document.getElementById('seccion-direccion').style.display = 'block';
    actualizarPasos(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverAPago() {
    document.getElementById('seccion-confirmacion').style.display = 'none';
    document.getElementById('seccion-pago').style.display = 'block';
    actualizarPasos(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function continuarAConfirmacion() {
    metodoPagoSeleccionado = document.querySelector('input[name="metodoPago"]:checked').value;
    
    document.getElementById('seccion-pago').style.display = 'none';
    document.getElementById('seccion-confirmacion').style.display = 'block';
    
    mostrarResumenConfirmacion();
    actualizarPasos(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function actualizarPasos(pasoActual) {
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < pasoActual) {
            step.classList.add('completed');
        } else if (index + 1 === pasoActual) {
            step.classList.add('active');
        }
    });
}

function mostrarResumenConfirmacion() {
    // Mostrar método de pago
    const metodosTexto = {
        'Tarjeta': '💳 Tarjeta de Crédito/Débito (Stripe)',
        'Efectivo': '💵 Efectivo contra entrega'
    };
    document.getElementById('confirmacion-pago').innerHTML = `<p>${metodosTexto[metodoPagoSeleccionado]}</p>`;
    
    // Mostrar productos
    const htmlProductos = carrito.map(item => {
        const precio = item.Precio || item.precioUnitario;
        return `
            <div class="resumen-producto-item">
                <img src="${API_URL.replace('/api', '')}/imagenes/productos/${item.ImagenPrincipal}" 
                     alt="${item.Nombre}">
                <div class="resumen-producto-info">
                    <h4>${item.Nombre}</h4>
                    <p>Cantidad: ${item.cantidad} × $${precio.toFixed(2)}</p>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('confirmacion-productos').innerHTML = htmlProductos;
}

// ============================================
// FINALIZAR PEDIDO
// ============================================

async function finalizarPedido() {
    const btnFinalizar = document.querySelector('.btn-finalizar');
    btnFinalizar.disabled = true;
    btnFinalizar.innerHTML = '⏳ Procesando pago...';
    
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        
        const subtotal = carrito.reduce((sum, item) => {
            return sum + ((item.Precio || item.precioUnitario) * item.cantidad);
        }, 0);
        
        const envio = subtotal >= 1500 ? 0 : 150;
        const total = subtotal + envio;
        
        if (metodoPagoSeleccionado === 'Tarjeta') {
            await procesarPagoStripe(usuario, subtotal, envio, total);
        } else {
            await procesarPedidoEfectivo(usuario, subtotal, envio, total);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al procesar el pedido: ' + error.message);
        const btnFinalizar = document.querySelector('.btn-finalizar');
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = '🎉 Finalizar Pedido';
    }
}

async function procesarPagoStripe(usuario, subtotal, envio, total) {
    // 1. Crear Payment Intent
    const intentResponse = await fetch(`${API_URL}/crear-intencion-pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            monto: total,
            descripcion: `Pedido ParfumClubMX - ${carrito.length} productos`,
            metadata: {
                usuarioId: usuario.id,
                direccionId: direccionSeleccionada
            }
        })
    });
    
    const { clientSecret, paymentIntentId } = await intentResponse.json();
    
    // 2. Confirmar pago con Stripe
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
            card: cardElement
        }
    });
    
    if (error) {
        throw new Error(error.message);
    }
    
    // 3. Crear pedido en BD
    const items = carrito.map(item => ({
        productoId: item.ProductoID,
        cantidad: item.cantidad,
        precioUnitario: item.Precio || item.precioUnitario
    }));
    
    const pedidoResponse = await fetch(`${API_URL}/confirmar-pago-pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            usuarioId: usuario.id,
            direccionId: direccionSeleccionada,
            items: items,
            subtotal: subtotal,
            costoEnvio: envio,
            descuento: 0
        })
    });
    
    const pedidoData = await pedidoResponse.json();
    
    if (pedidoData.success) {
        mostrarExito(pedidoData.numeroPedido);
        localStorage.removeItem('carrito');
    } else {
        throw new Error(pedidoData.error || 'Error al crear pedido');
    }
}

async function procesarPedidoEfectivo(usuario, subtotal, envio, total) {
    const items = carrito.map(item => ({
        productoId: item.ProductoID,
        cantidad: item.cantidad,
        precioUnitario: item.Precio || item.precioUnitario
    }));
    
    const response = await fetch(`${API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usuarioId: usuario.id,
            direccionId: direccionSeleccionada,
            metodoPago: 'Efectivo',
            items: items,
            subtotal: subtotal,
            costoEnvio: envio,
            descuento: 0
        })
    });
    
    const data = await response.json();
    
    if (data.success) {
        mostrarExito(data.numeroPedido);
        localStorage.removeItem('carrito');
    } else {
        throw new Error(data.error || 'Error al crear pedido');
    }
}

function mostrarExito(numeroPedido) {
    document.getElementById('numero-pedido-exito').textContent = numeroPedido;
    document.getElementById('modal-exito').style.display = 'flex';
}

// ============================================
// EVENTOS
// ============================================

function configurarEventos() {
    document.querySelectorAll('input[name="metodoPago"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const stripeContainer = document.getElementById('stripe-card-container');
            if (e.target.value === 'Tarjeta') {
                stripeContainer.style.display = 'block';
            } else {
                stripeContainer.style.display = 'none';
            }
        });
    });
}