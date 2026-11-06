"""Resposta de exemplo usada no modo demonstração (sem ANTHROPIC_API_KEY).
Serve para testar a interface sem gastar com a API."""

DEMO_RESULT = {
    "fotos_validas": True,
    "problemas_fotos": [],
    "analise_facial": {
        "formato_rosto": "quadrado",
        "confianca": "alta",
        "justificativa": "Testa, maçãs e mandíbula com larguras parecidas e ângulo da mandíbula bem marcado.",
        "proporcoes": "Terço superior levemente menor que os outros dois; mandíbula larga e reta.",
        "perfil": "Nuca levemente achatada, queixo com boa projeção, orelhas próximas à cabeça.",
        "pontos_fortes": ["Mandíbula marcada", "Queixo bem projetado", "Boa simetria"],
        "pontos_de_atencao": ["Nuca achatada pede volume atrás", "Testa curta: evitar franja pesada"],
    },
    "cabelo_atual": {
        "tipo": "Ondulado 2A",
        "espessura_densidade": "Fio médio, densidade alta",
        "linha_frontal": "Linha reta, sem entradas aparentes",
        "redemoinhos": "Um redemoinho no coroa, levemente à direita",
        "comprimento_atual": "Cerca de 6 cm no topo e 3 cm nas laterais",
    },
    "resumo_objetivo": (
        "Para um visual clássico, vale aproveitar a mandíbula forte com laterais limpas e um topo "
        "penteado para o lado, mantendo volume atrás para compensar a nuca."
    ),
    "recomendacoes": [
        {
            "nome": "Side part clássico com low fade",
            "termo_busca": "low fade side part",
            "compatibilidade": 94,
            "por_que_funciona": (
                "As linhas retas conversam com o rosto quadrado e a risca lateral dá o ar alinhado do "
                "estilo clássico. O fade baixo preserva volume na nuca."
            ),
            "manutencao": "media",
            "retorno_semanas": 3,
            "ficha_barbeiro": {
                "laterais": "Low fade começando na máquina 0,5 acima da orelha, subindo até a 2.",
                "nuca": "Manter 2 a 3 cm na região do occipital; pezinho arredondado.",
                "topo": "6 a 7 cm, tesoura, com camadas leves para não perder peso.",
                "franja_frente": "Frente um pouco mais longa (7 cm) para pentear para o lado.",
                "textura_acabamento": "Risca do lado esquerdo marcada com navalha bem sutil; costeleta reta.",
                "texto_para_mostrar": (
                    "Side part clássico: low fade da 0,5 até a 2, sem subir muito atrás. Topo na tesoura "
                    "com 6-7 cm, frente um pouco maior. Risca à esquerda bem leve na navalha, pezinho "
                    "arredondado e costeleta reta."
                ),
            },
            "finalizacao": {
                "produto": "Pomada de fixação média com brilho baixo",
                "passo_a_passo": [
                    "Seque com o secador direcionando para o lado da risca",
                    "Aplique uma porção do tamanho de uma ervilha nas mãos",
                    "Penteie com pente fino seguindo a risca",
                ],
            },
        },
        {
            "nome": "Ivy League",
            "termo_busca": "ivy league haircut",
            "compatibilidade": 86,
            "por_que_funciona": "Mais curto e prático, mantém a elegância e valoriza a mandíbula.",
            "manutencao": "baixa",
            "retorno_semanas": 4,
            "ficha_barbeiro": {
                "laterais": "Tesoura sobre pente ou máquina 3 nas laterais, sem degradê marcado.",
                "nuca": "Afinado natural, preservando volume.",
                "topo": "4 cm atrás aumentando para 5-6 cm na frente.",
                "franja_frente": "Frente levemente mais longa para pentear para o lado ou para cima.",
                "textura_acabamento": "Desbaste leve no topo; contorno da orelha limpo.",
                "texto_para_mostrar": (
                    "Ivy League: laterais na 3 ou tesoura sobre pente, nuca afinada natural. Topo de 4 cm "
                    "atrás até 5-6 na frente, com desbaste leve."
                ),
            },
            "finalizacao": {
                "produto": "Creme modelador leve",
                "passo_a_passo": ["Aplique com o cabelo úmido", "Penteie com os dedos para o lado"],
            },
        },
        {
            "nome": "Pompadour discreto",
            "termo_busca": "short pompadour fade",
            "compatibilidade": 78,
            "por_que_funciona": (
                "Dá altura que alonga levemente o terço superior curto; exige mais tempo para finalizar."
            ),
            "manutencao": "alta",
            "retorno_semanas": 3,
            "ficha_barbeiro": {
                "laterais": "Máquina 1 com degradê médio até a 3.",
                "nuca": "Pezinho quadrado, com volume no occipital.",
                "topo": "8 a 9 cm na frente, diminuindo para 6 cm na coroa.",
                "franja_frente": "Frente longa para jogar para trás com volume.",
                "textura_acabamento": "Desbaste por dentro para tirar peso sem perder altura.",
                "texto_para_mostrar": (
                    "Pompadour discreto: laterais da 1 à 3 em degradê médio, topo com 8-9 cm na frente e "
                    "6 na coroa, desbastado por dentro."
                ),
            },
            "finalizacao": {
                "produto": "Pomada à base d'água com brilho médio",
                "passo_a_passo": [
                    "Seque com escova redonda puxando a frente para cima e para trás",
                    "Aplique a pomada da raiz às pontas",
                    "Modele com pente largo",
                ],
            },
        },
    ],
    "evitar": [
        {"corte": "Franja reta pesada", "motivo": "Encurta ainda mais a testa."},
        {"corte": "High fade raspado atrás", "motivo": "Evidencia a nuca achatada."},
    ],
    "barba": "Barba curta e bem contornada (3 a 5 mm), reforçando as linhas retas da mandíbula.",
}
