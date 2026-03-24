const API_URL = 'http://localhost:3000/api';

function mostrarRegistro() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('registro-form').classList.remove('hidden');
}

function mostrarLogin() {
    document.getElementById('registro-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

async function login(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            
            // Redirigir según el rol
            if (data.usuario.rolId === 1) {
                window.location.href = 'admin/dashboard.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al iniciar sesión');
    }
}

async function registro(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('reg-nombre').value;
    const apellido = document.getElementById('reg-apellido').value;
    const email = document.getElementById('reg-email').value;
    const telefono = document.getElementById('reg-telefono').value;
    const password = document.getElementById('reg-password').value;
    
    if (password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, apellido, email, telefono, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
            mostrarLogin();
        } else {
            alert(data.error || 'Error al crear la cuenta');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrarse');
    }
}