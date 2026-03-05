import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";


const POSTER_GRADIENTS = [
    "from-red-900 via-red-800 to-zinc-900",
    "from-blue-900 via-indigo-900 to-zinc-900",
    "from-emerald-900 via-teal-900 to-zinc-900",
    "from-violet-900 via-purple-900 to-zinc-900",
    "from-amber-900 via-orange-900 to-zinc-900",
];

const ACCENT_COLORS = [
    { ring: "ring-red-500", badge: "bg-red-500", glow: "shadow-red-500/30", bar: "bg-red-500" },
    { ring: "ring-blue-500", badge: "bg-blue-500", glow: "shadow-blue-500/30", bar: "bg-blue-500" },
    { ring: "ring-emerald-500", badge: "bg-emerald-500", glow: "shadow-emerald-500/30", bar: "bg-emerald-500" },
    { ring: "ring-violet-500", badge: "bg-violet-500", glow: "shadow-violet-500/30", bar: "bg-violet-500" },
    { ring: "ring-amber-500", badge: "bg-amber-500", glow: "shadow-amber-500/30", bar: "bg-amber-500" },
];

function ScoreRing({ pct }) {
    const r = 20;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

    return (
        <svg width="56" height="56" className="rotate-[-90deg]">
            <circle cx="28" cy="28" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
            <circle
                cx="28" cy="28" r={r} fill="none"
                stroke={color} strokeWidth="5"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
            />
            <text
                x="28" y="28"
                textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize="10" fontWeight="700"
                style={{ transform: "rotate(90deg)", transformOrigin: "28px 28px", fontFamily: "monospace" }}
            >
                {Math.round(pct)}%
            </text>
        </svg>
    );
}

function MovieCard({ rec, index, gradient, accent }) {
    const [hovered, setHovered] = useState(false);
    const initials = rec.title.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                animationDelay: `${index * 120}ms`,
                animation: "cardSlideIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
            className={`
        relative rounded-xl overflow-hidden cursor-pointer
        border border-white/5
        transition-all duration-300
        ${hovered ? `ring-1 ${accent.ring} shadow-2xl ${accent.glow} scale-[1.02] -translate-y-1` : "shadow-lg"}
      `}
        >
            {/* Poster area */}
            <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/20" />
                {/* Decorative circles */}
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
                <span className="relative z-10 text-3xl font-black text-white/80 tracking-widest" style={{ fontFamily: "'Bebas Neue', 'Impact', sans-serif", letterSpacing: "0.15em" }}>
                    {initials}
                </span>
                {/* Rank badge */}
                <div className={`absolute top-3 left-3 w-7 h-7 rounded-full ${accent.badge} flex items-center justify-center`}>
                    <span className="text-white text-xs font-black">#{index + 1}</span>
                </div>
            </div>

            {/* Info area */}
            <div className="bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm leading-snug line-clamp-2 mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", fontSize: "1rem" }}>
                            {rec.title}
                        </h3>
                        {/* Match bar */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${accent.bar} rounded-full`}
                                    style={{
                                        width: hovered ? `${rec.similarity_pct}%` : "0%",
                                        transition: "width 1s cubic-bezier(0.34,1.56,0.64,1)",
                                    }}
                                />
                            </div>
                            <span className="text-zinc-400 text-xs font-mono whitespace-nowrap">
                                {rec.similarity_pct}%
                            </span>
                        </div>
                    </div>
                    <div className="shrink-0">
                        <ScoreRing pct={rec.similarity_pct} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function SearchDropdown({ movies, value, onChange, onSelect, loading }) {
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const filtered = movies
        .filter(t => t.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 8);

    useEffect(() => {
        const handleClick = (e) => {
            if (!listRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div className="relative w-full">
            <div className={`flex items-center bg-zinc-800 border rounded-xl transition-all duration-300 ${focused ? "border-red-500 shadow-lg shadow-red-500/20" : "border-zinc-700"}`}>
                {/* Search icon */}
                <svg className="ml-4 shrink-0 text-zinc-400 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={e => { onChange(e.target.value); setOpen(true); }}
                    onFocus={() => { setFocused(true); setOpen(true); }}
                    onBlur={() => setFocused(false)}
                    placeholder={loading ? "Loading movies…" : "Search for a movie…"}
                    disabled={loading}
                    className="flex-1 bg-transparent text-white placeholder-zinc-500 px-3 py-4 outline-none text-base"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                {value && (
                    <button onClick={() => { onChange(""); onSelect(""); setOpen(false); }} className="mr-3 text-zinc-500 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {open && filtered.length > 0 && (
                <ul
                    ref={listRef}
                    className="absolute z-50 mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
                    style={{ animation: "dropdownFade 0.15s ease both" }}
                >
                    {filtered.map((title, i) => (
                        <li key={i}>
                            <button
                                onMouseDown={() => { onSelect(title); onChange(title); setOpen(false); }}
                                className="w-full text-left px-4 py-3 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors text-sm flex items-center gap-3"
                                style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                                <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 10-4 4m0 0-4-4m4 4V3M4 19h16" />
                                </svg>
                                <span dangerouslySetInnerHTML={{
                                    __html: (() => {
                                        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                        return title.replace(new RegExp(`(${escaped})`, "gi"), `<mark class="bg-red-500/30 text-red-300 rounded px-0.5">$1</mark>`);
                                    })()
                                }} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function MovieRecommender() {
    const [movies, setMovies] = useState([]);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState("");
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState("idle"); // idle | loading-movies | loading-recs | error | done
    const [error, setError] = useState("");
    const [didYouMean, setDidYouMean] = useState([]);

    // Fetch all movie titles on mount
    useEffect(() => {
        setStatus("loading-movies");
        fetch(`${API_BASE}/movies`)
            .then(r => r.json())
            .then(data => {
                setMovies(data.titles || []);
                setStatus("idle");
            })
            .catch(() => {
                setError("Could not reach the API. Make sure the Flask server is running on port 5000.");
                setStatus("error");
            });
    }, []);

    const fetchRecommendations = useCallback(async (title) => {
        if (!title.trim()) return;
        setStatus("loading-recs");
        setResults([]);
        setError("");
        setDidYouMean([]);

        try {
            const res = await fetch(`${API_BASE}/recommend`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Something went wrong.");
                if (data.did_you_mean) setDidYouMean(data.did_you_mean);
                setStatus("error");
                return;
            }

            setResults(data.recommendations || []);
            setStatus("done");
        } catch {
            setError("Network error – is the Flask server running?");
            setStatus("error");
        }
    }, []);

    const handleSearch = () => fetchRecommendations(query);

    const isLoadingMovies = status === "loading-movies";
    const isLoadingRecs = status === "loading-recs";

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }

        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes dropdownFade {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

            <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>

                {/* Subtle scanline overlay */}
                <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.03]">
                    <div style={{ width: "100%", height: "2px", background: "white", animation: "scanline 8s linear infinite" }} />
                </div>

                {/* Noise texture overlay */}
                <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />

                <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">

                    {/* Header */}
                    <header className="mb-10 text-center">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="w-8 h-1 bg-red-600 rounded-full" />
                            <span className="text-red-500 text-xs font-bold tracking-[0.3em] uppercase">AI Powered</span>
                            <div className="w-8 h-1 bg-red-600 rounded-full" />
                        </div>
                        <h1 className="text-white font-black leading-none mb-3"
                            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 10vw, 5rem)", letterSpacing: "0.05em" }}>
                            CINE<span className="text-red-600">MATCH</span>
                        </h1>
                        <p className="text-zinc-400 text-sm font-light tracking-wide">
                            Discover films you'll love — powered by cosine similarity
                        </p>
                    </header>

                    {/* Search card */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-8 backdrop-blur-sm shadow-2xl">
                        <label className="block text-zinc-400 text-xs font-semibold tracking-[0.2em] uppercase mb-3">
                            Select a Movie
                        </label>

                        <div className="flex gap-3">
                            <div className="flex-1">
                                <SearchDropdown
                                    movies={movies}
                                    value={query}
                                    onChange={(val) => { setQuery(val); setSelected(""); }}   // ← this clears selected when user types
                                    onSelect={(val) => { setSelected(val); setQuery(val); }}  // ← this sets both when dropdown item clicked
                                    loading={isLoadingMovies}
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={isLoadingRecs || (!query && !selected)}
                                className={`
                  px-6 py-4 rounded-xl font-bold text-sm tracking-wider uppercase transition-all duration-200
                  ${isLoadingRecs || (!query && !selected)
                                        ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                                        : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 hover:shadow-red-700/40 hover:scale-105 active:scale-95"}
                `}
                                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.1em", fontSize: "1rem" }}
                            >
                                {isLoadingRecs ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : "Find"}
                            </button>
                        </div>

                        {/* Movie count */}
                        {movies.length > 0 && (
                            <p className="mt-3 text-zinc-600 text-xs">
                                <span className="text-zinc-400 font-semibold">{movies.length.toLocaleString()}</span> movies in database
                            </p>
                        )}
                    </div>

                    {/* Loading state */}
                    {isLoadingRecs && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-2 border-red-500/30"
                                    style={{ animation: "pulse-ring 1.5s ease infinite" }} />
                                <div className="absolute inset-2 rounded-full border-2 border-red-500/60"
                                    style={{ animation: "pulse-ring 1.5s ease infinite 0.3s" }} />
                                <div className="absolute inset-4 rounded-full bg-red-600"
                                    style={{ animation: "pulse-ring 1.5s ease infinite 0.6s" }} />
                            </div>
                            <p className="text-zinc-400 text-sm tracking-widest uppercase font-light">Analysing…</p>
                        </div>
                    )}

                    {/* Error state */}
                    {status === "error" && (
                        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-5 mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                                </svg>
                                <div>
                                    <p className="text-red-300 font-semibold text-sm mb-1">{error}</p>
                                    {didYouMean.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-zinc-400 text-xs mb-2">Did you mean:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {didYouMean.map((t, i) => (
                                                    <button key={i} onClick={() => { setQuery(t); setSelected(t); fetchRecommendations(t); }}
                                                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-full text-zinc-300 text-xs transition-colors">
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-1 h-6 bg-red-600 rounded-full" />
                                <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.08em", fontSize: "1.4rem" }}>
                                    Because you liked{" "}
                                    <span className="text-red-400">{selected || query}</span>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {results.map((rec, i) => (
                                    <MovieCard
                                        key={rec.title}
                                        rec={rec}
                                        index={i}
                                        gradient={POSTER_GRADIENTS[i % POSTER_GRADIENTS.length]}
                                        accent={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                                    />
                                ))}
                            </div>

                            <p className="mt-6 text-center text-zinc-600 text-xs">
                                Scores reflect cosine similarity on TF-IDF tag vectors
                            </p>
                        </div>
                    )}

                    {/* Empty state */}
                    {status === "idle" && results.length === 0 && movies.length > 0 && (
                        <div className="text-center py-16">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-800/60 border border-zinc-700 mb-5">
                                <svg className="w-9 h-9 text-zinc-600" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125h15M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h.75" />
                                </svg>
                            </div>
                            <p className="text-zinc-500 text-sm font-light">Search for a movie above to discover similar titles</p>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}