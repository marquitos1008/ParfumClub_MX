const API_URL = 'http://localhost:3000/api';
let usuario = null;
let productos = [];
let marcas = [];
let categorias = [];
let familias = [];
let productoEditando = null;

window.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    cargarCatalogos();
    cargarProductos();
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
        
        llenarSelectsMarcas();
        
        const filtroCategoria = document.getElementById('filtro-categoria');
        filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>' +
            categorias.map(c => `<option value="${c.CategoriaID}">${c.NombreCategoria}</option>`).join('');
        
        const selectCategoria = document.getElementById('select-categoria');
        selectCategoria.innerHTML = '<option value="">Seleccionar...</option>' +
            categorias.map(c => `<option value="${c.CategoriaID}">${c.NombreCategoria}</option>`).join('');
        
        const selectFamilia = document.getElementById('select-familia');
        selectFamilia.innerHTML = '<option value="">Seleccionar...</option>' +
            familias.map(f => `<option value="${f.FamiliaID}">${f.NombreFamilia}</option>`).join('');
        
    } catch (error) {
        console.error('Error cargando catálogos:', error);
    }
}

function llenarSelectsMarcas() {
    const filtroMarca = document.getElementById('filtro-marca');
    filtroMarca.innerHTML = '<option value="">Todas las marcas</option>' +
        marcas.map(m => `<option value="${m.MarcaID}">${m.NombreMarca}</option>`).join('');
    
    const selectMarca = document.getElementById('select-marca');
    selectMarca.innerHTML = `
        <option value="">Seleccionar...</option>
        ${marcas.map(m => `<option value="${m.MarcaID}">${m.NombreMarca}</option>`).join('')}
        <option value="nueva" style="background: #f3f4f6; font-weight: bold;">➕ Agregar Nueva Marca</option>
    `;
}

// ============================================
// CARGAR Y MOSTRAR PRODUCTOS
// ============================================

async function cargarProductos() {
    try {
        const response = await fetch(`${API_URL}/productos`);
        productos = await response.json();
        mostrarProductos(productos);
    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarProductos(lista) {
    const tbody = document.getElementById('tabla-productos');
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay productos</td></tr>';
        return;
    }
    
    tbody.innerHTML = lista.map(p => {
        const precioFinal = p.PrecioDescuento || p.PrecioOriginal;
        const stockBadge = p.Stock === 0 ? 'danger' : p.Stock <= p.StockMinimo ? 'warning' : 'success';
        
        return `
            <tr>
                <td>
                    <img src="${API_URL.replace('/api', '')}/imagenes/productos/${p.ImagenPrincipal}" 
                         alt="${p.Nombre}" 
                         onerror="this.src='https://via.placeholder.com/60'">
                </td>
                <td>
                    <strong>${p.Nombre}</strong>
                    <br>
                    <small style="color: var(--gray);">${p.NombreMarca}</small>
                </td>
                <td>${p.SKU}</td>
                <td>${p.NombreMarca}</td>
                <td>
                    <strong>$${parseFloat(precioFinal).toFixed(2)}</strong>
                    ${p.PrecioDescuento ? `<br><small style="text-decoration: line-through; color: var(--gray);">$${parseFloat(p.PrecioOriginal).toFixed(2)}</small>` : ''}
                </td>
                <td>
                    <span class="badge badge-${stockBadge}">${p.Stock} unidades</span>
                </td>
                <td>
                    <span class="badge badge-success">Activo</span>
                    ${p.Destacado ? '<br><span class="badge" style="background: #fef3c7; color: #92400e; margin-top: 5px;">⭐ Destacado</span>' : ''}
                </td>
                <td class="actions">
                    <button class="btn-warning" onclick="editarProducto(${p.ProductoID})" title="Editar">✏️</button>
                    <button class="btn-danger" onclick="eliminarProducto(${p.ProductoID})" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// FILTRAR PRODUCTOS
// ============================================

async function filtrarProductos() {
    const busqueda = document.getElementById('buscar-producto').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const marca = document.getElementById('filtro-marca').value;
    
    let url = `${API_URL}/productos/filtrar?`;
    if (busqueda) url += `busqueda=${busqueda}&`;
    if (categoria) url += `categoria=${categoria}&`;
    if (marca) url += `marca=${marca}&`;
    
    try {
        const response = await fetch(url);
        const productosFiltrados = await response.json();
        mostrarProductos(productosFiltrados);
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// MODAL FORMULARIO
// ============================================

function mostrarFormulario() {
    productoEditando = null;
    document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
    document.getElementById('form-producto').reset();
    limpiarPrevisualizaciones();
    configurarDragAndDrop();
    document.getElementById('modal-producto').classList.add('active');
    document.getElementById('btn-submit-text').textContent = 'Guardar Producto';
}

function cerrarFormulario() {
    document.getElementById('modal-producto').classList.remove('active');
    productoEditando = null;
}

// ============================================
// DRAG & DROP DE IMÁGENES
// ============================================

function configurarDragAndDrop() {
    for (let i = 1; i <= 4; i++) {
        const preview = document.getElementById(`preview-${i}`);
        const inputName = i === 1 ? 'imagenPrincipal' : `imagen${i}`;
        const fileInput = document.querySelector(`input[name="${inputName}"]`);
        
        // Click para abrir selector
        preview.onclick = () => fileInput.click();
        
        // Drag & Drop
        preview.addEventListener('dragover', (e) => {
            e.preventDefault();
            preview.style.borderColor = 'var(--primary)';
            preview.style.background = '#f0f0ff';
        });
        
        preview.addEventListener('dragleave', (e) => {
            e.preventDefault();
            preview.style.borderColor = 'var(--border)';
            preview.style.background = 'white';
        });
        
        preview.addEventListener('drop', (e) => {
            e.preventDefault();
            preview.style.borderColor = 'var(--border)';
            preview.style.background = 'white';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                
                // Validar que sea imagen
                if (!file.type.startsWith('image/')) {
                    alert('Por favor, arrastra solo archivos de imagen');
                    return;
                }
                
                // Asignar al input file
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                // Previsualizar
                previsualizarImagenDirecta(file, `preview-${i}`);
            }
        });
    }
}

function previsualizarImagen(input, previewId) {
    const preview = document.getElementById(previewId);
    
    if (input.files && input.files[0]) {
        previsualizarImagenDirecta(input.files[0], previewId);
    }
}

function previsualizarImagenDirecta(file, previewId) {
    const preview = document.getElementById(previewId);
    const reader = new FileReader();
    
    reader.onload = function(e) {
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">
            <div style="position: absolute; top: 5px; right: 5px; background: var(--danger); color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;" onclick="event.stopPropagation(); limpiarImagen('${previewId}')">✕</div>
        `;
    };
    
    reader.readAsDataURL(file);
}

function limpiarImagen(previewId) {
    const preview = document.getElementById(previewId);
    preview.innerHTML = '<span>Click o arrastra imagen</span>';
    
    // Limpiar el input file correspondiente
    const num = previewId.replace('preview-', '');
    const inputName = num === '1' ? 'imagenPrincipal' : `imagen${num}`;
    const fileInput = document.querySelector(`input[name="${inputName}"]`);
    if (fileInput) fileInput.value = '';
}

function mostrarImagenExistente(previewId, nombreImagen) {
    const preview = document.getElementById(previewId);
    const url = `${API_URL.replace('/api', '')}/imagenes/productos/${nombreImagen}`;
    preview.innerHTML = `
        <img src="${url}" alt="Imagen actual" style="width: 100%; height: 100%; object-fit: cover;">
        <div style="position: absolute; top: 5px; right: 5px; background: var(--danger); color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;" onclick="event.stopPropagation(); limpiarImagen('${previewId}')">✕</div>
    `;
}

function limpiarPrevisualizaciones() {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`preview-${i}`).innerHTML = '<span>Click o arrastra imagen</span>';
    }
}

// ============================================
// GESTIÓN DE MARCAS
// ============================================

document.getElementById('select-marca').addEventListener('change', function() {
    if (this.value === 'nueva') {
        mostrarModalNuevaMarca();
        this.value = ''; // Resetear selección
    }
});

function mostrarModalNuevaMarca() {
    const nombre = prompt('Nombre de la nueva marca:');
    
    if (!nombre || nombre.trim() === '') {
        alert('El nombre de la marca es obligatorio');
        return;
    }
    
    const paisOrigen = prompt('País de origen (opcional):') || null;
    
    agregarNuevaMarca(nombre.trim(), paisOrigen);
}

async function agregarNuevaMarca(nombre, paisOrigen) {
    try {
        const response = await fetch(`${API_URL}/admin/marcas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-id': usuario.id
            },
            body: JSON.stringify({ nombre, paisOrigen })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Marca "${nombre}" agregada exitosamente`);
            
            // Recargar catálogos
            await cargarCatalogos();
            
            // Seleccionar la nueva marca
            document.getElementById('select-marca').value = data.marcaId;
        } else {
            alert('❌ Error: ' + (data.error || 'No se pudo agregar la marca'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al agregar la marca');
    }
}

// ============================================
// CALCULAR DESCUENTO AUTOMÁTICAMENTE
// ============================================

// Arreglar el campo de descuento - hacerlo editable y recalcular porcentaje
document.addEventListener('DOMContentLoaded', function() {
    const precioOriginalInput = document.querySelector('input[name="precioOriginal"]');
    const precioDescuentoInput = document.querySelector('input[name="precioDescuento"]');
    const porcentajeInput = document.querySelector('input[name="porcentajeDescuento"]');
    
    // Hacer el campo de porcentaje solo lectura pero NO disabled
    if (porcentajeInput) {
        porcentajeInput.removeAttribute('disabled');
        porcentajeInput.setAttribute('readonly', 'true');
        porcentajeInput.style.background = '#f3f4f6';
        porcentajeInput.style.cursor = 'not-allowed';
    }
    
    function calcularDescuento() {
        const precioOriginal = parseFloat(precioOriginalInput?.value) || 0;
        const precioDescuento = parseFloat(precioDescuentoInput?.value) || 0;
        
        if (precioDescuento > 0 && precioDescuento < precioOriginal) {
            const porcentaje = Math.round(((precioOriginal - precioDescuento) / precioOriginal) * 100);
            if (porcentajeInput) porcentajeInput.value = porcentaje;
        } else {
            if (porcentajeInput) porcentajeInput.value = 0;
        }
    }
    
    if (precioOriginalInput) {
        precioOriginalInput.addEventListener('input', calcularDescuento);
    }
    
    if (precioDescuentoInput) {
        precioDescuentoInput.addEventListener('input', calcularDescuento);
        
        // Permitir borrar el descuento
        precioDescuentoInput.addEventListener('keydown', function(e) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.value = '';
                if (porcentajeInput) porcentajeInput.value = 0;
            }
        });
    }
});

// ============================================
// CREAR/EDITAR PRODUCTO
// ============================================

document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // Validar que tenga al menos la imagen principal
    if (!productoEditando && !formData.get('imagenPrincipal').name) {
        alert('❌ Debes agregar al menos la imagen principal del producto');
        return;
    }
    
    const btnSubmit = document.querySelector('#form-producto button[type="submit"]');
    const btnText = document.getElementById('btn-submit-text');
    btnText.innerHTML = '<span class="loading"></span> Guardando...';
    btnSubmit.disabled = true;
    
    try {
        const url = productoEditando 
            ? `${API_URL}/admin/productos/${productoEditando}` 
            : `${API_URL}/admin/productos`;
        
        const method = productoEditando ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'user-id': usuario.id
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ ' + data.mensaje);
            cerrarFormulario();
            cargarProductos();
        } else {
            alert('❌ Error: ' + (data.error || 'No se pudo guardar'));
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al guardar el producto');
    } finally {
        btnText.textContent = productoEditando ? 'Actualizar Producto' : 'Guardar Producto';
        btnSubmit.disabled = false;
    }
});

// ============================================
// EDITAR PRODUCTO
// ============================================

async function editarProducto(id) {
    try {
        const response = await fetch(`${API_URL}/productos/${id}`);
        const producto = await response.json();
        
        productoEditando = id;
        document.getElementById('modal-titulo').textContent = 'Editar Producto';
        
        const form = document.getElementById('form-producto');
        
        // Guardar nombre anterior y carpeta para detectar cambios
        const inputNombreAnterior = document.createElement('input');
        inputNombreAnterior.type = 'hidden';
        inputNombreAnterior.name = 'nombreAnterior';
        inputNombreAnterior.value = producto.Nombre;
        form.appendChild(inputNombreAnterior);
        
        const inputCarpetaActual = document.createElement('input');
        inputCarpetaActual.type = 'hidden';
        inputCarpetaActual.name = 'carpetaActual';
        inputCarpetaActual.value = producto.CarpetaImagenes || '';
        form.appendChild(inputCarpetaActual);
        
        // Llenar formulario
        form.nombre.value = producto.Nombre;
        form.sku.value = producto.SKU;
        form.descripcion.value = producto.Descripcion || '';
        form.descripcionLarga.value = producto.DescripcionLarga || '';
        form.categoriaId.value = producto.CategoriaID;
        form.marcaId.value = producto.MarcaID;
        form.familiaId.value = producto.FamiliaID;
        form.precioOriginal.value = producto.PrecioOriginal;
        form.precioDescuento.value = producto.PrecioDescuento || '';
        form.porcentajeDescuento.value = producto.PorcentajeDescuento || 0;
        form.stock.value = producto.Stock;
        form.stockMinimo.value = producto.StockMinimo;
        form.genero.value = producto.Genero;
        form.tamaño.value = producto.Tamaño;
        form.concentracion.value = producto.Concentracion;
        form.notasSalida.value = producto.NotasSalida || '';
        form.notasCorazon.value = producto.NotasCorazon || '';
        form.notasFondo.value = producto.NotasFondo || '';
        form.destacado.checked = producto.Destacado;
        form.nuevoLanzamiento.checked = producto.NuevoLanzamiento;
        
        // Previsualizar imágenes existentes
        if (producto.ImagenPrincipal) {
            mostrarImagenExistente('preview-1', producto.ImagenPrincipal);
        }
        if (producto.Imagen2) {
            mostrarImagenExistente('preview-2', producto.Imagen2);
        }
        if (producto.Imagen3) {
            mostrarImagenExistente('preview-3', producto.Imagen3);
        }
        if (producto.Imagen4) {
            mostrarImagenExistente('preview-4', producto.Imagen4);
        }
        
        configurarDragAndDrop();
        document.getElementById('modal-producto').classList.add('active');
        document.getElementById('btn-submit-text').textContent = 'Actualizar Producto';
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al cargar el producto');
    }
}

// ============================================
// ELIMINAR PRODUCTO
// ============================================

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/productos/${id}`, {
            method: 'DELETE',
            headers: {
                'user-id': usuario.id
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ ' + data.mensaje);
            cargarProductos();
        } else {
            alert('❌ Error al eliminar');
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al eliminar el producto');
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuario');
    window.location.href = '../login.html';
}

// Cerrar modal al hacer click fuera
document.getElementById('modal-producto').addEventListener('click', function(e) {
    if (e.target === this) {
        cerrarFormulario();
    }
});