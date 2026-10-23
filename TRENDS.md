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
