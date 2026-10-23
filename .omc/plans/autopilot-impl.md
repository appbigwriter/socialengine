# SocialEngine — plano de implementação

Data: 2026-10-22. Executar sem interrupções rotineiras; registrar dependências externas para retificação posterior, continuar trabalho independente e jamais converter teste simulado em aceite real. Preservar a stack Node/TypeScript/Fastify/PostgreSQL/React/Vite e o schema `custom_socialengine`.

Inspeção inicial confirmada: PostgreSQL 15.8, sete tabelas genéricas presentes, sem políticas RLS/funções. Estrutura observada registrada em `.omc/autopilot/spec.md`. Próximo passo de banco: confirmar contagens, índices, privilégios e ownership antes de migrations aditivas com colunas de escopo; não alterar `public`. Contrato Authority permanece pendente.

## Sequência e rastreabilidade das 48 stories

| Sprint | Stories | Implementação e verificação |
|---|---|---|
| 0 | SE-001, SE-002, SE-003, SE-004 | Inspeção não destrutiva do banco, mapa das sete tabelas e contrato de identidade; bootstrap em 09-codigo com build/test/dev/start, Docker e health/readiness; inventário de dependências externas. Guardar apenas nomes de variáveis e diagnósticos sanitizados. Não aplicar migrations antes da inspeção. |
| 1 | SE-005, SE-006, SE-007, SE-008, SE-048 | Adaptador de identidade verificável, sessão/logout, tenant/membership/papéis, blog, repositórios transacionais e isolamento banco/arquivo. Testes negativos com dois atores e dois tenants usando papel SQL sem bypass. Identidade Authority não confirmada bloqueia autenticação de produção e ownership real. |
| 2 | SE-009, SE-010, SE-011, SE-012, SE-013 | Marca, fontes/uploads privados, editor de slides estruturados, lock otimista, versões/revisão imutáveis, planejamento UTC/fuso e auditoria. Testar conflito 409, mudança invalidando aprovação, permissão por ação e retomada após restart. |
| 3 | SE-014, SE-015, SE-016, SE-017, SE-018, SE-042 | Extração PDF/texto; biblioteca de inspirações; interface IA com orçamento e chave própria criptografada; saída estruturada validada e regeneração de um slide; exportação de imagem/legenda/dados; configurações marca/blog/trends/contas/IA/cotas/equipe. Testar credenciais isoladas, revogação, erros, imagem renderizada e limites. Chamada real só com provedor disponível. |
| 4A | SE-044, SE-019, SE-045, SE-022 | Monitoramento por tenant; agendador persistente; conectores RSS/Atom e página pública; fetch seguro; extração versionada, canônica e deduplicação; painel saúde e reprocessamento. Testar restart, concorrência, duplicatas, robots/SSRF, limites e HTTP 200 vazio. Confirmar dois conectores reais quando fontes acessíveis forem configuradas. |
| 4B | SE-046, SE-020, SE-021, SE-047 | Observações temporais e cobertura; agrupamento explicável e ranking versionado; seleção/descarte e fonte→rascunho; séries conhecidas para crescimento/reset/falta de dados; piloto em dois nichos com extração e evidências reais. Não inferir tendência somente por recência. |
| 5 | SE-023, SE-024, SE-025, SE-026, SE-027 | OAuth Instagram com state/PKCE quando suportado e callback vinculado ao tenant; autorização de destinos; fila/leasing/idempotência/reconciliação; calendário/cancelamento. Implementar contratos de conector com estados honestos; confirmar carrossel real apenas com aplicativo e conta autorizados. |
| 6 | SE-028, SE-029, SE-030, SE-031, SE-043 | Snapshots analíticos, agregações/CSV privados; dashboard completo e responsivo; observabilidade e backup/restore/restart; piloto integral. Testar base temporal, métricas ausentes, rápida troca de tenant e requests atrasados. MVP só liberado após aceites reais inclusive restauração. |
| 7 | SE-032, SE-033, SE-034 | Conectores Facebook/LinkedIn, formatos próprios, OAuth/estado/revogação/métricas, adaptações e campanha com falhas parciais. Reusar fila/credenciais, sem duplicar os destinos bem-sucedidos. Não afirmar sucesso sem confirmação externa. |
| 8 | SE-035, SE-036, SE-037 | Entradas de referências YouTube/Reels/carrosséis com material enviado/transcrição autorizada; distinguir metadados de conteúdo lido; storyboard editável e vídeo básico renderizado vinculado à revisão. Testar vídeo/áudio autorizado e invalidar aprovação ao editar. |
| 9 | SE-038, SE-039, SE-040, SE-041 | TikTok/YouTube com consentimento, visibilidade e processamento próprios; campanha nas cinco redes e dashboard por destino; regressão de isolamento/recuperação e documentação de limites. Publicação privada/em processamento não comprova publicação pública. |

## Limites de implementação por faixa

- Fundação/segurança: `src/config`, `src/auth`, `src/db`, `migrations`, `scripts`, `tests/security`. Responsável por contrato, escopo transacional e arquivos privados. Nenhum consumidor deve criar queries fora do repositório escopado.
- Domínio/worker: `src/domain`, `src/jobs`, `src/integrations`, `src/trends`, `src/media`, testes correspondentes. Rotas enxutas autorizam e chamam serviços; workers obtêm contexto somente do job persistido e validam escopo atual antes de executar.
- Interface: `web/src` e testes de navegação/tenant. Consumir DTOs públicos; nenhuma variável server-only em bundle. Configurações mostram capacidades reais e pendências do servidor.
- Integração/qualidade: consolidar contratos, executar typecheck/build/test, testes PostgreSQL com papel restrito, smoke HTTP e UI, revisão de segredos/SQL/SSRF e documentação operacional. Evitar edição concorrente de arquivos centrais; dividir módulos e integrar em etapas.

## Contratos mínimos antes de implementar faixas

1. `AuthenticatedActor` contém identidade validada; `TenantContext` contém projeto, owner de catálogo, tenant e papéis derivados de membership. Rotas recebem tenant como seleção, nunca como prova de autorização.
2. Repositórios recebem contexto, executam transação e definem contexto RLS local à transação (sem vazamento no pool). Alinhar funções/políticas ao schema inspecionado. Papel administrativo reservado a inspeção/migration, nunca teste positivo de isolamento.
3. Versão editável contém slides, fonte(s), inspiração, marca, legenda, CTA e revisão. Aprovação/authorização identificam versão e conta; publicador valida imutabilidade antes de enviar.
4. Jobs têm tipo, contexto, chave idempotente, payload validado, estado, run_at UTC, tentativas, lease e resultado sanitizado. Reservar com operação atômica equivalente a `FOR UPDATE SKIP LOCKED`; distinguir erro transitório, permanente e resultado incerto.
5. Integrações expõem capacidades, autenticação/estado, validação de mídia, envio, reconciliação e métricas. Indisponibilidade explícita; não implementar um caminho genérico que finja publicar nas cinco redes.
6. DTOs de resultados carregam disponibilidade/origem/atualização; segredos nunca integram respostas. Erros públicos usam códigos e mensagens sanitizadas.

## Qualidade e evidência

Executar testes de lógica de permissões, contratos, revisão concorrente, cotas, sinais temporais e estados de jobs; testes integrados PostgreSQL são necessários para RLS/leases/restart. Testar fetch contra destinos internos, DNS privado e redirecionamento; upload contra formato/tamanho e acesso cruzado. Renderizar exemplos de slides e vídeo e inspecionar artefatos; teste unitário não comprova legibilidade ou formato externo.

Manter matriz de status para cada SE-001..SE-048 com evidência curta, testes e bloqueio externo. Verificar typecheck/build/test após integração, corrigir causas e repetir apenas checks afetados; revisão final de segurança, completude e qualidade. Revisões externas e publicação real permanecem pendentes se não houver acesso, sem interromper construção do restante.

## Crítica e riscos

- Maior risco é inventar identidade/owner para avançar: impedir acesso de produção por padrão até resolver Authority. Supabase Auth disponível não comprova vínculo com catálogo.
- Sete tabelas genéricas podem não ter índices/colunas necessários para RLS e fila: inspecionar primeiro, usar migração aditiva no schema exclusivo e documentar incompatibilidades. JSON flexível exige validação e índices por tipo, sem perder integridade de tenant.
- Uma conexão privilegiada mascara falhas de isolamento: testar papel restrito e negar startup operacional quando não houver garantia adequada.
- OAuth, auditorias das redes, DNS/TLS/DB e implantação são dependências externas; implementar adaptadores é trabalho útil, mas não encerra o aceite real.
- Renderização de imagens/vídeos e persistência de arquivos exigem bibliotecas/binários e disco durável; validar Docker cedo, limitar recursos e não guardar somente caminhos temporários.
- Coleta agressiva e ranking sem cobertura podem fabricar tendências; impor cotas separadas de publicação e preservar observações, deduplicação e incerteza.
- O prazo autônomo não autoriza publicar conteúdo sem aprovação/versionamento/destinos. Não expor segredos, deixar configuração incompleta com bypass ou ativar endpoint administrativo para facilitar demonstração.
