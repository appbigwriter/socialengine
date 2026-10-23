# Validação do pacote de deploy

Data: 23/10/2026. Estado: **pacote atualizado com o catálogo de fontes; serviço público não implantado por esta preparação**. A imagem Docker descrita abaixo corresponde à base anterior ao catálogo (commit ff68259). O pacote atual passou por build, testes e verificação de interface; não foi reconstruído em Docker nesta atualização.

## Evidências

- `npm run build`: typecheck e build Vite aprovados.
- `npm test`: 32 testes aprovados, zero falhas e um teste de rede opt-in não executado nessa rodada.
- Docker build da base anterior executado na VPS com dependências Linux de produção.
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

SHA-256 do pacote atual (catálogo incluído; validação local):

```text
fd34df07a8e8c846f6d2b4e74965963622d47dcaa7a341ef894a679839f3be65
```

Se o pacote for regenerado após alterações, registrar o novo hash e revalidar os checks afetados. O pacote contém o código implantável; testes locais e documentação externa ao contexto não são incluídos nele.

## Gate de produção

O preflight local identificou pendências de ownership, contrato de verificação Authority, chave de criptografia e conectividade SQL pelo endereço configurado. Supabase Auth respondeu e a escrita no diretório de dados foi validada.

A migration do schema foi aplicada anteriormente pelo acesso operacional à VPS e testada em banco temporário. A falha de conexão do preflight não significa que essa migration esteja ausente; significa que a conexão usada pelo runtime precisa ser validada.

Também é necessário confirmar o serviço Easypanel: contrato indica `sistemas/social`; a pasta inspecionada no host foi `sistemas/socialengine`.

Essas dependências impedem declarar o ambiente funcionalmente liberado, mas não impedem construir a imagem e preparar sua configuração.


## Atualização do Radar — 23/10/2026

- 25 feeds em inglês verificados com o coletor real: todos retornaram entradas válidas, sem afrouxar robots.txt, validação de DNS ou limite de tamanho.
- Evidência de rede: `09-codigo/docs/trend-catalog-validation.json`.
- Interface local: busca, filtro por tema, revisão do formulário, confirmação obrigatória, cadastro e estado “Já adicionada” verificados no sandbox.
- Testes de API: seleção isolada por tenant, recusa de duplicata sequencial com tracking, ausência de coleta sem confirmação e bloqueio do perfil viewer.
- Nenhuma migration necessária nesta atualização. A imagem Docker anterior não contém este catálogo; construir uma nova imagem a partir do código/pacote atual no Easypanel.
