# Ateliê das Esmeraldas

Vitrine online de pedras preciosas e joias exclusivas, com catálogo dinâmico e painel administrativo para o dono gerenciar produtos, ofertas e fotos sem mexer em código.

![HTML5](https://img.shields.io/badge/HTML5-vanilla-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-vanilla-1572b6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20modules-f7df1e?logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%C2%B7%20Auth%20%C2%B7%20Storage-3ecf8e?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados](#modelo-de-dados)
- [Segurança](#segurança)
- [Como rodar localmente](#como-rodar-localmente)
- [Painel administrativo](#painel-administrativo)
- [Deploy](#deploy)
- [Limpeza automática de fotos](#limpeza-automática-de-fotos)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Backup](#backup)
- [Manutenção automática](#manutenção-automática)
- [Roadmap](#roadmap)

## Visão geral

O projeto é um site estático (HTML, CSS e JavaScript puros, sem etapa de build) que lê o catálogo de um banco Supabase em tempo de execução. O dono da loja administra tudo pelo painel em `/admin`: o que ele publica ali aparece no site na hora.

| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS e JavaScript puros (sem framework e sem build) |
| Banco de dados | Supabase Postgres com Row Level Security (RLS) |
| Autenticação | Supabase Auth (e-mail e senha, cadastro público desativado) |
| Fotos | Supabase Storage (bucket `produtos`) |
| Hospedagem | Vercel (site estático) |
| Automação | GitHub Actions |

## Funcionalidades

### Site público

- **Banner de abertura** com cena do ateliê e, em seguida, os produtos escolhidos pelo dono (até 5), com transição suave entre as cenas.
- **Carrossel "Ofertas imperdíveis"** (até 8 ofertas) com efeito de água nas fotos. Ofertas além do limite continuam nas fileiras, com etiqueta de desconto.
- **Fileiras de pedras e joias** com rolagem horizontal.
- **"Crie a sua joia"** (encomendas): passo a passo em 5 etapas (peça, metal, pedra, detalhes, prazo e orçamento). Para alianças, pede par ou unidade, aro e gravação. No fim, mostra um resumo e envia o pedido pronto para o WhatsApp do ateliê. Nada é gravado no banco.
- **"Do ateliê até a sua casa"**: as 5 etapas da entrega. No computador, uma linha ondulada se desenha por trás dos ícones; no celular, uma linha vertical acompanha a rolagem.
- **Cartão de contato**: o visitante escreve a mensagem e o botão abre o WhatsApp com o texto pronto.
- **Dock fixo** na parte de baixo: Pesquisar, **Crie sua joia** (em destaque), Ofertas (com a quantidade) e WhatsApp. Recolhe ao rolar para baixo e volta ao rolar para cima.
- **Folha do produto**: o card se expande em uma janela com galeria de fotos (deslizar, setas e indicadores), título, descrição e preço.
- **Pesquisa** que filtra os produtos por nome e descrição.
- **Selos de confiança** animados e CNPJ da empresa.
- **Produtos vendidos** (estoque 0) ficam marcados como "Vendido" e saem das ofertas e do banner.
- Fotos com fallback: se uma foto ainda não estiver no Storage, o site usa a cópia local de `img/`.
- Compatível com Safari no iPhone (cantos arredondados do banner e rolagem).

### Painel administrativo

- Login seguro, exclusivo para quem está na tabela `admins`.
- **Trocar senha** (botão "Senha" no topo): confere a senha atual, mostra as regras enquanto o dono digita e desconecta os outros aparelhos ao salvar.
- **Esqueci a senha** na tela de login: envia um link por e-mail que abre direto a tela de criar a senha nova. A resposta é sempre a mesma, para não revelar quais e-mails são de administradores.
- Criar, editar, esconder e apagar produtos.
- Oferta com preço original, preço promocional e desconto calculado, com data de término opcional.
- Várias fotos por produto, com **compressão automática no navegador** (WebP, 1600 px na versão cheia e 500 px na miniatura, mantendo transparência).
- Opção **"Mostrar no banner"**, com foto própria para o banner.
- Controle de estoque e ordem de exibição.

## Arquitetura

```
Navegador (visitante)                         Navegador (dono)
        │                                            │
        │ chave pública (anon)                       │ login (Supabase Auth)
        ▼                                            ▼
  ┌───────────────────────────────────────────────────────────┐
  │                         Supabase                          │
  │  Postgres + RLS  ·  Auth  ·  Storage (bucket "produtos")  │
  └───────────────────────────────────────────────────────────┘
        ▲
        │ ping 2x por dia
  GitHub Actions
```

- O site nunca recebe uma chave com poder de escrita. Ele usa só a chave pública (`anon`), e quem decide o que pode ser lido ou alterado é o RLS no banco.
- O painel usa a mesma chave pública, mas só consegue escrever depois do login, e somente se o usuário constar em `admins`.
- Não há servidor próprio: o front-end fala direto com a API do Supabase.

## Estrutura do projeto

```
.
├── index.html              Página pública
├── style.css               Estilos do site
├── script.js               Navbar, carrossel, banner, folha do produto, pesquisa, "Crie a sua joia", contato e dock
├── produtos.js             Lê o catálogo do Supabase e monta fileiras, carrossel e banner
├── ripple.js               Efeito de água do carrossel
├── comprimir-imagem.js     Compressão de fotos no navegador (WebP)
├── admin/                  Painel administrativo (acessado em /admin)
│   ├── index.html
│   ├── admin.css
│   ├── admin.js            Login e navegação do painel
│   ├── lista.js            Lista de produtos
│   ├── form.js             Cadastro e edição de produto
│   ├── senha.js            Trocar senha e criar senha nova (recuperação)
│   ├── validacao.js        Validação dos campos e regras da senha
│   └── config.js           URL do projeto, chave pública e limites
├── vendor/                 Dependências locais (supabase-js e ogl)
├── img/                    Imagens de apoio e fallback dos produtos
├── supabase/
│   ├── functions/limpar-fotos/   Edge Function que apaga fotos do bucket
│   └── migrations/               Todo o banco em SQL, na ordem de aplicação
├── vercel.json             Cabeçalhos de segurança (CSP e outros)
├── .vercelignore           Lista do que PODE ir para o ar (o resto fica fora)
└── .github/workflows/      Automações (ping do Supabase)
```

## Modelo de dados

**`produtos`** (leitura pública apenas dos ativos)

| Campo | Descrição |
|---|---|
| `id` | Identificador |
| `nome`, `titulo`, `descricao`, `detalhes` | Textos exibidos no card e na folha do produto |
| `categoria` | `pedra` ou `joia` |
| `cor` | Tom do destaque: esmeralda, safira, rubi, ametista, topázio ou diamante |
| `preco`, `preco_original` | Preço atual e preço antes da oferta |
| `oferta`, `oferta_ate` | Marca de oferta e data de término opcional |
| `fotos` | Caminhos das fotos no bucket `produtos` |
| `no_banner`, `foto_banner` | Exibição no banner do topo e foto própria dele |
| `estoque` | `0` significa vendido |
| `ativo`, `ordem` | Visibilidade e ordem de exibição |

**`admins`**: usuários autorizados a escrever. A função `is_admin()` é usada pelas políticas de RLS.

**Storage**: bucket `produtos`, leitura pública, escrita apenas para administradores, aceita JPG, PNG e WebP de até 5 MB. O admin só envia para a pasta de um produto (`<uuid>/<arquivo>`), não sobrescreve arquivos e só apaga foto que nenhum produto usa.

## Segurança

- **RLS ativo** nas tabelas: o público só lê produtos ativos; criar, editar e apagar exige ser admin.
- **Cadastro público desativado** no Supabase Auth. Novos administradores são criados manualmente.
- **Senha forte**: o painel exige 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo. A mesma regra precisa estar configurada no Supabase (**Authentication → Policies**), porque a checagem do painel sozinha não impede quem chama a API direto.
- **Trava contra apagamento em massa**: o banco recusa um único comando que apague mais de 3 produtos, o `TRUNCATE` e um único comando que troque as fotos (ou a foto do banner) de mais de 3 produtos, porque trocar fotos apaga os arquivos antigos do bucket. Esconder, reordenar ou mudar preço de vários de uma vez continua liberado. O painel mexe em um produto por vez e não é afetado. Para fazer em massa de propósito, use o SQL Editor:
  ```sql
  begin;
  set local app.apagar_em_massa = 'sim';
  delete from public.produtos where ...;   -- ou: update public.produtos set fotos = ... where ...;
  commit;
  ```
- **Fotos protegidas no Storage**: o admin só apaga do bucket uma foto que nenhum produto usa. Para uma foto sumir, ela precisa sair do produto antes, e aí as travas acima valem também para o Storage. Uma sessão roubada não consegue esvaziar o bucket de uma vez.
- **Funções novas no banco nascem fechadas**: só `postgres` e `service_role` podem executá-las. Se o navegador precisar chamar uma função nova, dê `grant execute` explícito (como em `is_admin`).
- **Content Security Policy** restritiva em `vercel.json` (scripts apenas do próprio domínio, sem inline), além de `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`.
- **Dependências locais** em `vendor/`, sem scripts carregados de CDNs.
- **`/admin` fora dos buscadores** (`noindex, nofollow`).
- **Nenhuma chave secreta no código ou no histórico.** A chave pública (`anon`) é pública por desenho e fica no front-end.
- Textos vindos do banco são escapados antes de entrar no HTML.
- `.vercelignore` funciona como lista do que pode ser publicado: arquivos internos (`.env`, `README.md`, `supabase/`, `.github/` etc.) nunca vão para o ar.

Encontrou uma vulnerabilidade? Avise o responsável pelo projeto de forma privada, sem abrir uma issue pública.

## Como rodar localmente

Não há instalação nem build. Basta servir a pasta com qualquer servidor estático:

```bash
npx serve .
```

Depois acesse `http://localhost:3000` (site) e `http://localhost:3000/admin` (painel).

O projeto já aponta para o Supabase configurado em `produtos.js` e `admin/config.js`. Para usar outro projeto, troque `SUPABASE_URL` e `SUPABASE_ANON_KEY` nesses dois arquivos, usando **somente a chave pública (anon)**.

> Os arquivos usam ES modules; abrir o `index.html` direto pelo disco (`file://`) não funciona no painel. Use sempre um servidor local.

### WhatsApp do ateliê

O número `5511963799306` aparece 6 vezes: 4 no `index.html` (botão e telefone do cartão de contato, dock e botão final do "Crie a sua joia") e 2 no `script.js` (mensagem do contato e pedido do "Crie a sua joia"). Para trocar, procure por `963799306` e altere todas. O número fica no código, e não no banco, de propósito: quem invadir o painel não consegue desviar o atendimento.

As opções do "Crie a sua joia" (peças, metais, pedras, prazos e faixas de orçamento) estão no `index.html`, na seção `#encomenda`. Cada botão tem um `data-v` com o texto que vai para a mensagem.

## Painel administrativo

Acesse `/admin` e entre com e-mail e senha de um usuário cadastrado em `admins`.

**Adicionar um novo administrador**

1. No Supabase, vá em **Authentication → Users** e crie o usuário (e-mail e senha com 12+ caracteres).
2. Insira o `id` desse usuário na tabela `admins`.

**Fluxo do dia a dia**

1. Clique em novo produto e preencha nome, categoria, preço e descrição.
2. Envie as fotos: a compressão acontece automaticamente.
3. Para ofertas, ative a opção de oferta e informe o preço original.
4. Para destacar no banner, ative **Mostrar no banner** (máximo de 5 produtos).
5. Salve. O produto aparece no site imediatamente.

**Limites**

| Item | Limite |
|---|---|
| Tomadas no banner | 5 |
| Ofertas no carrossel | 8 (as demais ficam nas fileiras) |
| Tamanho de cada foto enviada | 5 MB |

## Deploy

O site é estático: qualquer commit na branch `main` pode ser publicado na Vercel.

1. Importe este repositório na Vercel.
2. Framework preset: **Other**. Sem comando de build e sem pasta de saída específica (raiz do projeto).
3. O `vercel.json` aplica os cabeçalhos de segurança e o `.vercelignore` define o que é publicado. Não há variáveis de ambiente.
4. Aponte o domínio da loja para o projeto.

> **Arquivo novo no site?** Acrescente-o ao `.vercelignore` com `!` na frente (ex.: `!novo-arquivo.js`). Arquivos fora dessa lista dão 404 no ar, de propósito.

Via linha de comando, a partir da pasta do projeto:

```bash
vercel deploy --prod
```

**Se o domínio mudar**, atualize no Supabase (**Authentication → URL Configuration**):

- **Site URL**: o domínio novo, por exemplo `https://dominio-da-loja.com.br`.
- **Redirect URLs**: só `https://dominio-da-loja.com.br/admin/**`, sem curinga solto e sem `localhost`.

Sem isso, o link do "Esqueci a senha" leva para o endereço antigo.

## Limpeza automática de fotos

Quando um produto é apagado, ou uma foto (ou a foto do banner) é trocada, o bucket `produtos` não guarda os arquivos antigos. O painel já apaga as fotos pelo navegador; a automação no banco é a rede de segurança para quando isso falha.

```
produtos (DELETE / UPDATE de fotos) → trigger → pg_net → Edge Function limpar-fotos → API do Storage
```

- **Triggers** em `produtos` (`AFTER DELETE` e `AFTER UPDATE OF fotos, foto_banner`) chamam a função de forma assíncrona. Qualquer erro é capturado e nunca trava o apagamento do produto.
- **Edge Function `limpar-fotos`** ([código](supabase/functions/limpar-fotos/index.ts)) apaga cada foto removida com a miniatura `-thumb` e, ao apagar o produto, o que sobrar na pasta `<id>/`. O Storage só remove o arquivo de verdade pela API, não por SQL.
- **Autenticação:** a função não usa JWT; ela exige um segredo compartilhado, guardado só no Vault do Supabase, e responde 401 sem ele. Segredo fora do formato (64 caracteres hexadecimais) é recusado sem consultar o banco; se um dia trocar o segredo, gere no mesmo formato.
- **Proteções:** só aceita caminhos no formato `<uuid-do-produto>/<arquivo>`, nunca toca em `exemplo/`, nunca apaga o que algum produto ainda usa e limita a 200 arquivos por chamada.
- O SQL das triggers está em [`supabase/migrations/passo3_triggers_limpeza.sql`](supabase/migrations/passo3_triggers_limpeza.sql).

## Banco de dados e migrations

A pasta [`supabase/migrations/`](supabase/migrations/) guarda todo o banco em SQL: tabelas, RLS, permissões, bucket, limpeza de fotos e trava contra apagamento em massa. Aplicados **na ordem dos nomes** num projeto Supabase vazio, recriam o banco inteiro (os produtos e as fotos não vêm junto).

| Arquivo | O que faz |
|---|---|
| `20261010205411_cria_produtos_admins_e_fotos` | Tabelas `produtos` e `admins`, RLS, `is_admin()` e bucket `produtos` |
| `20261010211616_admin_le_objetos_do_bucket_produtos` | Admin pode listar os arquivos do bucket |
| `20261010215211_endurece_permissoes_e_validacoes_produtos` | Permissões mínimas e validações dos campos |
| `20261010221409_adiciona_banner_aos_produtos` | Campos `no_banner` e `foto_banner` |
| `20261011131720_limpeza_fotos_passo1_pgnet_e_segredo` | `pg_net` e segredo da limpeza no Vault |
| `20261011131754_limpeza_fotos_passo2_funcoes_de_apoio` | Funções de apoio da limpeza de fotos |
| `passo3_triggers_limpeza` | Triggers da limpeza de fotos (aplicar depois do passo 2) |
| `20261012040000_trava_apagar_produtos_em_massa` | Trava contra apagar mais de 3 produtos e contra `TRUNCATE` |
| `20261014233007_trava_trocar_fotos_em_massa` | Trava contra trocar as fotos de mais de 3 produtos num comando |
| `20261014233043_funcoes_novas_sem_execute_publico` | Funções novas nascem sem `EXECUTE` para o público |
| `20261014233100_storage_so_apaga_foto_sem_uso` | Storage: só apaga foto sem uso, só envia para `<uuid>/`, sem sobrescrever |

A Edge Function `limpar-fotos` é publicada à parte (pasta `supabase/functions/`).

## Backup

O plano gratuito do Supabase **não tem backup automático**, e em nenhum plano o backup inclui as fotos do Storage. Até haver outra solução, faça uma cópia manual de tempos em tempos, principalmente antes de mudanças grandes:

1. **Produtos:** Table Editor → `produtos` → **Export → CSV**.
2. **Fotos:** Storage → bucket `produtos` → baixe as pastas.
3. Guarde os dois fora do Supabase (Google Drive, por exemplo).

No plano Pro, o Supabase guarda backups diários do banco por 7 dias.

## Manutenção automática

O plano gratuito do Supabase **pausa o projeto após 7 dias sem requisições**. Para evitar isso, o workflow [`ping-supabase.yml`](.github/workflows/ping-supabase.yml) faz uma consulta pública à API **duas vezes por dia** (08:00 e 20:00 em Brasília).

- Se a API não responder, o job falha e o GitHub avisa por e-mail.
- **Alarme de schemas internos:** o mesmo job confere que os schemas `net` (do `pg_net`, que dá acesso ao visitante e não pode ser fechado por nós) e `vault` (segredos) continuam **fora** da API. Se alguém os incluir em **Settings → API → Exposed schemas** no Supabase, o job falha e o GitHub avisa. Nunca exponha esses dois schemas.
- Para testar: aba **Actions → Ping Supabase → Run workflow**.
- Se o repositório for público e ficar 60 dias sem commits, o GitHub desativa agendamentos; basta reativar na aba Actions.
- Se o projeto for pausado mesmo assim, reative-o pelo painel do Supabase.

## Roadmap

- [ ] Confirmar com o dono as opções reais do "Crie a sua joia" (peças, metais, pedras, prazo médio e faixas de orçamento).
- [ ] Pagamento online (Pix e cartão) com Asaas, usando Supabase Edge Functions.
- [ ] Tabela de pedidos com RLS e validação do webhook de pagamento.
- [ ] Cálculo de frete.
- [ ] Adequação à LGPD (política de privacidade e consentimento).
- [ ] Domínio próprio e migração da hospedagem para a conta do cliente.
- [ ] Lixeira de produtos apagados (com volta em até 30 dias) e botão "Baixar backup" no painel.
- [ ] Login em dois passos (MFA) no painel.

---

Ateliê das Esmeraldas · CNPJ 60.580.387/0001-24
