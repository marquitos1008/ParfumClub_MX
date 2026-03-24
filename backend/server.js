const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

app.listen(3000, () => console.log('🚀 Servidor en http://localhost:3000'));