# Integrações sociais

Implementação de OAuth, credenciais protegidas, envio HTTP oficial, reconciliação e métricas disponíveis. **Não homologada em contas reais**: aplicativos, permissões, domínio/callback, auditorias e credenciais precisam ser configurados. Os testes usam transporte HTTP identificado como mock; nenhuma publicação real foi realizada.

## Configuração de servidor

- Instagram: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` (credenciais do produto Instagram Login, não presumir que sejam as do Facebook).
- Facebook: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_VERSION` (YYYYMM suportado).
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. `TIKTOK_PUBLIC_POSTING_APPROVED=true` somente depois de auditoria/validação operacional; a variável não concede permissões na rede.
- YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`.
- Meta: `META_GRAPH_VERSION` explícita (`vNN.N`) conforme o aplicativo. Não fixamos uma versão como atualmente disponível sem homologação.
- Infraestrutura já prevista: `SOCIALENGINE_ENCRYPTION_KEY`, domínio público HTTPS, Supabase Auth, owner confirmado no catálogo e contrato Authority habilitado.

Registrar exatamente os cinco callbacks HTTPS: `/api/social/instagram/callback`, `/api/social/facebook/callback`, `/api/social/linkedin/callback`, `/api/social/tiktok/callback`, `/api/social/youtube/callback` no domínio oficial. Nenhum endpoint aceita segredos de aplicativo do navegador.

`GET /api/tenants/:id/accounts/:platform/connect` autenticado como admin retorna `{authorizationUrl,expiresAt}` e cookie HttpOnly SameSite=Lax (Secure fora do sandbox). A interface navega para a URL. Estado persistente é criptograficamente vinculado a ator/tenant/cookie, expira em dez minutos e é consumido atomicamente. Callback revalida Authority e papel atual; os tokens permanecem em credentials(kind=oauth), com AES-GCM/AAD por projeto/owner/tenant/plataforma/conta. Não guardar/verificar códigos OAuth em logs.

Para mídia puxada pela rede, a aplicação oferece capacidade opaca de entrega com vinte minutos de validade em `/api/social/media/...`. O endpoint revalida o ator e usa os mesmos arquivos privados. Configurar logs do servidor/proxy para **omitir URLs completas de callback e mídia**, que carregam códigos/estados/capacidades temporárias. Não tratar essas URLs como arquivos públicos permanentes. TikTok requer domínio/prefixo verificado no portal.

## Publicação e limites

- Instagram: 2–10 slides renderizados ou vídeo Reel aprovado; criação de children/container, consulta de processamento e media_publish. Uma mídia ainda em processamento não é exibida como publicação concluída. Limite conservador de dez slides até homologação da conta/versão.
- Facebook: texto e múltiplas fotos via uploads não publicados e feed de Página autorizada; vídeos de Página ainda não habilitados neste adaptador.
- LinkedIn: texto ou multiImage orgânico via Images/Posts API; não equivale a carrossel publicitário. Documentos/PDF e vídeo ainda não habilitados. Publicação por perfil da pessoa autenticada; organizações exigem conector/permissões adicionais.
- TikTok: vídeo PULL_FROM_URL, consulta atual de creator_info, privacidade escolhida e consentimento explícito por publicação; sem escolha automática. Sem auditoria, somente SELF_ONLY pode ser tentado. O usuário precisa preencher as opções de divulgação/consentimento exigidas pela rede e concluir a homologação de UX antes de liberação de produção.
- YouTube: vídeo por upload resumable, título/descrição e visibilidade explicitamente autorizada. Estado permanece processing até consulta confirmar processamento e visibilidade. Privado ou não listado não prova publicação pública; verificar restrições do aplicativo antes de liberação.

Payload `job.payload.socialOptions`: YouTube `{privacyStatus:'public'|'private'|'unlisted',madeForKids:boolean}`; TikTok `{explicitConsent:true,privacyLevel:string,disableComment?:boolean,disableDuet?:boolean,disableStitch?:boolean}`. O endpoint editorial recebe um mapa por accountId e o worker usa somente as opções do destino autorizado.

Antes de cada envio, confirmar papel, conta conectada e revisão aprovada atual. Persistir tentativa antes de efeitos externos. Falta de resposta implica erro `uncertain:true`; nunca repetir cegamente. Reconciliação de um container Instagram que possa ter sido publicado sem resposta fica para resolução manual. `POST /api/tenants/:id/publications/:publicationId/reconcile` revalida a aprovação antes de qualquer novo efeito. `.../metrics` coleta snapshots horários sem converter ausências em zeros.

Métricas iniciais: Instagram likes/comments; Facebook reactions/comments/shares; YouTube views/likes/comments; TikTok views/likes/comments/shares quando ID e permissão disponíveis. LinkedIn permanece explicitamente indisponível sem analytics concedido. Demais indicadores ficam null. Coleta recorrente/reconciliação precisa ser conectada ao agendador (`publication.metrics`, `publication.reconcile`), respeitando quotas e políticas de retenção.

## Fontes primárias consultadas em 22/10/2026

- [Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server)
- [YouTube resumable uploads](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol)
- [LinkedIn OAuth/OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api)
- [TikTok Login web](https://developers.tiktok.com/docs/en/login-kit-web)
- [TikTok tokens](https://developers.tiktok.com/docs/en/oauth-user-access-token-management)
- [TikTok Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post)
- [TikTok status](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status)
- [Meta Instagram business login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login) e [Pages posts](https://developers.facebook.com/docs/pages-api/posts/): páginas primárias retornaram HTTP 429 nesta sessão; validar contrato/escopos/versão no aplicativo antes de habilitar produção. A implementação precisa de homologação real e não representa confirmação da versão mais recente.
