"""
Movie Recommendation Pipeline
------------------------------
Loads a movie dataset, engineers a 'tags' feature from 'overview',
'genres', and 'cast', applies TF-IDF vectorization (5000 features),
computes a Cosine Similarity matrix, and exports both artifacts as .pkl files.

Expected dataset columns (TMDB-style):
    - title       : movie title
    - overview    : plot summary (string)
    - genres      : list of dicts  [{"id": 28, "name": "Action"}, ...]
                    OR plain comma-separated string
    - cast        : list of dicts  [{"name": "Tom Hanks", ...}, ...]
                    OR plain comma-separated string

Outputs:
    - movies.pkl          : cleaned DataFrame with 'tags' column
    - similarity.pkl      : cosine-similarity matrix (numpy ndarray)
"""

import ast
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ──────────────────────────────────────────────
# 1. CONFIGURATION
# ──────────────────────────────────────────────
DATASET_PATH   = "tmdb_5000_movies.csv"   # ← change to your file path
CAST_PATH      = None                      # optional separate credits CSV
MAX_CAST       = 5                         # top-N cast members to keep
TFIDF_FEATURES = 5000
OUTPUT_DIR     = Path(".")                 # directory for .pkl files

# ──────────────────────────────────────────────
# 2. HELPER FUNCTIONS
# ──────────────────────────────────────────────

def _safe_parse(value):
    """Safely parse a stringified Python literal (list/dict)."""
    if isinstance(value, (list, dict)):
        return value
    if not isinstance(value, str) or value.strip() == "":
        return []
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError):
        return value  # return as-is if it's already plain text


def extract_names(value, key: str = "name", top_n: int = None) -> list[str]:
    """
    Extract string values from a list-of-dicts column.
    Falls back gracefully for plain strings or CSV lists.
    """
    parsed = _safe_parse(value)

    if isinstance(parsed, list):
        names = [item[key] for item in parsed if isinstance(item, dict) and key in item]
        if not names:
            # Might be a plain list of strings
            names = [str(i) for i in parsed if isinstance(i, str)]
    elif isinstance(parsed, str):
        # Handle comma-separated plain text
        names = [s.strip() for s in parsed.split(",") if s.strip()]
    else:
        names = []

    if top_n:
        names = names[:top_n]

    # Collapse multi-word names so TF-IDF treats them as single tokens
    return [n.replace(" ", "") for n in names]


def clean_text(text) -> str:
    """Lowercase and strip a plain-text field."""
    if not isinstance(text, str):
        return ""
    return text.lower().strip()


def build_tags(row: pd.Series) -> str:
    """Combine overview, genres, and cast into a single tags string."""
    overview = clean_text(row.get("overview", ""))
    genres   = " ".join(extract_names(row.get("genres", []))).lower()
    cast     = " ".join(extract_names(row.get("cast", []), top_n=MAX_CAST)).lower()
    return f"{overview} {genres} {cast}".strip()


# ──────────────────────────────────────────────
# 3. LOAD DATA
# ──────────────────────────────────────────────

def load_dataset(movie_path: str, cast_path: str | None = None) -> pd.DataFrame:
    """
    Load movies (and optionally a separate credits file) into one DataFrame.
    Handles two common TMDB layouts:
      A) Single CSV with 'genres', 'overview', 'cast' columns
      B) Two CSVs: movies + credits (merged on 'id' or 'movie_id')
    """
    print(f"[INFO] Loading movie data from: {movie_path}")
    movies = pd.read_csv(movie_path)

    # ── Optional credits merge ──────────────────
    if cast_path:
        print(f"[INFO] Loading cast data from:  {cast_path}")
        credits = pd.read_csv(cast_path)

        # Normalise join key
        if "movie_id" in credits.columns:
            credits = credits.rename(columns={"movie_id": "id"})

        movies = movies.merge(credits[["id", "cast"]], on="id", how="left")

    # ── Validate required columns ────────────────
    required = {"overview", "genres"}
    missing  = required - set(movies.columns)
    if missing:
        raise ValueError(
            f"Dataset is missing required column(s): {missing}\n"
            f"Available columns: {list(movies.columns)}"
        )

    if "cast" not in movies.columns:
        print("[WARN] No 'cast' column found – tags will use overview + genres only.")
        movies["cast"] = ""

    return movies


# ──────────────────────────────────────────────
# 4. CLEAN & FEATURE-ENGINEER
# ──────────────────────────────────────────────

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Drop nulls in key columns, reset index, build 'tags' feature."""
    print("[INFO] Cleaning dataframe …")

    df = df.copy()

    # Keep only useful columns (add more as needed)
    keep = [c for c in ["id", "title", "overview", "genres", "cast",
                         "vote_average", "release_date", "popularity"]
            if c in df.columns]
    df = df[keep]

    # Drop rows without an overview (the primary text signal)
    before = len(df)
    df.dropna(subset=["overview"], inplace=True)
    df["overview"].replace("", np.nan, inplace=True)
    df.dropna(subset=["overview"], inplace=True)
    print(f"[INFO] Dropped {before - len(df)} rows with missing overview. "
          f"Remaining: {len(df)}")

    df.reset_index(drop=True, inplace=True)

    # Build combined tags column
    print("[INFO] Building 'tags' column …")
    df["tags"] = df.apply(build_tags, axis=1)

    return df


# ──────────────────────────────────────────────
# 5. TF-IDF VECTORISATION
# ──────────────────────────────────────────────

def vectorise(df: pd.DataFrame, max_features: int = TFIDF_FEATURES):
    """
    Fit a TF-IDF vectoriser on the 'tags' column.

    Returns:
        tfidf_matrix : sparse matrix  (n_movies × max_features)
        vectorizer   : fitted TfidfVectorizer
    """
    print(f"[INFO] Fitting TF-IDF vectoriser (max_features={max_features}) …")

    vectorizer = TfidfVectorizer(
        max_features=max_features,
        stop_words="english",
        ngram_range=(1, 2),   # unigrams + bigrams for richer context
        min_df=2,             # ignore terms appearing in < 2 docs
    )

    tfidf_matrix = vectorizer.fit_transform(df["tags"])
    print(f"[INFO] TF-IDF matrix shape: {tfidf_matrix.shape}")
    return tfidf_matrix, vectorizer


# ──────────────────────────────────────────────
# 6. COSINE SIMILARITY
# ──────────────────────────────────────────────

def compute_similarity(tfidf_matrix) -> np.ndarray:
    """Compute pairwise cosine similarity. Returns a dense (n × n) ndarray."""
    print("[INFO] Computing cosine similarity matrix …")
    sim = cosine_similarity(tfidf_matrix)
    print(f"[INFO] Similarity matrix shape: {sim.shape}")
    return sim


# ──────────────────────────────────────────────
# 7. PERSIST
# ──────────────────────────────────────────────

def save_pickle(obj, filename: str, output_dir: Path = OUTPUT_DIR):
    """Pickle an object to output_dir/filename."""
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / filename
    with open(path, "wb") as f:
        pickle.dump(obj, f, protocol=pickle.HIGHEST_PROTOCOL)
    size_mb = path.stat().st_size / 1_048_576
    print(f"[INFO] Saved {filename}  ({size_mb:.1f} MB)  →  {path.resolve()}")


# ──────────────────────────────────────────────
# 8. RECOMMENDATION DEMO (sanity-check)
# ──────────────────────────────────────────────

def recommend(title: str, df: pd.DataFrame, sim: np.ndarray, top_n: int = 10):
    """Print the top-N most similar movies for a given title."""
    if "title" not in df.columns:
        print("[WARN] No 'title' column – skipping demo.")
        return

    matches = df[df["title"].str.lower() == title.lower()]
    if matches.empty:
        print(f"[WARN] '{title}' not found in dataset.")
        return

    idx      = matches.index[0]
    scores   = list(enumerate(sim[idx]))
    scores   = sorted(scores, key=lambda x: x[1], reverse=True)[1 : top_n + 1]

    print(f"\n  Top {top_n} recommendations for '{title}':")
    print("  " + "─" * 40)
    for rank, (i, score) in enumerate(scores, 1):
        movie_title = df.iloc[i]["title"]
        print(f"  {rank:>2}. {movie_title:<40} (score: {score:.4f})")


# ──────────────────────────────────────────────
# 9. MAIN
# ──────────────────────────────────────────────

def main():
    # ── Load ──────────────────────────────────
    try:
        df = load_dataset(DATASET_PATH, CAST_PATH)
    except FileNotFoundError:
        print(
            f"\n[ERROR] Dataset file not found: '{DATASET_PATH}'\n"
            "  Please update DATASET_PATH at the top of this script.\n"
            "  A popular free dataset: https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata\n"
        )
        sys.exit(1)

    # ── Clean & engineer features ──────────────
    df_clean = clean_dataframe(df)

    # ── Vectorise ─────────────────────────────
    tfidf_matrix, _ = vectorise(df_clean)

    # ── Similarity ────────────────────────────
    similarity = compute_similarity(tfidf_matrix)

    # ── Export ────────────────────────────────
    save_pickle(df_clean,   "movies.pkl")
    save_pickle(similarity, "similarity.pkl")

    # ── Quick demo ────────────────────────────
    sample_title = df_clean["title"].iloc[0] if "title" in df_clean.columns else None
    if sample_title:
        recommend(sample_title, df_clean, similarity)

    print("\n[DONE] Pipeline complete.")


if __name__ == "__main__":
    main()