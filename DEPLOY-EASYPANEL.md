# SocialEngine — Deploy em VPS com Easypanel

Preparação: **23/10/2026**. Código implantável: `09-codigo`. Este roteiro prepara a implantação; a liberação de produção depende do preflight e das validações abaixo.

## 1. Configuração do serviço

| Campo | Valor |
| --- | --- |
| Tipo | App |
| Projeto Easypanel | `sistemas` |
| Serviço definido no contrato | `social` |
| Repositório | `appbigwriter/socialengine` |
| Branch de trabalho | `codex/socialengine`; usar `main` somente depois da integração do código |
| Build Path do repositório | `/09-codigo` |
| Builder | Dockerfile |
| Dockerfile | `Dockerfile`, relativo ao Build Path |
| Porta interna | `3000` |
| Domínio | `socialengine.fbr.news` |
| Protocolo entre proxy e aplicação | HTTP |
| HTTPS público | Configurado no domínio pelo Easypanel |
| Volume persistente | Volume nomeado `socialengine-data`, montado em `/app/data` |
| Usuário do processo | `node`, UID/GID 1000 |

Não publicar a porta 3000 diretamente na internet. Usar o domínio/proxy do Easypanel. O processo escuta em `0.0.0.0:3000` dentro do container.

**Conferência necessária:** a inspeção da VPS encontrou uma pasta de serviço `sistemas/socialengine`, enquanto o contrato do projeto informa `sistemas/social`. Confirmar o serviço utilizado antes de configurar domínio, volume e variáveis; não criar dois serviços por engano nem alterar outro sistema.

## 2. Ambiente e segredos

Copiar o modelo [.env.example](.env.example) para **Environment** do serviço correto e preencher os valores pelo canal seguro já utilizado pela operação. Não adicionar `.env.local`, arquivos de backup ou chaves ao repositório nem ao upload de código.

O Dockerfile não recebe credenciais por `ARG`, não copia arquivos `.env` e não executa migrations durante o build.

### Variáveis necessárias à operação

- `DATABASE_URL`: conexão PostgreSQL acessível **de dentro do container**. Usar a rede privada apropriada entre aplicação e Supabase, ou um endpoint protegido e alcançável. `localhost` no container identifica a própria aplicação. Não fixar IP efêmero de outro container.
- `CONTROL_TOWER_PROJECT_ID`: `6dccc6dd-880f-4148-921a-08cbe8a1f219`.
- `CONTROL_TOWER_SCHEMA_NAME`: `custom_socialengine`.
- `AUTHORITY_OWNER_ID`: ownership real atribuído pelo catálogo, correspondente a `public.projects.authority_owner_id`. Não gerar um substituto para contornar essa dependência.
- `AUTHORITY_VERIFIER_URL` e `AUTHORITY_OPERATOR_TOKEN`: adaptador de autorização do Authority.
- `SUPABASE_URL` e `SUPABASE_ANON_KEY`: endpoint e chave pública de autenticação. Service role e tokens operacionais permanecem exclusivamente no servidor.
- `SOCIALENGINE_ENCRYPTION_KEY`: chave de 32 bytes, codificada em base64 ou hexadecimal, guardada no gerenciador de segredos.
- `SOCIALENGINE_PUBLIC_URL=https://socialengine.fbr.news`.
- `SOCIALENGINE_DATA_DIR=/app/data`.
- `NODE_ENV=production`, `APP_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`.

Gerar a chave de criptografia uma única vez no mecanismo seguro da operação. Preservá-la em restart, redeploy e restauração: trocá-la sem processo de rotação torna as credenciais antigas ilegíveis. Não registrar seu valor em logs.

`SOCIALENGINE_ADMIN_USER_IDS` recebe UUIDs de usuários existentes e explicitamente autorizados para o bootstrap administrativo. Não existe promoção automática do primeiro visitante.

### Contrato do adaptador Authority

O adaptador implementado envia `POST` à URL configurada, com token de operador em `Authorization: Bearer`, e corpo:

```json
{"project_id":"UUID do projeto","owner_id":"UUID do catálogo","user_id":"UUID autenticado"}
```

A autorização só é aceita com resposta HTTP de sucesso e:

```json
{"authorized":true,"project_id":"mesmo projeto","owner_id":"mesmo owner","user_id":"mesmo usuário"}
```

Esse é o contrato esperado pelo código, **ainda a alinhar com o serviço Authority existente**. Não foi assumido um endpoint remoto nem validado um contrato inexistente. Ausência ou divergência mantém os acessos privados e trabalhos bloqueados.

### Integrações opcionais

Credenciais dos aplicativos OAuth, versões da Meta/LinkedIn e auditoria do TikTok são configuradas no servidor conforme [a documentação dos conectores](09-codigo/src/social/README.md). Chaves de IA próprias são cadastradas na área do tenant depois da liberação do ambiente.

Nenhum segredo de aplicativo OAuth deve usar prefixo `VITE_`. O frontend recebe somente a chave pública de autenticação e metadados de capacidades.

## 3. Persistência e processo de publicação

O volume `/app/data` guarda arquivos privados e material renderizado. O banco mantém conteúdos, versões, conexões, fila e análises no schema exclusivo.

O volume precisa permitir escrita pelo UID 1000. Para um volume já existente, ajustar sua propriedade numa operação de manutenção direcionada ao volume correto; não executar a aplicação inteira como root para contornar permissões.

O serviço web executa o worker interno por padrão (`SOCIALENGINE_WORKER_ENABLED=true`). Para a primeira implantação, usar **um serviço App com uma réplica**. A fila já possui lease/idempotência, mas escalar workers ou separar processos exige dimensionamento e observabilidade próprios. `npm run worker` existe para esse cenário; não ativar simultaneamente processos adicionais sem definir a topologia.

O worker aguarda readiness e identidade válidas antes de reservar trabalho em produção. Não executar `npm run dev` nem passar `--sandbox` no Easypanel.

## 4. Migrations e bootstrap

Antes de qualquer nova migration, fazer backup do schema e do volume e confirmar a revisão do código implantado.

Em shell administrativo autorizado, dentro de `/app`:

```sh
npm run db:inspect
npm run db:migrate
npm run db:bootstrap
npm run preflight
```

- As migrations usam somente `custom_socialengine`; não modificam tabelas de governança em `public`.
- A migration cria papéis restritos e precisa de uma conexão administrativa autorizada. Não usar uma credencial do navegador.
- O usuário do pool da aplicação precisa conseguir assumir `socialengine_app`. Quando for diferente do usuário que executou a migration, conceder somente o vínculo e os privilégios necessários pelo procedimento administrativo do banco.
- Leituras de catálogo e bootstrap exigem os acessos administrativos previstos no contrato. Não conceder acesso irrestrito à governança como solução automática.
- O bootstrap verifica ownership real e os usuários existentes antes de criar espaços. Não é necessário executá-lo em todo restart.
- O preflight verifica configuração, catálogo, conexão, estrutura, autenticação e escrita no volume; não imprime segredos e sai com código diferente de zero enquanto houver bloqueios.

**Estado desta instalação:** a migration `20261022235817_socialengine_tenant_foundation.sql` já foi aplicada ao schema da VPS, após backup e teste em banco temporário. O mecanismo de migrations registra sua aplicação. Não repetir o SQL manualmente: usar o comando de migrations para reconhecer o histórico.

## 5. Build e implantação

### Pelo repositório

1. Garantir que o commit desejado esteja disponível na branch configurada.
2. Selecionar o repositório e o Build Path `/09-codigo`.
3. Selecionar Dockerfile, conferir Environment, volume e domínio.
4. Executar Deploy e conferir saída do build e logs de inicialização.
5. Executar o preflight e validar `/health` antes de liberar a operação.

### Por upload, caso o repositório não esteja acessível

Dentro de `09-codigo`:

```sh
npm run deploy:package
```

O comando gera `deploy/socialengine-easypanel.tar.gz` na raiz do projeto e verifica que o arquivo não contém `.env`, `.git`, dependências ou dados privados. O contexto do arquivo gerado já é a raiz da aplicação: para **esse upload**, usar Build Path `/` e Dockerfile `Dockerfile`, sem acrescentar `/09-codigo`.

O arquivo é código-fonte para o Easypanel construir a imagem na VPS. Não é backup de banco, arquivos ou segredos.

## 6. Verificações após o deploy

```sh
curl -f https://socialengine.fbr.news/live
curl -f https://socialengine.fbr.news/health
```

- `/live`: HTTP 200 comprova apenas que o processo está vivo. É a verificação de liveness do container, evitando restart contínuo enquanto um serviço externo está pendente.
- `/health`: HTTP 200 exige readiness. HTTP 503 indica bloqueio de configuração ou dependência e impede considerar o serviço liberado.
- `/api/runtime`: não pode retornar token de sandbox em produção nem segredos administrativos.
- Consultar dados sem sessão deve ser recusado; usuários de dois tenants não podem acessar os dados ou arquivos um do outro.
- Reiniciar o serviço e confirmar preservação de arquivos, configurações, versões e trabalho pendente.

Configurar o monitor de prontidão para `/health`, sem confundir o estado de liveness do Docker com a liberação funcional do produto.

Logs do proxy devem omitir URLs completas em `/api/social/*`, pois callbacks e entrega temporária de mídia podem carregar códigos ou capacidades de curta duração. O logger da aplicação já omite esses caminhos sensíveis.

## 7. Backup e rollback

- Fazer backup coordenado de PostgreSQL, volume privado e referências/versões do gerenciador de segredos.
- Guardar a chave de criptografia separadamente e garantir sua recuperação autorizada.
- Reter a imagem/commit da versão anterior para rollback do código. Rollback de código não desfaz automaticamente uma migration.
- Testar restauração em base/volume isolados antes de afetar produção.
- O backup inicial da estrutura existente e o teste PostgreSQL em base temporária foram realizados nesta sessão; isso não substitui uma política recorrente nem comprova recuperação com todos os dados futuros do negócio.

## 8. Bloqueios conhecidos para liberação

Na última inspeção, o catálogo estava com `authority_owner_id` vazio. A validação do Authority e a conexão SQL usada pelo runtime ainda precisam ser confirmadas; a conexão direta fornecida não funcionou deste computador. A inspeção e migration foram feitas pelo acesso operacional autorizado à VPS.

Também precisam de homologação real os aplicativos/permissões das redes e o provedor de IA. O deploy do código não comprova publicação social funcionando.

## Referência

[Documentação oficial do App Service no Easypanel](https://easypanel.io/docs/services/app): GitHub/Git, upload, Dockerfile, Environment, mounts e domínio. As opções podem variar conforme a versão instalada no painel.
