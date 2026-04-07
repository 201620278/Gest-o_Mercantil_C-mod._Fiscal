// Funções para backup Google Drive
async function salvarBackupConfig() {
  const config = {
    enabled: document.getElementById('backupEnabled').checked,
    frequency: document.getElementById('backupFrequency').value,
    google: {
      client_id: document.getElementById('googleClientId').value,
      client_secret: document.getElementById('googleClientSecret').value,
      redirect_uris: [document.getElementById('googleRedirectUri').value],
      refresh_token: document.getElementById('googleRefreshToken').value
    }
  };
  await fetch('/api/configuracoes/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  alert('Configuração de backup salva!');
}

async function backupManual() {
  const resp = await fetch('/api/configuracoes/backup/manual', { method: 'POST' });
  const data = await resp.json();
  if (data.success) {
    alert('Backup enviado para o Google Drive!');
  } else {
    alert('Erro ao fazer backup: ' + data.error);
  }
}
