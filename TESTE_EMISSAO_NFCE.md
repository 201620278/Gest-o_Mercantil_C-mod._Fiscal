# 🧪 Teste de Emissão de NFC-e com Assinatura Digital

## Como testar a assinatura XML real

### Cenário de Teste:
1. Realizar uma venda completa
2. Emitir NFC-e para a venda
3. Verificar o XML assinado com certificado real

### Passos:

#### 1. Obter Token
```powershell
$token = (Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"username":"Diego","password":"pdb100623"}' `
  -UseBasicParsing | ConvertFrom-Json).token
```

#### 2. Criar uma Venda
```powershell
$venda = @{
  cliente_id = 1
  forma_pagamento = "dinheiro"
  total = 100.00
  itens = @(
    @{
      produto_id = 1
      quantidade = 1
      preco_unitario = 100.00
    }
  )
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/vendas" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $venda
```

#### 3. Emitir NFC-e 
```powershell
$vendaId = 1  # ID da venda criada acima

Invoke-RestMethod -Uri "http://localhost:3000/api/fiscal/nfce/emitir/$vendaId" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json"
```

#### 4. Verificar Arquivos Gerados
Os XMLs serão salvos em:
- **XML sem assinatura**: `backend/storage/xml/nfce/nfce_venda_1_n001.xml`
- **XML assinado**: `backend/storage/xml/nfce/nfce_venda_1_n001_assinado.xml`

### XML Assinado Esperado

O XML assinado conterá a estrutura:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<NFe>
  <infNFe Id="NFe..." versao="4.00">
    <!-- conteúdo da NFC-e -->
  </infNFe>
  
  <!-- ASSINATURA DIGITAL REAL -->
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#NFe...">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>...</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>... ASSINATURA DIGITAL AQUI ...</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>... CERTIFICADO BASE64 ...</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
</NFe>
```

## ✅ Validação de Sucesso

Se a assinatura funcionar corretamente, o arquivo XML conterá:

1. ✅ **Bloco `<Signature>`** com conteúdo real (não "ASSINADO-PELO-SISTEMA")
2. ✅ **`<SignatureValue>`** com hash criptográfico
3. ✅ **`<X509Certificate>`** com certificado da empresa
4. ✅ **`<DigestValue>`** calculado pelo algoritmo SHA256
5. ✅ **Algoritmo RSA-SHA256** configurado corretamente

## 🔍 Verificar Assinatura (Ferramenta Online)

Você pode validar a assinatura usando:
- [XMLSec Validator](https://www.10tiao.com/archives/6631)
- [Ferramenta Online XML-Signature](https://www.xmlsec.io/demo/)

Ou via Python:
```python
from lxml import etree
from xmldsig import XMLVerifier

# Carregar XML assinado
with open('nfce_venda_1_n001_assinado.xml', 'rb') as f:
    doc = etree.parse(f)

# Validar assinatura
verifier = XMLVerifier()
result = verifier.verify(doc, cert=None)
print(f"Assinatura válida: {result}")
```

## 📋 Checklist de Funcionamento

- [ ] Servidor iniciando sem erros
- [ ] Token JWT obtido com sucesso
- [ ] Venda criada com sucesso
- [ ] NFC-e emitida com sucesso
- [ ] Arquivo XML assinado criado
- [ ] XML contém `<Signature>` real (não placeholder)
- [ ] `<DigestValue>` diferente entre XMLs
- [ ] `<SignatureValue>` presente e não vazio

## ⚠️ Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Configuração fiscal não encontrada" | Empresa não cadastrada | Executar POST `/api/fiscal/config` |
| "Caminho do certificado não configurado" | Certificado não foi enviado | Executar POST `/api/fiscal/config/certificado` |
| "Chave privada não encontrada" | Certificado corrompido | Verificar arquivo PFX e senha |
| XML vazio em `<SignatureValue>` | Erro na computação | Verificar logs do servidor |

## 🚀 Próximos Passos

1. Testar emissão de NFC-e
2. Validar XML assinado
3. Implementar envio para SEFAZ
4. Capturar protocolo SEFAZ
5. Gerar DANFE

---

**Documento criado em**: 7 de abril de 2026  
**Sistema**: Sistema de Gestão Mercantil - Módulo Fiscal  
**Status**: ✅ Assinatura Digital Implementada