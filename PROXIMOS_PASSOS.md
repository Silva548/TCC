# Próximos Passos — Sistema de Vendas Carvão Dois Irmãos

Atualizado em: 30/09/2026
Status atual: segunda rodada de auditoria aplicada. Tudo abaixo marked `[x]` já
está no código e coberto por teste.

## 1. Subir o ambiente e testar ponta a ponta 🔴 (bloqueador)

- [x] Instalar/iniciar PostgreSQL local
- [x] Corrigir credenciais do `.env` e documentar todas as variáveis em `.env.example`
- [x] Gerar `SESSION_SECRET` e torná-lo obrigatório fora de `development`
- [x] **Aplicar schema:** `npm run migrate` (o app NÃO usa mais `sequelize.sync()`)
- [x] Popular dados: `npm run seed`
- [x] Iniciar: `npm start` → http://localhost:3000
- [ ] Testar o fluxo completo a olho: login → CRUDs → pedidos (HTML) → relatório → logout

> ⚠️ Se o banco `carvao_dois_irmaos` já existia com tabelas criadas pelo antigo
> `sync()`, as migrations conflitarão ("relation already exists"). Para ambiente
> de dev, o caminho simples é recriar: `DROP DATABASE` + `CREATE DATABASE` +
> `npm run migrate` + `npm run seed`.

## 2. Qualidade ✅

- [x] ESLint configurado e limpo (`npm run lint`) — inclui os globais do runtime
      Node usados pelos testes
- [x] `lint:views` valida a sintaxe de todos os templates (`ejslint views`)
- [x] `npm test` roda a suíte unitária **e** a de integração (113 testes)
- [x] Banco de teste isolado (`DB_NAME_TEST`), preparado pelo `pretest` e
      recusado se for igual ao banco de desenvolvimento
- [x] Suíte de integração sem dependência nova: sobe o app real e fala HTTP
- [x] Cobertura de estoque, unicidade, CSRF, RBAC e FK `RESTRICT`

## 3. Documentar a API 🟡

- [x] Tabela de rotas (HTML x JSON) no `README.md`
- [ ] Swagger/OpenAPI para os endpoints JSON de pedidos e do relatório de vendas

## 4. Melhorias de produção 🟢

- [x] Sessões persistentes em PostgreSQL (connect-pg-simple)
- [x] RBAC: gestão de usuários restrita a admins (`requireRole('admin')`)
- [x] `carregarUsuario` reidrata papel/nome a cada requisição e derruba a
      sessão de conta removida ou rebaixada
- [x] SRI nos recursos de CDN e CSP restrita a uma única origem
- [x] Erros 500 carregam o `requestId` na tela e no JSON, e o log do servidor
      guarda a stack completa
- [ ] Fazer push dos commits locais para `origin/main`

## 5. Deploy 🟢

- [ ] Escolher hospedagem (Render/Railway com Postgres gerenciado, ou VPS)
- [ ] Configurar variáveis de produção (`NODE_ENV=production`, `SESSION_SECRET`,
      `DATABASE_URL` com `sslmode=require`, `TRUST_PROXY` se houver proxy)
- [ ] Rodar `npm run migrate` no pipeline de deploy (nunca `sync()`)
- [ ] Trocar a senha `admin123` do seed em qualquer ambiente que não seja local

## Mudanças da segunda auditoria (30/09/2026)

| Achado | Correção |
|---|---|
| App não subia: `express` exportado sem existir | Removido de `utils/responder.js` |
| `npm test` não rodava no Node 24 (glob de arquivos) | Scripts corrigidos + `.env` de exemplo |
| Estoque podia ficar negativo com o mesmo produto em 2 linhas | Agregação por `produto_id` antes de validar |
| Valor acima do `DECIMAL` virava erro 500 do Postgres | `utils/limites.js` com os limites de cada coluna |
| String acima do `VARCHAR` era cortada pelo banco, sem aviso | Mesmo util, com mensagem de erro na view |
| Excluir cliente com pedidos perdia o histórico | `ON DELETE RESTRICT` + bloqueio no controller |
| Sessão sobrevivia a rebaixamento de admin ou conta removida | `carregarUsuario` no pipeline |
| N+1 ao devolver estoque, dentro de transação travada | Uma leitura com `IN` em vez de um `findByPk` por item |
| `client_id`/`status` inválidos viravam 500 | Validação de query antes do controller |
| CSRF respondia texto puro a quem esperava JSON | `erro()` com content negotiation |
| CDNs sem SRI em três origens | `integrity` + `crossorigin`, tudo em jsdelivr, CSP apertada |
| `div` do container nunca fechada no layout | Fechada; teste conta as tags do HTML final |
| Link de paginação desabilitado ainda clicável (`?page=0`) | `<span>` em vez de `<a>` quando desabilitado |
| Filtro se perdia ao trocar de página | `queryExtra` no parcial de paginação |
| 500 sem rastro para o usuário | `requestId` na tela e no corpo do JSON |
| `DATABASE_URL` ignorado pelo app (só o CLI lia) | `config/db.js` lê a URL, com precedência e TLS |
| `ejs-lint` declarado mas binário inexistente | `ejslint` instalado e script corrigido |
| `database_postgres.sql` descrevia schema obsoleto | Regenerado do banco migrado, com aviso de instantâneo |

## Entregas desta rodada

- **UI web de pedidos** em `/pedidos`, no mesmo path da API: lista com filtro e
  paginação, formulário com 6 linhas fixas (sem JavaScript), detalhe com as
  transições válidas e cancelamento/exclusão com devolução de estoque.
- **`services/pedidoService.js`**: a regra de escrita de pedido (criar, mudar
  status, excluir) deixou de estar no controller e passou a ser uma única
  implementação usada pela API e pela web — a duplicação já tinha custado um
  bug de estoque.
- **Testes**: 133 no total, incluindo a UI de pedidos, o contrato
  HTML/JSON no mesmo path, as recusas de exclusão por FK e a guarda de
  credencial padrão.

## Correção de 30/09/2026 — recusa de exclusão por FK

O tratamento de violação de chave estrangeira nos controllers de cliente,
produto e categoria testava `err.name.includes('ForeignKeyConstraintError')`.
Essa classe só é lançada pelos validadores do próprio Sequelize; a recusa que
interessa aqui vem do **PostgreSQL**, que responde `23001` (`restrict_violation`)
embrulhada em `SequelizeDatabaseError`. O nome nunca casava, então o tratamento
era código morto e as três exclusões bloqueadas terminavam em 500 — inclusive a
"categoria informada não existe" ao salvar um produto com `categoria_id`
inexistente, que era onde a tela mais precisava da mensagem.

- `utils/dbErros.js` identifica a violação pelo SQLSTATE (`23001` e `23503`),
  aceitando o erro em `original` ou `parent` e ainda a classe do Sequelize.
- As recusas voltaram para a listagem com a mensagem num `alert`, em vez de
  `res.status(400).send(texto)`, que no navegador abria uma página de texto puro
  no meio da interface.
- A mensagem de cliente passou a dizer que é preciso **excluir** os pedidos:
  cancelá-los não libera a exclusão, porque o pedido continua apontando para o
  cliente.
- A contagem de pedidos e o `destroy` não são atômicos; um pedido criado entre
  os dois agora devolve a mesma mensagem em vez de 500.
- Coberto por 6 testes de `dbErros` e 5 de integração, incluindo um que injeta
  `<script>` na query para confirmar que a mensagem é escapada.


## Correção de 30/09/2026 — admin com senha padrão não sobe em produção

O seed já sorteava a senha do admin em produção, mas isso não cobre o caminho
que mais leva a uma credencial previsível: criar o banco em desenvolvimento
(onde a senha é `admin123`), exportar um dump e promover para produção. O seed é
idempotente, então ele não roda de novo — o admin já existe e a senha padrão
entra no ar sem aviso.

- `utils/credenciais.js` compara a senha do admin contra a lista de senhas
  padrão conhecidas com `bcrypt.compare` (não dá para ler o hash de volta).
- `server.js` recusa subir em produção quando a confere, com `exit 1` e a
  orientação de troca. Verificado no boot real: com `admin123` o processo
  termina antes de abrir listener; com a senha trocada, sobe normalmente.
- `ADMIN_SENHA` passou a ser respeitada pelo seed, para o operador escolher a
  senha em vez de depender do log de uma vez.


## Fora do escopo (decisões consciente)

- **Edição dos itens de um pedido existente.** O estoque já foi baixado e o
  preço foi congelado em `itens_pedidos.preco_unitario`; editar exigiria
  reverter e reaplicar estoque dentro de uma transação nova, e a API não tem
  endpoint correspondente. Hoje a tela só oferece mudar o status, cancelar e
  excluir. Se for preciso, treat como projeto próprio.
- **Relatório de vendas em HTML.** A rota é só JSON por enquanto; dar uma view
  a ela exige extrair as agregações para o service, como foi feito com a escrita.
- **Confirmação em JavaScript ao excluir.** A CSP não permite script inline
  (`scriptSrc` sem `'unsafe-inline'`), então um `onsubmit="confirm(...)"` seria
  bloqueado em silêncio e a exclusão aconteceria sem aviso. O botão é
  explicitamente rotulado. Uma confirmação em duas etapas exigiria JS ou uma
  tela intermediária.
