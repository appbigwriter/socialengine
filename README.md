# SocialEngine

Motor editorial multi-tenant para influenciadores digitais, com fontes, carrosséis editáveis, revisão, Trends e integrações sociais.

- [PRD](PRD.md)
- [Sprints e Stories](SPRINTS.md)
- [Motor de Trends](TRENDS.md)
- [Deploy em VPS com Easypanel](DEPLOY-EASYPANEL.md)
- [Variáveis de ambiente sem segredos](.env.example)

## Execução local

Requer Node.js 24. Dentro de `09-codigo`:

```sh
npm ci
npm run build
npm test
npm run dev
```

O comando `dev` inicia um sandbox explícito em `http://127.0.0.1:3000`, com PostgreSQL embutido e dados de teste separados em `.data/sandbox`. Não conecta o banco de produção nem comprova publicações reais.

## Produção

Usar o Dockerfile de `09-codigo`, volume persistente em `/app/data`, porta interna 3000 e as variáveis configuradas no Easypanel. Seguir o roteiro de deploy antes de liberar usuários.

O processo expõe `/live` para liveness e `/health` para readiness. Identity/ownership e integrações precisam estar configurados para a operação de produção. Não habilitar autenticação sandbox em produção.

As integrações sociais possuem adaptadores e testes de contrato, mas a homologação em contas reais depende dos aplicativos, permissões e credenciais de cada rede.
