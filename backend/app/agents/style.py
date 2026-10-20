"""Writing style shared by the CV and the cover letter: plain, specific, without the usual tics of AI-written text.

STYLE_RULES go into the prompts; lint() checks the result so leftovers can be fixed.
"""

import re

from ..nlp import normalize
from ..schemas import Lang

# Phrases that make a text sound generated or boilerplate (compared without case or accents)
BANNED = {
    "fr": [
        "passionné", "passionnée", "passion pour", "dynamique", "je me permets", "c'est avec un grand intérêt",
        "c'est avec enthousiasme", "vif intérêt", "fort de", "forte de", "en outre", "par ailleurs", "de plus,",
        "n'hésitez pas", "valeur ajoutée", "relever de nouveaux défis", "relever des défis", "contribuer activement",
        "mettre à profit", "je suis convaincu", "je suis convaincue", "véritable atout", "atout majeur", "pleinement",
        "synergie", "incontournable", "en constante évolution", "à l'ère du", "plus que jamais", "permettez-moi",
        "au sein de votre prestigieuse", "votre prestigieuse", "s'inscrit parfaitement", "parfaitement en adéquation",
        "en adéquation avec", "faire la différence", "me tient à cœur", "soif d'apprendre", "riche expérience",
        "solides compétences", "esprit d'équipe développé", "je suis persuadé", "je suis persuadée",
    ],
    "en": [
        "i am writing to express", "i am writing to apply", "passionate", "passion for", "thrilled", "excited to apply",
        "leverage", "delve", "tapestry", "dynamic", "fast-paced", "cutting-edge", "seamless", "robust", "furthermore",
        "moreover", "additionally", "in today's", "ever-evolving", "i am confident that", "align with", "aligns with",
        "resonate", "testament", "spearheaded", "honed", "foster", "showcase", "unwavering", "keen interest",
        "eager to", "invaluable", "synergy", "game-changer", "realm", "landscape", "perfect fit", "make a difference",
        "hit the ground running", "proven track record", "strong background", "i would welcome the opportunity",
    ],
}

STYLE_RULES = {
    "fr": """Style (indispensable, le texte doit se lire comme écrit par le candidat lui-même) :
- Phrases simples et directes, de longueur variée : des courtes, quelques-unes plus longues. Pas d'effets de manche.
- Du concret plutôt que des qualités affirmées : un projet, une tâche, un outil, un résultat réel du profil.
- Pas de tiret cadratin (—) ni de tiret entre deux espaces pour ponctuer : virgule, point ou deux-points.
- Pas d'énumérations systématiques par trois, pas de « non seulement… mais aussi », pas de phrase de conclusion qui résume.
- Ne jamais employer : {banned}.
- Au féminin ou au masculin seulement si le profil l'indique (ex. « développeuse ») ; sinon tourner la phrase pour éviter l'accord.""",
    "en": """Style (essential, the text must read as written by the candidate):
- Plain, direct sentences of varied length: some short, a few longer. No flourishes.
- Concrete over claimed qualities: a project, a task, a tool, a real result from the profile.
- No em dashes (—) or spaced hyphens as punctuation: use commas, full stops or colons.
- No reflexive groups of three, no "not only… but also", no summarising final sentence.
- Never use: {banned}.""",
}
STYLE_RULES = {lang: rules.format(banned=", ".join(f"« {b} »" for b in BANNED[lang])) for lang, rules in STYLE_RULES.items()}

_DASH = re.compile(r"\s[—–-]\s|—")


def lint(text: str, lang: Lang) -> list[str]:
    """Banned phrases and dash punctuation found in the text."""
    flat = normalize(text)
    found = [b for b in BANNED[lang] if normalize(b) in flat]
    if _DASH.search(text):
        found.append("—")
    return found


def strip_dashes(text: str) -> str:
    """Last resort when the model keeps em dashes: turn them into commas."""
    return re.sub(r"\s*,\s*,", ",", _DASH.sub(", ", text))
