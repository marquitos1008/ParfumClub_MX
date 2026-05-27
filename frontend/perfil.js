// ============================================
// PERFIL DE USUARIO - JAVASCRIPT
// ============================================

const API_URL = 'http://localhost:3000/api';
let usuario = null;
let direcciones = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAutenticacion()) return;
    cargarDatos();
});

function verificarAutenticacion() {
    usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function cargarDatos() {
    try {
        // Cargar datos del usuario
        document.getElementById('nombre-perfil').textContent = `${usuario.nombre} ${usuario.apellido}`;
        document.getElementById('email-perfil').textContent = usuario.email;

        // Cargar en formulario
        document.getElementById('input-nombre').value = usuario.nombre || '';
        document.getElementById('input-apellido').value = usuario.apellido || '';
        document.getElementById('input-email').value = usuario.email || '';
        document.getElementById('input-telefono').value = usuario.telefono || '';

        // Cargar direcciones
        await cargarDirecciones();

        // Agregar listener al formulario de datos
        document.getElementById('form-datos-personales').addEventListener('submit', guardarDatos);

        // Agregar listener al formulario de cambiar contraseña
        document.getElementById('form-cambiar-contrasena').addEventListener('submit', cambiarContrasena);

        // Agregar listener al formulario de agregar dirección
        document.getElementById('form-agregar-direccion').addEventListener('submit', guardarDireccion);

    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// NAVEGACIÓN DE SECCIONES
// ============================================

function abrirSeccion(seccion, boton) {
    // Ocultar todas las secciones
    document.querySelectorAll('.perfil-seccion').forEach(s => s.classList.remove('active'));

    // Mostrar sección seleccionada
    document.getElementById(`seccion-${seccion}`).classList.add('active');

    // Actualizar menu activo
    document.querySelectorAll('.perfil-menu-item').forEach(btn => btn.classList.remove('active'));
    boton.classList.add('active');
}

// ============================================
// GUARDAR DATOS PERSONALES
// ============================================

async function guardarDatos(e) {
    e.preventDefault();

    const datos = {
        nombre: document.getElementById('input-nombre').value,
        apellido: document.getElementById('input-apellido').value,
        telefono: document.getElementById('input-telefono').value
    };

    try {
        // Por ahora solo guardamos localmente
        // En producción se enviaría al backend
        usuario.nombre = datos.nombre;
        usuario.apellido = datos.apellido;
        usuario.telefono = datos.telefono;

        localStorage.setItem('usuario', JSON.stringify(usuario));

        alert('✅ Datos actualizados exitosamente');

        // Actualizar header
        document.getElementById('nombre-perfil').textContent = `${usuario.nombre} ${usuario.apellido}`;

    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar datos');
    }
}

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================

async function cambiarContrasena(e) {
    e.preventDefault();

    const passwordActual = document.getElementById('input-password-actual').value;
    const passwordNueva = document.getElementById('input-password-nueva').value;
    const passwordConfirmar = document.getElementById('input-password-confirmar').value;

    // Validaciones
    if (passwordActual === usuario.password) {
        alert('❌ La contraseña actual es incorrecta');
        return;
    }

    if (passwordNueva.length < 8) {
        alert('❌ La nueva contraseña debe tener al menos 8 caracteres');
        return;
    }

    if (passwordNueva !== passwordConfirmar) {
        alert('❌ Las contraseñas no coinciden');
        return;
    }

    if (passwordNueva === passwordActual) {
        alert('❌ La nueva contraseña debe ser diferente a la actual');
        return;
    }

    try {
        // Por ahora solo validamos localmente
        // En producción se enviaría al backend con cifrado
        usuario.password = passwordNueva;
        localStorage.setItem('usuario', JSON.stringify(usuario));

        alert('✅ Contraseña cambiada exitosamente');

        // Limpiar formulario
        document.getElementById('form-cambiar-contrasena').reset();

    } catch (error) {
        console.error('Error:', error);
        alert('Error al cambiar contraseña');
    }
}

// ============================================
// DIRECCIONES
// ============================================

async function cargarDirecciones() {
    try {
        const response = await fetch(`${API_URL}/direcciones/usuario/${usuario.id}`);
        direcciones = await response.json();

        renderizarDirecciones();

    } catch (error) {
        console.error('Error:', error);
    }
}

function renderizarDirecciones() {
    const contenedor = document.getElementById('lista-direcciones-perfil');

    if (direcciones.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray);">
                <div style="font-size: 48px; margin-bottom: 15px;">📍</div>
                <h3>No tienes direcciones guardadas</h3>
                <p>Agrega una dirección de envío para continuar</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = `
        <div class="lista-direcciones-perfil">
            ${direcciones.map(dir => `
                <div class="direccion-card-perfil ${dir.EsPredeterminada ? 'predeterminada' : ''}">
                    ${dir.EsPredeterminada ? '<span class="badge-predeterminada-perfil">PREDETERMINADA</span>' : ''}
                    <h4>${dir.NombreCompleto}</h4>
                    <p>${dir.Calle} ${dir.NumeroExterior}${dir.NumeroInterior ? ' Int. ' + dir.NumeroInterior : ''}</p>
                    <p>${dir.Colonia}, ${dir.Ciudad}, ${dir.Estado} ${dir.CodigoPostal}</p>
                    <p>📞 ${dir.Telefono}</p>
                    ${dir.Referencias ? `<p style="margin-top: 8px; font-size: 13px;">📝 ${dir.Referencias}</p>` : ''}

                    <div class="direccion-acciones">
                        <button class="btn-editar-dir" onclick="editarDireccion(${dir.DireccionID})">
                            ✏️ Editar
                        </button>
                        <button class="btn-eliminar-dir" onclick="eliminarDireccion(${dir.DireccionID})">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function mostrarFormularioDireccionPerfil() {
    document.getElementById('formulario-direccion-perfil').style.display = 'block';
    document.getElementById('formulario-direccion-perfil').scrollIntoView({ behavior: 'smooth' });
}

function ocultarFormularioDireccionPerfil() {
    document.getElementById('formulario-direccion-perfil').style.display = 'none';
    document.getElementById('form-agregar-direccion').reset();
}

async function guardarDireccion(e) {
    e.preventDefault();

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
            ocultarFormularioDireccionPerfil();
            await cargarDirecciones();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

function editarDireccion(direccionId) {
    alert('Función de edición próximamente');
}

async function eliminarDireccion(direccionId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta dirección?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/direcciones/${direccionId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Dirección eliminada');
            await cargarDirecciones();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar dirección');
    }
}

// ============================================
// NOTIFICACIONES
// ============================================

function guardarNotificaciones() {
    const preferencias = {
        pedidos: document.getElementById('notif-pedidos').checked,
        envios: document.getElementById('notif-envios').checked,
        ofertas: document.getElementById('notif-ofertas').checked,
        productos: document.getElementById('notif-productos').checked
    };

    localStorage.setItem('preferencias-notificaciones', JSON.stringify(preferencias));
    alert('✅ Preferencias de notificaciones guardadas');
}

// ============================================
// CERRAR SESIÓN
// ============================================

function cerrarSesionPerfil() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        localStorage.removeItem('usuario');
        window.location.href = 'login.html';
    }
}