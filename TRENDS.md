# SocialEngine — Motor de Trends

**Status:** especificação para implementação · **Base:** R03 do [PRD](PRD.md).

## 1. Objetivo

Encontrar sinais relevantes do nicho antes de gerar conteúdo. O motor deve descobrir, extrair, organizar e acompanhar assuntos; a IA transforma evidências em sugestões editoriais.

Tratar três coisas separadamente: **coleta de sinais**, **extração de conteúdo** e **detecção de tendência**. Um título descoberto não equivale a um artigo lido; um artigo recente não comprova crescimento do assunto.

## 2. Configuração por tenant

- Nichos e subnichos, público, idioma e região.
- Termos acompanhados, sinônimos e termos excluídos.
- Sites, feeds, canais, perfis e assuntos de referência.
- Conectores e credenciais autorizados para aquele espaço.
- Frequência, janela de observação, limite de itens e orçamento de coleta/IA dentro da cota da plataforma.
- Fontes ativadas/pausadas e preferências de alerta no dashboard.

Credenciais, fontes privadas, preferências e ranking são isolados por tenant. Otimizar coletas públicas compartilhadas só poderá ocorrer com política explícita e acesso controlado, sem compartilhar material privado ou contexto editorial entre influenciadores.

## 3. Estratégia de conectores

| Conector | Descoberta | Extração e limites |
| --- | --- | --- |
| RSS/Atom | Novos itens e atualizações de fontes cadastradas | Usar o conteúdo permitido no feed; buscar a página apenas quando o acesso e o extrator estiverem habilitados. |
| API oficial ou provedor autorizado | Consultas e metadados disponíveis no acesso concedido | Registrar campos efetivamente retornados, credencial/cota utilizada e limitações. |
| Página pública | URLs iniciais, listagens ou sitemaps configurados | Extrair texto principal e metadados com regras por domínio; renderização quando tecnicamente necessária e permitida. Não percorrer a web sem limite. |
| Material enviado | URL, texto, imagem, PDF ou vídeo fornecido pelo usuário | Distinguir referência salva de conteúdo processado. Extrair apenas formatos suportados e solicitar material complementar quando necessário. |

No MVP, ativar pelo menos dois tipos de conector que funcionem com fontes reais acessíveis. RSS/Atom e extração de páginas públicas são candidatos iniciais; a escolha final deve ser comprovada no piloto. APIs sociais e referências audiovisuais são adicionadas conforme acesso e processamento forem entregues.

Não prometer leitura de qualquer Instagram, TikTok ou YouTube. Um conector pode obter metadados sem ter acesso à mídia ou transcrição. Nenhum acesso negado será contornado por coleta de sessão pessoal, quebra de CAPTCHA ou bypass de paywall.

Para raspagem, registrar as condições de uso/acesso da fonte e respeitar robots.txt, limites e escopo configurados. Robots.txt não será interpretado como autorização suficiente para reutilizar conteúdo. Restringir tamanho, tempo, redirecionamentos e endereços de destino; verificar também cada redirecionamento para impedir acesso à rede interna.

## 4. Processamento

1. **Agendar:** criar trabalho persistente por fonte e janela, com prioridade e tenant.
2. **Descobrir:** consultar fonte e registrar o identificador/URL do item encontrado.
3. **Extrair:** produzir texto e metadados, ou registrar que apenas metadados estavam disponíveis.
4. **Normalizar:** idioma, datas, URL canônica, autor e conteúdo, sem executar scripts ou instruções da fonte.
5. **Deduplicar:** comparar identificador externo, URL e conteúdo; agrupar republicações e acompanhar atualizações do mesmo item.
6. **Observar:** salvar o sinal disponível e seu horário sem sobrescrever o histórico.
7. **Agrupar assuntos:** associar itens ao mesmo tópico, preservando evidências e a origem de cada associação.
8. **Classificar:** calcular relevância para o tenant, intensidade do sinal e confiança separadamente.
9. **Apresentar:** mostrar oportunidades, evidências, atualização, limitações e possíveis ângulos de abordagem.
10. **Converter:** ao selecionar uma pauta, vincular o material à biblioteca e ao post para manter rastreabilidade.

O resultado de cada etapa precisa poder ser reprocessado sem criar duplicatas. Alterar extrator ou critério de classificação registra sua versão para explicar diferenças futuras.

## 5. Dados mínimos

| Registro lógico | Campos essenciais |
| --- | --- |
| Fonte | Tenant, tipo de conector, domínio/identificador, configuração de acesso, frequência, estado e última execução. |
| Execução | Fonte, início/fim, estado, tentativa, itens descobertos/processados, erro e consumo disponível. |
| Item | Identificador externo, URL canônica, autor quando disponível, datas publicadas/observadas, idioma e agrupamento de duplicatas. |
| Extração | Item, método/versão, estado, campos extraídos, trecho/texto permitido, referência ao arquivo quando houver e motivo de falha. |
| Observação | Item/tópico, horário, tipo/unidade do sinal, valor disponível, fonte e janela coberta. Valor ausente permanece ausente. |
| Tópico e ranking | Tenant, assunto, evidências, critérios/versão, relevância, sinais, confiança, classificação e motivo da recomendação. |
| Decisão editorial | Pauta selecionada, descartada ou adiada, ator, motivo opcional e vínculo com conteúdo produzido. |

Mapear os registros às tabelas do contrato existente em `custom_socialengine` antes de criar migrations. Não criar estruturas de governança em `public`.

Reter somente material permitido e necessário para o produto. Definir prazo para conteúdo bruto, observações e logs antes do piloto; preservar evidência suficiente para rastrear as recomendações.

## 6. Detecção e ranking

### Relevância editorial

Considerar nicho/subnicho, público, idioma, região, atualidade e utilidade. Explicar o vínculo da pauta com o influenciador. Assunto popular fora do nicho não deve dominar o radar.

### Intensidade do sinal

Conforme disponibilidade, observar frequência de novas menções em fontes independentes e variação temporal de métricas públicas comparáveis. Definir unidade, janela e linha de base de cada sinal antes de calcular crescimento.

Contadores acumulados só produzem velocidade pela diferença entre observações válidas. Ajustar pela idade do conteúdo quando aplicável. Redução da cobertura do coletor não comprova queda de interesse. Valores de redes ou provedores com definições distintas não serão somados diretamente.

### Confiança

Avaliar qualidade, atualidade, diversidade e cobertura das evidências. Cem republicações do mesmo texto não equivalem a cem fontes independentes. Conteúdo do blog do próprio influenciador pode apoiar a produção, mas não comprova, sozinho, uma tendência externa.

### Estados apresentados

- **Oportunidade recente:** relevante e atual, mas sem evidência temporal suficiente.
- **Em observação:** há sinais a acompanhar; cobertura ou histórico ainda insuficientes.
- **Em crescimento:** regra de crescimento atendida com observações comparáveis e cobertura suficiente.
- **Estável ou em desaceleração:** classificação sustentada por histórico comparável.
- **Desatualizada/indisponível:** a coleta não sustenta uma avaliação atual.

Parâmetros, pesos e limiares devem ser configuráveis e versionados. Calibrar no piloto; não declarar pontuação como probabilidade de viralização. Comparar rankings entre versões com um conjunto de casos conhecidos e avaliação editorial.

## 7. Experiência do radar

Cada cartão mostra tema, resumo, nicho, fontes, primeira/última observação, estado, relevância, confiança e motivo da sugestão. O detalhe apresenta a linha do tempo disponível e os limites da evidência.

Filtrar por tema, região, idioma, período e estado. Permitir salvar, descartar e transformar em conteúdo. Sinalizar temas já utilizados pelo tenant para reduzir repetição editorial.

O dashboard mostra oportunidades e saúde das fontes. Erros operacionais sensíveis ficam restritos aos papéis apropriados.

## 8. Operação e aceite do piloto

- Usar fila persistente, reservas atômicas de trabalho, cache, limites por origem/tenant e retentativas espaçadas para falhas transitórias.
- Pausar ou alertar quando uma fonte perde acesso ou o extrator deixa de obter os campos esperados; uma execução HTTP 200 vazia não comprova extração correta.
- Reconciliar trabalhos após reinício e limitar concorrência e consumo de IA; não afetar o processamento de publicações por excesso de coleta.
- Medir sucesso de descoberta/extração, duplicatas, atraso da coleta, cobertura e custo disponível, além da avaliação editorial das pautas.
- Testar indisponibilidade, conteúdo alterado, duplicação, republicações, contadores reiniciados, dados ausentes, redirecionamentos inseguros e instruções maliciosas no material.
- Demonstrar duas configurações de nicho e fontes reais com execuções recorrentes. Testar regras temporais com séries conhecidas, claramente identificadas como testes, e observar o histórico real coletado no piloto.
- Não concluir a entrega com links estáticos, sinais inventados ou coleta simulada apresentada como real.

## Referências técnicas

- [YouTube Data API — videos.list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list): parâmetros e campos disponíveis devem ser verificados na implementação; não representa acesso irrestrito a todos os sinais do nicho.
- [Google — princípios de crawling](https://developers.google.com/crawling/docs/about-crawling): referência para controle de recrawl, cache e respeito às preferências de acesso. A implementação deve validar também as regras de cada fonte escolhida.


## Catálogo de fontes sugeridas — implementado em 23/10/2026

O Radar possui a aba **Fontes sugeridas**, com 44 feeds em inglês de 26 editores, comunidades e provedores. São 13 temas: notícias, redes sociais, fóruns, espiritualidade, viagens, tecnologia/IA, marketing/creators, saúde, negócios, cultura/lifestyle, ciência/ambiente, educação e tendências. Há busca, filtro por tema e indicação de fontes já adicionadas no influenciador ativo.

O catálogo faz parte do código e não cria assinaturas nem registros de coleta automaticamente. “Adicionar fonte” abre um formulário com URL, nome, termos em inglês, idioma, região e intervalo inicial de seis horas. O usuário ajusta os termos ao nicho e confirma as condições de acesso. A assinatura usa a API existente, com escopo de tenant, permissões e limite de 30 fontes. A interface sinaliza fontes existentes e a API rejeita cadastros sequenciais do mesmo URL canônico no mesmo tenant; o mesmo feed pode ser escolhido por tenants diferentes. Não há nova migration.

### O que pode ser monitorado hoje

- **RSS / Atom:** notícias, blogs, pesquisas e feeds temáticos. O coletor lê até 40 entradas por rodada, usando os textos/resumos efetivamente disponibilizados pelo editor; não busca automaticamente o artigo completo de cada entrada.
- **HTML público:** extração do conteúdo principal de uma página específica, com texto suficiente. Não é um crawler de todo o site e não contorna login, paywall, bloqueio ou restrições de robots.txt.
- PDFs, textos e materiais de referência pertencem à Biblioteca de fontes; não são conectores de monitoramento recorrente do Radar.
- Perfis, hashtags e popularidade no Instagram/TikTok/YouTube e APIs de comunidades exigem conectores próprios e contratos de acesso. Google Trends Trending Now já possui RSS para EUA/Reino Unido; séries históricas e filtros de Explore têm acesso separado. Nenhum desses sinais é simulado. Crescimento continua dependendo de histórico comparável.

### Seleção, acesso e verificação

Foram mantidos apenas os 44 feeds que retornaram entradas válidas pelo coletor de produção, com as proteções de rede, robots.txt, formato e tamanho existentes. Os testes de rede ocorreram em 23/10/2026; disponibilidade futura e acesso a partir da VPS podem variar. O relatório contém apenas URL, data, contagem de entradas e resultado, sem republicar os materiais: `09-codigo/docs/trend-catalog-validation.json`.

Fontes que falharam na verificação foram removidas, incluindo endereços com 404, XML inválido, tamanho excessivo, DNS recusado ou crawl-delay acima do limite. Não foram reduzidas proteções para fazê-las funcionar.

A disponibilidade técnica não concede direitos de republicação. Os cartões e o formulário apontam as condições do editor. A BBC exige permissão para uso comercial; isso é destacado antes da ativação. O MIT News tem requisitos de atribuição e condições separadas para imagens. Nenhuma imagem é importada pelo catálogo. Fontes institucionais de fornecedores, como Google, são identificadas como tais.

Referências primárias: [feeds do MIT News](https://news.mit.edu/rss), [política do MIT News](https://news.mit.edu/terms-of-use), [termos da BBC — seção sobre RSS](https://downloads.bbc.co.uk/usingthebbc/bbc_terms_of_use_19September2022english.pdf). Os próprios feeds dos demais editores estão registrados no catálogo e no relatório.

Para revalidar a partir do diretório `09-codigo`: `npm run trends:verify-catalog`. É um comando manual de rede; não é executado no build nem nos testes offline. O relatório atualizado fica em `.data/trend-catalog-check.json`; revise-o antes de substituir a evidência versionada.


### Ampliação de cobertura — notícias, redes sociais, fóruns, espiritualidade e viagens

A seleção inicial tinha 25 fontes e concentrava-se em tecnologia e pesquisa. A ampliação adiciona 13 fontes verificadas e dá nomes explícitos às cinco categorias solicitadas:

| Categoria | Fontes disponíveis |
| --- | --- |
| Notícias (3) | NPR Top Stories, BBC World, Al Jazeera |
| Redes sociais (3) | Social Media Today, TechCrunch Social e conta oficial do Mastodon |
| Fóruns (2) | Hacker News e Discourse Meta |
| Espiritualidade (4) | Lion’s Roar (budismo), Tiny Buddha (reflexões pessoais), Mindful (atenção plena secular), Baha’i Teachings (perspectiva bahá’í) |
| Viagens (3) | Nomadic Matt, Travel Off Path e Skift |

Os cartões identificam **conteúdo editorial**, **tópicos de fórum** e **publicações da conta**. O filtro apresenta uma explicação da cobertura de cada nova categoria. Fontes sobre redes sociais não são apresentadas como coleta de perfis ou hashtags; o Mastodon fornece publicações de uma conta específica por RSS. A documentação oficial descreve [RSS de perfis públicos do Mastodon](https://docs.joinmastodon.org/user/network/#rss) e [feeds de fóruns Discourse](https://meta.discourse.org/t/finding-discourse-rss-feeds/264134).

O parser RSS passou de `rss-parser-v1` para `rss-parser-v2`: posts sem título, como os do Mastodon, usam um trecho de até 140 caracteres do conteúdo como identificação, com `titleOrigin=content_excerpt`. Títulos originais mantêm `titleOrigin=feed`. Entradas sem título e sem texto suficiente continuam excluídas, assim como links internos/inválidos. O histórico já gravado não é reescrito; as novas extrações registram a nova versão.

As 38 fontes passaram pelo coletor real após essa alteração. Candidatas bloqueadas por robots.txt, DNS restrito ou frequência incompatível foram excluídas. A ampliação não ativa assinaturas dos tenants, não altera suas fontes existentes e não exige migration.


### Diretório de agências, repercussão e ferramentas — implementação atual

**44 feeds coletáveis** e **21 opções no diretório informativo** são contagens distintas: o diretório inclui provedores que ainda não podem ser conectados. Ele fica em **Radar → Fontes sugeridas → Explorar agências, redes e ferramentas**, com busca e filtro por tipo.

- **Agências:** Reuters e Associated Press, com caminhos oficiais para Reuters Connect e AP Media API. Os conectores não estão implementados; não existe RSS genérico inventado nem requisição paga automática.
- **Jornais:** NYT e Financial Times possuem feeds tecnicamente verificados e podem abrir o formulário existente de revisão. WSJ foi bloqueado por robots.txt e Washington Post retornou HTTP 502 na rodada documentada. Guardian e Le Monde aparecem com a exigência de autorização comercial de suas páginas oficiais, sem ativação pelo diretório.
- **TV e mídia global:** BBC, Al Jazeera, DW e France 24 possuem RSS verificado. O feed candidato da CNN falhou no estabelecimento da conexão TLS e ficou como coleta não validada, sem afirmar indisponibilidade permanente do veículo.
- **Repercussão:** Reddit r/worldnews, r/news, r/geopolitics e X estão identificados como API com integração pendente. No Reddit, acesso à API e uso comercial dependem de aprovação; no X, também é necessário prever credenciais, cobrança por uso e orçamento. Uma comunidade ou post não é apresentado como notícia verificada.
- **Ferramentas:** Google Trends possui RSS Trending Now; TikTok Creative Center está disponível como consulta externa; Pinterest Trends e Perplexity apontam documentação de APIs, com conectores pendentes. Perplexity é pesquisa e síntese, sem atribuir a ele uma métrica de popularidade.

As opções pendentes oferecem links oficiais para consulta, sem formulário de credenciais nem botão que simule uma conexão existente. A seleção de RSS continua explícita por tenant, com termos do nicho, frequência e confirmação das condições de acesso. RSS verificado não concede licença de reutilização nem acesso a artigos com paywall.

#### Google Trends Trending Now

- Feeds em inglês para EUA (`geo=US`) e Reino Unido (`geo=GB`), com região visível no cartão e no formulário. Eles acompanham pesquisas em alta no Google; não representam automaticamente buscas no YouTube nem a série de interesse relativo de 0 a 100 do Explore.
- A estimativa `ht:approx_traffic` é preservada como texto em `searchSignal.rawApproximateTraffic`, somente quando o conteúdo vem da URL HTTPS oficial de Trending Now. Não é convertida em contagem exata, percentual de crescimento, intensidade ou popularidade em outra rede.
- `growthComparable=false`; as observações continuam sem uma medida quantitativa comparável. O ranking mantém crescimento nulo até existir uma série com unidade, janela e cobertura adequadas.
- Os itens do feed compartilham uma URL. `discoveryKey` combina provedor, país e fingerprint do termo para preservar consultas diferentes e atualizar o histórico do mesmo termo, sem unir EUA e Reino Unido.
- O feed pode trazer apenas consulta, data, estimativa e link. O sistema não inventa o corpo de uma reportagem. Ao criar um rascunho, o material permanece como metadados; a geração exige uma fonte complementar com texto efetivamente extraído.
- No sandbox, uma fonte Google Trends gerou **10 itens e 10 pautas distintos**, todos com estimativa e crescimento nulo; nenhuma falha da origem foi registrada.

#### Evidências e qualidade

A verificação registra agora também a data de publicação mais recente do feed. Isso permite distinguir funcionamento técnico de atualização editorial: NPR Health e Nomadic Matt receberam notas sobre ausência de atualização recente na verificação de 23/10/2026, sem apagar assinaturas existentes. O destaque inicial prioriza alternativas mais recentes.

- `09-codigo/docs/trend-catalog-validation.json`: 44 feeds com itens válidos e datas de publicação encontradas.
- `09-codigo/docs/global-news-validation.json`: sete candidatos de veículos globais, incluindo falhas documentadas de WSJ, Washington Post e CNN.
- Testes: proveniência da estimativa do Google, ausência de crescimento fabricado, separação de consultas/países e impossibilidade de abrir formulário RSS para provedores pendentes.

Referências oficiais: [Reuters Connect](https://reutersagency.com/content-delivery-platforms/reuters-connect/), [AP Media API](https://api.ap.org/media/v/docs/Getting_Started_API.htm), [Guardian RSS](https://www.theguardian.com/help/feeds), [Le Monde RSS](https://www.lemonde.fr/en/about-us/article/2026/03/27/le-monde-rss-feeds_6751860_115.html), [Reddit Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy), [X API](https://docs.x.com/x-api/getting-started/pricing), [Google Trending Now e exportação RSS](https://support.google.com/trends/answer/3076011?hl=en), [Google Trends API alpha](https://developers.google.com/search/apis/trends), [Pinterest Trends API](https://developer.pinterest.com/docs/analytics-and-reports/trends/), [Perplexity API](https://docs.perplexity.ai/docs/getting-started/overview).
