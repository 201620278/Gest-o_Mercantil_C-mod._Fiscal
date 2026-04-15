const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SERVER_PATH = path.join(__dirname, 'backend', 'server.js');
const ADMIN_USER = { username: 'Diego', password: 'pdb100623' };
let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SERVER_PATH)) {
      return reject(new Error(`Servidor não encontrado em: ${SERVER_PATH}`));
    }

    serverProcess = spawn(process.execPath, [SERVER_PATH], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let started = false;
    let stderr = '';

    const timeout = setTimeout(() => {
      if (!started) {
        reject(new Error('Tempo esgotado ao iniciar o servidor.'));
      }
    }, 10000);

    serverProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (!started && text.includes('Servidor rodando na porta')) {
        started = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk.toString());
    });

    serverProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (!started) {
        reject(new Error(`Servidor saiu prematuramente com código ${code}. ${stderr}`));
      }
    });
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const body = await res.text();
    let json;
    try { json = body ? JSON.parse(body) : null; } catch (err) { json = body; }
    return { status: res.status, ok: res.ok, body: json };
  } catch (err) {
    throw new Error(`Falha na requisição ${url}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('Iniciando integração de teste...');
  await startServer();
  console.log('Servidor iniciado.');

  try {
    const loginResp = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_USER)
    });

    if (!loginResp.ok) {
      throw new Error(`Falha no login: ${loginResp.status} ${JSON.stringify(loginResp.body)}`);
    }

    const token = loginResp.body?.token;
    if (!token) {
      throw new Error('Token JWT não retornado no login.');
    }
    console.log('Login realizado com sucesso. Token obtido.');

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const vendasResp = await fetchJson(`${BASE_URL}/api/vendas`, { method: 'GET', headers });
    if (!vendasResp.ok) {
      throw new Error(`Erro ao listar vendas: ${vendasResp.status} ${JSON.stringify(vendasResp.body)}`);
    }

    let vendaId = null;
    if (Array.isArray(vendasResp.body) && vendasResp.body.length > 0) {
      vendaId = vendasResp.body[0].id;
      console.log(`Usando venda existente ID=${vendaId}`);
    } else {
      console.log('Nenhuma venda encontrada. Tentando criar uma venda de teste.');
      const produtosResp = await fetchJson(`${BASE_URL}/api/produtos`, { method: 'GET', headers });
      const clientesResp = await fetchJson(`${BASE_URL}/api/clientes`, { method: 'GET', headers });

      if (!produtosResp.ok || !clientesResp.ok) {
        throw new Error('Não foi possível obter produtos ou clientes para criar a venda de teste.');
      }

      const produto = Array.isArray(produtosResp.body) && produtosResp.body[0];
      const cliente = Array.isArray(clientesResp.body) && clientesResp.body[0];

      if (!produto) {
        throw new Error('Nenhum produto cadastrado disponível para criar a venda de teste.');
      }

      const vendaBody = {
        cliente_id: cliente ? cliente.id : null,
        forma_pagamento: 'dinheiro',
        total: Number(produto.preco_venda || produto.preco || 100.00),
        itens: [
          {
            produto_id: produto.id,
            quantidade: 1,
            preco_unitario: Number(produto.preco_venda || produto.preco || 100.00),
            subtotal: Number(produto.preco_venda || produto.preco || 100.00)
          }
        ]
      };
      const createVendaResp = await fetchJson(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(vendaBody)
      });
      if (!createVendaResp.ok) {
        throw new Error(`Erro ao criar venda de teste: ${createVendaResp.status} ${JSON.stringify(createVendaResp.body)}`);
      }
      vendaId = createVendaResp.body?.id || createVendaResp.body?.id;
      if (!vendaId) {
        throw new Error(`Resposta inesperada na criação da venda: ${JSON.stringify(createVendaResp.body)}`);
      }
      console.log(`Venda de teste criada com sucesso. ID=${vendaId}`);
    }

    console.log('Teste de integração concluído com sucesso.');
  } finally {
    stopServer();
    console.log('Servidor finalizado.');
  }
}

main().catch((err) => {
  console.error('Teste de integração falhou:', err.message);
  stopServer();
  process.exit(1);
});
