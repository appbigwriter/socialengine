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
# Diagnóstico do cadastro de influenciador — 26/10/2026

- Reproduzido `GET /api/workspaces` com HTTP 503 e `AUTH_UNAVAILABLE`, enquanto `/health` retornava 200. O health atual não verifica conectividade com o Supabase Auth.
- Dentro do container, a chamada ao Auth falhava com `getaddrinfo ENOTFOUND supabase-control-tower-api.fbr.news`. O DNS da VPS (`153.92.2.6`) retornava nome inexistente; `1.1.1.1` e `8.8.8.8` resolviam o domínio corretamente.
- Aplicada correção somente no serviço Swarm `sistemas_socialengine`: `docker service update --dns-add 1.1.1.1 --dns-add 8.8.8.8 --detach sistemas_socialengine`. Preservar esses resolvedores nas próximas recriações do serviço pelo Easypanel; a alteração do serviço Swarm pode ser substituída pelo painel.
- Validação: token propositalmente inválido passou de HTTP 503 / `AUTH_UNAVAILABLE` para HTTP 401 / `INVALID_SESSION`. O container voltou a alcançar o Auth sem desativar validação TLS ou autenticação.
- A sessão real passou a exibir `Acesso não autorizado pelo Authority`. A inspeção confirmou duas pendências independentes: o token de operador do SocialEngine difere do configurado no Authority; `POST /api/verify` não existe no Authority implantado (404 com a credencial válida do próprio serviço). Nenhum token foi registrado neste documento ou alterado na operação.
- O cadastro continua pendente da implementação/configuração do contrato de verificação no Authority. Não promover usuários ao bootstrap como solução para essa integração. O tratamento local de erros agora distingue 401/404 de integração (503) de recusa explícita de acesso (403); essa alteração de código ainda precisa de deploy.

## Verificador Authority e importação de Character Kit — 26/10/2026

- Pendências acima resolvidas nesta atualização: implementado `POST /api/verify` no projeto `F:/Projetos/_FBR/AuthorityEngine/09-codigo`, com validação do catálogo, usuário ativo e memberships existentes. Testado contra o banco real: usuário autorizado retorna 200; usuário sem vínculo retorna 403. Credenciais ausentes/inválidas e payloads inválidos continuam bloqueados; indisponibilidade retorna 503.
- Atualizado somente o token de integração do serviço SocialEngine para o token de operador já reconhecido pelo Authority, sem imprimir seu valor. Nenhuma permissão ou membership foi criada.
- Imagens publicadas no Swarm: `authority:verify-20261026` e `socialengine:persona-20261026`. Especificações anteriores preservadas em `/root/socialengine-persona-backup-20261026` na VPS, com acesso restrito. O DNS explícito do SocialEngine foi preservado.
- Antes de novo deploy pelo Easypanel, sincronizar o código atualizado dos dois projetos, o token de integração reconhecido e os resolvedores de DNS com a configuração do painel. Um deploy a partir de fontes/configurações antigas pode substituir as alterações aplicadas diretamente ao Swarm. Não imprimir nem copiar tokens para documentação ou Git.
- Cadastro e edição aceitam texto colado e arquivos Markdown/TXT (até 200 KB e 50.000 caracteres). `Preencher com o kit` extrai os campos declarados em português ou inglês; mantém valores atuais quando o documento não informa o campo. O kit completo é persistido em metadata do workspace, isolado por tenant, e enviado como referência de persona para a geração, junto com o idioma e os campos revisados.
- Validado com o arquivo fornecido `valentina-character-bible-v1.md`: nome, posicionamento, público, promessa, voz e idioma EN-US preenchidos. Cor e fuso mantidos para revisão. Formulário publicado preenchido no navegador; cadastro não submetido automaticamente.
- Build e tipos do SocialEngine aprovados. 45 testes passaram e 1 teste externo opt-in foi ignorado. Authority: 73 testes aprovados. Health de produção retorna 200; chamada real do SocialEngine ao novo verificador retorna 200 para o usuário autorizado e 403 para usuário sem vínculo.

## Recorrência após redeploy — 27/10/2026

- Às 00:01 (America/Sao_Paulo), o Easypanel recriou o serviço usando `main`, código anterior ao Character Kit, DNS herdado da VPS e token antigo de integração. Reproduzido novamente HTTP 503 / `AUTH_UNAVAILABLE`, com `ENOTFOUND` para Supabase e Authority.
- Corrigido o DNS da interface `eth0` via `resolvectl dns eth0 1.1.1.1 8.8.8.8`, com persistência no drop-in `/etc/systemd/network/10-netplan-eth0.network.d/90-fbr-dns.conf`. Não foram alterados IPs, rotas ou reiniciados outros serviços. Novos containers herdam os resolvedores corretos sem depender de um override Swarm.
- Restaurada a imagem testada `socialengine:persona-20261026` e o token reconhecido pelo Authority. O mesmo token foi salvo em Environment do Easypanel e confirmado após recarregar a página, sem registrar seu valor.
- Preparada a branch `codex/auth-persona-release`, baseada em `origin/main`, contendo somente fontes, testes, configurações de exemplo e documentação da versão já validada. Excluídos dependências, dados locais, arquivos de ambiente privados e segredos do histórico de publicação.
