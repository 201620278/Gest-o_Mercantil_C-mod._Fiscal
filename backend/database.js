const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'banco', 'mercadao.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    inicializarBanco();
  }
});

function inicializarBanco() {
                // ===== CATEGORIAS =====
                db.run(`
                  CREATE TABLE IF NOT EXISTS categorias (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome VARCHAR(100) NOT NULL UNIQUE,
                    descricao TEXT
                  )
                `, (err) => {
                  if (err) console.error('Erro ao criar tabela categorias:', err);
                  else console.log('Tabela categorias criada/verificada');
                });

                // ===== SUBCATEGORIAS =====
                db.run(`
                  CREATE TABLE IF NOT EXISTS subcategorias (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome VARCHAR(100) NOT NULL,
                    descricao TEXT,
                    categoria_id INTEGER,
                    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
                  )
                `, (err) => {
                  if (err) console.error('Erro ao criar tabela subcategorias:', err);
                  else console.log('Tabela subcategorias criada/verificada');
                });

                // ===== GARANTIR COLUNAS NOVAS EM PRODUTOS =====
                db.all(`PRAGMA table_info(produtos)`, [], (err, rows) => {
                  if (err) {
                    console.error('Erro ao verificar colunas da tabela produtos:', err);
                    return;
                  }

                  const colunas = rows.map(r => r.name);

                  if (!colunas.includes('categoria_id')) {
                    db.run(`ALTER TABLE produtos ADD COLUMN categoria_id INTEGER`, (err) => {
                      if (err) console.error('Erro ao adicionar coluna categoria_id:', err);
                      else console.log('Coluna categoria_id adicionada em produtos');
                    });
                  }

                  if (!colunas.includes('subcategoria_id')) {
                    db.run(`ALTER TABLE produtos ADD COLUMN subcategoria_id INTEGER`, (err) => {
                      if (err) console.error('Erro ao adicionar coluna subcategoria_id:', err);
                      else console.log('Coluna subcategoria_id adicionada em produtos');
                    });
                  }

                  if (!colunas.includes('lucro_percentual')) {
                    db.run(`ALTER TABLE produtos ADD COLUMN lucro_percentual DECIMAL(10,2)`, (err) => {
                      if (err) console.error('Erro ao adicionar coluna lucro_percentual:', err);
                      else console.log('Coluna lucro_percentual adicionada em produtos');
                    });
                  }
                });
              // Tabela de subcategorias
              db.run(`
                CREATE TABLE IF NOT EXISTS subcategorias (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  nome TEXT NOT NULL,
                  categoria_id INTEGER NOT NULL,
                  ativo INTEGER DEFAULT 1,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
                )
              `, (err) => {
                if (err) console.error('Erro ao criar tabela subcategorias:', err);
                else console.log('Tabela subcategorias criada/verificada');
              });
          // Tabela de categorias
          db.run(`
            CREATE TABLE IF NOT EXISTS categorias (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nome TEXT NOT NULL UNIQUE,
              descricao TEXT,
              ativo INTEGER DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) console.error('Erro ao criar tabela categorias:', err);
            else console.log('Tabela categorias criada/verificada');
          });
      // Tabela de fornecedores
      db.run(`
        CREATE TABLE IF NOT EXISTS fornecedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome VARCHAR(200) NOT NULL,
          razao_social VARCHAR(200),
          cpf_cnpj VARCHAR(20) UNIQUE,
          telefone VARCHAR(20),
          email VARCHAR(100),
          contato VARCHAR(100),
          cep VARCHAR(10),
          rua VARCHAR(200),
          numero VARCHAR(20),
          bairro VARCHAR(100),
          cidade VARCHAR(100),
          uf VARCHAR(2),
          observacoes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Erro ao criar tabela fornecedores:', err);
        else console.log('Tabela fornecedores criada/verificada');
      });
  // Criar todas as tabelas em sequência
  db.serialize(() => {
    // Tabela de produtos
    db.run(`
      CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo VARCHAR(50) UNIQUE,
        nome VARCHAR(200) NOT NULL,
        categoria_id INTEGER,
        subcategoria_id INTEGER,
        unidade VARCHAR(20),
        preco_compra DECIMAL(10,2),
        preco_venda DECIMAL(10,2) NOT NULL,
        lucro_percentual DECIMAL(10,2),
        estoque_atual DECIMAL(10,2) DEFAULT 0,
        estoque_minimo DECIMAL(10,2) DEFAULT 0,
        fornecedor VARCHAR(200),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela produtos:', err);
      else console.log('Tabela produtos criada/verificada');
    });

    // Tabela de clientes
    db.run(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(200) NOT NULL,
        cpf_cnpj VARCHAR(20) UNIQUE,
        telefone VARCHAR(20),
        email VARCHAR(100),
        endereco TEXT,
        limite_credito DECIMAL(10,2) DEFAULT 0,
        credito_atual DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cep VARCHAR(10),
        rua VARCHAR(200),
        numero VARCHAR(20),
        bairro VARCHAR(100),
        cidade VARCHAR(100),
        uf VARCHAR(2)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela clientes:', err);
      else console.log('Tabela clientes criada/verificada');
    });

    // Tabela de compras
    db.run(`
      CREATE TABLE IF NOT EXISTS compras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nota_fiscal VARCHAR(50) UNIQUE,
        data_compra DATE NOT NULL,
        fornecedor VARCHAR(200),
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pendente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela compras:', err);
      else console.log('Tabela compras criada/verificada');
    });

    // Tabela de itens de compra
    db.run(`
      CREATE TABLE IF NOT EXISTS compras_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compra_id INTEGER,
        produto_id INTEGER,
        quantidade DECIMAL(10,2) NOT NULL,
        preco_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela compras_itens:', err);
      else console.log('Tabela compras_itens criada/verificada');
    });

    // Tabela de vendas
    db.run(`
      CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo VARCHAR(50) UNIQUE,
        data_venda DATE NOT NULL,
        cliente_id INTEGER,
        total DECIMAL(10,2) NOT NULL,
        desconto DECIMAL(10,2) DEFAULT 0,
        forma_pagamento VARCHAR(50),
        status VARCHAR(20) DEFAULT 'concluida',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela vendas:', err);
      else console.log('Tabela vendas criada/verificada');
    });

    // Tabela de itens de venda
    db.run(`
      CREATE TABLE IF NOT EXISTS vendas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER,
        produto_id INTEGER,
        quantidade DECIMAL(10,2) NOT NULL,
        preco_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela vendas_itens:', err);
      else console.log('Tabela vendas_itens criada/verificada');
    });

    // Tabela de movimentações financeiras
    db.run(`
      CREATE TABLE IF NOT EXISTS financeiro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo VARCHAR(20) NOT NULL,
        descricao TEXT,
        valor DECIMAL(10,2) NOT NULL,
        data_movimento DATE NOT NULL,
        categoria VARCHAR(50),
        forma_pagamento VARCHAR(50),
        referencia_id INTEGER,
        referencia_tipo VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela financeiro:', err);
      else console.log('Tabela financeiro criada/verificada');
    });

    // Tabela de contas a receber (parcelas de vendas a prazo)
    db.run(`
      CREATE TABLE IF NOT EXISTS contas_receber (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER,
        cliente_id INTEGER,
        numero_parcela INTEGER,
        total_parcelas INTEGER,
        valor_parcela DECIMAL(10,2) NOT NULL,
        valor_restante DECIMAL(10,2) NOT NULL,
        data_vencimento DATE NOT NULL,
        data_pagamento DATE,
        status VARCHAR(20) DEFAULT 'aberto',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venda_id) REFERENCES vendas(id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela contas_receber:', err);
      else console.log('Tabela contas_receber criada/verificada');
    });

    // Histórico de alteração de preços (compra/venda)
    db.run(`
      CREATE TABLE IF NOT EXISTS produtos_preco_historico (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER NOT NULL,
        preco_compra_anterior DECIMAL(10,2),
        preco_compra_novo DECIMAL(10,2),
        preco_venda_anterior DECIMAL(10,2),
        preco_venda_novo DECIMAL(10,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela produtos_preco_historico:', err);
      else console.log('Tabela produtos_preco_historico criada/verificada');
    });

    // Usuários do sistema (login)
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'operador',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela usuarios:', err);
      else {
        console.log('Tabela usuarios criada/verificada');
        seedUsuarioAdmin();
      }
    });

    // Tabela de configurações (criar por último)
    db.run(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        tipo VARCHAR(50),
        descricao TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela configuracoes:', err);
      } else {
        console.log('Tabela configuracoes criada/verificada');
        // Inserir configurações padrão após criar a tabela
        inserirConfiguracoesPadrao();
      }
    });
  });
}

// Função separada para inserir configurações padrão
function inserirConfiguracoesPadrao() {
  const configs = [
    ['nome_empresa', 'Mercadão da Economia', 'string', 'Nome da empresa'],
    ['cnpj', '', 'string', 'CNPJ da empresa'],
    ['telefone', '', 'string', 'Telefone para contato'],
    ['email', '', 'string', 'Email para contato'],
    ['endereco', '', 'text', 'Endereço da empresa'],
    ['logo', '', 'text', 'URL da logo'],
    ['imprimir_cupom', 'true', 'boolean', 'Imprimir cupom fiscal'],
    ['juros_mora', '1.0', 'decimal', 'Juros de mora por dia (%)']
  ];

  configs.forEach(config => {
    db.run(`
      INSERT OR IGNORE INTO configuracoes (chave, valor, tipo, descricao)
      VALUES (?, ?, ?, ?)
    `, config, (err) => {
      if (err) {
        console.error(`Erro ao inserir configuração ${config[0]}:`, err);
      }
    });
  });
  
  console.log('Configurações padrão inseridas/verificadas');
}

function seedUsuarioAdmin() {
  const hash = bcrypt.hashSync('pdb100623', 10);
  db.run(`
    INSERT OR IGNORE INTO usuarios (username, password_hash, role)
    VALUES ('Diego', ?, 'admin')
  `, [hash], (err) => {
    if (err) console.error('Erro ao criar usuário administrador padrão:', err);
    else console.log('Usuário administrador padrão verificado (Diego)');
  });
}

module.exports = db;