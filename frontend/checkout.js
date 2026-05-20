// ============================================
// CHECKOUT.JS - CON INTEGRACIÓN STRIPE
// ============================================

const API_URL = 'http://localhost:3000/api';
let stripe;
let cardElement;
let clientSecret;
let direccionSeleccionada = null;
let metodoPagoSeleccionado = 'Tarjeta';

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    verificarAutenticacion();
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
    }
}

// ============================================
// INICIALIZAR STRIPE
// ============================================

async function inicializarStripe() {
    try {
        // Obtener clave pública de Stripe
        const response = await fetch(`${API_URL}/stripe-public-key`);
        const { publicKey } = await response.json();
        
        // Inicializar Stripe
        stripe = Stripe(publicKey);
        
        // Crear elementos de tarjeta
        const elements = stripe.elements();
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            }
        });
        
        cardElement.mount('#card-element');
        
        // Manejar errores de validación
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
// CARGAR DATOS
// ============================================

async function cargarResumenPedido() {
    const carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    
    if (carrito.length === 0) {
        alert('Tu carrito está vacío');
        window.location.href = 'index.html';
        return;
    }
    
    let subtotal = 0;
    let htmlProductos = '';
    
    for (const item of carrito) {
        const precio = item.Precio || item.precioUnitario;
        const itemSubtotal = precio * item.cantidad;
        subtotal += itemSubtotal;
        
        htmlProductos += `
            <div class="resumen-producto-item">
                <img src="${API_URL.replace('/api', '')}/imagenes/productos/${item.ImagenPrincipal || 'placeholder.jpg'}" 
                     alt="${item.Nombre}">
                <div class="resumen-producto-info">
                    <h4>${item.Nombre}</h4>
                    <p>Cantidad: ${item.cantidad}</p>
                    <span class="resumen-producto-precio">$${precio.toFixed(2)}</span>
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

async function cargarDirecciones() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const response = await fetch(`${API_URL}/direcciones/usuario/${usuario.id}`);
        const direcciones = await response.json();
        
        const contenedor = document.getElementById('direcciones-guardadas');
        
        if (direcciones.length === 0) {
            contenedor.innerHTML = '<p style="color: #666;">No tienes direcciones guardadas. Agrega una nueva.</p>';
            return;
        }
        
        contenedor.innerHTML = direcciones.map(dir => `
            <div class="direccion-card ${dir.EsPredeterminada ? 'selected' : ''}" 
                 onclick="seleccionarDireccion(${dir.DireccionID})">
                ${dir.EsPredeterminada ? '<span class="badge-predeterminada">Predeterminada</span>' : ''}
                <h4>${dir.NombreCompleto}</h4>
                <p>${dir.Calle} ${dir.NumeroExterior}${dir.NumeroInterior ? ' Int. ' + dir.NumeroInterior : ''}</p>
                <p>${dir.Colonia}, ${dir.Ciudad}, ${dir.Estado} ${dir.CodigoPostal}</p>
                <p>📞 ${dir.Telefono}</p>
                ${dir.Referencias ? `<p class="referencias">📝 ${dir.Referencias}</p>` : ''}
            </div>
        `).join('');
        
        // Seleccionar la predeterminada automáticamente
        const predeterminada = direcciones.find(d => d.EsPredeterminada);
        if (predeterminada) {
            seleccionarDireccion(predeterminada.DireccionID);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// SELECCIONAR DIRECCIÓN
// ============================================

function seleccionarDireccion(direccionId) {
    // Remover selección anterior
    document.querySelectorAll('.direccion-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Seleccionar nueva
    event.currentTarget.classList.add('selected');
    direccionSeleccionada = direccionId;
    
    // Habilitar botón continuar
    document.getElementById('btn-continuar-pago').disabled = false;
}

// ============================================
// FORMULARIO DE DIRECCIÓN
// ============================================

function mostrarFormularioDireccion() {
    document.getElementById('formulario-direccion').style.display = 'block';
}

function ocultarFormularioDireccion() {
    document.getElementById('formulario-direccion').style.display = 'none';
    document.getElementById('form-direccion').reset();
}

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
// NAVEGACIÓN ENTRE PASOS
// ============================================

function continuarAPago() {
    if (!direccionSeleccionada) {
        alert('Por favor selecciona una dirección de envío');
        return;
    }
    
    document.getElementById('seccion-direccion').style.display = 'none';
    document.getElementById('seccion-pago').style.display = 'block';
    
    actualizarPasos(2);
}

function volverADireccion() {
    document.getElementById('seccion-pago').style.display = 'none';
    document.getElementById('seccion-confirmacion').style.display = 'none';
    document.getElementById('seccion-direccion').style.display = 'block';
    
    actualizarPasos(1);
}

function volverAPago() {
    document.getElementById('seccion-confirmacion').style.display = 'none';
    document.getElementById('seccion-pago').style.display = 'block';
    
    actualizarPasos(2);
}

function continuarAConfirmacion() {
    // Obtener método de pago seleccionado
    metodoPagoSeleccionado = document.querySelector('input[name="metodoPago"]:checked').value;
    
    document.getElementById('seccion-pago').style.display = 'none';
    document.getElementById('seccion-confirmacion').style.display = 'block';
    
    mostrarResumenConfirmacion();
    actualizarPasos(3);
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

// ============================================
// MOSTRAR RESUMEN DE CONFIRMACIÓN
// ============================================

function mostrarResumenConfirmacion() {
    // Aquí mostrarías el resumen... lo continúo en el siguiente mensaje
}

// ============================================
// FINALIZAR PEDIDO CON STRIPE
// ============================================

async function finalizarPedido() {
    const btnFinalizar = event.target;
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = 'Procesando pago...';
    
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const carrito = JSON.parse(localStorage.getItem('carrito')) || [];
        
        const subtotal = carrito.reduce((sum, item) => {
            return sum + (item.Precio * item.cantidad);
        }, 0);
        
        const envio = subtotal >= 1500 ? 0 : 150;
        const total = subtotal + envio;
        
        if (metodoPagoSeleccionado === 'Tarjeta') {
            // PAGO CON STRIPE
            await procesarPagoStripe(usuario, carrito, subtotal, envio, total);
        } else {
            // PAGO EN EFECTIVO
            await procesarPedidoEfectivo(usuario, carrito, subtotal, envio, total);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el pedido: ' + error.message);
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = '🎉 Finalizar Pedido';
    }
}

async function procesarPagoStripe(usuario, carrito, subtotal, envio, total) {
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
        precioUnitario: item.Precio
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
    }
}

async function procesarPedidoEfectivo(usuario, carrito, subtotal, envio, total) {
    const items = carrito.map(item => ({
        productoId: item.ProductoID,
        cantidad: item.cantidad,
        precioUnitario: item.Precio
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
    }
}

function mostrarExito(numeroPedido) {
    document.getElementById('numero-pedido-exito').textContent = numeroPedido;
    document.getElementById('modal-exito').classList.add('active');
}

// ============================================
// EVENTOS
// ============================================

function configurarEventos() {
    // Cambiar método de pago
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