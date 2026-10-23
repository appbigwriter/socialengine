# Validação do pacote de deploy

Data: 23/10/2026. Estado: **preparado e testado em container isolado; serviço público não implantado por esta preparação**.

## Evidências

- `npm run build`: typecheck e build Vite aprovados.
- `npm test`: 30 testes aprovados, zero falhas e um teste de rede opt-in não executado nessa rodada.
- Docker build executado na VPS com dependências Linux de produção.
- Imagem local na VPS: `socialengine:deploy-20261023-a69083c`.
- ID da imagem: `sha256:14b1574db0d53d50b6c48e647a3879dbb4401cfe4e5b8b4db254635c74d1f8e3`.
- Imagem executada em container isolado, sem portas publicadas nem dados/credenciais reais.
- Usuário do processo: UID 1000.
- Página inicial: HTTP 200.
- `/live`: HTTP 200.
- `/health`: HTTP 503 com configuração obrigatória ausente, como esperado.
- Runtime de produção sem token de sandbox.
- Escrita no volume e leitura após restart confirmadas.
- Sharp e FFmpeg disponíveis na imagem final.
- Arquivo de upload inspecionado: sem `.env`, `.git`, `node_modules` ou `.data`.
- Nenhum valor secreto configurado no `.env.local` encontrado no conteúdo do pacote.

## Arquivo para upload

`socialengine-easypanel.tar.gz` — contexto de build `/`, Dockerfile `Dockerfile`.

SHA-256 do pacote validado:

```text
a69083c92bc9d26d4f0dc41f8bbebe68a6a5f4aada53fdc3bc3f62f4e22f8d75
```

Se o pacote for regenerado após alterações, registrar o novo hash e revalidar os checks afetados. O pacote contém o código implantável; testes locais e documentação externa ao contexto não são incluídos nele.

## Gate de produção

O preflight local identificou pendências de ownership, contrato de verificação Authority, chave de criptografia e conectividade SQL pelo endereço configurado. Supabase Auth respondeu e a escrita no diretório de dados foi validada.

A migration do schema foi aplicada anteriormente pelo acesso operacional à VPS e testada em banco temporário. A falha de conexão do preflight não significa que essa migration esteja ausente; significa que a conexão usada pelo runtime precisa ser validada.

Também é necessário confirmar o serviço Easypanel: contrato indica `sistemas/social`; a pasta inspecionada no host foi `sistemas/socialengine`.

Essas dependências impedem declarar o ambiente funcionalmente liberado, mas não impedem construir a imagem e preparar sua configuração.
