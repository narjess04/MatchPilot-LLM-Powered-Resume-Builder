<p align="center">
  <img src="frontend/public/logo.png" alt="MatchPilot" width="110" />
</p>

<h1 align="center">MatchPilot</h1>

<p align="center"><b>Un CV taillé pour chaque offre. Sans rien inventer.</b></p>

MatchPilot est une plateforme qui aide les candidats, en particulier les jeunes diplômés, à préparer des candidatures ciblées. À partir du profil réel du candidat et d'une offre d'emploi, elle génère un **CV optimisé ATS** et une **lettre de motivation**, en s'appuyant sur des LLM, du NLP et des agents IA.

L'IA reformule et réorganise le contenu pour coller à l'offre, mais **n'invente jamais** d'expérience, de diplôme ou de compétence.

## Fonctionnalités

- **Compte** : e-mail / mot de passe, Google, LinkedIn
- **Import du profil** depuis un ancien CV (PDF, Word, photo ou scan) ou un PDF LinkedIn, avec contrôle anti-invention
- **Profil éditable** : expériences, formation, projets avec lien GitHub, compétences par catégorie, langues, sections optionnelles (hackathons, vie associative, centres d'intérêt)
- **Offre d'emploi** par copier-coller ou capture(s) d'écran : seul le texte de l'annonce est gardé (menus, boutons, publicités et offres similaires sont ignorés)
- **5 modèles de CV** compatibles ATS (dont un modèle LaTeX exportable vers Overleaf), photo et couleur au choix
- **Analyse de l'offre** : compétences requises ou appréciées, prérequis, mots-clés ATS
- **CV adapté à l'offre**, en français ou en anglais : réécrit et réorganisé, mais entreprises, dates et écoles sont recopiées du profil ; compétences et chiffres absents du profil retirés ou signalés ; taux de mots-clés avant / après
- **Lettre de motivation** en français ou en anglais, écrite à partir du vrai parcours et des mots du candidat, puis relue pour retirer les tournures toutes faites
- *En cours* : score de correspondance détaillé, export PDF / Word

## Stack

| | |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | FastAPI, SQLAlchemy, Alembic (SQLite en local, PostgreSQL en production) |
| IA | Groq (`gpt-oss-120b` pour l'extraction, `qwen3.8-27b` pour l'OCR des CV), OpenRouter (`gemini-3.1-flash-lite` pour la lecture des captures d'offres, `qwen3.8-max` pour la rédaction) |
| Documents | PyMuPDF, python-docx, LaTeX |

```
CV / offre ──► lecture du texte (OCR si scan) ──► extraction JSON (LLM) ──► contrôle anti-invention
                                                                        └──► profil ──► CV adapté + lettre
```

## Installation

**Prérequis :** Python 3.11+, Node.js 20+, une clé [Groq](https://console.groq.com) et une clé [OpenRouter](https://openrouter.ai).

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS / Linux : source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # puis renseigner les clés
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
```

L'application est disponible sur **http://localhost:5173**.

## Configuration

Les variables sont dans `backend/.env` (modèle : `backend/.env.example`). Ce fichier n'est jamais versionné.

| Variable | Rôle |
|---|---|
| `GROQ_API_KEY` | Extraction du profil et OCR |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Rédaction du CV et de la lettre |
| `OPENROUTER_REASONING_TOKENS` | Budget de réflexion du modèle de rédaction (2048 par défaut : environ 50 s par CV au lieu de 4 min) |
| `OPENROUTER_FALLBACK_MODEL` | Remplace Groq quand il est saturé (même modèle, `gpt-oss-120b`, payé à l'usage) |
| `OPENROUTER_VISION_MODELS` | Lecture des captures d'offres (modèle principal puis secours, par défaut Gemini 3.1 Flash Lite puis GPT-6 Luna) |
| `SECRET_KEY` | Signature des sessions (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Connexion Google (optionnel) |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Connexion LinkedIn (optionnel) |
| `DATABASE_URL` | Base de données (SQLite par défaut) |

Pour Google et LinkedIn, l'URL de redirection à déclarer est `http://localhost:5173/api/auth/{google|linkedin}/callback`.


