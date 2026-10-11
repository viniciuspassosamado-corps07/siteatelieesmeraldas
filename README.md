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
- **Folha do produto**: o card se expande em uma janela com galeria de fotos (deslizar, setas e indicadores), título, descrição e preço.
- **Pesquisa** que filtra os produtos por nome e descrição.
- **Selos de confiança** animados e CNPJ da empresa.
- **Produtos vendidos** (estoque 0) ficam marcados como "Vendido" e saem das ofertas e do banner.
- Fotos com fallback: se uma foto ainda não estiver no Storage, o site usa a cópia local de `img/`.
- Compatível com Safari no iPhone (cantos arredondados do banner e rolagem).

### Painel administrativo

- Login seguro, exclusivo para quem está na tabela `admins`.
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
├── script.js               Navbar, carrossel, banner, folha do produto e pesquisa
├── produtos.js             Lê o catálogo do Supabase e monta fileiras, carrossel e banner
├── ripple.js               Efeito de água do carrossel
├── comprimir-imagem.js     Compressão de fotos no navegador (WebP)
├── admin/                  Painel administrativo (acessado em /admin)
│   ├── index.html
│   ├── admin.css
│   ├── admin.js            Login e navegação do painel
│   ├── lista.js            Lista de produtos
│   ├── form.js             Cadastro e edição de produto
│   ├── validacao.js        Validação dos campos
│   └── config.js           URL do projeto, chave pública e limites
├── vendor/                 Dependências locais (supabase-js e ogl)
├── img/                    Imagens de apoio e fallback dos produtos
├── supabase/
│   ├── functions/limpar-fotos/   Edge Function que apaga fotos do bucket
│   └── migrations/               SQL das triggers de limpeza
├── vercel.json             Cabeçalhos de segurança (CSP e outros)
├── .vercelignore           Arquivos que não vão para o ar
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

**Storage**: bucket `produtos`, leitura pública, escrita apenas para administradores, aceita JPG, PNG e WebP de até 5 MB.

## Segurança

- **RLS ativo** nas tabelas: o público só lê produtos ativos; criar, editar e apagar exige ser admin.
- **Cadastro público desativado** no Supabase Auth. Novos administradores são criados manualmente.
- **Política de senha forte** (mínimo de 12 caracteres, com complexidade) e confirmação de e-mail.
- **Content Security Policy** restritiva em `vercel.json` (scripts apenas do próprio domínio, sem inline), além de `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`.
- **Dependências locais** em `vendor/`, sem scripts carregados de CDNs.
- **`/admin` fora dos buscadores** (`noindex, nofollow`).
- **Nenhuma chave secreta no código ou no histórico.** A chave pública (`anon`) é pública por desenho e fica no front-end.
- Textos vindos do banco são escapados antes de entrar no HTML.
- `.vercelignore` impede a publicação de arquivos internos.

Encontrou uma vulnerabilidade? Avise o responsável pelo projeto de forma privada, sem abrir uma issue pública.

## Como rodar localmente

Não há instalação nem build. Basta servir a pasta com qualquer servidor estático:

```bash
npx serve .
```

Depois acesse `http://localhost:3000` (site) e `http://localhost:3000/admin` (painel).

O projeto já aponta para o Supabase configurado em `produtos.js` e `admin/config.js`. Para usar outro projeto, troque `SUPABASE_URL` e `SUPABASE_ANON_KEY` nesses dois arquivos, usando **somente a chave pública (anon)**.

> Os arquivos usam ES modules; abrir o `index.html` direto pelo disco (`file://`) não funciona no painel. Use sempre um servidor local.

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
3. O `vercel.json` aplica os cabeçalhos de segurança e o `.vercelignore` filtra os arquivos internos.
4. Aponte o domínio da loja para o projeto.

Via linha de comando, a partir da pasta do projeto:

```bash
vercel deploy --prod
```

Se o domínio mudar, confira também no Supabase (**Authentication → URL Configuration**) se **Site URL** e **Redirect URLs** apontam para o domínio novo, sem curingas.

## Limpeza automática de fotos

Quando um produto é apagado, ou uma foto (ou a foto do banner) é trocada, o bucket `produtos` não guarda os arquivos antigos. O painel já apaga as fotos pelo navegador; a automação no banco é a rede de segurança para quando isso falha.

```
produtos (DELETE / UPDATE de fotos) → trigger → pg_net → Edge Function limpar-fotos → API do Storage
```

- **Triggers** em `produtos` (`AFTER DELETE` e `AFTER UPDATE OF fotos, foto_banner`) chamam a função de forma assíncrona. Qualquer erro é capturado e nunca trava o apagamento do produto.
- **Edge Function `limpar-fotos`** ([código](supabase/functions/limpar-fotos/index.ts)) apaga cada foto removida com a miniatura `-thumb` e, ao apagar o produto, o que sobrar na pasta `<id>/`. O Storage só remove o arquivo de verdade pela API, não por SQL.
- **Autenticação:** a função não usa JWT; ela exige um segredo compartilhado, guardado só no Vault do Supabase, e responde 401 sem ele.
- **Proteções:** só aceita caminhos no formato `<uuid-do-produto>/<arquivo>`, nunca toca em `exemplo/`, nunca apaga o que algum produto ainda usa e limita a 200 arquivos por chamada.
- O SQL das triggers está em [`supabase/migrations/`](supabase/migrations/passo3_triggers_limpeza.sql).

## Manutenção automática

O plano gratuito do Supabase **pausa o projeto após 7 dias sem requisições**. Para evitar isso, o workflow [`ping-supabase.yml`](.github/workflows/ping-supabase.yml) faz uma consulta pública à API **duas vezes por dia** (08:00 e 20:00 em Brasília).

- Se a API não responder, o job falha e o GitHub avisa por e-mail.
- Para testar: aba **Actions → Ping Supabase → Run workflow**.
- Se o repositório for público e ficar 60 dias sem commits, o GitHub desativa agendamentos; basta reativar na aba Actions.
- Se o projeto for pausado mesmo assim, reative-o pelo painel do Supabase.

## Roadmap

- [ ] Pagamento online (Pix e cartão) com Asaas, usando Supabase Edge Functions.
- [ ] Tabela de pedidos com RLS e validação do webhook de pagamento.
- [ ] Cálculo de frete.
- [ ] Adequação à LGPD (política de privacidade e consentimento).
- [ ] Domínio próprio e migração da hospedagem para a conta do cliente.

---

Ateliê das Esmeraldas · CNPJ 60.580.387/0001-24
