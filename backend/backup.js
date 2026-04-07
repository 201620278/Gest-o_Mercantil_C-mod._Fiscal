const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const cron = require('node-cron');

// Caminho do banco de dados
const DB_PATH = path.join(__dirname, 'banco', 'mercadao.db');
// Caminho do arquivo de configurações de backup
const CONFIG_PATH = path.join(__dirname, 'backup-config.json');

// Carrega configurações de backup
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  // Configuração padrão
  return {
    enabled: false,
    frequency: '0 2 * * *', // padrão: todo dia às 2h
    google: {
      client_id: '',
      client_secret: '',
      redirect_uris: [],
      refresh_token: ''
    }
  };
}

// Salva configurações de backup
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

// Cria o cliente OAuth2 do Google
function getOAuth2Client(googleConfig) {
  const { client_id, client_secret, redirect_uris, refresh_token } = googleConfig;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials({ refresh_token });
  return oAuth2Client;
}

// Faz upload do arquivo de backup para o Google Drive
async function uploadBackupToDrive(googleConfig) {
  const oAuth2Client = getOAuth2Client(googleConfig);
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const fileMetadata = {
    name: `mercadao-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
  };
  const media = {
    mimeType: 'application/x-sqlite3',
    body: fs.createReadStream(DB_PATH)
  };
  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });
    return { success: true, file: file.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Agendamento do backup automático
let currentTask = null;
function scheduleBackup(config) {
  if (currentTask) currentTask.stop();
  if (config.enabled && config.google.refresh_token) {
    currentTask = cron.schedule(config.frequency, async () => {
      await uploadBackupToDrive(config.google);
    });
  }
}

// Inicializa agendamento ao carregar
const config = loadConfig();
scheduleBackup(config);

module.exports = {
  loadConfig,
  saveConfig,
  uploadBackupToDrive,
  scheduleBackup
};
