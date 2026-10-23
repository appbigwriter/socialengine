# SocialEngine — PRD

**Versão:** 1.0 · **Data:** 22/10/2026 · **Status:** escopo para execução.

## 1. Objetivo

Criar um motor de conteúdo multi-tenant para nossos influenciadores digitais: pesquisar oportunidades do nicho, transformar materiais em posts, aplicar referências narrativas e visuais, permitir edição e aprovação e distribuir versões adequadas para cada rede.

Salvar conteúdo, versões, aprovações, publicações e dados analíticos no Supabase self-hosted, com acesso controlado e histórico por influenciador.

**Resultado esperado:** reduzir o trabalho entre encontrar uma pauta e publicar um conteúdo original, preservando a identidade de cada influenciador.

## 2. Usuários e isolamento

- **Administrador:** gerencia influenciadores, membros, configurações e conexões.
- **Editor:** pesquisa, cadastra fontes, cria e edita conteúdos.
- **Revisor:** revisa, solicita ajustes e aprova versões.
- **Publicador:** distribui versões aprovadas e acompanha falhas.
- **Leitor:** consulta conteúdos e resultados.

Uma pessoa pode acumular permissões. O responsável pode administrar vários influenciadores, mediante vínculo explícito com cada espaço.

**Tenant = espaço de um influenciador.** Cada espaço terá marca, nicho, fontes, conteúdos, contas sociais, equipe e métricas próprios. Selecionar outro tenant na interface nunca concede acesso a ele.

Os papéis acima são permissões do produto. Seu vínculo com o Authority será definido pelo contrato da integração; tokens de integração não serão tratados como login de usuário.

## 3. Fluxo principal

1. Entrar e selecionar o influenciador.
2. Configurar público, nicho, objetivos, tom de voz, identidade visual e blog do influenciador.
3. Selecionar uma oportunidade do radar ou iniciar uma pauta própria.
4. Escolher o material-fonte: texto, notícia, PDF, YouTube, Reel, carrossel ou arquivo.
5. Escolher uma estrutura de inspiração e os formatos desejados.
6. Gerar e editar slides, imagens, legenda e chamada para ação.
7. Revisar e aprovar a versão final.
8. Selecionar destinos e publicar ou agendar.
9. Acompanhar o status por rede e os resultados disponíveis.

## 4. Requisitos e critérios de aceite

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| R01 | Acesso multi-tenant | Dois tenants de teste não conseguem consultar, alterar, exportar nem baixar arquivos um do outro, inclusive por requisições diretas. |
| R02 | Identidade do influenciador | Nome, nicho, público, tom de voz, cores e referências ficam salvos e são utilizados na criação. |
| R03 | Radar de pautas | Cada oportunidade apresenta assunto, fonte, data observada, relevância para o nicho e evidência disponível. Sem histórico suficiente, aparece como oportunidade, sem alegação de crescimento comprovado. |
| R04 | Biblioteca de fontes | Armazena origem, tipo, título, material disponível e arquivos privados. Quando um link não puder ser lido, solicita texto, transcrição ou arquivo; não inventa seu conteúdo. |
| R05 | Inspiração | Permite selecionar uma estrutura narrativa e uma referência visual. A saída usa conteúdo e identidade próprios, com registro da referência. |
| R06 | Geração por IA | Produz um carrossel com capa, desenvolvimento, conclusão, legenda e CTA a partir da fonte selecionada. Registra provedor, modelo, data, consumo e resultado da geração. |
| R07 | Editor | Permite editar textos, trocar imagens, adicionar, remover e reordenar slides e refazer um slide sem perder os demais. Exporta os arquivos necessários à publicação. |
| R08 | Revisão e versões | Mantém versões anteriores e registra autor, revisor, data e decisão. Alterar conteúdo aprovado exige nova aprovação. Edições concorrentes não sobrescrevem trabalho silenciosamente. |
| R09 | Calendário | Exibe conteúdo planejado, aprovado, agendado e publicado, distinguindo planejamento de agendamento confirmado. Salva horário em UTC e exibe no fuso do espaço. |
| R10 | Publicação | Publica apenas a versão aprovada e autorizada. Cada destino tem status, tentativas, erro e identificador ou link retornado pela rede. |
| R11 | Análises e histórico | Armazena coletas datadas e identifica sua origem. Exibe métricas disponíveis por conteúdo, rede e período; dados indisponíveis não aparecem como zero. |
| R12 | Auditoria | Registra alterações de acesso, conteúdo, aprovações e ações de publicação, sem incluir senhas ou tokens nos logs. |
| R13 | Configurações e integrações por tenant | Cada espaço possui uma área para gerenciar contas sociais, APIs permitidas, limites e preferências. Somente administradores autorizados alteram credenciais; segredos não são devolvidos ao navegador nem acessíveis a outro tenant. |
| R14 | Dashboard do tenant | Cada influenciador possui uma visão geral com indicadores de conteúdo e resultados, calendário, pendências, conexões, consumo e atividade recente. Os dados e ações respeitam tenant, papel, período e disponibilidade das integrações. |
| R15 | Blog do influenciador | O cadastro de cada influenciador inclui URL do blog, plataforma e estado de implantação. O vínculo é persistido por tenant e fica disponível para futuras integrações de leitura e publicação, sem habilitá-las automaticamente. |

### Motor de Trends — componente central do produto

O radar deve ter coleta automática e persistente, não depender apenas de pesquisas pontuais feitas pela IA. A especificação de execução está em [TRENDS.md](TRENDS.md).

**Fluxo:** fontes configuradas → fila de coleta → API/feed/raspagem permitida → extração → normalização e deduplicação → observações históricas → classificação por nicho → pauta → conteúdo.

- Cada tenant configura nichos, subnichos, palavras-chave, exclusões, idioma, região, referências e frequência dentro das cotas da plataforma.
- Usar conectores por tipo de fonte: APIs disponíveis, RSS/Atom, páginas públicas com extração suportada e materiais enviados. Fontes sociais e seus dados dependerão do acesso real concedido.
- Guardar origem, horários, método de extração, texto ou trecho permitido, estado da coleta, métricas disponíveis e observações ao longo do tempo.
- Agrupar republicações da mesma notícia; não tratar cópias como evidências independentes de uma tendência.
- Calcular sinais de crescimento apenas em janelas comparáveis, separando relevância editorial, intensidade do sinal e confiança da evidência. Ausência de coleta não representa queda de interesse.
- Mostrar fontes, última atualização, motivo da sugestão e limitações. A IA ajuda a interpretar e propor ângulos; não substitui a medição dos sinais.
- Operar coletas no servidor com limites, cache, retentativas, alertas e bloqueio de acesso a endereços internos. Respeitar regras de acesso e limites de cada fonte; acesso negado será exibido como indisponível.

O MVP precisa demonstrar coleta real recorrente por pelo menos dois tipos de conector acessíveis, extração útil, histórico de observações e ranking para dois nichos distintos. O conjunto inicial de fontes e a cadência serão definidos na configuração do piloto. Uma lista estática de links não atende ao requisito.

### Cadastro do blog do influenciador

Adicionar a seção **Blog** no cadastro e nas configurações do influenciador, contendo:

- URL principal do blog.
- Estado: a definir, em implantação, ativo ou inativo.
- Plataforma/CMS: informada pelo administrador, incluindo opção ainda não definida.
- URL do feed RSS/Atom, quando disponível.
- Idioma e associação ao tenant e ao influenciador.
- Estado da integração futura: não configurada, conectada ou com falha, conforme o conector existir.

Permitir salvar o influenciador enquanto o blog está em implantação, mas exigir uma URL HTTP/HTTPS válida para marcá-lo como ativo. Validar URLs e preservar o vínculo ao editar o cadastro, exportar os dados ou reiniciar a aplicação.

Nesta entrega, o escopo do blog é cadastro e persistência. Leitura de artigos como fonte, reaproveitamento editorial, publicação e métricas do blog são integrações futuras. Não presumir WordPress nem armazenar credenciais de CMS em campos comuns do cadastro. Ler ou publicar no blog dependerá de configuração e autorização específicas.

### Dashboard de cada tenant

O **Dashboard** será a tela inicial do influenciador selecionado. Deve responder: o que estamos produzindo, o que precisa de atenção, o que será publicado e quais resultados já foram obtidos.

| Bloco | Conteúdo e ações |
| --- | --- |
| Identificação e filtros | Influenciador ativo, fuso, período de análise e filtro de rede. Trocar de tenant limpa dados e requisições do contexto anterior. |
| Produção editorial | Contagens e acesso aos rascunhos, revisões pendentes e conteúdos aprovados. Indicar quando o indicador representa o estado atual, independentemente do período analítico. |
| Distribuição | Publicações agendadas, confirmadas, falhas e pendentes de reconciliação, com acesso ao detalhe por destino. |
| Resultados | Alcance, visualizações, interações, salvamentos e compartilhamentos conforme disponibilidade. Mostrar origem, período e atualização; taxas e comparações precisam informar sua fórmula e base. |
| Gráficos e destaques | Distribuição de publicações por rede/formato, evolução de indicadores quando houver histórico adequado e conteúdos de maior resultado segundo uma métrica selecionada. |
| Agenda | Próximos conteúdos e horários no fuso do tenant, distinguindo planejamento editorial de publicação agendada. |
| Radar | Oportunidades recentes do nicho, com fonte, confiança e ação para iniciar conteúdo. |
| Pendências e conexões | Revisões aguardando ação, falhas de geração/publicação, contas desconectadas, credenciais expiradas e coletas desatualizadas. |
| Uso de IA | Consumo, limite e saldo de cota disponível do tenant; custo somente quando calculável. Acesso às configurações conforme permissão. |
| Atividade recente | Criações, alterações, aprovações e publicações registradas em auditoria, com autor e horário quando disponíveis ao usuário. |
| Ações rápidas | Criar conteúdo, adicionar fonte, abrir revisão e consultar calendário. Exibir apenas ações permitidas ao usuário. |

Os cartões devem levar à listagem ou ao detalhe que explica o número apresentado. Estados sem dados, integração pendente e falha de carregamento serão distintos. Dados de demonstração nunca serão misturados aos dados reais.

Não somar snapshots acumulados para fabricar evolução diária, nem apresentar alcance entre redes como pessoas únicas. Comparações entre períodos só aparecem com bases compatíveis; métricas não disponíveis permanecem identificadas como indisponíveis.

O dashboard será responsivo e respeitará as permissões do espaço. Uma eventual visão consolidada de todos os tenants para a administração da plataforma constitui escopo separado deste dashboard.

### Área de configurações por tenant

Cada influenciador terá o menu **Configurações**, com:

- **Marca e preferências:** identidade, público, nicho, objetivos, tom de voz, fuso e padrões de conteúdo.
- **Blog:** endereço, plataforma/CMS, feed quando disponível e estado de implantação; preparação para integrações futuras.
- **Trends:** fontes e referências, palavras-chave, exclusões, região, idioma e frequência de coleta dentro dos limites concedidos.
- **Contas sociais:** conectar, consultar estado, reconectar e desconectar Instagram, Facebook, LinkedIn, TikTok e YouTube conforme os conectores forem entregues. Usar autorização oficial da rede, sem solicitar a senha da conta social.
- **APIs e IA:** selecionar provedores suportados e utilizar a integração disponibilizada pela plataforma ou cadastrar uma chave própria do tenant, quando permitido. Exibir estado, resultado do teste de conexão e opção de substituir ou revogar a chave; nunca recuperar o segredo salvo pela interface.
- **Consumo e limites:** consultar uso e limites do espaço. O administrador do tenant pode configurar limites dentro do teto concedido pela plataforma, sem elevar sua própria cota.
- **Equipe e permissões:** gerenciar vínculos e papéis do espaço.

Credenciais próprias serão protegidas no servidor, com criptografia e gestão de chaves separada dos dados, ou por um gerenciador de segredos. A tabela `settings` guardará apenas preferências e referências aos segredos. Conexões e testes devem usar a credencial do tenant ativo, sem recorrer silenciosamente à credencial de outro espaço.

As credenciais centrais de Supabase, Authority, Control Tower e dos aplicativos OAuth das redes pertencem à operação da plataforma e não serão configuráveis pelos tenants. O uso de uma API compartilhada exige política explícita de acesso e atribuição de consumo por espaço.

Desconectar uma conta ou revogar uma chave impede novos usos e identifica trabalhos pendentes afetados, preservando histórico e auditoria. A habilitação dos controles acompanha a entrega de cada conector; um controle de configuração não comprova integração funcionando.

### Regras de publicação e análise

- Aprovar conteúdo não autoriza destinos adicionais. Publicar ou agendar exige selecionar contas, versões e horário.
- Preparar adaptações por rede: um carrossel não será enviado como se fosse um vídeo do YouTube.
- Uma falha em um destino não deve duplicar publicações nos demais.
- Antes de repetir uma operação com resultado incerto, consultar o estado na rede. Quando não houver confirmação possível, encaminhar para resolução manual.
- Métricas acumuladas de uma publicação não serão somadas repetidamente entre coletas. O painel identificará a janela analisada e a regra de cálculo.
- Informações extraídas das fontes serão tratadas como dados, nunca como instruções para alterar permissões ou executar ações.

## 5. Entregas por etapa

### Etapa 1 — Fundação e criação manual

- Validar conexão, tabelas existentes e contrato do Authority.
- Implementar autenticação, vínculos, papéis e seleção de tenant.
- Implementar identidade da marca, biblioteca, editor, versões e revisão.
- Preparar persistência de publicações, coletas e auditoria.
- Executar testes de isolamento no banco, servidor e arquivos.

**Concluída quando:** dois influenciadores operam em espaços isolados e conseguem criar, revisar e recuperar o histórico de um conteúdo.

### Etapa 2 — Inteligência e geração

- Conectar um provedor de IA configurável no servidor.
- Implementar extração de texto e PDF e geração de carrosséis editáveis.
- Implementar biblioteca inicial de estruturas narrativas e visuais.
- Conectar o radar a fontes acessíveis do nicho, com coleta recorrente, extração, deduplicação e observações históricas conforme [TRENDS.md](TRENDS.md).
- Registrar referências, consumo, falhas e limites por tenant.

**Concluída quando:** uma fonte real gera uma peça editável, com origem e consumo registrados; o radar apresenta oportunidades verificáveis.

### Etapa 3 — MVP operacional: Instagram

- Conectar contas autorizadas do Instagram.
- Implementar publicação e agendamento por fila, com validação do arquivo final.
- Coletar métricas disponíveis e apresentar seu histórico.
- Testar falhas, confirmação de publicação e recuperação após reinício.
- Implantar no ambiente oficial e executar piloto com dois influenciadores.

**Concluída quando:** o fluxo fonte → criação → aprovação → publicação → coleta funciona com conteúdo e contas reais, com evidências registradas.

### Etapa 4 — Distribuição completa

- Adicionar Facebook, LinkedIn, TikTok e YouTube, conforme acesso às integrações.
- Implementar ingestão de referências sociais e YouTube quando houver acesso ao material.
- Produzir adaptações de carrosséis e vídeos para cada destino.
- Unificar aprovação, calendário e acompanhamento das publicações.

**Concluída quando:** uma campanha aprovada pode ser distribuída às cinco redes, respeitando os formatos e requisitos de cada integração.

**Fora do MVP:** cobrança por assinatura, aplicativo móvel, caixa de mensagens, anúncios pagos, avatares e produção avançada de vídeos. A distribuição completa permanece no escopo do projeto, na etapa 4.

## 6. Arquitetura e dados

### Infraestrutura definida

| Item | Definição |
| --- | --- |
| Repositório | https://github.com/appbigwriter/socialengine.git |
| Pasta local | `F:\Projetos\_FBR\SocialEngine` |
| Código implantável | `/09-codigo` no repositório |
| Banco | Supabase central self-hosted |
| Schema exclusivo | `custom_socialengine` |
| Project ID | `6dccc6dd-880f-4148-921a-08cbe8a1f219` |
| Hospedagem | VPS2 · Easypanel · projeto `sistemas` · serviço `social` |
| Domínio | https://socialengine.fbr.news |
| Saúde | https://socialengine.fbr.news/health |
| Runtime | `HOST=0.0.0.0` · `PORT=3000` |

### Organização da aplicação

- **Interface:** painel, biblioteca, editor, revisão, calendário e análises.
- **Servidor:** autenticação e autorização, operações do banco, geração e integrações.
- **Worker:** execução da fila de publicação, confirmação de resultados e coleta de métricas.
- **Banco e arquivos:** registros persistentes, histórico e armazenamento privado.

### Contrato de persistência

Inspecionar e reutilizar o contrato existente antes de criar migrations. O documento de infraestrutura prevê estas tabelas no schema exclusivo:

| Tabela | Uso previsto, sujeito à estrutura existente |
| --- | --- |
| `entities` | Influenciadores, espaços e entidades do domínio. |
| `entity_relations` | Vínculos entre usuários, espaços e demais entidades. |
| `records` | Conteúdos, fontes, versões, publicações e coletas, identificados por tipo. |
| `files` | Metadados e localização dos arquivos privados. |
| `settings` | Marca, preferências e configurações sem segredos. |
| `audit_logs` | Trilhas de auditoria. |
| `events` | Eventos de processamento e integração. |

O mapeamento acima é uma proposta funcional, não uma afirmação sobre as colunas existentes. Índices, restrições e eventual necessidade de tabelas adicionais serão definidos após a inspeção.

Registros do domínio devem carregar `project_id`, `owner_id` e o identificador do tenant. O `owner_id` seguirá a identidade definida pelo catálogo/Authority; não será presumido igual ao usuário autenticado. Relações não podem ligar registros de tenants diferentes.

Não criar nem alterar tabelas de governança em `public`. O acesso pelo PostgREST só será habilitado se fizer parte da arquitetura aprovada.

### Segurança e continuidade

- Autorizar cada operação no servidor e aplicar isolamento no banco com RLS e privilégios mínimos. Uma conexão privilegiada que contorne RLS não contará como isolamento validado.
- Manter service role, tokens Authority, credenciais de IA e tokens sociais no servidor, fora do frontend, Git e logs.
- Proteger arquivos por tenant. Usar acesso autenticado ou URLs temporárias quando necessário.
- Preservar ownership, configurações e filas após restart e redeploy.
- Configurar backups de banco e arquivos e executar um teste de restauração antes do piloto.
- Definir retenção, exclusão e responsável pelo atendimento antes de liberar o serviço aos influenciadores.

## 7. Dependências e decisões pendentes

| Pendência | Necessária para |
| --- | --- |
| Resolver acesso SQL; a inspeção inicial recebeu encerramento inesperado da conexão | Inspecionar o contrato e aplicar migrations. |
| Confirmar origem de `owner_id`, identidade do usuário e validação do Authority | Implementar acesso e ownership corretamente. |
| Confirmar estrutura real das sete tabelas previstas | Fechar o modelo de persistência. |
| Escolher provedor/modelo de IA e disponibilizar credencial no servidor | Habilitar geração e estabelecer limites de consumo. |
| Disponibilizar contas, aplicativos e permissões das redes | Publicar e coletar resultados reais. |
| Disponibilizar acesso ao deploy e validar armazenamento e backups | Implantar e operar o piloto. |

Situação observada em 22/10/2026: Supabase Auth respondeu HTTP 200; `custom_socialengine` não estava disponível pelo PostgREST; o `/health` da aplicação respondeu HTTP 502. Revalidar durante a implantação.

## 8. Validação e ordem de execução

1. Resolver as dependências de banco e identidade.
2. Inspecionar o ambiente e documentar o mapeamento de dados.
3. Executar a etapa 1 e seus testes de isolamento.
4. Executar a etapa 2 com fontes reais e controle de consumo.
5. Executar a etapa 3 e validar o MVP no ambiente oficial.
6. Corrigir problemas do piloto e executar a etapa 4.

### Critérios para liberar o MVP

- [ ] Isolamento comprovado entre pelo menos dois tenants, incluindo arquivos e acesso direto.
- [ ] Papéis testados: usuário sem permissão não aprova nem publica.
- [ ] Configurações e credenciais próprias isoladas por tenant, com teste real de conexão, substituição e revogação; nenhuma chave salva é devolvida ao navegador.
- [ ] Dashboard por tenant validado em desktop e celular, com indicadores rastreáveis, filtros coerentes, pendências acionáveis e ausência de dados cruzados entre espaços.
- [ ] Radar validado com coleta real recorrente em dois tipos de conector, extração, histórico, deduplicação, classificação por nicho e indicação de falhas e confiança.
- [ ] Cadastro do blog disponível por influenciador, com URL validada para blogs ativos e persistência isolada por tenant.
- [ ] Geração, edição, revisão e histórico funcionando com persistência real.
- [ ] Alteração de conteúdo aprovado invalida a aprovação anterior.
- [ ] Publicação real no Instagram com identificador confirmado e tratamento de falhas.
- [ ] Métricas disponíveis coletadas com origem e data, sem valores fabricados.
- [ ] Restart/redeploy preserva conteúdo, ownership, configurações e trabalho pendente.
- [ ] Nenhum segredo presente no repositório, frontend ou logs.
- [ ] Backup e restauração testados.
- [ ] `/health` retorna HTTP 200 quando a aplicação está pronta; indisponibilidade das dependências essenciais retorna estado de falha, sem expor detalhes secretos.

**Indicadores do piloto:** tempo entre fonte e aprovação, proporção de peças aprovadas sem retrabalho, custo de geração por peça, sucesso de publicação e atualização das coletas. Medir uma linha de base antes de estabelecer metas de desempenho ou crescimento.
