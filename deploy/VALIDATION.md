# Validação do pacote de deploy

Data: 23/10/2026. Estado: **pacote atualizado com o catálogo de fontes; serviço público não implantado por esta preparação**. A imagem Docker descrita abaixo corresponde à base anterior ao catálogo (commit ff68259). O pacote atual passou por build, testes e verificação de interface; não foi reconstruído em Docker nesta atualização.

## Evidências

- `npm run build`: typecheck e build Vite aprovados.
- `npm test`: 36 testes aprovados, zero falhas e um teste de rede opt-in não executado nessa rodada.
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
96813179974949621d6443e3ff3011a829095c8d1df25eb4b6779609b9e7c4fd
```

Se o pacote for regenerado após alterações, registrar o novo hash e revalidar os checks afetados. O pacote contém o código implantável; testes locais e documentação externa ao contexto não são incluídos nele.

## Gate de produção

O preflight local identificou pendências de ownership, contrato de verificação Authority, chave de criptografia e conectividade SQL pelo endereço configurado. Supabase Auth respondeu e a escrita no diretório de dados foi validada.

A migration do schema foi aplicada anteriormente pelo acesso operacional à VPS e testada em banco temporário. A falha de conexão do preflight não significa que essa migration esteja ausente; significa que a conexão usada pelo runtime precisa ser validada.

Também é necessário confirmar o serviço Easypanel: contrato indica `sistemas/social`; a pasta inspecionada no host foi `sistemas/socialengine`.

Essas dependências impedem declarar o ambiente funcionalmente liberado, mas não impedem construir a imagem e preparar sua configuração.


## Atualização do Radar — 23/10/2026

- 44 feeds em inglês verificados com o coletor real: todos retornaram entradas válidas, sem afrouxar robots.txt, validação de DNS ou limite de tamanho.
- Evidência de rede: `09-codigo/docs/trend-catalog-validation.json`.
- Interface local: busca, filtro por tema, revisão do formulário, confirmação obrigatória, cadastro e estado “Já adicionada” verificados no sandbox.
- Testes de API: seleção isolada por tenant, recusa de duplicata sequencial com tracking, ausência de coleta sem confirmação e bloqueio do perfil viewer.
- Nenhuma migration necessária nesta atualização. A imagem Docker anterior não contém este catálogo; construir uma nova imagem a partir do código/pacote atual no Easypanel.

- Ampliação de cobertura: notícias, redes sociais, fóruns, espiritualidade e viagens conferidos no filtro e nos cartões da interface local.
- Parser RSS v2: coleta real de 20 publicações da conta oficial do Mastodon confirmada. Teste offline cobre posts sem título, títulos vazios, preservação de títulos originais e rejeição de links internos/entradas vazias.
- A ampliação não fornece coleta de hashtags nem métricas de popularidade de Instagram/TikTok/YouTube.


## Agências, repercussão e ferramentas — 23/10/2026

- Diretório com 21 entradas: 13 agências/veículos globais, três comunidades Reddit, X e quatro ferramentas de tendências/pesquisa. Somente entradas com RSS verificado abrem o formulário de adição; pendências de API/licença/coleta estão identificadas.
- NYT World, Financial Times World, DW English, France 24 e Google Trends EUA/Reino Unido adicionados ao catálogo coletável, totalizando 44 feeds. Todos retornaram itens pelo coletor real.
- Google Trends verificado no worker do sandbox: dez consultas preservadas em dez itens/pautas, estimativas mantidas como aproximadas e crescimento nulo. A identidade inclui termo e país porque a origem reutiliza o mesmo link para várias consultas.
- Nenhuma API paga foi chamada, credencial externa criada ou coleta de Reddit/X/TikTok/Pinterest/Perplexity ativada. Esses conectores permanecem pendentes.
- A imagem Docker da base ff68259 continua como evidência anterior; o pacote atual deve gerar uma nova imagem no Easypanel. Não houve implantação pública nesta atualização.
