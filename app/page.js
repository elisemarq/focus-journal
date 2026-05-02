"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const TAGS = [
  { id: "deep", emoji: "🟢", label: "Deep work" },
  { id: "interrupt", emoji: "🔴", label: "Interruption" },
  { id: "neutral", emoji: "⚪", label: "Neutral" },
];

const STEPS = [
  {
    icon: "📓",
    title: "Keep an interstitial journal",
    description: "Throughout your day, jot down the time and what you're switching to every time your attention shifts. You don't need to be perfect — even rough times work great.",
    example: null,
  },
  {
    icon: "✍️",
    title: "Write time + activity",
    description: "Each entry is just a time and a short description. Write it the moment you switch tasks — before you forget!",
    example: [
      "9:00 — emails",
      "9:45 — working on report",
      "10:30 — meeting with Sarah",
      "11:15 — back to report",
      "12:00 — lunch",
    ],
  },
  {
    icon: "📸",
    title: "Snap and analyse",
    description: "At the end of your day, photograph your journal page. Our AI reads your handwriting and finds patterns in how you spend your time — specific to you, not generic advice.",
    example: null,
  },
];

export default function Home() {
  const [showGuide, setShowGuide] = useState(null);
  const [screen, setScreen] = useState("upload");
  const [goals, setGoals] = useState(["", "", ""]);
  const [completedGoals, setCompletedGoals] = useState(new Set());
  const [carriedGoals, setCarriedGoals] = useState([]);
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
  const [currentStep, setCurrentStep] = useState(0);
  const [user, setUser] = useState(null);

 useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = "/login";
        return;
      }
      setUser(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          window.location.href = "/login";
        } else {
          setUser(session.user);
        }
      }
    );

    const dismissed = localStorage.getItem("guide-dismissed");
    setShowGuide(dismissed !== "true");
    const saved = localStorage.getItem("carried-goals");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        const todayStr = new Date().toISOString().split("T")[0];
        if (parsed.date === yesterdayStr || parsed.date === todayStr) {
          setCarriedGoals(parsed.goals || []);
          setGoals(prev => {
            const merged = [...parsed.goals];
            while (merged.length < 3) merged.push("");
            return merged;
          });
        } else {
          localStorage.removeItem("carried-goals");
        }
      } catch (e) {
        localStorage.removeItem("carried-goals");
      }
    }
  }, []);

  const dismissGuide = () => {
    localStorage.setItem("guide-dismissed", "true");
    setShowGuide(false);
  };

  const reopenGuide = () => {
    setCurrentStep(0);
    setShowGuide(true);
  };

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
          goals: goals.filter(g => g.trim()),
          userId: user?.id,
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

  const carryForward = (goal) => {
    const existing = JSON.parse(localStorage.getItem("carried-goals") || '{"goals":[]}');
    const updatedGoals = [...new Set([...existing.goals, goal])].slice(0, 3);
    localStorage.setItem("carried-goals", JSON.stringify({
      goals: updatedGoals,
      date: new Date().toISOString().split("T")[0],
    }));
    setCarriedGoals(updatedGoals);
  };

  const removeCarriedGoal = (goal) => {
    const updated = carriedGoals.filter(g => g !== goal);
    setCarriedGoals(updated);
    if (updated.length === 0) {
      localStorage.removeItem("carried-goals");
    } else {
      localStorage.setItem("carried-goals", JSON.stringify({
        goals: updated,
        date: new Date().toISOString().split("T")[0],
      }));
    }
  };

  const reset = () => {
    setPreview(null);
    setEntries([]);
    setConfirmed(new Set());
    setInsights(null);
    setError(null);
    setGoals(["", "", ""]);
    setScreen("upload");
    setCompletedGoals(new Set());
  };

  const flaggedCount = entries.filter(e => e.confidence === "low" && !confirmed.has(e.id)).length;
  const allConfirmed = entries.length > 0 && entries.every(e => confirmed.has(e.id));
  const deepCount = entries.filter(e => e.tag === "deep").length;
  const interruptCount = entries.filter(e => e.tag === "interrupt").length;
  const hasGoals = goals.some(g => g.trim());

  if (showGuide === null) return null;

  // GUIDE SCREEN
  if (showGuide) {
    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;
    return (
      <main style={{
        minHeight: "100vh", background: "#0c0c14",
        color: "#ede8ff", fontFamily: "monospace",
        padding: "40px 20px", maxWidth: "480px", margin: "0 auto",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "3px", marginBottom: "8px" }}>
            FOCUS JOURNAL · GUIDE
          </div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "normal", color: "#6ee7c7" }}>
            How it works
          </h1>
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: "3px", borderRadius: "2px",
              background: i <= currentStep ? "#6ee7c7" : "rgba(255,255,255,0.08)",
              transition: "background 0.3s ease",
            }} />
          ))}
        </div>
        <div style={{
          flex: 1, background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(110,231,199,0.15)",
          borderRadius: "16px", padding: "28px", marginBottom: "24px",
        }}>
          <div style={{ fontSize: "56px", marginBottom: "20px", textAlign: "center" }}>
            {step.icon}
          </div>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "8px" }}>
            STEP {currentStep + 1} OF {STEPS.length}
          </div>
          <h2 style={{ margin: "0 0 14px", fontSize: "20px", fontWeight: "normal", color: "#ede8ff", lineHeight: 1.3 }}>
            {step.title}
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#a098c8", lineHeight: 1.8 }}>
            {step.description}
          </p>
          {step.example && (
            <div style={{ background: "#fdf8f0", borderRadius: "10px", padding: "16px 20px" }}>
              <div style={{ fontSize: "10px", color: "#9a8a70", letterSpacing: "2px", marginBottom: "10px", fontFamily: "monospace" }}>
                EXAMPLE PAGE
              </div>
              {step.example.map((entry, i) => (
                <div key={i} style={{
                  display: "flex", gap: "12px", padding: "5px 0",
                  borderBottom: i < step.example.length - 1 ? "1px solid rgba(180,200,230,0.3)" : "none",
                  fontFamily: "'Segoe Script', 'Bradley Hand', cursive",
                }}>
                  <span style={{ color: "#9a7060", fontSize: "13px", minWidth: "40px" }}>
                    {entry.split(" — ")[0]}
                  </span>
                  <span style={{ color: "#3a2a20", fontSize: "13px" }}>
                    {entry.split(" — ")[1]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {currentStep > 0 && (
            <button onClick={() => setCurrentStep(s => s - 1)} style={{
              flex: 1, background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px", padding: "14px",
              fontSize: "13px", fontFamily: "monospace",
              color: "#7870a8", cursor: "pointer", letterSpacing: "1px",
            }}>← back</button>
          )}
          <button
            onClick={() => isLast ? dismissGuide() : setCurrentStep(s => s + 1)}
            style={{
              flex: 2,
              background: isLast ? "linear-gradient(135deg, #6ee7c7, #4ab880)" : "rgba(110,231,199,0.1)",
              border: `1px solid ${isLast ? "transparent" : "rgba(110,231,199,0.3)"}`,
              borderRadius: "10px", padding: "14px",
              fontSize: "13px", fontFamily: "monospace",
              color: isLast ? "#0c0c14" : "#6ee7c7",
              cursor: "pointer", fontWeight: isLast ? "bold" : "normal",
              letterSpacing: "1px", transition: "all 0.2s ease",
            }}>
            {isLast ? "Got it — let's go! →" : "next →"}
          </button>
        </div>
        <button onClick={dismissGuide} style={{
          background: "none", border: "none",
          color: "#3a3858", fontSize: "11px",
          cursor: "pointer", fontFamily: "monospace",
          letterSpacing: "1px", padding: "12px", marginTop: "4px",
        }}>skip guide</button>
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

  // GOALS SCREEN
  if (screen === "goals") {
    return (
      <main style={{
        minHeight: "100vh", background: "#0c0c14",
        color: "#ede8ff", fontFamily: "monospace",
        padding: "40px 20px", maxWidth: "480px", margin: "0 auto",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "3px", marginBottom: "8px" }}>
            FOCUS JOURNAL · TODAY'S GOALS
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: "normal", color: "#6ee7c7" }}>
            What do you need<br />to do today?
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#7870a8", lineHeight: 1.6 }}>
            Set up to 3 goals. At the end of the day, you decide if they're done — no judgment, just clarity.
          </p>
          {carriedGoals.length > 0 && (
            <div style={{
              marginTop: "16px",
              background: "rgba(110,231,199,0.06)",
              border: "1px solid rgba(110,231,199,0.2)",
              borderRadius: "10px", padding: "12px 16px",
            }}>
              <div style={{ fontSize: "10px", color: "#3a7060", letterSpacing: "2px", marginBottom: "6px" }}>
                🔁 CARRIED OVER FROM YESTERDAY
              </div>
              {carriedGoals.map((g, i) => (
                <div key={i} style={{ fontSize: "12px", color: "#a098c8", marginBottom: "3px", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#6ee7c7" }}>→</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px", marginBottom: "32px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${goals[i] ? "rgba(110,231,199,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "12px", padding: "16px 20px",
              transition: "border-color 0.2s ease",
            }}>
              <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "8px" }}>
                GOAL {i + 1} {i > 0 ? "(optional)" : ""}
              </div>
              <input
                value={goals[i]}
                onChange={e => {
                  const newGoals = [...goals];
                  newGoals[i] = e.target.value;
                  setGoals(newGoals);
                }}
                placeholder={
                  i === 0 ? "e.g. Finish the project proposal" :
                  i === 1 ? "e.g. Reply to all pending emails" :
                  "e.g. Take a proper lunch break"
                }
                style={{
                  width: "100%", background: "transparent",
                  border: "none", outline: "none",
                  color: "#ede8ff", fontSize: "14px",
                  fontFamily: "monospace", lineHeight: 1.5,
                  boxSizing: "border-box", caretColor: "#6ee7c7",
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => setScreen("upload")}
            disabled={!goals[0].trim()}
            style={{
              width: "100%",
              background: goals[0].trim()
                ? "linear-gradient(135deg, #6ee7c7, #4ab880)"
                : "rgba(255,255,255,0.04)",
              border: "none", borderRadius: "10px", padding: "14px",
              fontSize: "13px", fontFamily: "monospace",
              color: goals[0].trim() ? "#0c0c14" : "#3a3858",
              cursor: goals[0].trim() ? "pointer" : "default",
              fontWeight: "bold", letterSpacing: "1px",
              transition: "all 0.2s ease",
            }}>
            {goals[0].trim() ? "Save goals → snap journal" : "Enter at least one goal"}
          </button>
          <button onClick={() => { setGoals(["", "", ""]); setScreen("upload"); }} style={{
            background: "none", border: "none",
            color: "#3a3858", fontSize: "11px",
            cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "1px", padding: "6px",
          }}>skip — no goals today</button>
        </div>
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
        padding: "32px 20px 120px",
        maxWidth: "480px", margin: "0 auto",
      }}>
        {/* Day score header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "3px", marginBottom: "8px" }}>
            FOCUS · YOUR DAY
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "normal", color: "#ede8ff" }}>
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
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <div style={{
              flex: 1, background: "rgba(110,231,199,0.06)",
              border: "1px solid rgba(110,231,199,0.15)",
              borderRadius: "8px", padding: "10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "18px", color: "#6ee7c7", fontWeight: "bold" }}>{deepCount}</div>
              <div style={{ fontSize: "9px", color: "#3a7060", marginTop: "2px" }}>🟢 deep work</div>
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
              <div style={{ fontSize: "9px", color: "#3a3858", marginTop: "2px" }}>⚪ neutral</div>
            </div>
          </div>
          {insights.dayScore?.summary && (
            <p style={{ margin: "14px 0 0", fontSize: "13px", color: "#b8b0e0", lineHeight: 1.7, fontStyle: "italic" }}>
              {insights.dayScore.summary}
            </p>
          )}
        </div>

        {/* Goals checklist — 100% user driven */}
        {hasGoals && goals.filter(g => g.trim()).length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px", padding: "20px",
            marginBottom: "14px",
          }}>
            <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "6px" }}>
              🎯 TODAY'S GOALS
            </div>
            <p style={{ margin: "0 0 14px", fontSize: "11px", color: "#3a3858", fontFamily: "monospace" }}>
              tap to mark complete
            </p>
            {goals.filter(g => g.trim()).map((goal, i) => {
              const isDone = completedGoals.has(goal);
              return (
                <div key={i} style={{
                  marginBottom: i < goals.filter(g => g.trim()).length - 1 ? "12px" : 0,
                  paddingBottom: i < goals.filter(g => g.trim()).length - 1 ? "12px" : 0,
                  borderBottom: i < goals.filter(g => g.trim()).length - 1
                    ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div
                    onClick={() => {
                      setCompletedGoals(prev => {
                        const next = new Set(prev);
                        next.has(goal) ? next.delete(goal) : next.add(goal);
                        return next;
                      });
                    }}
                    style={{
                      display: "flex", gap: "12px",
                      alignItems: "flex-start", cursor: "pointer",
                    }}>
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "6px",
                      border: `2px solid ${isDone ? "#6ee7c7" : "rgba(255,255,255,0.2)"}`,
                      background: isDone ? "rgba(110,231,199,0.15)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: "1px",
                      transition: "all 0.2s ease",
                    }}>
                      {isDone && <span style={{ color: "#6ee7c7", fontSize: "13px" }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: "13px",
                        color: isDone ? "#6ee7c7" : "#c8c0f0",
                        textDecoration: isDone ? "line-through" : "none",
                        opacity: isDone ? 0.7 : 1,
                        lineHeight: 1.5,
                        transition: "all 0.2s ease",
                      }}>
                        {goal}
                      </div>
                      {isDone && (
                        <div style={{ fontSize: "11px", color: "#6ee7c7", opacity: 0.6, marginTop: "3px" }}>
                          Nice work! 🌿
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Carry forward — only unchecked goals */}
        {hasGoals && goals.filter(g => g.trim()).some(g => !completedGoals.has(g)) && (
          <div style={{
            background: "rgba(160,152,200,0.08)",
            border: "1px solid rgba(160,152,200,0.2)",
            borderRadius: "12px", padding: "16px 20px",
            marginBottom: "14px",
          }}>
            <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "10px" }}>
              🔁 CARRY FORWARD?
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#a098c8", lineHeight: 1.6 }}>
              These didn't quite make it today — want to try again tomorrow?
            </p>
            {goals.filter(g => g.trim() && !completedGoals.has(g)).map((goal, i) => {
              const alreadyCarried = carriedGoals.includes(goal);
              return (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: "10px", marginBottom: "8px",
                }}>
                  <span style={{ fontSize: "12px", color: "#c8c0f0", flex: 1 }}>
                    💙 {goal}
                  </span>
                  <button
                    onClick={() => alreadyCarried ? removeCarriedGoal(goal) : carryForward(goal)}
                    style={{
                      background: alreadyCarried ? "rgba(110,231,199,0.15)" : "rgba(160,152,200,0.1)",
                      border: `1px solid ${alreadyCarried ? "rgba(110,231,199,0.4)" : "rgba(160,152,200,0.25)"}`,
                      borderRadius: "20px", padding: "4px 12px",
                      fontSize: "11px", fontFamily: "monospace",
                      color: alreadyCarried ? "#6ee7c7" : "#a098c8",
                      cursor: "pointer", flexShrink: 0,
                      transition: "all 0.15s ease", whiteSpace: "nowrap",
                    }}>
                    {alreadyCarried ? "✓ added" : "+ tomorrow"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Focus window */}
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
                <div style={{ fontSize: "13px", color: "#d4ceff", marginBottom: "4px" }}>
                  {insights.focusWindow.start} – {insights.focusWindow.end}
                </div>
                <div style={{ fontSize: "12px", color: "#a098c8", lineHeight: 1.5 }}>
                  {insights.focusWindow.activity}
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#6ee7c7", lineHeight: 1.6, opacity: 0.8, fontStyle: "italic" }}>
              "{insights.focusWindow.insight}"
            </p>
          </div>
        )}

        {/* Interruption cost */}
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

        {/* Energy pattern */}
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

        {/* Bottom bar */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "16px 20px",
          background: "rgba(12,12,20,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(10px)",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <button onClick={reset} style={{
            width: "100%",
            background: "rgba(110,231,199,0.08)",
            border: "1px solid rgba(110,231,199,0.2)",
            borderRadius: "10px", padding: "13px",
            color: "#6ee7c7", fontSize: "12px",
            cursor: "pointer", fontFamily: "monospace", letterSpacing: "1px",
          }}>+ Log another day</button>
          <a href="https://ko-fi.com/focusjournal" target="_blank" rel="noopener noreferrer" style={{
            display: "block", textAlign: "center", padding: "8px",
            fontSize: "12px", color: "#f5d06a", fontFamily: "monospace",
            letterSpacing: "1px", textDecoration: "none", opacity: 0.8,
          }}>☕ buy me a coffee</a>
          <button onClick={reopenGuide} style={{
            background: "none", border: "none",
            color: "#3a3858", fontSize: "11px",
            cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "1px", padding: "4px",
          }}>? show guide again</button>
        </div>
      </main>
    );
  }

  // UPLOAD SCREEN
  if (!preview && !loading && screen === "upload") {
    return (
      <main style={{
        minHeight: "100vh", background: "#0c0c14",
        color: "#ede8ff", fontFamily: "monospace",
        padding: "40px 20px", maxWidth: "480px", margin: "0 auto",
      }}>
        <div style={{ marginBottom: "32px" }}>
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

        {hasGoals && (
          <div style={{
            background: "rgba(110,231,199,0.05)",
            border: "1px solid rgba(110,231,199,0.15)",
            borderRadius: "12px", padding: "14px 16px", marginBottom: "20px",
          }}>
            <div style={{ fontSize: "10px", color: "#3a7060", letterSpacing: "2px", marginBottom: "8px" }}>
              🎯 TODAY'S GOALS
            </div>
            {goals.filter(g => g.trim()).map((g, i) => (
              <div key={i} style={{
                fontSize: "12px", color: "#a098c8",
                marginBottom: "4px", display: "flex", gap: "8px",
              }}>
                <span style={{ color: "#6ee7c7" }}>→</span>
                <span>{g}</span>
              </div>
            ))}
            <button onClick={() => setScreen("goals")} style={{
              background: "none", border: "none", color: "#3a7060",
              fontSize: "10px", cursor: "pointer", fontFamily: "monospace",
              letterSpacing: "1px", padding: "4px 0 0", display: "block",
            }}>edit goals</button>
          </div>
        )}

        <label style={{
          display: "block", background: "rgba(110,231,199,0.05)",
          border: "2px dashed rgba(110,231,199,0.25)",
          borderRadius: "16px", padding: "48px 20px",
          textAlign: "center", cursor: "pointer", marginBottom: "14px",
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

        {!hasGoals && (
          <button onClick={() => setScreen("goals")} style={{
            width: "100%",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px", padding: "14px",
            fontSize: "13px", fontFamily: "monospace",
            color: "#7870a8", cursor: "pointer",
            letterSpacing: "1px", marginBottom: "14px",
          }}>
            🎯 What do you need to do today? →
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <button onClick={reopenGuide} style={{
            background: "none", border: "none", color: "#3a3858",
            fontSize: "11px", cursor: "pointer", fontFamily: "monospace", letterSpacing: "1px",
          }}>? show guide</button>
          <button onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }} style={{
            background: "none", border: "none",
            color: "#3a3858", fontSize: "11px",
            cursor: "pointer", fontFamily: "monospace",
            letterSpacing: "1px",
          }}>
            sign out
          </button>
          <a href="https://ko-fi.com/focusjournal" target="_blank" rel="noopener noreferrer" style={{
            fontSize: "11px", color: "#3a3858", fontFamily: "monospace",
            letterSpacing: "1px", textDecoration: "none", opacity: 0.7,
          }}>☕ buy me a coffee</a>
        </div>

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

      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "1px" }}>TAG:</span>
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
          }}>✓ All entries look right — confirm all as neutral</button>
        </div>
      )}

      <div style={{ padding: "4px 0 100px" }}>
        {entries.map((entry) => {
          const isEditing = editingId === entry.id;
          const isConfirmed = confirmed.has(entry.id);
          const isFlagged = entry.confidence === "low" && !isConfirmed;

          return (
            <div key={entry.id} style={{
              padding: "10px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              background: isFlagged ? "rgba(245,200,74,0.04)" : "transparent",
            }}>
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
                      color: isConfirmed ? "#6ee7c7" : isFlagged ? "#f5c84a" : "#9088b8",
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
                        color: "#ede8ff", fontSize: "13px",
                        fontFamily: "monospace", outline: "none",
                        boxSizing: "border-box",
                      }} />
                  ) : (
                    <span onClick={() => !isEditing && startEdit(entry)}
                      style={{
                        fontSize: "13px", lineHeight: 1.5, cursor: "pointer",
                        color: isConfirmed
                          ? entry.tag === "deep" ? "#6ee7c7"
                            : entry.tag === "interrupt" ? "#f57a6a"
                              : "#7870a8"
                          : isFlagged ? "#c8b870" : "#c8c0f0",
                      }}>
                      {entry.activity}
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                    {isConfirmed ? (
                      <span style={{ fontSize: "12px", color: "#3a5a48" }}>✓</span>
                    ) : isFlagged ? (
                      <button onClick={(e) => { e.stopPropagation(); confirmEntry(entry.id); }}
                        style={{
                          background: "rgba(245,200,74,0.1)",
                          border: "1px solid rgba(245,200,74,0.25)",
                          borderRadius: "3px", padding: "3px 8px",
                          fontSize: "10px", color: "#f5c84a",
                          cursor: "pointer", fontFamily: "monospace",
                        }}>✓ ok</button>
                    ) : (
                      <span style={{ fontSize: "10px", color: "#3a3858" }}>tap</span>
                    )}
                  </div>
                )}
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

              <div style={{ display: "flex", gap: "6px", paddingLeft: "56px" }}>
                {TAGS.map(t => (
                  <button key={t.id} onClick={() => setTag(entry.id, t.id)}
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
                        : "#3a3858",
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
        position: "sticky", bottom: 0,
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
            color: allConfirmed ? "#0c0c14" : "#3a3858",
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
          color: "#3a3858", fontSize: "11px",
          cursor: "pointer", fontFamily: "monospace",
          letterSpacing: "1px", padding: "6px",
        }}>↺ retake photo</button>
      </div>
    </main>
  );
}