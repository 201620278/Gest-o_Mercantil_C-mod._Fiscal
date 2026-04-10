const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database');

const JWT_SECRET = 'mercantil_do_nando_secret_key_2024';

function extrairToken(req) {
  const authHeader = req.headers['authorization'];
  return authHeader && authHeader.split(' ')[1];
}

function verificarToken(req, res, next) {
  const token = extrairToken(req);
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
}

function exigirAdmin(req, res, next) {
  verificarToken(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem executar esta ação.' });
    }
    next();
  });
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, usuario) => {
    if (err) {
      console.error('Erro ao consultar usuário:', err);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const senhaValida = bcrypt.compareSync(password, usuario.password_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, role: usuario.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: usuario.id,
        username: usuario.username,
        role: usuario.role,
        nome: usuario.username
      }
    });
  });
});

router.post('/verificar', verificarToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout realizado com sucesso' });
});

router.get('/usuarios', exigirAdmin, (req, res) => {
  db.all(`SELECT id, username, role, created_at FROM usuarios ORDER BY username`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
    res.json(rows || []);
  });
});

router.post('/usuarios', exigirAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const role = req.body?.role === 'admin' ? 'admin' : 'operador';

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 4 caracteres.' });
  }

  db.get('SELECT id FROM usuarios WHERE username = ?', [username], (errBusca, existente) => {
    if (errBusca) {
      return res.status(500).json({ error: 'Erro ao validar usuário.' });
    }
    if (existente) {
      return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO usuarios (username, password_hash, role) VALUES (?, ?, ?)`, [username, hash, role], function(errInsert) {
      if (errInsert) {
        return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
      }
      res.json({ id: this.lastID, username, role, message: 'Usuário cadastrado com sucesso.' });
    });
  });
});

router.delete('/usuarios/:id', exigirAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  if (req.user?.id === id) {
    return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário logado.' });
  }

  db.get('SELECT id, username FROM usuarios WHERE id = ?', [id], (errBusca, usuario) => {
    if (errBusca) {
      return res.status(500).json({ error: 'Erro ao localizar usuário.' });
    }
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    db.run('DELETE FROM usuarios WHERE id = ?', [id], function(errDelete) {
      if (errDelete) {
        return res.status(500).json({ error: 'Erro ao remover usuário.' });
      }
      res.json({ message: 'Usuário removido com sucesso.' });
    });
  });
});

module.exports = { router, verificarToken, exigirAdmin };
