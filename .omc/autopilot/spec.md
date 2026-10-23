# SocialEngine — especificação de execução autônoma

Data: 2026-10-22. Fontes normativas: PRD.md, SPRINTS.md, TRENDS.md e socialengine-dev-doc.md. Os 48 critérios das stories permanecem obrigatórios; implementação local não substitui comprovação de integração real.

## Resultado e arquitetura

Aplicação multi-tenant para transformar fontes e tendências em campanhas originais, editáveis, revisadas e distribuídas com resultados históricos. Tenant é o espaço de um influenciador, com blog, marca, equipe, fontes, segredos, conteúdo e métricas próprios.

Código implantável em `09-codigo/`. Adotar Node.js + TypeScript, Fastify no servidor, PostgreSQL via driver pg, React/Vite no cliente e worker de trabalhos persistentes. Servidor entrega o build estático e APIs autenticadas na porta 3000 (`HOST=0.0.0.0`). Worker reutiliza serviços e repositórios; fila no PostgreSQL, sem introduzir Redis neste estágio. Docker inclui os recursos de renderização necessários e volume privado durável ou armazenamento privado externo configurado.

Camadas: validação HTTP → identidade/permissões → serviço de domínio → repositório transacional; conectores externos ficam atrás de interfaces explícitas. Frontend nunca recebe acesso administrativo ao banco nem tokens de integrações. Dados demonstrativos, quando necessários para avaliação visual, devem estar explicitamente separados e não podem conferir sucesso a integrações.

## Persistência e identidade obrigatórias

- Usar exclusivamente `custom_socialengine` para dados e migrations. Não criar, alterar ou excluir governança em `public`.
- Inspecionar as sete tabelas existentes (`entities`, `entity_relations`, `records`, `files`, `settings`, `audit_logs`, `events`), colunas, índices, restrições, políticas e privilégios antes de aplicar SQL. O mapeamento abaixo é lógico, não afirma que suas colunas já existem.
- Projeto da plataforma: `6dccc6dd-880f-4148-921a-08cbe8a1f219`; `project_id` delimita a aplicação no catálogo. `owner_id` é ownership derivado do catálogo/Authority; não deve ser presumido igual ao usuário ou tenant. `tenant_id` delimita o influenciador. `actor_id` identifica a pessoa autenticada. Membership associa ator e tenant com papéis autorizados.
- Aplicar escopo de projeto, owner e tenant em cada operação, políticas RLS com papel sem BYPASSRLS e restrições que neguem relações cruzadas. Não confiar em IDs/papéis enviados pelo browser. Auditoria somente acrescenta eventos, via servidor.
- Sessão de usuário e tokens Authority são conceitos distintos. O contrato Authority permanece PENDENTE: origem de owner, validação de sessão, vínculo/membership, descoberta/validação dos papéis e ciclo de revogação ainda precisam de evidência. Nenhum token Authority fixo do runtime deve ser aceito como login humano nem exposto no cliente.
- Até haver contrato confirmado, criar adaptadores e testes com identidade de teste explicitamente local; produção recusa acesso privado sem verificador de identidade configurado. Não inserir silenciosamente um owner arbitrário. Operações dependentes ficam indisponíveis com explicação.

## Mapeamento lógico inicial

`entities`: tenant/influenciador e identidades referenciáveis; `entity_relations`: memberships/vínculos; `records`: fontes, versões, aprovações, campanhas, destinos, observações analíticas e registros de Trends discriminados por tipo; `files`: objetos privados e metadados; `settings`: marca/blog/preferências/cotas e referências de segredos; `audit_logs`: mudanças sensíveis e decisões; `events`: fila persistente e eventos de execução. Segredos só como ciphertext com chave independente do banco ou referência de secret manager. Adaptar após inspeção, evitando duas fontes de verdade.

### Inspeção confirmada durante planejamento

Inspeção SQL somente leitura via acesso SSH autorizado confirmou PostgreSQL 15.8 e as sete tabelas existentes: `entities(id,key,name,type,metadata,created_at,updated_at)`; `entity_relations(id,source_entity_id,target_entity_id,relation_type,created_at)`; `records(id,entity_id,data,created_at,updated_at)`; `files(id,name,path,mime_type,size_bytes,metadata,created_at)`; `settings(id,key,value,is_public,created_at,updated_at)`; `audit_logs(id,action,resource_id,metadata,created_at)`; `events(id,event_type,payload,created_at)`. Não há políticas RLS ou funções no schema. Contagem e ownership das linhas ainda precisam ser confirmados antes de alterar dados existentes.

Preparar migrations aditivas para `project_id`, `owner_id` e `tenant_id`, índices e restrições em todas as entidades persistentes relevantes. Não atribuir ownership retroativo sem evidência. Fila poderá acrescentar colunas operacionais a `events`, mantendo payload tipado e validação de contexto. Usar verificação de pré-condição para recusar aplicação sobre contrato divergente ou linhas sem ownership que não possam ser migradas com segurança.

## Capacidades e invariantes

1. Identidade: login/logout seguro, seleção com limpeza de cache e cancelamento de requests antigos, papéis acumuláveis e negação padrão. Blog permite implantação sem URL; ativo exige HTTP(S); cadastro não autoriza coleta/publicação.
2. Criação: material-fonte, inspiração e marca distintos; slides estruturados, imagens privadas, legenda/CTA, edição concorrente por revisão esperada. Histórico imutável e aprovação ligada ao hash/ID exato da versão. Toda mudança invalida aprovação e a autorização afetada.
3. IA/arquivos: fontes externas são dados não confiáveis; limites de entrada e saída, timeout, orçamento e rastreabilidade. Chaves próprias isoladas, criptografia, revogação, quotas reservadas atomicamente e sem fallback silencioso para outro tenant. PDFs ilegíveis indicam necessidade de transcrição; imagens e vídeos somente onde houver implementação e acesso.
4. Trends: RSS/Atom e página pública são os primeiros conectores candidatos, ambos reais. Fetch com prevenção de SSRF na resolução DNS e em cada redirecionamento, bloqueio de IPs internos/privados, limites de bytes/tempo/taxa e robots/regras da origem. Descoberta, extração e detecção são etapas separadas. Normalização e deduplicação com evidências preservadas; republicações não são fontes independentes. Observações append-only, ranking versionado com relevância, intensidade e confiança distintas. Só declarar crescimento com série comparável e cobertura adequada; ausência não vira zero. Coleta não compete sem limite com publicação.
5. Distribuição: aprovação editorial separada de autorização por destino/conta/versão/horário; persistir chave idempotente e tentativa antes de envio. Reservas atômicas com lease, retry com backoff e reconciliação para resposta incerta. Sem repetição cega de efeitos externos. Cancelar/desconectar bloqueia novo envio; histórico persiste.
6. Resultados: snapshots com unidade/origem/data/janela; cálculo usa último valor ou diferenças válidas, não soma acumulados repetidos. Dashboard por tenant com filtros, produção, calendário, resultados, conexões, Trends, consumo e atividade. Indisponível não vira zero; alcance não é pessoas únicas entre redes.
7. Exportação: produzir arquivos compatíveis e reproduzíveis vinculados à versão. Vídeo básico por sequência de cenas e renderização, sem prometer avatares/produção avançada. Cada conector valida mídia de seu destino antes da execução.
8. Operação: health/readiness revela apenas disponibilidade sanitizada, backup/restauração em ambiente isolado, retenção e procedimentos documentados. Não executar publicações reais ou distribuição comercial sem versão/destinos autorizados na aplicação.

## Dependências e critérios de conclusão

Bloqueios externos a registrar com responsável e próxima ação: conectividade PostgreSQL; inspeção do contrato; identidade Authority/owner; papel de banco não privilegiado; armazenamento privado/backup; chave independente de criptografia; IA/modelo/cota; OAuth/aplicativos/contas/permissões de cinco redes; acesso Easypanel/implantação; fontes reais e autorização de piloto. Não contornar um bloqueio inventando dado, sessão, métrica, confirmação ou segredo.

É permitido implementar componentes e executar testes locais enquanto o ambiente está bloqueado. Registro de progresso deve separar: implementado, verificado localmente, verificado em infraestrutura e bloqueado externo. Apenas o atendimento integral do aceite original conclui uma story. MVP requer dois tenants reais isolados, dois nichos e dois conectores recorrentes reais, fluxo completo Instagram e restore comprovado. Expansão exige confirmação real nas cinco redes.
