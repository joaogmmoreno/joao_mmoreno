# Corte Certo — consultor de corte de cabelo com visagismo

> "Corte Certo" é um nome provisório.

O cliente tira 3 fotos (perfil esquerdo, frente, perfil direito), escolhe a imagem que quer passar
(clássico, despojado, casual ou moderno) e recebe:

- **Análise do rosto**: formato, proporções (terços faciais), o que os perfis mostram (nuca, queixo,
  mandíbula, orelhas), pontos a valorizar e a equilibrar.
- **Análise do cabelo**: tipo (1A–4C), densidade, entradas, redemoinhos.
- **3 cortes recomendados**, do mais ao menos compatível, cada um com:
  - **Ficha técnica para o barbeiro** (máquina, degradê, cm no topo, pezinho, acabamento) e um texto
    pronto para mostrar no celular, copiar ou enviar pelo WhatsApp;
  - frequência de manutenção e como finalizar em casa.
- O que **evitar** e sugestão de **barba**.

A análise é feita pelo Claude (modelo com visão) com um prompt de visagismo e saída em JSON estruturado.

## Estrutura

```
corte-certo/
├── app.py            # servidor Flask: serve a interface e a rota POST /api/analisar
├── analysis.py       # prompt de visagismo, schema da resposta e chamada ao Claude
├── demo.py           # resposta de exemplo (modo demonstração)
├── static/           # interface (HTML/CSS/JS puro, mobile-first)
├── requirements.txt
└── Dockerfile
```

## Rodar localmente

```bash
cd corte-certo
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Modo demonstração (sem chave): o resultado é sempre o mesmo exemplo
python app.py

# Modo real
export ANTHROPIC_API_KEY=sk-ant-...
python app.py
```

Abra http://localhost:8000. Para testar a câmera no celular, o navegador exige HTTPS; o jeito mais
rápido é publicar (abaixo) ou usar um túnel como `cloudflared tunnel --url http://localhost:8000`.

### Variáveis de ambiente

| Variável            | Padrão            | Para quê |
|---------------------|-------------------|----------|
| `ANTHROPIC_API_KEY` | —                 | Chave da API. Sem ela, o app roda em modo demonstração. |
| `CLAUDE_MODEL`      | `claude-opus-5-5` | Modelo usado na análise. |
| `CLAUDE_EFFORT`     | `high`            | Profundidade do raciocínio (`low`, `medium`, `high`...). Menor = mais rápido e barato. |
| `DEMO_MODE`         | —                 | `1` força o modo demonstração mesmo com chave. |
| `PORT`              | `8000`            | Porta do servidor. |

O app ativa o *fallback* automático da API: se o modelo recusar uma requisição, ela é refeita em outro
modelo sem intervenção.

## Publicar (o caminho mais rápido)

O app é um único container Docker, sem banco de dados nesta fase. Qualquer uma destas serve:

- **Render** ou **Railway**: conectar o repositório no GitHub, apontar para a pasta `corte-certo/`
  (usa o `Dockerfile`), cadastrar `ANTHROPIC_API_KEY` nas variáveis. Já sai com HTTPS e domínio.
- **Google Cloud Run**: `gcloud run deploy corte-certo --source corte-certo --set-env-vars ...`

Custo estimado por análise com as configurações padrão: cerca de **US$ 0,05 a 0,15**
(3 fotos de ~1280 px + resposta). A interface já reduz as fotos antes de enviar.

## Roteiro

### Fase 1 — MVP (este código)
- [x] Captura das 3 fotos com guia de enquadramento
- [x] Escolha de estilo, comprimento, tempo de manutenção e observações
- [x] Análise de visagismo + 3 recomendações + ficha do barbeiro
- [x] Copiar / enviar ficha pelo WhatsApp
- [ ] Publicar em Render/Railway com domínio próprio
- [ ] Testar com 10–20 pessoas reais e ajustar o prompt

### Fase 2 — Perfil e histórico do cliente
- Login (e-mail/telefone com código, ou Google)
- Banco de dados + armazenamento de fotos (ex.: Supabase = Postgres + Auth + Storage)
- Tabelas: `clientes`, `analises` (fotos, preferências, resultado), `cortes`
  (data, corte feito, barbeiro, foto depois, observações)
- Linha do tempo com **antes e depois** e lembrete de retorno ("faz 3 semanas do seu corte")

### Fase 3 — Para barbearias
- Painel do barbeiro: ver a ficha do cliente antes de ele sentar na cadeira
- Várias barbearias, cada uma com seus profissionais (multi-tenant)
- Instalar como app no celular (PWA) e, se fizer sentido, publicar nas lojas

### Cuidados (LGPD)
Fotos do rosto são dados pessoais e podem ser dados sensíveis (biometria). Nesta fase nada é
armazenado: as fotos vão para a análise e são descartadas. Ao salvar perfis na Fase 2, será preciso
consentimento explícito, política de privacidade, opção de apagar a conta e as fotos, e
armazenamento com acesso restrito.
