# Corte Certo: contexto do projeto

> Arquivo para começar uma conversa nova com o histórico do projeto.
> Atualizado em 06/11/2026. "Corte Certo" é um nome provisório.

## O que é

App de celular para barbearias e salões. O cliente tira **3 fotos** (perfil esquerdo, frente e perfil
direito) e escolhe a **imagem que quer passar**: Clássico, Despojado, Casual ou Moderno. A IA faz uma
análise de **visagismo** e devolve:

- **Rosto**: formato, proporções (terços faciais), o que os perfis mostram (nuca, queixo, mandíbula,
  orelhas), pontos a valorizar e a equilibrar.
- **Cabelo**: tipo (1A–4C), densidade, entradas, redemoinhos, comprimento atual.
- **3 cortes recomendados**, do mais ao menos compatível (%), cada um com:
  - **ficha para o barbeiro** em linguagem de barbearia (máquina nº, degradê, cm no topo, pezinho,
    acabamento) e um texto pronto para mostrar, copiar ou enviar pelo WhatsApp;
  - manutenção e intervalo de retorno; como finalizar em casa;
  - botões **Ver fotos** (Google Imagens) e **Pinterest**, que buscam o corte por um `termo_busca` sugerido pela IA.
- O que **evitar** e uma sugestão de **barba**.

O estilo é escolha do cliente; a fisionomia define **como** executar esse estilo.

## Onde está

- **Repositório**: `joaogmmoreno/joao_mmoreno`, branch `claude/haircut-advisor-app-5l9x86`, pasta `corte-certo/`.
  O resto do repositório (NF/ZPL, Flask "Oi") não tem relação com este projeto.
- **Versão de teste para celular** (página do Claude, privada):
  https://claude.ai/artifact/AKTR4bUPpBbfi3hPpNGNtA

## Arquitetura (app completo)

```
corte-certo/
├── app.py            # Flask: serve a interface; POST /api/analisar; GET /api/status
├── analysis.py       # prompt de visagismo, schema JSON da resposta, chamada ao Claude
├── demo.py           # resultado fixo (modo demonstração, sem chave de API)
├── static/
│   ├── index.html    # 3 telas + câmera em tela cheia
│   ├── app.js        # navegação, câmera guiada, envio, renderização do resultado
│   ├── styles.css    # visual mobile-first, modo escuro
│   ├── manifest.json, sw.js, icons/   # PWA instalável
├── CLAUDE.md         # regras de design mobile (lidas automaticamente pelo Claude Code)
├── README.md         # como rodar, publicar e roteiro
├── requirements.txt  # flask, anthropic, gunicorn
└── Dockerfile        # gunicorn com timeout de 180 s
```

- **IA**: Claude via SDK `anthropic` em Python. Modelo `claude-opus-5-5` (env `CLAUDE_MODEL`), effort `high`
  (env `CLAUDE_EFFORT`), saída estruturada com `output_config.format` (JSON schema em `RESULT_SCHEMA`),
  fallback automático em caso de recusa (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).
- **Sem `ANTHROPIC_API_KEY`** o app roda em modo demonstração, com o resultado de `demo.py`.
- As fotos são reduzidas no celular para no máximo 1280 px (JPEG 0,85) antes do envio.
- Custo estimado: de US$ 0,05 a 0,15 por análise.
- Nada é armazenado: as fotos vão para a análise e são descartadas.

## Fluxo de telas

1. **Fotos**: 3 quadros com silhueta (perfil esq., frente, perfil dir.). Tocar abre a câmera guiada.
2. **Estilo**: 4 cartões de estilo; controles segmentados para corte (masc./fem.), comprimento e tempo
   para arrumar; campo opcional de observações.
3. **Analisando**: animação de escaneamento com mensagens que vão mudando.
4. **Resultado**: rosto, cabelo, resumo, as 3 opções (controle segmentado), ficha do barbeiro, finalização,
   o que evitar e barba.

## Decisões tomadas

- **Sempre pensado para celular** (Apple HIG e Material Design 3). Regras completas em `CLAUDE.md`:
  - toque de no mínimo 44 px e botão principal fixo embaixo;
  - barra com voltar e progresso; botão voltar do Android e gesto do iPhone funcionando (History API);
  - áreas seguras, sem rolagem lateral (testado em 320, 390 e 412 px), campos com 16 px ou mais;
  - modo escuro.
- **PWA instalável** agora; para as lojas, depois, via **Capacitor** (mesmo código).
- **Câmera própria** (getUserMedia):
  - contorno da cabeça para cada ângulo e instruções de como virar o corpo;
  - timer de 3 ou 10 s com bipes (padrão 3 s), troca para a câmera traseira, galeria;
  - revisão com Repetir / Usar foto e avanço automático para o próximo ângulo;
  - **a foto é salva sem espelhar** (senão o perfil esquerdo vira o direito); só a prévia é espelhada;
  - sem HTTPS, usa a câmera padrão do sistema.
- **Fotos de exemplo dos cortes**: por ora, **opção 2** (links de busca no Google Imagens e no Pinterest).
  Discutido para depois:
  - **opção 1**, catálogo próprio de 30 a 40 cortes com fotos licenciadas ou de barbearias parceiras;
    a IA passaria a escolher cortes dessa lista;
  - **opção 4**, provador virtual (o corte aplicado na foto do cliente), como recurso premium.
  - Não usar fotos do Instagram ou do Pinterest dentro do app (direitos autorais e direito de imagem).
- **LGPD**: foto do rosto pode ser dado sensível (biometria). Quando houver perfis salvos: consentimento
  explícito, política de privacidade, opção de apagar conta e fotos, acesso restrito.

## Versão de teste (página do Claude)

- Um único HTML, sem servidor. A análise usa a capacidade `sample` (com imagens) da página, que roda
  **na conta do Claude de quem abre**, sem chave de API.
- Usa a câmera padrão do celular (a página não tem acesso à câmera ao vivo); não instala como app.
- Na primeira análise, o Claude pede permissão. Se a pessoa recusar, aparece o cartão
  **"Falta a sua permissão"** com o botão Abrir permissões. Os erros mostram um código (ex.: `rate_limited`).
- Se a análise real não estiver disponível, aparece "Modo exemplo" e o resultado é fixo.
- Arquivo-fonte gerado nesta sessão (não está no repositório). Para alterar a página numa conversa nova,
  publicar de novo pela URL acima.

## Como rodar e testar

```bash
cd corte-certo
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py                    # modo demonstração
ANTHROPIC_API_KEY=... python app.py   # análise real
```

- No celular, a câmera e a instalação exigem HTTPS: publicar (Render ou Railway com o Dockerfile) ou
  usar um túnel (`cloudflared tunnel --url http://localhost:8000`).
- Testes feitos com Playwright em iPhone SE, iPhone 13 e Pixel 7, com câmera falsa do Chromium
  (`--use-fake-device-for-media-stream`).

## O que ainda NÃO foi testado

- **Análise real com fotos de verdade**: o app completo não teve chave de API, e a versão de teste ainda
  não rodou com sucesso no celular (havia o problema da permissão, já tratado na página).
- A câmera ao vivo num celular físico.

## Próximos passos

1. Conseguir uma análise real pela versão de teste e avaliar se o formato do rosto, os cortes, a ficha
   do barbeiro e as fotos fazem sentido; ajustar o prompt.
2. Criar a chave da API e publicar o app completo no Render ou Railway (HTTPS e domínio).
3. Testar com 10 a 20 pessoas reais.
4. **Fase 2**: login, perfil por cliente e histórico de cortes com antes e depois e lembrete de retorno.
   Sugestão: Supabase (Postgres, Auth e Storage). Tabelas: `clientes`, `analises`, `cortes`.
5. **Fase 3**: painel do barbeiro, várias barbearias, lojas via Capacitor.

## Preferências do João

- Conversa em português do Brasil, explicações simples e diretas.
- O app deve **sempre** ser pensado para celular.
- Quer chegar online o quanto antes; prefere soluções simples primeiro.
