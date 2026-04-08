# ✅ Assinatura XML Real - Implementação Completa

## Resumo das Mudanças Implementadas

### 1. **Imports Adicionados** (`backend/services/fiscalService.js`)
```javascript
const { SignedXml } = require('xml-crypto');
const certificadoService = require('./certificadoService');
```

### 2. **Funções Auxiliares Adicionadas**

#### `limparPem(pem)`
Remove formatação PEM do certificado para gerar Base64 compatível com XML-Signature.
```javascript
function limparPem(pem) {
  return String(pem || '')
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\r?\n|\r/g, '')
    .trim();
}
```

#### `validarConfigCertificado(empresa)`
Valida se a empresa tem certificado e senha configurados.
```javascript
function validarConfigCertificado(empresa) {
  if (!empresa) {
    throw new Error('Configuração fiscal não encontrada.');
  }

  if (!empresa.certificado_path || String(empresa.certificado_path).trim() === '') {
    throw new Error('Caminho do certificado não configurado.');
  }

  if (!empresa.certificado_senha || String(empresa.certificado_senha).trim() === '') {
    throw new Error('Senha do certificado não configurada.');
  }
}
```

### 3. **Função assinarXml() Substituída**

**Antes:**
```javascript
function assinarXml(xml, empresa) {
  const assinatura = `\n  <Signature>ASSINADO-PELO-SISTEMA</Signature>`;
  if (xml.includes('</enviNFe>')) {
    return xml.replace('</enviNFe>', `${assinatura}\n</enviNFe>`);
  }
  return xml + assinatura;
}
```

**Depois:**
```javascript
function assinarXml(xml, empresa) {
  validarConfigCertificado(empresa);

  const certificado = certificadoService.carregarCertificadoSalvo(
    empresa.certificado_path,
    empresa.certificado_senha
  );

  const pemKey = certificado.pemKey;
  const pemCert = certificado.pemCert;
  const certBase64 = limparPem(pemCert);

  const sig = new SignedXml();

  sig.privateKey = pemKey;
  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#'
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
  });

  sig.keyInfoProvider = {
    getKeyInfo() {
      return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
    }
  };

  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name(.)='infNFe']",
      action: 'after'
    }
  });

  return sig.getSignedXml();
}
```

### 4. **Verificações Realizadas**

✅ **Chamada em `emitirNfce()`:**
```javascript
const xmlAssinado = assinarXml(xml, empresa);
const xmlAssinadoPath = salvarXml(xmlAssinado, `nfce_venda_${vendaId}_n${numero}_assinado`);
```
Já está conforme esperado.

✅ **Exports em `certificadoService.js`:**
- ✅ `carregarCertificadoSalvo` exportado
- ✅ Retorna `{ ok, info, pemKey, pemCert }`
- ✅ Lança erro se certificado inválido

## 🔒 Algoritmos Utilizados

| Aspecto | Algoritmo |
|--------|-----------|
| **Assinatura** | RSA-SHA256 |
| **Canonicalização** | XML-EXC-C14N |
| **Digest** | SHA256 |
| **Referência** | `//*[local-name(.)='infNFe']` |

## 🚀 Estado do Sistema

✅ **Pré-requisitos Completos:**
- Configuração fiscal salva
- Certificado A1 válido e testado
- Caminho e senha do certificado armazenados
- Assinatura XML real implementada

✅ **Pronto Para:**
- Emissão de NFC-e com assinatura digital
- Envio para SEFAZ
- Validação de protocolo

## 📝 Próximo Passo

Implementar envio para SEFAZ com NFC-e assinada digitalmente usando a função `emitirNfce()`.

## ⚡ Status do Servidor

✅ Servidor rodando porta 3000
✅ Todas as tabelas criadas
✅ Usuário administrador verificado
✅ Sistema pronto para emissão de NFC-e