"""
Movie Recommendation Flask API
================================
Endpoints:
  GET  /movies        → returns all movie titles
  POST /recommend     → accepts {"title": "..."}, returns top-5 recommendations

Prerequisites:
  pip install flask flask-cors pandas numpy pickle5

Run:
  python app.py
"""
import requests
import os
import pickle
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

# TMDB API integration

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "fcf0eec5da3b18b1828fad191d0eebdc")
TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"

# ──────────────────────────────────────────────
# APP FACTORY
# ──────────────────────────────────────────────

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes and all origins

# ──────────────────────────────────────────────
# LOAD ARTIFACTS AT STARTUP
# ──────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MOVIES_PKL = os.path.join(BASE_DIR, "movies.pkl")   # ✅ matches preprocessor output
SIM_PKL    = os.path.join(BASE_DIR, "similarity.pkl")


def load_pickle(path: str, label: str):
    """Load a pickle file and surface a clear error if it is missing."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"[STARTUP ERROR] Could not find '{label}' at: {path}\n"
            "  Make sure the .pkl files are in the same directory as app.py."
        )
    with open(path, "rb") as f:
        obj = pickle.load(f)
    print(f"[INFO] Loaded {label}  ({type(obj).__name__})  ←  {path}")
    return obj


movies_df  = load_pickle(MOVIES_PKL, "movies.pkl")   # pandas DataFrame
similarity = load_pickle(SIM_PKL,    "similarity.pkl")   # numpy ndarray (n × n)

# Normalise: ensure we always work with a DataFrame that has a 'title' column
if isinstance(movies_df, pd.Series):
    movies_df = movies_df.to_frame(name="title")

if "title" not in movies_df.columns:
    raise ValueError(
        "[STARTUP ERROR] movie_list.pkl must contain a DataFrame with a 'title' column.\n"
        f"  Found columns: {list(movies_df.columns)}"
    )

# Reset index so positional iloc matches the similarity matrix rows
movies_df = movies_df.reset_index(drop=True)

print(f"[INFO] Dataset: {len(movies_df)} movies  |  "
      f"Similarity matrix: {similarity.shape}")


# ──────────────────────────────────────────────
# HELPER
# ──────────────────────────────────────────────

def fetch_poster(title: str) -> str | None:
    try:
        res = requests.get(TMDB_SEARCH_URL, params={
            "api_key": TMDB_API_KEY,
            "query": title,
            "page": 1,
        }, timeout=5)
        data = res.json()
        results = data.get("results", [])
        if results and results[0].get("poster_path"):
            return TMDB_IMG_BASE + results[0]["poster_path"]
    except Exception:
        pass
    return None


def get_recommendations(title: str, top_n: int = 5) -> list[dict]:
    mask = movies_df["title"].str.lower() == title.strip().lower()
    indices = movies_df.index[mask].tolist()

    if not indices:
        return None

    movie_idx = indices[0]
    sim_scores = list(enumerate(similarity[movie_idx]))
    sim_scores_sorted = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    top_matches = [item for item in sim_scores_sorted if item[0] != movie_idx][:top_n]

    recommendations = []
    for idx, score in top_matches:
        rec_title = movies_df.iloc[idx]["title"]
        recommendations.append({
            "title": rec_title,
            "similarity_pct": round(float(score) * 100, 2),
            "poster": fetch_poster(rec_title),
        })

    return recommendations


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    """Health-check / welcome route."""
    return jsonify({
        "status":    "ok",
        "message":   "Movie Recommendation API is running.",
        "endpoints": {
            "GET  /movies":     "Return list of all movie titles.",
            "POST /recommend":  "Body: {\"title\": \"<movie name>\"} → top-5 recommendations.",
        },
    }), 200


@app.route("/movies", methods=["GET"])
def get_movies():
    """
    GET /movies
    -----------
    Returns a JSON array of every movie title in the dataset.

    Response 200:
        {
            "count":  4800,
            "titles": ["Avatar", "Spectre", ...]
        }
    """
    titles = movies_df["title"].dropna().tolist()
    return jsonify({
        "count":  len(titles),
        "titles": titles,
    }), 200


@app.route("/recommend", methods=["POST"])
def recommend():
    """
    POST /recommend
    ---------------
    Request body (JSON):
        { "title": "The Dark Knight" }

    Response 200:
        {
            "query": "The Dark Knight",
            "recommendations": [
                {"title": "Batman Begins",        "similarity_pct": 74.12},
                {"title": "The Dark Knight Rises","similarity_pct": 71.88},
                ...
            ]
        }

    Response 400 – missing or empty title field.
    Response 404 – title not found in dataset.
    """
    body = request.get_json(silent=True)

    # ── Input validation ──────────────────────
    if not body:
        return jsonify({
            "error": "Request body must be JSON.",
            "hint":  'Example: {"title": "Inception"}',
        }), 400

    title = body.get("title", "").strip()

    if not title:
        return jsonify({
            "error": "The 'title' field is required and must not be empty.",
            "hint":  'Example: {"title": "Inception"}',
        }), 400

    # ── Lookup ────────────────────────────────
    results = get_recommendations(title)

    if results is None:
        # Try to surface close suggestions for a better DX
        lower_titles = movies_df["title"].str.lower()
        suggestions  = movies_df["title"][
            lower_titles.str.contains(title.lower(), na=False, regex=False)
        ].head(5).tolist()

        response = {
            "error": f"Movie '{title}' not found in the dataset.",
        }
        if suggestions:
            response["did_you_mean"] = suggestions

        return jsonify(response), 404

    return jsonify({
        "query":           title,
        "recommendations": results,
    }), 200


# ──────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    print(f"\n  Movie Recommendation API")
    print(f"  ─────────────────────────────")
    print(f"  Running on  http://127.0.0.1:{port}")
    print(f"  Debug mode  {'ON' if debug else 'OFF'}")
    print(f"  Movies      {len(movies_df)}")
    print(f"  Sim matrix  {similarity.shape}\n")

    app.run(host="0.0.0.0", port=port, debug=debug)