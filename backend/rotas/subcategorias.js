const express = require('express');
const router = express.Router();


const db = require('../database');

// LISTAR TODAS
router.get('/', (req, res) => {
    db.all('SELECT * FROM subcategorias ORDER BY nome', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro ao listar subcategorias' });
        res.json(rows);
    });
});

// LISTAR POR CATEGORIA
router.get('/categoria/:categoria_id', (req, res) => {
    db.all('SELECT * FROM subcategorias WHERE categoria_id = ? ORDER BY nome', [req.params.categoria_id], (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro ao listar subcategorias da categoria' });
        res.json(rows);
    });
});

// BUSCAR POR ID
router.get('/:id', (req, res) => {
    db.get('SELECT * FROM subcategorias WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar subcategoria' });
        if (!row) return res.status(404).json({ erro: 'Subcategoria não encontrada' });
        res.json(row);
    });
});

// CRIAR
router.post('/', (req, res) => {
    const { nome, categoria_id } = req.body;
    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    if (!categoria_id) {
        return res.status(400).json({ erro: 'Categoria é obrigatória' });
    }
    const sql = `INSERT INTO subcategorias (nome, categoria_id) VALUES (?, ?)`;
    db.run(sql, [nome.trim(), categoria_id], function(err) {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao criar subcategoria' });
        }
        res.json({ id: this.lastID, message: 'Subcategoria criada com sucesso' });
    });
});

// ATUALIZAR
router.put('/:id', (req, res) => {
    const { nome, categoria_id } = req.body;
    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    if (!categoria_id) {
        return res.status(400).json({ erro: 'Categoria é obrigatória' });
    }
    db.run(
        `UPDATE subcategorias SET nome = ?, categoria_id = ? WHERE id = ?`,
        [nome.trim(), categoria_id, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ erro: 'Erro ao atualizar' });
            res.json({ message: 'Subcategoria atualizada com sucesso' });
        }
    );
});

// EXCLUIR
router.delete('/:id', (req, res) => {
    db.run(
        `DELETE FROM subcategorias WHERE id = ?`,
        [req.params.id],
        function(err) {
            if (err) return res.status(500).json({ erro: 'Erro ao excluir' });
            res.json({ message: 'Subcategoria excluída com sucesso' });
        }
    );
});

module.exports = router;
