const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')('sk_test_51TYyduQyWORSQ9oNwKQsbBs2raDzLv4C9GVVUL8a33OVD0nTOTdGryg52agWHsEBe5jX4Cbla6TKYusGjAaCDagL00zaSY9L5f');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/imagenes', express.static('imagenes'));

// ============================================
// UTILIDADES
// ============================================

function crearSlug(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// ============================================
// CONFIGURACIÓN MULTER SIMPLE
// ============================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Crear carpeta temporal primero
        const tempDir = path.join(__dirname, 'imagenes', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, 'imagenes/temp/');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|webp/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Solo imágenes (jpg, png, webp)');
        }
    }
});

// ============================================
// FUNCIONES PARA MANEJO DE IMÁGENES
// ============================================

function moverImagenesACarpetaProducto(archivosTemp, nombreProducto, productoId) {
    const slug = crearSlug(nombreProducto);
    const carpetaProducto = `${slug}-${productoId}`;
    const rutaCarpeta = path.join(__dirname, 'imagenes', 'productos', carpetaProducto);
    
    // Crear carpeta del producto
    if (!fs.existsSync(rutaCarpeta)) {
        fs.mkdirSync(rutaCarpeta, { recursive: true });
    }
    
    const imagenesFinales = {};
    const nombresImagenes = {
        'imagenPrincipal': 'principal',
        'imagen2': 'vista-2',
        'imagen3': 'vista-3',
        'imagen4': 'vista-4'
    };
    
    // Mover cada imagen de temp a la carpeta del producto
    for (const [campo, archivo] of Object.entries(archivosTemp)) {
        if (archivo) {
            const extension = path.extname(archivo.filename);
            const nuevoNombre = `${nombresImagenes[campo]}${extension}`;
            const rutaOrigen = archivo.path;
            const rutaDestino = path.join(rutaCarpeta, nuevoNombre);
            
            // Mover archivo
            fs.renameSync(rutaOrigen, rutaDestino);
            
            // Guardar ruta relativa
            imagenesFinales[campo] = `${carpetaProducto}/${nuevoNombre}`;
        }
    }
    
    return { imagenesFinales, carpetaProducto };
}

function eliminarCarpeta(rutaCarpeta) {
    if (fs.existsSync(rutaCarpeta)) {
        fs.rmSync(rutaCarpeta, { recursive: true, force: true });
        console.log('🗑️  Carpeta eliminada:', rutaCarpeta);
        return true;
    }
    return false;
}

function renombrarCarpeta(rutaVieja, rutaNueva) {
    if (fs.existsSync(rutaVieja) && !fs.existsSync(rutaNueva)) {
        fs.renameSync(rutaVieja, rutaNueva);
        console.log('📝 Carpeta renombrada');
        return true;
    }
    return false;
}

// ============================================
// CONFIGURACIÓN BD
// ============================================

const config = {
    user: 'sa',
    password: 'octubre8g',
    server: 'MARCO',
    database: 'PerfumeriaOnline',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;
sql.connect(config).then(p => {
    pool = p;
    console.log('✅ Conectado a SQL Server');
}).catch(err => console.error('❌ Error BD:', err));

// ============================================
// MIDDLEWARE
// ============================================

function verificarAdmin(req, res, next) {
    const userId = req.headers['user-id'];
    
    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT RolID FROM Usuarios WHERE UsuarioID = @userId')
        .then(result => {
            if (result.recordset.length > 0 && result.recordset[0].RolID === 1) {
                next();
            } else {
                res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
            }
        })
        .catch(err => res.status(500).json({ error: err.message }));
}

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, password)
            .query(`
                SELECT u.*, r.NombreRol 
                FROM Usuarios u
                INNER JOIN Roles r ON u.RolID = r.RolID
                WHERE u.Email = @email AND u.Password = @password AND u.Activo = 1
            `);
        
        if (result.recordset.length > 0) {
            const usuario = result.recordset[0];
            
            await pool.request()
                .input('userId', sql.Int, usuario.UsuarioID)
                .query('UPDATE Usuarios SET UltimoAcceso = GETDATE() WHERE UsuarioID = @userId');
            
            res.json({ 
                success: true, 
                usuario: {
                    id: usuario.UsuarioID,
                    nombre: usuario.Nombre,
                    apellido: usuario.Apellido,
                    email: usuario.Email,
                    rol: usuario.NombreRol,
                    rolId: usuario.RolID
                }
            });
        } else {
            res.json({ success: false, mensaje: 'Credenciales incorrectas' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, apellido, email, password, telefono } = req.body;
        
        await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('apellido', sql.NVarChar, apellido)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, password)
            .input('telefono', sql.NVarChar, telefono || null)
            .query(`
                INSERT INTO Usuarios (Nombre, Apellido, Email, Password, Telefono, RolID) 
                VALUES (@nombre, @apellido, @email, @password, @telefono, 2)
            `);
        
        res.json({ success: true, mensaje: 'Usuario registrado exitosamente' });
    } catch (err) {
        if (err.number === 2627) {
            res.status(400).json({ error: 'El email ya está registrado' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// ============================================
// RUTAS PÚBLICAS - PRODUCTOS
// ============================================

app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                p.*,
                m.NombreMarca,
                c.NombreCategoria,
                f.NombreFamilia,
                f.Color as ColorFamilia,
                CASE 
                    WHEN p.PrecioDescuento IS NOT NULL THEN p.PrecioDescuento
                    ELSE p.PrecioOriginal
                END as PrecioFinal
            FROM Productos p
            LEFT JOIN Marcas m ON p.MarcaID = m.MarcaID
            LEFT JOIN Categorias c ON p.CategoriaID = c.CategoriaID
            LEFT JOIN FamiliasOlfativas f ON p.FamiliaID = f.FamiliaID
            WHERE p.Activo = 1
            ORDER BY p.Destacado DESC, p.FechaCreacion DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/productos/filtrar', async (req, res) => {
    try {
        const { marca, genero, categoria, familia, precioMin, precioMax, busqueda, destacados } = req.query;
        
        let query = `
            SELECT 
                p.*,
                m.NombreMarca,
                c.NombreCategoria,
                f.NombreFamilia,
                CASE 
                    WHEN p.PrecioDescuento IS NOT NULL THEN p.PrecioDescuento
                    ELSE p.PrecioOriginal
                END as PrecioFinal
            FROM Productos p
            LEFT JOIN Marcas m ON p.MarcaID = m.MarcaID
            LEFT JOIN Categorias c ON p.CategoriaID = c.CategoriaID
            LEFT JOIN FamiliasOlfativas f ON p.FamiliaID = f.FamiliaID
            WHERE p.Activo = 1
        `;
        
        if (marca) query += ` AND p.MarcaID = ${marca}`;
        if (genero) query += ` AND p.Genero = '${genero}'`;
        if (categoria) query += ` AND p.CategoriaID = ${categoria}`;
        if (familia) query += ` AND p.FamiliaID = ${familia}`;
        if (precioMin) query += ` AND p.PrecioOriginal >= ${precioMin}`;
        if (precioMax) query += ` AND p.PrecioOriginal <= ${precioMax}`;
        if (busqueda) query += ` AND (p.Nombre LIKE '%${busqueda}%' OR m.NombreMarca LIKE '%${busqueda}%')`;
        if (destacados === 'true') query += ` AND p.Destacado = 1`;
        
        query += ` ORDER BY p.Destacado DESC, p.FechaCreacion DESC`;
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/productos/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    p.*,
                    m.NombreMarca,
                    c.NombreCategoria,
                    f.NombreFamilia,
                    f.Color as ColorFamilia
                FROM Productos p
                LEFT JOIN Marcas m ON p.MarcaID = m.MarcaID
                LEFT JOIN Categorias c ON p.CategoriaID = c.CategoriaID
                LEFT JOIN FamiliasOlfativas f ON p.FamiliaID = f.FamiliaID
                WHERE p.ProductoID = @id
            `);
        
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: 'Producto no encontrado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// RUTAS ADMIN - PRODUCTOS
// ============================================

// Crear producto
app.post('/api/admin/productos', verificarAdmin, upload.fields([
    { name: 'imagenPrincipal', maxCount: 1 },
    { name: 'imagen2', maxCount: 1 },
    { name: 'imagen3', maxCount: 1 },
    { name: 'imagen4', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            nombre, sku, descripcion, descripcionLarga,
            categoriaId, marcaId, familiaId,
            precioOriginal, precioDescuento, porcentajeDescuento,
            stock, stockMinimo, genero, tamaño, concentracion,
            notasSalida, notasCorazon, notasFondo,
            destacado, nuevoLanzamiento
        } = req.body;
        
        const slug = crearSlug(nombre);
        
        // PRIMERO: Insertar producto en BD para obtener el ID
        const result = await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('sku', sql.NVarChar, sku)
            .input('descripcion', sql.NVarChar, descripcion)
            .input('descripcionLarga', sql.NVarChar, descripcionLarga || null)
            .input('categoriaId', sql.Int, categoriaId)
            .input('marcaId', sql.Int, marcaId)
            .input('familiaId', sql.Int, familiaId)
            .input('precioOriginal', sql.Decimal(10, 2), precioOriginal)
            .input('precioDescuento', sql.Decimal(10, 2), precioDescuento || null)
            .input('porcentajeDescuento', sql.Int, porcentajeDescuento || 0)
            .input('stock', sql.Int, stock)
            .input('stockMinimo', sql.Int, stockMinimo || 5)
            .input('genero', sql.NVarChar, genero)
            .input('tamaño', sql.NVarChar, tamaño)
            .input('concentracion', sql.NVarChar, concentracion)
            .input('notasSalida', sql.NVarChar, notasSalida || null)
            .input('notasCorazon', sql.NVarChar, notasCorazon || null)
            .input('notasFondo', sql.NVarChar, notasFondo || null)
            .input('slug', sql.NVarChar, slug)
            .input('destacado', sql.Bit, destacado === 'true' ? 1 : 0)
            .input('nuevoLanzamiento', sql.Bit, nuevoLanzamiento === 'true' ? 1 : 0)
            .query(`
                INSERT INTO Productos (
                    Nombre, SKU, Descripcion, DescripcionLarga,
                    CategoriaID, MarcaID, FamiliaID,
                    PrecioOriginal, PrecioDescuento, PorcentajeDescuento,
                    Stock, StockMinimo, Genero, Tamaño, Concentracion,
                    NotasSalida, NotasCorazon, NotasFondo,
                    Slug, Destacado, NuevoLanzamiento
                ) VALUES (
                    @nombre, @sku, @descripcion, @descripcionLarga,
                    @categoriaId, @marcaId, @familiaId,
                    @precioOriginal, @precioDescuento, @porcentajeDescuento,
                    @stock, @stockMinimo, @genero, @tamaño, @concentracion,
                    @notasSalida, @notasCorazon, @notasFondo,
                    @slug, @destacado, @nuevoLanzamiento
                );
                SELECT SCOPE_IDENTITY() as ProductoID;
            `);
        
        const productoId = result.recordset[0].ProductoID;
        
        // SEGUNDO: Mover imágenes de temp a carpeta del producto
        const archivosTemp = {
            imagenPrincipal: req.files['imagenPrincipal'] ? req.files['imagenPrincipal'][0] : null,
            imagen2: req.files['imagen2'] ? req.files['imagen2'][0] : null,
            imagen3: req.files['imagen3'] ? req.files['imagen3'][0] : null,
            imagen4: req.files['imagen4'] ? req.files['imagen4'][0] : null
        };
        
        const { imagenesFinales, carpetaProducto } = moverImagenesACarpetaProducto(archivosTemp, nombre, productoId);
        
        // TERCERO: Actualizar producto con rutas de imágenes
        await pool.request()
            .input('productoId', sql.Int, productoId)
            .input('imagenPrincipal', sql.NVarChar, imagenesFinales.imagenPrincipal || null)
            .input('imagen2', sql.NVarChar, imagenesFinales.imagen2 || null)
            .input('imagen3', sql.NVarChar, imagenesFinales.imagen3 || null)
            .input('imagen4', sql.NVarChar, imagenesFinales.imagen4 || null)
            .input('carpetaImagenes', sql.NVarChar, carpetaProducto)
            .query(`
                UPDATE Productos 
                SET ImagenPrincipal = @imagenPrincipal,
                    Imagen2 = @imagen2,
                    Imagen3 = @imagen3,
                    Imagen4 = @imagen4,
                    CarpetaImagenes = @carpetaImagenes
                WHERE ProductoID = @productoId
            `);
        
        res.json({ 
            success: true, 
            mensaje: 'Producto creado exitosamente',
            productoId: productoId,
            carpeta: carpetaProducto
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Actualizar producto
app.put('/api/admin/productos/:id', verificarAdmin, upload.fields([
    { name: 'imagenPrincipal', maxCount: 1 },
    { name: 'imagen2', maxCount: 1 },
    { name: 'imagen3', maxCount: 1 },
    { name: 'imagen4', maxCount: 1 }
]), async (req, res) => {
    try {
        const productoId = req.params.id;
        const {
            nombre, sku, descripcion, descripcionLarga,
            categoriaId, marcaId, familiaId,
            precioOriginal, precioDescuento, porcentajeDescuento,
            stock, stockMinimo, genero, tamaño, concentracion,
            notasSalida, notasCorazon, notasFondo,
            destacado, nuevoLanzamiento,
            nombreAnterior, carpetaActual
        } = req.body;
        
        // Obtener datos actuales
        const productoActual = await pool.request()
            .input('id', sql.Int, productoId)
            .query('SELECT * FROM Productos WHERE ProductoID = @id');
        
        const producto = productoActual.recordset[0];
        let carpetaFinal = carpetaActual || producto.CarpetaImagenes;
        
        // Si cambió el nombre, renombrar carpeta
        if (nombreAnterior && nombre !== nombreAnterior && carpetaActual) {
            const slug = crearSlug(nombre);
            const nuevaCarpeta = `${slug}-${productoId}`;
            const rutaVieja = path.join(__dirname, 'imagenes', 'productos', carpetaActual);
            const rutaNueva = path.join(__dirname, 'imagenes', 'productos', nuevaCarpeta);
            
            if (renombrarCarpeta(rutaVieja, rutaNueva)) {
                carpetaFinal = nuevaCarpeta;
            }
        }
        
        // Procesar nuevas imágenes si hay
        let imagenes = {
            imagenPrincipal: producto.ImagenPrincipal,
            imagen2: producto.Imagen2,
            imagen3: producto.Imagen3,
            imagen4: producto.Imagen4
        };
        
        if (req.files && Object.keys(req.files).length > 0) {
            const archivosTemp = {
                imagenPrincipal: req.files['imagenPrincipal'] ? req.files['imagenPrincipal'][0] : null,
                imagen2: req.files['imagen2'] ? req.files['imagen2'][0] : null,
                imagen3: req.files['imagen3'] ? req.files['imagen3'][0] : null,
                imagen4: req.files['imagen4'] ? req.files['imagen4'][0] : null
            };
            
            // Mover solo las nuevas imágenes
            for (const [campo, archivo] of Object.entries(archivosTemp)) {
                if (archivo) {
                    const extension = path.extname(archivo.filename);
                    const nombresImagenes = {
                        'imagenPrincipal': 'principal',
                        'imagen2': 'vista-2',
                        'imagen3': 'vista-3',
                        'imagen4': 'vista-4'
                    };
                    const nuevoNombre = `${nombresImagenes[campo]}${extension}`;
                    const rutaOrigen = archivo.path;
                    const rutaDestino = path.join(__dirname, 'imagenes', 'productos', carpetaFinal, nuevoNombre);
                    
                    // Asegurar que existe la carpeta
                    const dirCarpeta = path.join(__dirname, 'imagenes', 'productos', carpetaFinal);
                    if (!fs.existsSync(dirCarpeta)) {
                        fs.mkdirSync(dirCarpeta, { recursive: true });
                    }
                    
                    fs.renameSync(rutaOrigen, rutaDestino);
                    imagenes[campo] = `${carpetaFinal}/${nuevoNombre}`;
                }
            }
        }
        
        await pool.request()
            .input('productoId', sql.Int, productoId)
            .input('nombre', sql.NVarChar, nombre)
            .input('sku', sql.NVarChar, sku)
            .input('descripcion', sql.NVarChar, descripcion)
            .input('descripcionLarga', sql.NVarChar, descripcionLarga || null)
            .input('categoriaId', sql.Int, categoriaId)
            .input('marcaId', sql.Int, marcaId)
            .input('familiaId', sql.Int, familiaId)
            .input('precioOriginal', sql.Decimal(10, 2), precioOriginal)
            .input('precioDescuento', sql.Decimal(10, 2), precioDescuento || null)
            .input('porcentajeDescuento', sql.Int, porcentajeDescuento || 0)
            .input('stock', sql.Int, stock)
            .input('stockMinimo', sql.Int, stockMinimo || 5)
            .input('genero', sql.NVarChar, genero)
            .input('tamaño', sql.NVarChar, tamaño)
            .input('concentracion', sql.NVarChar, concentracion)
            .input('notasSalida', sql.NVarChar, notasSalida || null)
            .input('notasCorazon', sql.NVarChar, notasCorazon || null)
            .input('notasFondo', sql.NVarChar, notasFondo || null)
            .input('imagenPrincipal', sql.NVarChar, imagenes.imagenPrincipal)
            .input('imagen2', sql.NVarChar, imagenes.imagen2)
            .input('imagen3', sql.NVarChar, imagenes.imagen3)
            .input('imagen4', sql.NVarChar, imagenes.imagen4)
            .input('destacado', sql.Bit, destacado === 'true' ? 1 : 0)
            .input('nuevoLanzamiento', sql.Bit, nuevoLanzamiento === 'true' ? 1 : 0)
            .input('carpetaImagenes', sql.NVarChar, carpetaFinal)
            .query(`
                UPDATE Productos SET
                    Nombre = @nombre,
                    SKU = @sku,
                    Descripcion = @descripcion,
                    DescripcionLarga = @descripcionLarga,
                    CategoriaID = @categoriaId,
                    MarcaID = @marcaId,
                    FamiliaID = @familiaId,
                    PrecioOriginal = @precioOriginal,
                    PrecioDescuento = @precioDescuento,
                    PorcentajeDescuento = @porcentajeDescuento,
                    Stock = @stock,
                    StockMinimo = @stockMinimo,
                    Genero = @genero,
                    Tamaño = @tamaño,
                    Concentracion = @concentracion,
                    NotasSalida = @notasSalida,
                    NotasCorazon = @notasCorazon,
                    NotasFondo = @notasFondo,
                    ImagenPrincipal = @imagenPrincipal,
                    Imagen2 = @imagen2,
                    Imagen3 = @imagen3,
                    Imagen4 = @imagen4,
                    Destacado = @destacado,
                    NuevoLanzamiento = @nuevoLanzamiento,
                    CarpetaImagenes = @carpetaImagenes,
                    FechaActualizacion = GETDATE()
                WHERE ProductoID = @productoId
            `);
        
        res.json({ success: true, mensaje: 'Producto actualizado exitosamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Eliminar producto
app.delete('/api/admin/productos/:id', verificarAdmin, async (req, res) => {
    try {
        const productoId = req.params.id;
        
        const result = await pool.request()
            .input('id', sql.Int, productoId)
            .query('SELECT CarpetaImagenes FROM Productos WHERE ProductoID = @id');
        
        if (result.recordset.length > 0) {
            const carpeta = result.recordset[0].CarpetaImagenes;
            
            await pool.request()
                .input('id', sql.Int, productoId)
                .query('UPDATE Productos SET Activo = 0 WHERE ProductoID = @id');
            
            if (carpeta) {
                const rutaCarpeta = path.join(__dirname, 'imagenes', 'productos', carpeta);
                eliminarCarpeta(rutaCarpeta);
            }
            
            res.json({ success: true, mensaje: 'Producto eliminado exitosamente' });
        } else {
            res.status(404).json({ error: 'Producto no encontrado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// RUTAS AUXILIARES
// ============================================

app.get('/api/marcas', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM Marcas WHERE Activo = 1 ORDER BY NombreMarca');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/categorias', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM Categorias WHERE Activo = 1 ORDER BY Orden, NombreCategoria');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/familias', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM FamiliasOlfativas ORDER BY NombreFamilia');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/marcas', verificarAdmin, async (req, res) => {
    try {
        const { nombre, paisOrigen } = req.body;
        
        const result = await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('paisOrigen', sql.NVarChar, paisOrigen || null)
            .query(`
                INSERT INTO Marcas (NombreMarca, PaisOrigen) 
                VALUES (@nombre, @paisOrigen);
                SELECT SCOPE_IDENTITY() as MarcaID;
            `);
        
        res.json({ 
            success: true, 
            mensaje: 'Marca creada exitosamente',
            marcaId: result.recordset[0].MarcaID
        });
    } catch (err) {
        if (err.number === 2627) {
            res.status(400).json({ error: 'Esta marca ya existe' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/admin/stats', verificarAdmin, async (req, res) => {
    try {
        const stats = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Productos WHERE Activo = 1) as TotalProductos,
                (SELECT COUNT(*) FROM Usuarios WHERE RolID = 2) as TotalClientes,
                (SELECT COUNT(*) FROM Pedidos WHERE EstadoPedido != 'Cancelado') as TotalPedidos,
                (SELECT ISNULL(SUM(Total), 0) FROM Pedidos WHERE EstadoPedido != 'Cancelado') as VentasTotales,
                (SELECT COUNT(*) FROM Productos WHERE Stock <= StockMinimo AND Activo = 1) as ProductosBajoStock
        `);
        
        res.json(stats.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ⬇️⬇️⬇️ AGREGAR TODO EL CÓDIGO NUEVO AQUÍ ⬇️⬇️⬇️
// ============================================

// ============================================
// RUTAS DE PEDIDOS
// ============================================

// Crear pedido desde carrito
app.post('/api/pedidos', async (req, res) => {
    try {
        const { 
            usuarioId, 
            direccionId, 
            metodoPago, 
            items, // Array de {productoId, cantidad, precioUnitario}
            subtotal,
            costoEnvio,
            cuponId = null,
            descuento = 0
        } = req.body;
        
        // Validar stock de todos los productos
        for (const item of items) {
            const stockResult = await pool.request()
                .input('productoId', sql.Int, item.productoId)
                .query('SELECT Stock FROM Productos WHERE ProductoID = @productoId');
            
            if (stockResult.recordset[0].Stock < item.cantidad) {
                return res.status(400).json({ 
                    error: `Stock insuficiente para el producto ${item.productoId}` 
                });
            }
        }
        
        const total = subtotal + costoEnvio - descuento;
        
        // Generar número de pedido único
        const numeroPedido = `PED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Insertar pedido
        const pedidoResult = await pool.request()
            .input('usuarioId', sql.Int, usuarioId)
            .input('direccionId', sql.Int, direccionId)
            .input('numeroPedido', sql.NVarChar, numeroPedido)
            .input('subtotal', sql.Decimal(10, 2), subtotal)
            .input('descuento', sql.Decimal(10, 2), descuento)
            .input('costoEnvio', sql.Decimal(10, 2), costoEnvio)
            .input('total', sql.Decimal(10, 2), total)
            .input('metodoPago', sql.NVarChar, metodoPago)
            .input('cuponId', sql.Int, cuponId)
            .query(`
                INSERT INTO Pedidos (
                    UsuarioID, DireccionEnvioID, NumeroPedido, 
                    Subtotal, Descuento, CostoEnvio, Total,
                    EstadoPedido, EstadoPago, MetodoPago, CuponID
                ) VALUES (
                    @usuarioId, @direccionId, @numeroPedido,
                    @subtotal, @descuento, @costoEnvio, @total,
                    'Pendiente', 'Pendiente', @metodoPago, @cuponId
                );
                SELECT SCOPE_IDENTITY() as PedidoID;
            `);
        
        const pedidoId = pedidoResult.recordset[0].PedidoID;
        
        // Insertar detalles del pedido y actualizar stock
        for (const item of items) {
            // Insertar detalle
            await pool.request()
                .input('pedidoId', sql.Int, pedidoId)
                .input('productoId', sql.Int, item.productoId)
                .input('cantidad', sql.Int, item.cantidad)
                .input('precioUnitario', sql.Decimal(10, 2), item.precioUnitario)
                .query(`
                    INSERT INTO DetallePedido (PedidoID, ProductoID, Cantidad, PrecioUnitario)
                    VALUES (@pedidoId, @productoId, @cantidad, @precioUnitario)
                `);
            
            // Reducir stock
            await pool.request()
                .input('productoId', sql.Int, item.productoId)
                .input('cantidad', sql.Int, item.cantidad)
                .query(`
                    UPDATE Productos 
                    SET Stock = Stock - @cantidad,
                        VentasTotales = ISNULL(VentasTotales, 0) + @cantidad
                    WHERE ProductoID = @productoId
                `);
        }
        
        // Limpiar carrito del usuario
        await pool.request()
            .input('usuarioId', sql.Int, usuarioId)
            .query('DELETE FROM Carrito WHERE UsuarioID = @usuarioId');
        
        res.json({ 
            success: true, 
            mensaje: 'Pedido creado exitosamente',
            pedidoId: pedidoId,
            numeroPedido: numeroPedido
        });
        
    } catch (err) {
        console.error('Error al crear pedido:', err);
        res.status(500).json({ error: err.message });
    }
});

// Obtener pedidos del usuario
app.get('/api/pedidos/usuario/:userId', async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.params.userId)
            .query(`
                SELECT 
                    p.*,
                    d.Calle, d.Ciudad, d.Estado, d.CodigoPostal,
                    COUNT(dp.DetalleID) as TotalProductos
                FROM Pedidos p
                LEFT JOIN Direcciones d ON p.DireccionEnvioID = d.DireccionID
                LEFT JOIN DetallePedido dp ON p.PedidoID = dp.PedidoID
                WHERE p.UsuarioID = @userId
                GROUP BY p.PedidoID, p.UsuarioID, p.DireccionEnvioID, p.NumeroPedido,
                         p.Subtotal, p.Descuento, p.CostoEnvio, p.Total,
                         p.EstadoPedido, p.EstadoPago, p.MetodoPago,
                         p.FechaPedido, p.FechaConfirmacion, p.FechaEnvio, p.FechaEntrega,
                         p.GuiaRastreo, p.Paqueteria, p.CuponID, p.NotasInternas,
                         d.Calle, d.Ciudad, d.Estado, d.CodigoPostal
                ORDER BY p.FechaPedido DESC
            `);
        
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener detalle completo de un pedido
app.get('/api/pedidos/:id', async (req, res) => {
    try {
        // Datos del pedido
        const pedidoResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    p.*,
                    u.Nombre, u.Apellido, u.Email, u.Telefono,
                    d.Calle, d.NumeroExterior, d.NumeroInterior, d.Colonia,
                    d.Ciudad, d.Estado, d.CodigoPostal, d.Referencias
                FROM Pedidos p
                INNER JOIN Usuarios u ON p.UsuarioID = u.UsuarioID
                LEFT JOIN Direcciones d ON p.DireccionEnvioID = d.DireccionID
                WHERE p.PedidoID = @id
            `);
        
        if (pedidoResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        
        const pedido = pedidoResult.recordset[0];
        
        // Detalles (productos) del pedido
        const detallesResult = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    dp.*,
                    prod.Nombre, prod.ImagenPrincipal, prod.SKU,
                    m.NombreMarca
                FROM DetallePedido dp
                INNER JOIN Productos prod ON dp.ProductoID = prod.ProductoID
                LEFT JOIN Marcas m ON prod.MarcaID = m.MarcaID
                WHERE dp.PedidoID = @id
            `);
        
        pedido.Detalles = detallesResult.recordset;
        
        res.json(pedido);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar estado de pedido (Admin)
app.put('/api/admin/pedidos/:id/estado', verificarAdmin, async (req, res) => {
    try {
        const { estadoPedido, estadoPago, guiaRastreo, paqueteria } = req.body;
        
        const updates = [];
        const request = pool.request().input('id', sql.Int, req.params.id);
        
        if (estadoPedido) {
            updates.push('EstadoPedido = @estadoPedido');
            request.input('estadoPedido', sql.NVarChar, estadoPedido);
            
            // Actualizar fechas según estado
            if (estadoPedido === 'Confirmado') {
                updates.push('FechaConfirmacion = GETDATE()');
            } else if (estadoPedido === 'Enviado') {
                updates.push('FechaEnvio = GETDATE()');
            } else if (estadoPedido === 'Entregado') {
                updates.push('FechaEntrega = GETDATE()');
            }
        }
        
        if (estadoPago) {
            updates.push('EstadoPago = @estadoPago');
            request.input('estadoPago', sql.NVarChar, estadoPago);
        }
        
        if (guiaRastreo) {
            updates.push('GuiaRastreo = @guiaRastreo');
            request.input('guiaRastreo', sql.NVarChar, guiaRastreo);
        }
        
        if (paqueteria) {
            updates.push('Paqueteria = @paqueteria');
            request.input('paqueteria', sql.NVarChar, paqueteria);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        
        await request.query(`
            UPDATE Pedidos 
            SET ${updates.join(', ')}
            WHERE PedidoID = @id
        `);
        
        res.json({ success: true, mensaje: 'Pedido actualizado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener todos los pedidos (Admin)
app.get('/api/admin/pedidos', verificarAdmin, async (req, res) => {
    try {
        const { estado, desde, hasta } = req.query;
        
        let query = `
            SELECT 
                p.PedidoID, p.NumeroPedido, p.Total, p.EstadoPedido, p.EstadoPago,
                p.MetodoPago, p.FechaPedido,
                u.Nombre + ' ' + u.Apellido as NombreCliente,
                u.Email,
                COUNT(dp.DetalleID) as TotalProductos
            FROM Pedidos p
            INNER JOIN Usuarios u ON p.UsuarioID = u.UsuarioID
            LEFT JOIN DetallePedido dp ON p.PedidoID = dp.PedidoID
            WHERE 1=1
        `;
        
        if (estado) query += ` AND p.EstadoPedido = '${estado}'`;
        if (desde) query += ` AND p.FechaPedido >= '${desde}'`;
        if (hasta) query += ` AND p.FechaPedido <= '${hasta}'`;
        
        query += `
            GROUP BY p.PedidoID, p.NumeroPedido, p.Total, p.EstadoPedido, p.EstadoPago,
                     p.MetodoPago, p.FechaPedido, u.Nombre, u.Apellido, u.Email
            ORDER BY p.FechaPedido DESC
        `;
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// RUTAS DE DIRECCIONES
// ============================================

// Obtener direcciones del usuario
app.get('/api/direcciones/usuario/:userId', async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.params.userId)
            .query(`
                SELECT * FROM Direcciones 
                WHERE UsuarioID = @userId 
                ORDER BY EsPredeterminada DESC, FechaCreacion DESC
            `);
        
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agregar nueva dirección
app.post('/api/direcciones', async (req, res) => {
    try {
        const {
            usuarioId, nombreCompleto, telefono,
            calle, numeroExterior, numeroInterior, colonia,
            ciudad, estado, codigoPostal, referencias,
            esPredeterminada
        } = req.body;
        
        // Si es predeterminada, quitar bandera de otras direcciones
        if (esPredeterminada) {
            await pool.request()
                .input('userId', sql.Int, usuarioId)
                .query('UPDATE Direcciones SET EsPredeterminada = 0 WHERE UsuarioID = @userId');
        }
        
        const result = await pool.request()
            .input('usuarioId', sql.Int, usuarioId)
            .input('nombreCompleto', sql.NVarChar, nombreCompleto)
            .input('telefono', sql.NVarChar, telefono)
            .input('calle', sql.NVarChar, calle)
            .input('numeroExterior', sql.NVarChar, numeroExterior)
            .input('numeroInterior', sql.NVarChar, numeroInterior || null)
            .input('colonia', sql.NVarChar, colonia)
            .input('ciudad', sql.NVarChar, ciudad)
            .input('estado', sql.NVarChar, estado)
            .input('codigoPostal', sql.NVarChar, codigoPostal)
            .input('referencias', sql.NVarChar, referencias || null)
            .input('esPredeterminada', sql.Bit, esPredeterminada ? 1 : 0)
            .query(`
                INSERT INTO Direcciones (
                    UsuarioID, NombreCompleto, Telefono,
                    Calle, NumeroExterior, NumeroInterior, Colonia,
                    Ciudad, Estado, CodigoPostal, Referencias,
                    EsPredeterminada
                ) VALUES (
                    @usuarioId, @nombreCompleto, @telefono,
                    @calle, @numeroExterior, @numeroInterior, @colonia,
                    @ciudad, @estado, @codigoPostal, @referencias,
                    @esPredeterminada
                );
                SELECT SCOPE_IDENTITY() as DireccionID;
            `);
        
        res.json({ 
            success: true, 
            mensaje: 'Dirección agregada exitosamente',
            direccionId: result.recordset[0].DireccionID
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar dirección
app.put('/api/direcciones/:id', async (req, res) => {
    try {
        const {
            nombreCompleto, telefono,
            calle, numeroExterior, numeroInterior, colonia,
            ciudad, estado, codigoPostal, referencias,
            esPredeterminada, usuarioId
        } = req.body;
        
        if (esPredeterminada) {
            await pool.request()
                .input('userId', sql.Int, usuarioId)
                .query('UPDATE Direcciones SET EsPredeterminada = 0 WHERE UsuarioID = @userId');
        }
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombreCompleto', sql.NVarChar, nombreCompleto)
            .input('telefono', sql.NVarChar, telefono)
            .input('calle', sql.NVarChar, calle)
            .input('numeroExterior', sql.NVarChar, numeroExterior)
            .input('numeroInterior', sql.NVarChar, numeroInterior || null)
            .input('colonia', sql.NVarChar, colonia)
            .input('ciudad', sql.NVarChar, ciudad)
            .input('estado', sql.NVarChar, estado)
            .input('codigoPostal', sql.NVarChar, codigoPostal)
            .input('referencias', sql.NVarChar, referencias || null)
            .input('esPredeterminada', sql.Bit, esPredeterminada ? 1 : 0)
            .query(`
                UPDATE Direcciones SET
                    NombreCompleto = @nombreCompleto,
                    Telefono = @telefono,
                    Calle = @calle,
                    NumeroExterior = @numeroExterior,
                    NumeroInterior = @numeroInterior,
                    Colonia = @colonia,
                    Ciudad = @ciudad,
                    Estado = @estado,
                    CodigoPostal = @codigoPostal,
                    Referencias = @referencias,
                    EsPredeterminada = @esPredeterminada
                WHERE DireccionID = @id
            `);
        
        res.json({ success: true, mensaje: 'Dirección actualizada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar dirección
app.delete('/api/direcciones/:id', async (req, res) => {
    try {
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Direcciones WHERE DireccionID = @id');
        
        res.json({ success: true, mensaje: 'Dirección eliminada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// RUTAS DE PAGOS CON STRIPE
// ============================================

// Crear intención de pago (Payment Intent)
app.post('/api/crear-intencion-pago', async (req, res) => {
    try {
        const { monto, descripcion, metadata } = req.body;
        
        // Crear Payment Intent en Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(monto * 100), // Stripe usa centavos
            currency: 'mxn',
            description: descripcion,
            metadata: metadata, // Info adicional del pedido
            automatic_payment_methods: {
                enabled: true,
            },
        });
        
        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
        
    } catch (err) {
        console.error('Error Stripe:', err);
        res.status(500).json({ error: err.message });
    }
});

// Confirmar pago y crear pedido
app.post('/api/confirmar-pago-pedido', async (req, res) => {
    try {
        const { 
            paymentIntentId,
            usuarioId, 
            direccionId, 
            items,
            subtotal,
            costoEnvio,
            descuento = 0
        } = req.body;
        
        // Verificar el pago en Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
                error: 'El pago no ha sido completado' 
            });
        }
        
        // Validar stock
        for (const item of items) {
            const stockResult = await pool.request()
                .input('productoId', sql.Int, item.productoId)
                .query('SELECT Stock FROM Productos WHERE ProductoID = @productoId');
            
            if (stockResult.recordset[0].Stock < item.cantidad) {
                return res.status(400).json({ 
                    error: `Stock insuficiente para el producto ${item.productoId}` 
                });
            }
        }
        
        const total = subtotal + costoEnvio - descuento;
        const numeroPedido = `PED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Insertar pedido
        const pedidoResult = await pool.request()
            .input('usuarioId', sql.Int, usuarioId)
            .input('direccionId', sql.Int, direccionId)
            .input('numeroPedido', sql.NVarChar, numeroPedido)
            .input('subtotal', sql.Decimal(10, 2), subtotal)
            .input('descuento', sql.Decimal(10, 2), descuento)
            .input('costoEnvio', sql.Decimal(10, 2), costoEnvio)
            .input('total', sql.Decimal(10, 2), total)
            .input('paymentIntentId', sql.NVarChar, paymentIntentId)
            .query(`
                INSERT INTO Pedidos (
                    UsuarioID, DireccionEnvioID, NumeroPedido, 
                    Subtotal, Descuento, CostoEnvio, Total,
                    EstadoPedido, EstadoPago, MetodoPago, StripePaymentIntentID
                ) VALUES (
                    @usuarioId, @direccionId, @numeroPedido,
                    @subtotal, @descuento, @costoEnvio, @total,
                    'Confirmado', 'Pagado', 'Tarjeta', @paymentIntentId
                );
                SELECT SCOPE_IDENTITY() as PedidoID;
            `);
        
        const pedidoId = pedidoResult.recordset[0].PedidoID;
        
        // Insertar detalles y actualizar stock
        for (const item of items) {
            await pool.request()
                .input('pedidoId', sql.Int, pedidoId)
                .input('productoId', sql.Int, item.productoId)
                .input('cantidad', sql.Int, item.cantidad)
                .input('precioUnitario', sql.Decimal(10, 2), item.precioUnitario)
                .query(`
                    INSERT INTO DetallePedido (PedidoID, ProductoID, Cantidad, PrecioUnitario)
                    VALUES (@pedidoId, @productoId, @cantidad, @precioUnitario)
                `);
            
            await pool.request()
                .input('productoId', sql.Int, item.productoId)
                .input('cantidad', sql.Int, item.cantidad)
                .query(`
                    UPDATE Productos 
                    SET Stock = Stock - @cantidad,
                        VentasTotales = ISNULL(VentasTotales, 0) + @cantidad
                    WHERE ProductoID = @productoId
                `);
        }
        
        // Limpiar carrito
        await pool.request()
            .input('usuarioId', sql.Int, usuarioId)
            .query('DELETE FROM Carrito WHERE UsuarioID = @usuarioId');
        
        res.json({ 
            success: true, 
            mensaje: 'Pedido creado exitosamente',
            pedidoId: pedidoId,
            numeroPedido: numeroPedido
        });
        
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// WebHook de Stripe (para recibir eventos de pago)
app.post('/api/webhook-stripe', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = 'tu_webhook_secret'; // Lo obtendrás de Stripe Dashboard
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Manejar eventos de Stripe
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('✅ Pago exitoso:', paymentIntent.id);
            
            // Actualizar estado del pedido en BD
            await pool.request()
                .input('paymentIntentId', sql.NVarChar, paymentIntent.id)
                .query(`
                    UPDATE Pedidos 
                    SET EstadoPago = 'Pagado',
                        EstadoPedido = 'Confirmado',
                        FechaConfirmacion = GETDATE()
                    WHERE StripePaymentIntentID = @paymentIntentId
                `);
            break;
            
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log('❌ Pago fallido:', failedPayment.id);
            
            await pool.request()
                .input('paymentIntentId', sql.NVarChar, failedPayment.id)
                .query(`
                    UPDATE Pedidos 
                    SET EstadoPago = 'Rechazado',
                        EstadoPedido = 'Cancelado'
                    WHERE StripePaymentIntentID = @paymentIntentId
                `);
            break;
            
        default:
            console.log(`Evento no manejado: ${event.type}`);
    }
    
    res.json({ received: true });
});

// Obtener clave pública de Stripe (para el frontend)
app.get('/api/stripe-public-key', (req, res) => {
    res.json({ 
        publicKey: 'pk_test_51TYyduQyWORSQ9oNgkWXaQ8ckJKsWuRrbz29Z2fAbxw0C49OLU7dN6bhJ9T4gaOJjjK5rgPgq9tNDm49YW3osWpQ00YJRlSOeI' // La obtendrás de Stripe
    });
});

app.listen(3000, () => console.log('🚀 Servidor en http://localhost:3000'));