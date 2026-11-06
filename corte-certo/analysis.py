"""Análise de visagismo com o Claude: recebe 3 fotos + preferências e devolve
um JSON estruturado com a análise do rosto, cortes recomendados e a ficha
técnica para o barbeiro/cabeleireiro."""

from __future__ import annotations

import base64
import json
import os

import anthropic

MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("CLAUDE_EFFORT", "high")  # low | medium | high | xhigh | max

ESTILOS = {
    "classico": "Clássico — elegante, alinhado, atemporal, passa seriedade e confiança",
    "despojado": "Despojado — natural, com movimento, aparência de 'arrumado sem esforço'",
    "casual": "Casual — prático, fácil de manter, bom para o dia a dia",
    "moderno": "Moderno — atual, com contraste e textura, segue tendências",
}

SYSTEM_PROMPT = """Você é um visagista e mestre barbeiro/cabeleireiro com 20 anos de experiência no Brasil. \
Seu trabalho é analisar a fisionomia do cliente e recomendar o corte de cabelo que melhor transmite a imagem \
que ELE quer passar, explicando o corte com o vocabulário técnico usado nas barbearias e salões brasileiros.

Você recebe três fotos: perfil esquerdo, frente e perfil direito.

Como analisar:
- FRENTE: formato do rosto (oval, redondo, quadrado, retangular/alongado, coração/triângulo invertido, \
diamante, triangular), proporção dos terços faciais (testa, nariz, queixo), largura da testa vs. maçãs vs. \
mandíbula, simetria, linha frontal do cabelo (entradas, recuo), redemoinhos visíveis.
- PERFIS: formato do crânio e da nuca (achatada, arredondada, projetada), projeção do queixo e da testa, \
ângulo da mandíbula, posição e tamanho das orelhas, perfil do nariz, volume natural do cabelo nas laterais.
- CABELO: tipo (liso, ondulado, cacheado, crespo — use a escala 1A a 4C se possível), espessura do fio, \
densidade, direção de crescimento, sinais de rarefação, comprimento atual.

Princípios de visagismo a aplicar:
- Equilibrar proporções: rosto alongado pede menos altura no topo e mais volume lateral; rosto redondo pede \
altura e laterais baixas; rosto quadrado pode ser suavizado com textura ou valorizado com linhas retas no \
estilo clássico; testa alta pode pedir franja ou topete projetado para frente; entradas pedem cortes que \
não exponham a linha frontal (ex.: crop texturizado) ou que a assumam com laterais bem baixas.
- Nuca achatada pede volume na região do occipital (não raspar alto atrás).
- Respeitar a textura natural: não recomendar um corte que dependa de liso para quem tem cacheado, a menos \
que você explique a finalização necessária.
- A intenção de estilo escolhida pelo cliente é o critério principal; a fisionomia define COMO executar \
esse estilo da melhor forma.

A ficha do barbeiro deve ser objetiva e executável: use máquina nº (0, 0,5, 1, 1,5, 2, 3, 4...), pente, \
degradê/fade (low, mid, high, navalhado, disfarçado), tesoura sobre pente, comprimento em centímetros no topo, \
desfiado, picotado, texturização com tesoura de desbaste ou navalha, risca (lado), pezinho (quadrado, \
arredondado, natural/afinado), acabamento de costeleta e contorno da orelha. Para cortes femininos ou longos, \
use camadas, repicado, bico, comprimento em relação a ombro/queixo/clavícula, franja (cortina, reta, lateral).

Regras:
- Seja respeitoso e focado em cabelo. Não faça julgamentos sobre beleza, peso, etnia ou idade; fale de \
proporções e características objetivas.
- Nunca tente identificar a pessoa.
- Se as fotos estiverem ruins (escuras, cortadas, boné, ângulo errado, não mostram um rosto), registre em \
`problemas_fotos`, reduza a `confianca` e faça o melhor possível. Se não houver nenhum rosto humano nas \
fotos, marque `fotos_validas` como false e deixe as recomendações vazias.
- Recomende exatamente 3 cortes, do mais indicado ao menos indicado, todos coerentes com o estilo pedido.
- Escreva tudo em português do Brasil."""


def _str(desc: str) -> dict:
    return {"type": "string", "description": desc}


def _enum(values: list[str], desc: str = "") -> dict:
    d: dict = {"type": "string", "enum": values}
    if desc:
        d["description"] = desc
    return d


def _obj(props: dict) -> dict:
    return {
        "type": "object",
        "properties": props,
        "required": list(props.keys()),
        "additionalProperties": False,
    }


def _list(item: dict, desc: str = "") -> dict:
    d: dict = {"type": "array", "items": item}
    if desc:
        d["description"] = desc
    return d


RESULT_SCHEMA = _obj(
    {
        "fotos_validas": {"type": "boolean"},
        "problemas_fotos": _list(_str("Problema encontrado em alguma foto"), "Vazio se as fotos estão boas"),
        "analise_facial": _obj(
            {
                "formato_rosto": _enum(
                    ["oval", "redondo", "quadrado", "retangular", "coracao", "diamante", "triangular"]
                ),
                "confianca": _enum(["alta", "media", "baixa"]),
                "justificativa": _str("Por que esse formato, em 1-2 frases"),
                "proporcoes": _str("Terços faciais, larguras de testa/maçãs/mandíbula"),
                "perfil": _str("O que os perfis mostram: crânio, nuca, queixo, mandíbula, orelhas"),
                "pontos_fortes": _list(_str("Característica a valorizar")),
                "pontos_de_atencao": _list(_str("Característica a equilibrar ou disfarçar")),
            }
        ),
        "cabelo_atual": _obj(
            {
                "tipo": _str("Ex.: ondulado 2B"),
                "espessura_densidade": _str("Ex.: fio médio, densidade alta"),
                "linha_frontal": _str("Entradas, recuo, formato da linha"),
                "redemoinhos": _str("Onde estão e como afetam o corte; 'nenhum visível' se for o caso"),
                "comprimento_atual": _str("Descrição do comprimento atual"),
            }
        ),
        "resumo_objetivo": _str("Como o estilo escolhido se traduz para ESTE rosto, em 1-2 frases"),
        "recomendacoes": _list(
            _obj(
                {
                    "nome": _str("Nome popular do corte, ex.: 'Crop texturizado com mid fade'"),
                    "compatibilidade": {"type": "integer", "description": "0 a 100"},
                    "por_que_funciona": _str("Ligação direta com a fisionomia e o estilo pedido"),
                    "manutencao": _enum(["baixa", "media", "alta"]),
                    "retorno_semanas": {"type": "integer", "description": "A cada quantas semanas retocar"},
                    "ficha_barbeiro": _obj(
                        {
                            "laterais": _str("Máquina/tesoura, altura do degradê"),
                            "nuca": _str("Acabamento e pezinho"),
                            "topo": _str("Comprimento em cm e técnica"),
                            "franja_frente": _str("Como tratar a frente/franja"),
                            "textura_acabamento": _str("Desbaste, navalha, risca, contornos"),
                            "texto_para_mostrar": _str(
                                "Parágrafo curto, em linguagem de barbearia, que o cliente pode mostrar ao "
                                "barbeiro no celular"
                            ),
                        }
                    ),
                    "finalizacao": _obj(
                        {
                            "produto": _str("Pomada, pasta, cera, creme, leave-in, sal marinho..."),
                            "passo_a_passo": _list(_str("Passo da finalização em casa")),
                        }
                    ),
                }
            ),
            "Exatamente 3 cortes, do mais ao menos indicado",
        ),
        "evitar": _list(
            _obj({"corte": _str("Corte ou característica"), "motivo": _str("Por que não favorece")})
        ),
        "barba": _str("Sugestão de barba que combina, ou 'não se aplica'"),
    }
)


def _image_block(data: bytes, media_type: str) -> dict:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(data).decode("ascii"),
        },
    }


class AnalysisError(Exception):
    """Erro mostrado ao usuário final (mensagem já em português)."""


def analyze(photos: dict[str, tuple[bytes, str]], prefs: dict[str, str]) -> dict:
    """photos: {"esquerda"|"frente"|"direita": (bytes, media_type)}."""
    estilo = ESTILOS.get(prefs.get("estilo", ""), prefs.get("estilo", ""))
    pedido = [
        f"Estilo que o cliente quer transmitir: {estilo}",
        f"Público do corte: {prefs.get('publico') or 'não informado'}",
        f"Comprimento preferido: {prefs.get('comprimento') or 'tanto faz'}",
        f"Disposição para manutenção: {prefs.get('manutencao') or 'não informado'}",
    ]
    if prefs.get("observacoes"):
        pedido.append(f"Observações do cliente: {prefs['observacoes']}")

    content: list[dict] = []
    for key, label in (("esquerda", "Perfil esquerdo"), ("frente", "Frente"), ("direita", "Perfil direito")):
        data, media_type = photos[key]
        content.append({"type": "text", "text": f"Foto — {label}:"})
        content.append(_image_block(data, media_type))
    content.append(
        {
            "type": "text",
            "text": "Preferências do cliente:\n- " + "\n- ".join(pedido) + "\n\nFaça a análise e as recomendações.",
        }
    )

    client = anthropic.Anthropic()
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": RESULT_SCHEMA},
            },
            # Se o modelo recusar a requisição, a API tenta automaticamente outro modelo.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.RateLimitError as e:
        raise AnalysisError("Muitas análises ao mesmo tempo. Tente de novo em instantes.") from e
    except anthropic.APIStatusError as e:
        raise AnalysisError(f"O serviço de análise respondeu com erro ({e.status_code}).") from e
    except anthropic.APIConnectionError as e:
        raise AnalysisError("Não foi possível conectar ao serviço de análise.") from e

    if response.stop_reason == "refusal":
        raise AnalysisError("Não foi possível analisar essas fotos. Tente fotos diferentes.")
    if response.stop_reason == "max_tokens":
        raise AnalysisError("A análise ficou longa demais e foi interrompida. Tente novamente.")

    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise AnalysisError("A resposta da análise veio em formato inesperado. Tente novamente.") from e
