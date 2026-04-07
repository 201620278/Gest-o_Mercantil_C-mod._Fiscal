const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Chave secreta para JWT
const JWT_SECRET = 'mercantil_do_nando_secret_key_2024';

// Usuários pré-definidos
const usuarios = [
    {
        id: 1,
        username: 'admin',
        password: bcrypt.hashSync('admin123', 8),
        nome: 'Administrador',
        perfil: 'admin'
    },
    {
        id: 2,
        username: 'vendedor',
        password: bcrypt.hashSync('venda123', 8),
        nome: 'Vendedor',
        perfil: 'vendedor'
    }
];

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('Tentativa de login:', username);
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    const usuario = usuarios.find(u => u.username === username);
    
    if (!usuario) {
        console.log('Usuário não encontrado:', username);
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    const senhaValida = bcrypt.compareSync(password, usuario.password);
    
    if (!senhaValida) {
        console.log('Senha inválida para:', username);
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    // Gerar token
    const token = jwt.sign(
        { id: usuario.id, username: usuario.username, perfil: usuario.perfil },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
    
    console.log('Login bem-sucedido:', username);
    
    res.json({
        token,
        user: {
            id: usuario.id,
            username: usuario.username,
            nome: usuario.nome,
            perfil: usuario.perfil
        }
    });
});

// Verificar token
router.post('/verificar', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }
        res.json({ valid: true, user });
    });
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = { router, verificarToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Acesso negado' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }
        req.user = user;
        next();
    });
} };