"use client";
import { useState } from "react";

const TAGS = [
  { id: "deep", emoji: "🟢", label: "Deep work" },
  { id: "interrupt", emoji: "🔴", label: "Interruption" },
  { id: "neutral", emoji: "⚪", label: "Neutral" },
];

export default function Home() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [editActivity, setEditActivity] = useState("");
  const [confirmed, setConfirmed] = useState(new Set());
  const [insights, setInsights] = useState(null);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(",")[1];
      setPreview(event.target.result);
      setLoading(true);
      setError(null);
      setEntries([]);
      setConfirmed(new Set());
      setInsights(null);
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setEntries(data.entries.map((e, i) => ({
          ...e, id: i, tag: "neutral",
          confidence: e.time.includes("?") || e.activity.includes("[?]") ? "low" : "high",
        })));
      } catch (err) {
        setError("Something went wrong — try again!");
        setPreview(null);
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditTime(entry.time);
    setEditActivity(entry.activity);
  };

  const saveEdit = (id) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, time: editTime, activity: editActivity, confidence: "high" } : e
    ));
    setConfirmed(prev => new Set([...prev, id]));
    setEditingId(null);
  };

  const confirmEntry = (id) => {
    setConfirmed(prev => new Set([...prev, id]));
  };

  const confirmAll = () => {
    setConfirmed(new Set(entries.map(e => e.id)));
  };

  const setTag = (id, tag) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, tag } : e));
    setConfirmed(prev => new Set([...prev, id]));
  };

  const handleAnalyse = async () => {
    setAnalysing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
  entries,
  date: new Date().toISOString().split("T")[0],
}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsights(data.insights);
    } catch (err) {
      setError("Couldn't analyse — try again!");
    }
    setAnalysing(false);
  };

  const reset = () => {
    setPreview(null);
    setEntries([]);
    setConfirmed(new Set());
    setInsights(null);
    setError(null);
  };

  const flaggedCount = entries.filter(e => e.confidence === "low" && !confirmed.has(e.id)).length;
  const allConfirmed = entries.length > 0 && entries.every(e => confirmed.has(e.id));
  const deepCount = entries.filter(e => e.tag === "deep").length;
  const interruptCount = entries.filter(e => e.tag === "interrupt").length;

  // UPLOAD SCREEN
  if (!preview && !loading) {
    return (
      <main style={{
        minHeight: "100vh", background: "#0c0c14",
        color: "#ede8ff", fontFamily: "monospace",
        padding: "40px 20px", maxWidth: "480px", margin: "0 auto",
      }}>
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "3px", marginBottom: "8px" }}>
            FOCUS JOURNAL
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: "normal", color: "#6ee7c7" }}>
            Snap your journal.
          </h1>
          <p style={{ color: "#7870a8", fontSize: "13px", margin: 0 }}>
            We'll read your handwriting and pull out your day.
          </p>
        </div>
        <label style={{
          display: "block", background: "rgba(110,231,199,0.05)",
          border: "2px dashed rgba(110,231,199,0.25)",
          borderRadius: "16px", padding: "48px 20px",
          textAlign: "center", cursor: "pointer",
        }}>
          <input type="file" accept="image/*" capture="environment"
            onChange={handlePhoto} style={{ display: "none" }} />
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📸</div>
          <div style={{ color: "#6ee7c7", fontSize: "15px", marginBottom: "6px" }}>
            Tap to photograph your journal
          </div>
          <div style={{ color: "#6860a0", fontSize: "11px" }}>
            or choose an image from your gallery
          </div>
        </label>
        {error && (
          <div style={{
            marginTop: "20px", background: "rgba(245,122,106,0.1)",
            border: "1px solid rgba(245,122,106,0.3)",
            borderRadius: "8px", padding: "14px 16px",
            color: "#f57a6a", fontSize: "13px",
          }}>{error}</div>
        )}
      </main>
    );
  }

  // LOADING SCREEN
  if (loading || analysing) {
    return (
      <main style={{
        minHeight: "100vh", background: "#0c0c14",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "monospace",
      }}>
        <div style={{ fontSize: "40px", marginBottom: "20px" }}>
          {analysing ? "💡" : "🔍"}
        </div>
        <div style={{ color: "#6ee7c7", fontSize: "14px", marginBottom: "8px" }}>
          {analysing ? "Finding your patterns..." : "Reading your handwriting..."}
        </div>
        <div style={{ color: "#6860a0", fontSize: "11px" }}>This takes about 10 seconds</div>
      </main>
    );
  }

  // INSIGHTS SCREEN
  if (insights) {
    const scoreColor = insights.dayScore?.score >= 7 ? "#6ee7c7"
      : insights.dayScore?.score >= 5 ? "#f5d06a" : "#f5a97f";
    return (
      <main style={{
        minHeight: "100vh", background: "#0c0c14",
        color: "#ede8ff", fontFamily: "monospace",
        padding: "32px 20px 100px",
        maxWidth: "480px", margin: "0 auto",
      }}>
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "3px", marginBottom: "8px" }}>
            FOCUS · YOUR DAY
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "normal", color: "#e8e0ff" }}>
              {insights.dayScore?.label || "Today's patterns"}
            </h2>
            {insights.dayScore?.score && (
              <div style={{
                background: `${scoreColor}15`,
                border: `1px solid ${scoreColor}40`,
                borderRadius: "8px", padding: "8px 14px", textAlign: "center",
              }}>
                <div style={{ fontSize: "24px", color: scoreColor, fontWeight: "bold" }}>
                  {insights.dayScore.score}
                </div>
                <div style={{ fontSize: "9px", color: "#6860a0" }}>/ 10</div>
              </div>
            )}
          </div>

          {/* User-tagged summary */}
          <div style={{
            display: "flex", gap: "8px", marginTop: "14px",
          }}>
            <div style={{
              flex: 1, background: "rgba(110,231,199,0.06)",
              border: "1px solid rgba(110,231,199,0.15)",
              borderRadius: "8px", padding: "10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "18px", color: "#6ee7c7", fontWeight: "bold" }}>{deepCount}</div>
              <div style={{ fontSize: "9px", color: "#3a7060", marginTop: "2px" }}>🟢 deep work blocks</div>
            </div>
            <div style={{
              flex: 1, background: "rgba(245,122,106,0.06)",
              border: "1px solid rgba(245,122,106,0.15)",
              borderRadius: "8px", padding: "10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "18px", color: "#f57a6a", fontWeight: "bold" }}>{interruptCount}</div>
              <div style={{ fontSize: "9px", color: "#7a3030", marginTop: "2px" }}>🔴 interruptions</div>
            </div>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", padding: "10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "18px", color: "#6a6488", fontWeight: "bold" }}>
                {entries.length - deepCount - interruptCount}
              </div>
              <div style={{ fontSize: "9px", color: "#7870a8", marginTop: "2px" }}>⚪ neutral</div>
            </div>
          </div>

          {insights.dayScore?.summary && (
            <p style={{
              margin: "14px 0 0", fontSize: "13px", color: "#b8b0e0",
              lineHeight: 1.7, fontStyle: "italic",
            }}>
              {insights.dayScore.summary}
            </p>
          )}
        </div>

        {insights.focusWindow && (
          <div style={{
            background: "rgba(110,231,199,0.06)",
            border: "1px solid rgba(110,231,199,0.2)",
            borderRadius: "12px", padding: "20px", marginBottom: "14px",
          }}>
            <div style={{ fontSize: "10px", color: "#3a7060", letterSpacing: "2px", marginBottom: "10px" }}>
              ⚡ FOCUS WINDOW
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
              <div style={{
                background: "rgba(110,231,199,0.1)", borderRadius: "8px",
                padding: "10px 14px", textAlign: "center", flexShrink: 0,
              }}>
                <div style={{ fontSize: "22px", color: "#6ee7c7", fontWeight: "bold" }}>
                  {insights.focusWindow.duration}m
                </div>
                <div style={{ fontSize: "9px", color: "#3a7060" }}>longest block</div>
              </div>
              <div>
                <div style={{ fontSize: "13px", color: "#c0b8d8", marginBottom: "4px" }}>
                  {insights.focusWindow.start} – {insights.focusWindow.end}
                </div>
                <div style={{ fontSize: "12px", color: "#5a5878", lineHeight: 1.5 }}>
                  {insights.focusWindow.activity}
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#6ee7c7", lineHeight: 1.6, opacity: 0.8, fontStyle: "italic" }}>
              "{insights.focusWindow.insight}"
            </p>
          </div>
        )}

        {insights.interruptionCost && (
          <div style={{
            background: "rgba(245,169,127,0.06)",
            border: "1px solid rgba(245,169,127,0.2)",
            borderRadius: "12px", padding: "20px", marginBottom: "14px",
          }}>
            <div style={{ fontSize: "10px", color: "#7a5030", letterSpacing: "2px", marginBottom: "10px" }}>
              🔀 INTERRUPTION COST
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
              <div style={{
                background: "rgba(245,169,127,0.1)", borderRadius: "8px",
                padding: "10px 14px", textAlign: "center", flexShrink: 0,
              }}>
                <div style={{ fontSize: "22px", color: "#f5a97f", fontWeight: "bold" }}>
                  {insights.interruptionCost.count}
                </div>
                <div style={{ fontSize: "9px", color: "#7a5030" }}>interruptions</div>
              </div>
              <div style={{ paddingTop: "4px" }}>
                {insights.interruptionCost.triggers?.map((t, i) => (
                  <span key={i} style={{
                    display: "inline-block",
                    background: "rgba(245,169,127,0.1)",
                    border: "1px solid rgba(245,169,127,0.2)",
                    borderRadius: "20px", padding: "2px 10px",
                    fontSize: "11px", color: "#f5a97f",
                    marginRight: "6px", marginBottom: "6px",
                  }}>{t}</span>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#f5a97f", lineHeight: 1.6, opacity: 0.8, fontStyle: "italic" }}>
              "{insights.interruptionCost.insight}"
            </p>
          </div>
        )}

        {insights.energyPattern && (
          <div style={{
            background: "rgba(196,168,245,0.06)",
            border: "1px solid rgba(196,168,245,0.2)",
            borderRadius: "12px", padding: "20px", marginBottom: "24px",
          }}>
            <div style={{ fontSize: "10px", color: "#6a4880", letterSpacing: "2px", marginBottom: "10px" }}>
              🔮 ENERGY PATTERN
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div style={{
                flex: 1, background: "rgba(110,231,199,0.08)",
                borderRadius: "8px", padding: "10px", textAlign: "center",
              }}>
                <div style={{ fontSize: "10px", color: "#3a7060", marginBottom: "4px" }}>PEAK</div>
                <div style={{ fontSize: "12px", color: "#6ee7c7" }}>{insights.energyPattern.peakTime}</div>
              </div>
              <div style={{
                flex: 1, background: "rgba(245,169,127,0.08)",
                borderRadius: "8px", padding: "10px", textAlign: "center",
              }}>
                <div style={{ fontSize: "10px", color: "#7a5030", marginBottom: "4px" }}>LOW</div>
                <div style={{ fontSize: "12px", color: "#f5a97f" }}>{insights.energyPattern.lowTime || "unclear"}</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#c4a8f5", lineHeight: 1.6, opacity: 0.8, fontStyle: "italic" }}>
              "{insights.energyPattern.insight}"
            </p>
          </div>
        )}

        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "16px 20px",
          background: "rgba(12,12,20,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(10px)",
        }}>
          <button onClick={reset} style={{
            width: "100%",
            background: "rgba(110,231,199,0.08)",
            border: "1px solid rgba(110,231,199,0.2)",
            borderRadius: "10px", padding: "13px",
            color: "#6ee7c7", fontSize: "12px",
            cursor: "pointer", fontFamily: "monospace", letterSpacing: "1px",
          }}>
            + Log another day
          </button>
        </div>
      </main>
    );
  }

  // CORRECTION SCREEN
  return (
    <main style={{
      minHeight: "100vh", background: "#0c0c14",
      color: "#ede8ff", fontFamily: "monospace",
    }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.3)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "2px" }}>
            FOCUS · REVIEW
          </div>
          <div style={{ fontSize: "12px", color: "#9088b8" }}>
            {entries.length} entries
            {flaggedCount > 0 && (
              <span style={{ color: "#f5c84a", marginLeft: "8px" }}>· {flaggedCount} to check</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "60px", height: "3px",
            background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.round((confirmed.size / entries.length) * 100)}%`,
              background: "#6ee7c7", borderRadius: "2px",
              transition: "width 0.3s ease",
            }} />
          </div>
          <span style={{ fontSize: "10px", color: "#7870a8" }}>
            {confirmed.size}/{entries.length}
          </span>
        </div>
      </div>

      {/* Tag legend */}
      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex", gap: "14px", alignItems: "center",
      }}>
        <span style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "1px" }}>TAG EACH ENTRY:</span>
        {TAGS.map(t => (
          <span key={t.id} style={{ fontSize: "11px", color: "#7870a8" }}>
            {t.emoji} {t.label}
          </span>
        ))}
      </div>

      {preview && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "8px" }}>
            YOUR PAGE
          </div>
          <img src={preview} alt="Journal" style={{
            width: "100%", maxHeight: "160px",
            objectFit: "cover", objectPosition: "top",
            borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)",
          }} />
        </div>
      )}

      {flaggedCount === 0 && !allConfirmed && (
        <div style={{ padding: "10px 20px" }}>
          <button onClick={confirmAll} style={{
            width: "100%",
            background: "rgba(110,231,199,0.08)",
            border: "1px solid rgba(110,231,199,0.2)",
            borderRadius: "8px", padding: "9px",
            color: "#6ee7c7", fontSize: "11px",
            cursor: "pointer", fontFamily: "monospace", letterSpacing: "1px",
          }}>
            ✓ All entries look right — confirm all as neutral
          </button>
        </div>
      )}

      <div style={{ padding: "4px 0 100px" }}>
        {entries.map((entry) => {
          const isEditing = editingId === entry.id;
          const isConfirmed = confirmed.has(entry.id);
          const isFlagged = entry.confidence === "low" && !isConfirmed;
          const tagColor = entry.tag === "deep" ? "#6ee7c7"
            : entry.tag === "interrupt" ? "#f57a6a" : "#7870a8";

          return (
            <div key={entry.id} style={{
              padding: "10px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              background: isFlagged ? "rgba(245,200,74,0.04)" : "transparent",
            }}>
              {/* Top row: time + activity */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "8px" }}>
                <div style={{ width: "44px", flexShrink: 0 }}>
                  {isEditing ? (
                    <input value={editTime} onChange={e => setEditTime(e.target.value)}
                      style={{
                        width: "42px", background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(110,231,199,0.4)",
                        borderRadius: "3px", padding: "3px 5px",
                        color: "#6ee7c7", fontSize: "12px",
                        fontFamily: "monospace", outline: "none",
                      }} />
                  ) : (
                    <span style={{
                      fontSize: "13px",
                      color: isConfirmed ? tagColor : isFlagged ? "#f5c84a" : "#6a6488",
                    }}>{entry.time}</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <input autoFocus value={editActivity}
                      onChange={e => setEditActivity(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveEdit(entry.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      style={{
                        width: "100%", background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(110,231,199,0.4)",
                        borderRadius: "3px", padding: "4px 8px",
                        color: "#e8e0ff", fontSize: "13px",
                        fontFamily: "monospace", outline: "none",
                        boxSizing: "border-box",
                      }} />
                  ) : (
                    <span
                      onClick={() => !isEditing && startEdit(entry)}
                      style={{
                        fontSize: "13px", lineHeight: 1.5, cursor: "pointer",
                        color: isConfirmed ? (entry.tag === "deep" ? "#6ee7c7" : entry.tag === "interrupt" ? "#f57a6a" : "#5a5878") : isFlagged ? "#c8b870" : "#d4ceff",
                      }}>
                      {entry.activity}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); saveEdit(entry.id); }}
                      style={{
                        background: "rgba(110,231,199,0.15)",
                        border: "1px solid rgba(110,231,199,0.3)",
                        borderRadius: "3px", padding: "4px 8px",
                        fontSize: "11px", color: "#6ee7c7",
                        cursor: "pointer", fontFamily: "monospace",
                      }}>save</button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "3px", padding: "4px 6px",
                        fontSize: "11px", color: "#7870a8",
                        cursor: "pointer", fontFamily: "monospace",
                      }}>esc</button>
                  </div>
                )}
              </div>

              {/* Tag row */}
              <div style={{ display: "flex", gap: "6px", paddingLeft: "56px" }}>
                {TAGS.map(t => (
                  <button key={t.id}
                    onClick={() => setTag(entry.id, t.id)}
                    style={{
                      background: entry.tag === t.id
                        ? t.id === "deep" ? "rgba(110,231,199,0.15)"
                          : t.id === "interrupt" ? "rgba(245,122,106,0.15)"
                            : "rgba(255,255,255,0.08)"
                        : "transparent",
                      border: entry.tag === t.id
                        ? t.id === "deep" ? "1px solid rgba(110,231,199,0.4)"
                          : t.id === "interrupt" ? "1px solid rgba(245,122,106,0.4)"
                            : "1px solid rgba(255,255,255,0.15)"
                        : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "20px", padding: "3px 10px",
                      fontSize: "11px", cursor: "pointer",
                      fontFamily: "monospace",
                      color: entry.tag === t.id
                        ? t.id === "deep" ? "#6ee7c7"
                          : t.id === "interrupt" ? "#f57a6a"
                            : "#8a8898"
                        : "#2a2840",
                      transition: "all 0.15s ease",
                    }}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "16px 20px",
        background: "rgba(12,12,20,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(10px)",
      }}>
        <button
          onClick={() => allConfirmed && handleAnalyse()}
          disabled={!allConfirmed}
          style={{
            width: "100%",
            background: allConfirmed
              ? "linear-gradient(135deg, #6ee7c7, #4ab880)"
              : "rgba(255,255,255,0.04)",
            border: "none", borderRadius: "10px", padding: "14px",
            fontSize: "13px", fontFamily: "monospace",
            color: allConfirmed ? "#0c0c14" : "#2a2840",
            cursor: allConfirmed ? "pointer" : "default",
            fontWeight: "bold", letterSpacing: "1px",
            transition: "all 0.2s ease",
          }}>
          {allConfirmed
            ? "ANALYSE MY DAY →"
            : `CONFIRM ${entries.length - confirmed.size} MORE TO CONTINUE`}
        </button>
        <button onClick={reset} style={{
          width: "100%", marginTop: "8px",
          background: "transparent", border: "none",
          color: "#2a2840", fontSize: "11px",
          cursor: "pointer", fontFamily: "monospace",
          letterSpacing: "1px", padding: "6px",
        }}>↺ retake photo</button>
      </div>
    </main>
  );
}