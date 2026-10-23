# SocialEngine — Sprints e Stories

**Base:** [PRD v1.0](PRD.md) · **Data:** 22/10/2026 · **Status inicial:** backlog.

## Como executar

- Executar as sprints na ordem abaixo, respeitando as dependências de cada story.
- Usar os estados: **Backlog → Pronta → Em andamento → Em revisão → Concluída**. Registrar bloqueios com motivo, responsável pela resolução e próxima ação.
- Uma story fica **Pronta** quando suas dependências, acessos e decisões necessários estão disponíveis.
- Uma story fica **Concluída** quando atende aos critérios de aceite, passa pelos testes pertinentes e apresenta evidência verificável.
- Trabalhar em entregas pequenas, com uma demonstração ao final de cada sprint.
- A duração de cada sprint e a capacidade da equipe serão definidas antes de assumir datas. A sequência abaixo é um plano de entregas, não uma promessa de prazo.
- Integrações podem ser desenvolvidas com simulações identificadas; a conclusão de stories de integração exige validação real.

### Regras para todas as stories

1. Persistir dados exclusivamente em `custom_socialengine`, respeitando o contrato existente e os identificadores `project_id`, `owner_id` e tenant.
2. Validar acesso no servidor e no banco. Não confiar no tenant ou no papel informado pelo navegador.
3. Manter segredos fora do Git, frontend e logs.
4. Preservar histórico e não fabricar fontes, métricas ou confirmação de publicação.
5. Disponibilizar estados de carregamento, vazio, sucesso e falha nas telas aplicáveis.
6. Validar os fluxos principais em desktop e celular, com campos identificados e navegação por teclado.
7. Registrar na conclusão: mudança entregue, testes executados, evidência e limitações restantes.

## Visão das sprints

| Sprint | Entrega | Stories | Marco |
| --- | --- | --- | --- |
| 0 | Infraestrutura e contratos de integração | SE-001 a SE-004 | Base liberada para implementação |
| 1 | Identidade, tenants, permissões e blog | SE-005 a SE-008 e SE-048 | Dois influenciadores isolados |
| 2 | Fontes, editor manual e revisão | SE-009 a SE-013 | Etapa 1 do PRD |
| 3 | Geração por IA, configurações e exportação | SE-014 a SE-018 e SE-042 | Criação assistida funcional |
| 4A | Configuração, coleta e extração de sinais | SE-044, SE-019, SE-045, SE-022 | Pipeline de Trends funcional |
| 4B | Histórico, tendências e ranking por nicho | SE-046, SE-020, SE-021, SE-047 | Etapa 2 do PRD |
| 5 | Instagram e fila de publicação | SE-023 a SE-027 | Publicação real |
| 6 | Dashboard, análises, operação e piloto | SE-028 a SE-031 e SE-043 | MVP / etapa 3 do PRD |
| 7 | Facebook e LinkedIn | SE-032 a SE-034 | Distribuição ampliada |
| 8 | Fontes sociais e vídeo básico | SE-035 a SE-037 | Conteúdo adaptado para vídeo |
| 9 | TikTok, YouTube e campanha integrada | SE-038 a SE-041 | Etapa 4 do PRD |

**MVP:** sprints 0 a 6, incluindo 4A e 4B. **Expansão:** sprints 7 a 9. O plano contém 11 sprints; a divisão de Trends preserva os identificadores das stories anteriores.

## Sprint 0 — Infraestrutura e contratos

**Objetivo:** tornar o ambiente acessível e fechar as decisões que afetam segurança e persistência.

### SE-001 — Validar acesso ao banco

Como desenvolvedor, quero acessar o PostgreSQL pelo caminho autorizado para inspecionar o ambiente existente.

**Dependências:** acesso de rede ou acesso autorizado à VPS2.

**Aceite:**
- Executar `select 1` e inspecionar tabelas, colunas, índices, políticas e privilégios de `custom_socialengine`.
- Documentar o caminho de conexão e o resultado da inspeção sem registrar credenciais; preservar a governança em `public`.

### SE-002 — Definir identidade e contrato de dados

Como administrador, quero um contrato claro de identidade para que ownership e permissões sejam persistidos corretamente.

**Dependências:** SE-001; documentação ou acesso autorizado ao Authority/Control Tower.

**Aceite:**
- Documentar origem e validação do usuário, `project_id`, `owner_id`, tenant e papéis; distinguir sessão de usuário de token de integração.
- Mapear o domínio às tabelas `entities`, `entity_relations`, `records`, `files`, `settings`, `audit_logs` e `events`; registrar ajustes necessários antes das migrations.

### SE-003 — Preparar aplicação e deploy

Como operador, quero uma aplicação implantável para validar o runtime oficial desde o início.

**Dependências:** SE-001; acesso ao Easypanel e ao ambiente de validação.

**Aceite:**
- Organizar código implantável em `/09-codigo`, configuração de exemplo sem segredos e comandos reproduzíveis de build, teste e execução.
- Subir em `sistemas/social`, porta 3000, e validar `/health`: HTTP 200 quando pronta e estado de falha quando uma dependência essencial estiver indisponível, sem expor segredos.

### SE-004 — Preparar dependências externas

Como responsável pelo projeto, quero antecipar acessos de IA e redes sociais para reduzir bloqueios nas próximas sprints.

**Dependências:** identificação dos responsáveis pelas contas e infraestrutura.

**Aceite:**
- Registrar provedor de IA, credenciais necessárias, contas de teste, aplicativos sociais, permissões e responsáveis por aprovação para as cinco redes.
- Registrar o estado de cada dependência e o mecanismo de entrega de segredos ao servidor. Uma solicitação enviada não será marcada como acesso concedido.

**Demonstração:** ambiente acessível, inspeção do banco concluída e contratos documentados. Aprovações externas podem continuar em acompanhamento.

## Sprint 1 — Identidade, tenants e permissões

**Objetivo:** permitir a operação de dois influenciadores com acesso e dados separados.

### SE-005 — Autenticar e encerrar sessões

Como usuário, quero entrar e sair da minha conta para acessar apenas os espaços autorizados.

**Dependências:** SE-002 e SE-003.

**Aceite:**
- Validar a identidade pelo contrato definido, tratar sessão expirada e impedir acesso anônimo a dados privados.
- Encerrar a sessão sem manter conteúdo de outro usuário na interface ou em caches compartilhados.

### SE-006 — Criar e selecionar influenciadores

Como administrador, quero gerenciar espaços de influenciadores para organizar suas operações.

**Dependências:** SE-005.

**Aceite:**
- Criar espaço com ownership válido e listar somente espaços aos quais o usuário tem vínculo.
- Ao trocar de espaço, limpar os dados anteriores e descartar respostas atrasadas que pertençam a outro tenant.

### SE-007 — Gerenciar membros e papéis

Como administrador, quero definir permissões por espaço para distribuir responsabilidades.

**Dependências:** SE-006.

**Aceite:**
- Aplicar os papéis Administrador, Editor, Revisor, Publicador e Leitor, permitindo acumulação conforme o contrato definido.
- Bloquear promoção de privilégios por requisição direta e registrar concessão, alteração e revogação de acesso em auditoria.

### SE-008 — Garantir isolamento no banco e nos arquivos

Como responsável pela operação, quero isolamento por tenant para proteger conteúdos e materiais privados.

**Dependências:** SE-006 e SE-007.

**Aceite:**
- Aplicar migrations, políticas, privilégios mínimos e restrições que impeçam relações entre registros de tenants diferentes.
- Testar dois tenants e tentativas de leitura, escrita, exportação e download cruzados, incluindo requisições diretas e acesso SQL com o papel da aplicação. Conexão que contorna RLS não comprova isolamento.

**Demonstração:** dois usuários operando espaços distintos; tentativas de acesso cruzado são negadas.

### SE-048 — Cadastrar blog do influenciador

Como administrador, quero vincular o blog ao influenciador para preparar seu uso futuro como fonte e canal de publicação.

**Dependências:** SE-006 e SE-007.

**Aceite:**
- Incluir no cadastro e nas configurações URL principal, estado de implantação, plataforma/CMS, feed opcional e idioma, associados ao influenciador e tenant corretos, conforme R15.
- Permitir cadastro enquanto o blog está a definir ou em implantação; exigir URL HTTP/HTTPS válida para marcar como ativo. Não presumir um CMS nem exigir credenciais nesta etapa.
- Salvar, editar, consultar e exportar o vínculo, preservando dados após restart/redeploy e impedindo acesso cruzado entre dois tenants.
- Indicar integração futura como não configurada; cadastrar o blog não inicia coleta nem autoriza publicação. Credenciais futuras seguirão a proteção definida em SE-042.

## Sprint 2 — Fontes, editor manual e revisão

**Objetivo:** entregar o fluxo manual completo antes de adicionar IA.

### SE-009 — Configurar identidade da marca

Como editor autorizado, quero consultar a identidade do influenciador para manter consistência no conteúdo.

**Dependências:** SE-008.

**Aceite:**
- Administrador salva nome, nicho, público, objetivos, tom de voz, cores e referências do espaço.
- Editor consulta essas configurações, e novos rascunhos recebem a identidade correta sem herdar dados de outro tenant.

### SE-010 — Cadastrar fontes e arquivos privados

Como editor, quero guardar textos, links e arquivos para reutilizar materiais na produção.

**Dependências:** SE-008.

**Aceite:**
- Salvar título, tipo, origem, texto disponível e metadados de arquivos, com validação de tamanho e formato e acesso privado.
- Distinguir material cadastrado de material extraído; quando faltar texto, solicitar trechos, transcrição ou arquivo, sem inventar o conteúdo do link.

### SE-011 — Criar e editar carrossel manualmente

Como editor, quero montar e ajustar slides para transformar uma ideia em conteúdo.

**Dependências:** SE-009 e SE-010.

**Aceite:**
- Criar rascunho próprio ou vinculado a uma fonte; editar textos, adicionar, remover e reordenar slides e trocar imagens.
- Salvar e reabrir o conteúdo com prévia, legenda e CTA; avisar sobre alterações não salvas e impedir sobrescrita silenciosa em edição concorrente.

### SE-012 — Versionar e revisar conteúdos

Como revisor, quero avaliar uma versão identificada para aprovar exatamente o conteúdo que será usado.

**Dependências:** SE-011 e SE-007.

**Aceite:**
- Submeter à revisão, solicitar ajustes e aprovar com ator, data e versão; recuperar versões anteriores sem apagar o histórico.
- Bloquear aprovação sem permissão. Qualquer alteração de texto, imagem, legenda ou adaptação aprovada exige nova aprovação.

### SE-013 — Registrar atividade e planejamento

Como equipe editorial, quero acompanhar alterações e datas planejadas para organizar o trabalho.

**Dependências:** SE-012.

**Aceite:**
- Exibir histórico de criação, edição e revisão, sem permitir adulteração dos registros por usuários comuns.
- Salvar data planejada em UTC e apresentar no fuso do espaço, identificando explicitamente que ainda não existe agendamento na rede.

**Demonstração:** criar uma fonte e um carrossel, solicitar ajustes, aprovar e consultar o histórico em dois espaços isolados.

## Sprint 3 — IA e exportação

**Objetivo:** gerar peças editáveis a partir de fontes reais e identidade da marca.

### SE-014 — Extrair texto e PDF

Como editor, quero aproveitar textos e PDFs para produzir conteúdos fundamentados.

**Dependências:** SE-010.

**Aceite:**
- Extrair conteúdo de texto e PDF legível, preservando origem e páginas ou trechos de referência quando disponíveis.
- Tratar documento inválido, protegido ou sem texto utilizável; informar a necessidade de transcrição ou processamento adicional. Instruções contidas no material não alteram o comportamento autorizado do sistema.

### SE-015 — Selecionar inspiração narrativa e visual

Como editor, quero escolher uma estrutura e uma referência visual para orientar a criação.

**Dependências:** SE-009 e SE-011.

**Aceite:**
- Disponibilizar estruturas iniciais de educação, história, análise e lista, com referência visual selecionável e registro de origem.
- Manter material-fonte, inspiração e identidade da marca como entradas distintas e persistentes.

### SE-016 — Conectar IA com limites de consumo

Como administrador, quero configurar o provedor no servidor para controlar uso e custo.

**Dependências:** SE-004 e SE-008; provedor e credencial disponíveis.

**Aceite:**
- Fazer uma chamada real autenticada, com limites de entrada, tempo e consumo por tenant e tratamento de falha e indisponibilidade.
- Registrar provedor, modelo, consumo disponível, duração e resultado. Informar custo como indisponível quando não houver base confiável de cálculo; não expor chaves nem dados de outros tenants.

### SE-017 — Gerar e refazer conteúdo editável

Como editor, quero gerar uma peça a partir da fonte para reduzir o trabalho de produção.

**Dependências:** SE-014, SE-015 e SE-016.

**Aceite:**
- Gerar capa, desenvolvimento, conclusão, legenda e CTA em estrutura editável, respeitando marca e fonte e vinculando os materiais utilizados.
- Gerar ou selecionar imagens para a peça e refazer somente um slide sem perder os demais. Alterações em conteúdo aprovado invalidam sua aprovação.

### SE-018 — Exportar arquivos de publicação

Como publicador, quero arquivos finais válidos para enviar a peça à rede de destino.

**Dependências:** SE-017.

**Aceite:**
- Renderizar slides em PNG/JPEG e exportar legenda e dados editáveis, sem cortes ou elementos fora da área útil no conjunto de teste.
- Validar dimensões, tamanho e formato exigidos pelo destino antes de liberar a peça para publicação; apresentar falhas corrigíveis ao usuário.

**Demonstração:** um PDF real gera um carrossel com referência visual, imagens e legenda; editar um slide e exportar os arquivos finais.

### SE-042 — Centralizar configurações e credenciais por tenant

Como administrador de um influenciador, quero uma área de configurações para gerenciar integrações e preferências do meu espaço com segurança.

**Dependências:** SE-007, SE-008, SE-009 e SE-016. Os controles sociais são completados pelas stories de cada conector.

**Aceite:**
- Disponibilizar seções de marca, contas sociais, APIs/IA, consumo e equipe, respeitando permissões e o tenant selecionado; indicar conectores ainda indisponíveis.
- Permitir usar um provedor compartilhado autorizado ou cadastrar chave própria para um provedor suportado. Testar conexão no servidor, substituir e revogar a chave, exibindo apenas estado e identificação mascarada, sem devolver o segredo salvo.
- Guardar segredos criptografados ou em gerenciador próprio, com referências nas configurações. Credenciais centrais de infraestrutura e aplicativos OAuth não ficam disponíveis aos tenants.
- Testar duas credenciais de tenants distintos e demonstrar seleção correta, bloqueio de acesso cruzado, limite de consumo e invalidação de novos usos após revogação. Registrar ações em auditoria sem segredos.
- Cada conector social deve integrar esta área com conectar, estado, reconectar e desconectar, incluindo o tratamento dos trabalhos pendentes afetados, antes de sua story ser considerada concluída.

## Sprint 4A — Configuração, coleta e extração de sinais

**Objetivo:** entregar o pipeline de ingestão conforme [TRENDS.md](TRENDS.md), com fontes reais e execuções recorrentes.

### SE-044 — Configurar fontes e monitoramento por tenant

Como administrador, quero definir fontes, termos e frequência para acompanhar o nicho do influenciador.

**Dependências:** SE-008, SE-009, SE-004 e SE-042.

**Aceite:**
- Cadastrar fontes/conectores, palavras-chave, exclusões, região, idioma, referências e frequência dentro das cotas; permitir ativar e pausar.
- Registrar capacidades e restrições de cada fonte, como metadados, texto, mídia e sinais disponíveis, e referências seguras às credenciais quando necessárias.
- Validar isolamento das configurações, fontes privadas e credenciais entre dois tenants. Cadastro de URL do blog não autoriza sua coleta automaticamente.

### SE-019 — Coletar sinais de fontes configuradas

Como editor, quero acompanhar automaticamente fontes do meu nicho para encontrar assuntos relevantes.

**Dependências:** SE-044; fontes acessíveis selecionadas.

**Aceite:**
- Implementar pelo menos dois tipos de conector comprovados com fontes reais, usando API, RSS/Atom ou raspagem permitida conforme a fonte; registrar identificador, URL e datas disponíveis.
- Agendar trabalhos persistentes, limitar concorrência e requisições por origem/tenant e usar cache e retentativas para falhas transitórias.
- Respeitar condições de acesso e robots.txt aplicáveis, bloquear destinos internos e redirecionamentos inseguros e sinalizar bloqueio ou cota esgotada. Não contornar login, CAPTCHA ou paywall.

### SE-045 — Extrair, normalizar e deduplicar materiais

Como editor, quero receber conteúdo limpo e rastreável para usar as fontes com confiança.

**Dependências:** SE-019 e SE-014.

**Aceite:**
- Extrair texto principal e metadados dos formatos suportados; registrar método/versão, campos disponíveis e estado. Distinguir descoberta, metadados e conteúdo efetivamente extraído.
- Normalizar URLs, idioma e datas; reconhecer itens repetidos e agrupar republicações sem contá-las como evidências independentes.
- Reprocessar sem duplicação, detectar extrator quebrado e preservar origem e histórico de atualização. Dados e instruções presentes no material não executam ações no sistema.

### SE-022 — Acompanhar execução do radar

Como operador, quero conhecer a saúde das coletas para não apresentar informações antigas como atuais.

**Dependências:** SE-019 e SE-045.

**Aceite:**
- Exibir última coleta e próxima execução, atraso, falhas, cobertura disponível, volumes descobertos/extraídos e consumo quando mensurável, respeitando papéis e tenant.
- Permitir pausar e reprocessar com autorização, recuperar trabalhos após reinício e emitir alertas no dashboard sem registrar segredos.
- Simular indisponibilidade e mudança de página e confirmar a detecção; HTTP 200 com extração vazia não será tratado como coleta útil.

**Demonstração:** dois nichos com fontes reais e coleta recorrente em dois tipos de conector, incluindo deduplicação, extração e falha visível.

## Sprint 4B — Histórico, tendências e ranking por nicho

**Objetivo:** transformar sinais coletados em tendências explicáveis e pautas utilizáveis.

### SE-046 — Persistir séries de observação e medir sinais

Como analista editorial, quero comparar observações no tempo para identificar crescimento com base em evidências.

**Dependências:** SE-045 e SE-022.

**Aceite:**
- Persistir observações com origem, horário, unidade, janela e valor disponível, sem sobrescrever histórico nem converter ausência em zero.
- Calcular variações apenas em séries comparáveis, usando diferenças para contadores acumulados e cobertura da coleta para interpretar menções; tratar reset de contador e alteração de fonte.
- Testar crescimento, estabilidade, desaceleração e histórico insuficiente com séries conhecidas identificadas como testes. Demonstrar também a persistência das observações reais do piloto.

### SE-020 — Classificar oportunidades editoriais

Como editor, quero entender por que uma pauta foi sugerida para decidir se faz sentido para minha audiência.

**Dependências:** SE-046 e SE-016.

**Aceite:**
- Classificar tópicos por nicho, público, idioma, região e atualidade; apresentar separadamente relevância editorial, intensidade do sinal e confiança, com critérios e versão registrados.
- Exibir fontes, motivo, atualização e linha do tempo disponível. Distinguir oportunidade recente, em observação, em crescimento, estável/em desaceleração e dado desatualizado/indisponível.
- Não inventar métricas, equiparar republicações a fontes independentes ou apresentar pontuação como probabilidade de viralização. Falta de cobertura não comprova queda de interesse.

### SE-021 — Transformar uma pauta em rascunho

Como editor, quero iniciar um post a partir do radar para aproveitar uma oportunidade.

**Dependências:** SE-020 e SE-017.

**Aceite:**
- Filtrar e selecionar pauta, salvar ou descartar oportunidade e escolher uma estrutura antes de gerar conteúdo.
- Preservar a ligação entre observações, tópico, fonte e post. Mostrar temas já utilizados pelo tenant para apoiar a decisão e reduzir repetição.

### SE-047 — Validar qualidade e resiliência do motor de Trends

Como responsável pelo produto, quero comprovar que o radar descobre e explica oportunidades reais antes de liberar o MVP.

**Dependências:** SE-020, SE-021 e SE-022.

**Aceite:**
- Validar dois nichos distintos, dois tipos de conector, coletas recorrentes reais e geração de conteúdo a partir de evidências rastreáveis; uma lista estática de links não atende ao aceite.
- Revisar uma amostra identificada por nicho, registrar relevância editorial, duplicatas, qualidade da extração, cobertura, atraso e consumo disponível; documentar ajustes e limitações do ranking.
- Testar falhas, extrator alterado, reinício, cota excedida, entrada maliciosa e acesso cruzado entre tenants, sem afetar indevidamente a fila de publicações.

**Demonstração:** radar explicável com histórico real, testes das regras temporais e pautas utilizáveis para dois influenciadores.

## Sprint 5 — Instagram e publicação confiável

**Objetivo:** publicar e agendar versões aprovadas com confirmação por destino.

### SE-023 — Conectar conta do Instagram

Como administrador, quero autorizar uma conta do influenciador para permitir distribuição e coleta de dados.

**Dependências:** SE-004 e SE-007; aplicativo, conta e permissões disponíveis.

**Aceite:**
- Concluir autorização real com validação de retorno e vincular a conta ao tenant correto, exibindo identidade e estado da conexão.
- Guardar tokens protegidos no servidor; tratar expiração, revogação e reconexão, sem transferir acesso entre tenants.

### SE-024 — Preparar campanha e autorizar destinos

Como publicador, quero escolher contas, versões e horário para autorizar a distribuição com clareza.

**Dependências:** SE-012, SE-018 e SE-023.

**Aceite:**
- Exibir prévia da versão aprovada, conta de destino e ação imediata ou horário; exigir permissão de publicação.
- Registrar a autorização separadamente da aprovação editorial e impedir destinos adicionais ou conteúdo alterado sem nova autorização aplicável.

### SE-025 — Implementar fila persistente

Como operador, quero que publicações agendadas sobrevivam a reinícios e sejam processadas sem duplicação evitável.

**Dependências:** SE-024.

**Aceite:**
- Persistir versão aprovada, destino, horário e chave de idempotência; reservar trabalho de forma atômica entre workers.
- Recuperar trabalhos após falha ou restart, com limite de tentativas e reconciliação antes de repetir operações de resultado incerto.

### SE-026 — Publicar e reconciliar no Instagram

Como publicador, quero confirmar o resultado real de cada envio para acompanhar o que entrou no ar.

**Dependências:** SE-025 e SE-023.

**Aceite:**
- Publicar carrossel real e registrar identificador retornado, status confirmado e link quando disponível.
- Testar erro de validação, credencial expirada, limite da rede e perda de resposta após envio. Casos não reconciliáveis exigem resolução manual, sem repetição cega.

### SE-027 — Operar o calendário de publicação

Como publicador, quero acompanhar e corrigir agendamentos para manter a programação editorial.

**Dependências:** SE-013, SE-025 e SE-026.

**Aceite:**
- Distinguir planejado, em revisão, aprovado, agendado, em processamento, publicado, falho, cancelado e pendente de reconciliação.
- Reagendar ou cancelar trabalhos elegíveis de forma auditada; proteger versões em distribuição contra alterações e tratar horários no fuso do espaço.

**Demonstração:** uma publicação imediata, uma agendada e uma falha recuperada, com confirmações reais e sem duplicar a peça.

## Sprint 6 — Análises, operação e piloto do MVP

**Objetivo:** concluir o fluxo até a medição e comprovar a operação em produção.

### SE-028 — Coletar métricas do Instagram

Como influenciador, quero conservar as medições dos meus posts para acompanhar seus resultados ao longo do tempo.

**Dependências:** SE-026 e SE-023.

**Aceite:**
- Coletar as métricas disponíveis com publicação, origem e horário da observação, preservando snapshots anteriores.
- Tratar métrica indisponível, token expirado e repetição da coleta sem inventar zeros nem duplicar a mesma observação.

### SE-029 — Exibir resultados e exportar histórico

Como influenciador, quero consultar resultados por período para decidir os próximos conteúdos.

**Dependências:** SE-028.

**Aceite:**
- Filtrar por período, conteúdo e rede; explicar a regra de agregação e não somar repetidamente contadores acumulados da mesma publicação.
- Exportar somente dados do tenant autorizado e distinguir alcance somado por post de pessoas únicas, assim como zero de indisponível.

### SE-030 — Validar continuidade e proteção de dados

Como operador, quero recuperação testada para preservar histórico e operação diante de falhas.

**Dependências:** SE-025 e SE-028; acesso à infraestrutura de backup.

**Aceite:**
- Executar backup e restauração de banco e arquivos em ambiente isolado e verificar integridade e isolamento dos dados restaurados.
- Testar restart/redeploy com trabalho pendente, preservando ownership, credenciais protegidas e estados. Registrar procedimentos de recuperação e monitoramento sem segredos.

### SE-031 — Executar piloto e liberar o MVP

Como responsável pelo produto, quero validar a solução com dois influenciadores para liberar uma operação utilizável.

**Dependências:** SE-047, SE-048, SE-027, SE-029, SE-030 e SE-043; definição de retenção, exclusão e atendimento.

**Aceite:**
- Executar fonte → IA → edição → revisão → publicação → métricas nos dois espaços; comprovar todos os critérios de liberação do MVP do PRD.
- Registrar tempo até aprovação, retrabalho, consumo/custo disponível, sucesso de publicação e atualização das coletas; corrigir falhas que comprometam segurança, conteúdo ou distribuição antes da liberação.

**Demonstração:** MVP no domínio oficial com evidências reais, resultados persistidos e recuperação validada.

### SE-043 — Entregar dashboard completo por tenant

Como influenciador e membro autorizado da equipe, quero uma visão geral do meu espaço para acompanhar produção, resultados e ações pendentes sem navegar por todas as telas.

**Dependências:** SE-022, SE-027, SE-029 e SE-042.

**Aceite:**
- Apresentar tenant ativo, filtros de período/rede, produção editorial, distribuição, resultados, gráficos e destaques, agenda, radar, conexões, uso de IA e atividade recente, conforme R14 do PRD.
- Identificar indicadores de estado atual separadamente dos indicadores do período; mostrar atualização, fonte e regra de cálculo. Evitar duplicação de snapshots e comparações sem base compatível.
- Permitir abrir o detalhe ou a listagem de cada indicador e executar ações rápidas conforme o papel. Pendências levam a revisão, conexão, publicação ou coleta correspondente.
- Validar troca rápida entre dois tenants, inclusive com respostas atrasadas, filtros, cache e chamadas diretas, sem mistura de dados ou permissões.
- Validar desktop, celular, teclado e estados de carregamento, erro, ausência de dados e integração pendente. A ausência de uma integração não será representada como resultado zero.
- Na expansão, integrar cada nova rede ao mesmo dashboard e preservar a identificação de métricas não comparáveis; essa integração faz parte do aceite de SE-032, SE-033, SE-038 e SE-039.

## Sprint 7 — Facebook e LinkedIn

**Objetivo:** ampliar a distribuição usando as permissões, fila e histórico existentes.

### SE-032 — Publicar no Facebook

Como publicador, quero distribuir conteúdo à Página autorizada do influenciador para ampliar a presença da marca.

**Dependências:** SE-031 e SE-004; acessos específicos da rede.

**Aceite:**
- Conectar Página autorizada, preparar arquivos e texto compatíveis e obter confirmação real de uma publicação.
- Integrar calendário, reconciliação, auditoria e coleta das métricas disponíveis, mantendo isolamento e autorização por destino.

### SE-033 — Publicar no LinkedIn

Como publicador, quero distribuir versões apropriadas ao LinkedIn para alcançar a audiência profissional.

**Dependências:** SE-031 e SE-004; acessos específicos da rede.

**Aceite:**
- Autorizar destino suportado e publicar texto, imagens ou documento conforme a versão preparada e os recursos concedidos à integração.
- Registrar confirmação real, tratar falhas e coletar métricas disponíveis pelo mesmo fluxo auditável das demais redes.

### SE-034 — Distribuir campanha em múltiplos destinos

Como publicador, quero aprovar adaptações por destino para distribuir uma campanha com uma única operação de envio.

**Dependências:** SE-032 e SE-033.

**Aceite:**
- Preparar, editar e aprovar adaptações específicas para Instagram, Facebook e LinkedIn antes de autorizar a distribuição conjunta.
- Acompanhar cada destino separadamente; repetir um destino falho não republica os que já tiveram sucesso.

**Demonstração:** campanha nas três redes, incluindo uma falha parcial tratada sem duplicação.

## Sprint 8 — Referências sociais e vídeo básico

**Objetivo:** ampliar materiais de entrada e preparar saídas em vídeo para a distribuição completa.

### SE-035 — Ingerir materiais do YouTube

Como editor, quero aproveitar um vídeo de referência para criar uma abordagem própria.

**Dependências:** SE-014 e SE-017; acesso autorizado ao material.

**Aceite:**
- Extrair ou receber transcrição/material acessível, preservando origem e referências temporais quando disponíveis.
- Solicitar transcrição ou arquivo quando a integração não puder ler o conteúdo; não afirmar que o vídeo foi analisado usando somente seus metadados.

### SE-036 — Ingerir Reels e carrosséis de referência

Como editor, quero usar referências sociais para orientar conteúdo e narrativa sem perder a originalidade.

**Dependências:** SE-015 e SE-017; material acessível ou enviado pelo usuário.

**Aceite:**
- Receber link ou arquivo e distinguir extração de conteúdo de análise de estrutura narrativa e visual.
- Salvar origem, tratar falhas de acesso e produzir abordagem própria com identidade do influenciador, mantendo a referência rastreável.

### SE-037 — Produzir vídeo básico editável

Como editor, quero transformar uma pauta em vídeo simples para publicar nos destinos que exigem esse formato.

**Dependências:** SE-017 e SE-018.

**Aceite:**
- Criar roteiro, sequência de cenas/slides, duração, legendas e áudio autorizado quando utilizado; permitir ajustes e renderizar arquivo compatível com os destinos escolhidos.
- Revisar e aprovar a versão renderizada; mudanças no vídeo ou na adaptação invalidam sua aprovação. Produção avançada e avatares permanecem fora do escopo.

**Demonstração:** referência acessível gera roteiro e vídeo original revisável; referência inacessível apresenta alternativa de entrada.

## Sprint 9 — TikTok, YouTube e distribuição completa

**Objetivo:** concluir o fluxo integrado das cinco redes previstas no PRD.

### SE-038 — Publicar no TikTok

Como publicador, quero enviar conteúdo original à conta autorizada para distribuir a versão preparada para o TikTok.

**Dependências:** SE-037, SE-034 e SE-004; permissões e revisões externas necessárias concluídas.

**Aceite:**
- Implementar autorização, prévia, escolhas e consentimentos exigidos pela integração e publicar um formato efetivamente suportado pelo acesso concedido.
- Confirmar o resultado e sua visibilidade esperada em conta real, tratar falhas e coletar métricas disponíveis. Upload privado ou pendente não comprova publicação pública.

### SE-039 — Publicar no YouTube

Como publicador, quero enviar um vídeo aprovado ao canal autorizado para distribuir conteúdo no YouTube.

**Dependências:** SE-037, SE-034 e SE-004; permissões necessárias disponíveis.

**Aceite:**
- Publicar vídeo compatível, com título, descrição, configurações e programação autorizadas; identificar a versão destinada a Shorts quando aplicável.
- Acompanhar processamento e confirmar publicação, registrando identificador e link; integrar reconciliação e métricas disponíveis.

### SE-040 — Unificar campanha e resultados nas cinco redes

Como influenciador, quero acompanhar todas as versões e publicações de uma campanha para entender sua distribuição.

**Dependências:** SE-038 e SE-039.

**Aceite:**
- Selecionar e revisar as adaptações de Instagram, Facebook, LinkedIn, TikTok e YouTube e autorizar seus destinos e horários numa operação de campanha.
- Exibir status e métricas por destino, com origem, disponibilidade e regra de cálculo. Falhas parciais e métricas não comparáveis não serão ocultadas numa soma única.

### SE-041 — Validar e entregar a expansão

Como responsável pelo produto, quero comprovar a distribuição completa para encerrar a implementação do PRD.

**Dependências:** SE-040, SE-035 e SE-036.

**Aceite:**
- Demonstrar campanha real nas cinco redes, com versões aprovadas, destinos autorizados, resultados confirmados e coleta das métricas disponíveis.
- Reexecutar os testes de isolamento e recuperação afetados pelas integrações e entregar documentação de operação, limites conhecidos e procedimentos de suporte.

**Demonstração:** operação completa por campanha, sem dependências de integração escondidas ou ações simuladas apresentadas como executadas.

## Rastreabilidade com o PRD

| Requisito | Stories principais |
| --- | --- |
| R01 — Multi-tenant | SE-002, SE-005 a SE-008, SE-031, SE-041 |
| R02 — Identidade | SE-009, SE-015, SE-017 |
| R03 — Radar | SE-019 a SE-022, SE-044 a SE-047 |
| R04 — Fontes | SE-010, SE-014, SE-035, SE-036 |
| R05 — Inspiração | SE-015, SE-017, SE-036 |
| R06 — Geração | SE-016, SE-017, SE-037 |
| R07 — Editor | SE-011, SE-017, SE-018, SE-037 |
| R08 — Revisão | SE-012, SE-024, SE-034, SE-037, SE-040 |
| R09 — Calendário | SE-013, SE-027, SE-034, SE-040 |
| R10 — Publicação | SE-023 a SE-027, SE-032 a SE-034, SE-038 a SE-041 |
| R11 — Análises | SE-028, SE-029, SE-032, SE-033, SE-038 a SE-040 |
| R12 — Auditoria | SE-007, SE-012, SE-013, SE-024 a SE-027, SE-030, SE-041 |
| R13 — Configurações por tenant | SE-042, SE-009, SE-023, SE-032, SE-033, SE-038, SE-039 |
| R14 — Dashboard por tenant | SE-043, SE-029, SE-031, SE-032, SE-033, SE-038, SE-039 |
| R15 — Blog do influenciador | SE-048 |

## Início da execução

Começar por **SE-001** e **SE-002**. Preparar **SE-003** e levantar os acessos de **SE-004** enquanto as dependências são resolvidas. Nenhuma story deste documento está concluída apenas por estar planejada.
