const express = require('express');
const router = express.Router();


const db = require('../database');


// LISTAR
router.get('/', (req, res) => {
    db.all('SELECT * FROM categorias ORDER BY nome', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro ao listar categorias' });
        res.json(rows);
    });
});

// BUSCAR POR ID
router.get('/:id', (req, res) => {
    db.get('SELECT * FROM categorias WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar categoria' });
        if (!row) return res.status(404).json({ erro: 'Categoria não encontrada' });
        res.json(row);
    });
});

// CRIAR
router.post('/', (req, res) => {
    const { nome, descricao } = req.body;
    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    const sql = `INSERT INTO categorias (nome, descricao) VALUES (?, ?)`;
    db.run(sql, [nome.trim(), descricao || ''], function(err) {
        if (err) {
            if (err.message && err.message.includes('UNIQUE')) {
                return res.status(400).json({ erro: 'Categoria já existe' });
            }
            return res.status(500).json({ erro: 'Erro ao criar categoria' });
        }
        res.json({ id: this.lastID, message: 'Categoria criada com sucesso' });
    });
});

// ATUALIZAR
router.put('/:id', (req, res) => {
    const { nome, descricao } = req.body;
    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    db.run(
        `UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?`,
        [nome.trim(), descricao || '', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ erro: 'Erro ao atualizar' });
            res.json({ message: 'Categoria atualizada com sucesso' });
        }
    );
});

// EXCLUIR
router.delete('/:id', (req, res) => {
    db.run(
        `DELETE FROM categorias WHERE id = ?`,
        [req.params.id],
        function(err) {
            if (err) return res.status(500).json({ erro: 'Erro ao excluir' });
            res.json({ message: 'Categoria excluída com sucesso' });
        }
    );
});

module.exports = router;
