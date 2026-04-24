import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { entries, date, goals } = await request.json();

    const entriesText = entries
      .map(e => `${e.time} — ${e.activity} [${e.tag}]`)
      .join("\n");

    const goalsText = goals && goals.filter(g => g).length > 0
      ? `\nThe user set these goals for today:\n${goals.filter(g => g).map((g, i) => `${i + 1}. ${g}`).join("\n")}\n`
      : "";

    console.log("Analysing entries:", entriesText);
    console.log("Goals:", goalsText);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `You are a warm, encouraging ADHD productivity coach analysing an interstitial journal.

The user has tagged each entry as one of:
- [deep] = intentional focused work
- [interrupt] = something that pulled them away from deeper work
- [neutral] = normal transition like lunch, commute, admin

Entries with tags:
${entriesText}
${goalsText}
Use the tags as ground truth — do not override what the user has told you.
ONLY reference times and activities explicitly in the entries above.
Never invent data not present in the entries.

${goals && goals.filter(g => g).length > 0 ? `For each goal, return it in goalResults with status "pending" — the user will mark goals complete themselves.` : ""}

Return ONLY raw JSON, no backticks:
{
  "focusWindow": {
    "start": "start time of longest deep work block",
    "end": "end time of longest deep work block",
    "duration": minutes as number,
    "activity": "what they were focused on",
    "insight": "one specific sentence about their best focus block using exact times"
  },
  "interruptionCost": {
    "count": number of entries tagged interrupt,
    "triggers": ["list of activities tagged as interrupt"],
    "insight": "one specific sentence about what interrupted them and when"
  },
  "energyPattern": {
    "peakTime": "time range of deep work blocks",
    "lowTime": "time range of interruptions or neutral blocks or null",
    "insight": "one specific sentence about their energy arc based on their tags"
  },
  "dayScore": {
    "score": number 1-10 based on ratio of deep to interrupt blocks,
    "label": "two or three word label",
    "summary": "two warm specific sentences referencing their actual tagged entries"
  }${goals && goals.filter(g => g).length > 0 ? `,
  "goalResults": [
    ${goals.filter(g => g).map(g => `{
      "goal": "${g}",
      "status": "pending",
      "note": "one short warm encouraging sentence about this goal"
    }`).join(",\n    ")}
  ]` : ""}
}`,
        },
      ],
      max_tokens: 1000,
    });

    const text = response.choices[0].message.content;
    console.log("Raw AI response:", text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse response" }, { status: 500 });
    }

    const insights = JSON.parse(jsonMatch[0]);

    // Save journal day
    const { data: dayData, error: dayError } = await supabase
      .from("journal_days")
      .insert({
        date: date || new Date().toISOString().split("T")[0],
        day_score: insights.dayScore?.score || null,
        day_label: insights.dayScore?.label || null,
        day_summary: insights.dayScore?.summary || null,
      })
      .select()
      .single();

    if (dayError) {
      console.error("Error saving day:", dayError);
      return Response.json({ insights, saved: false });
    }

    // Save entries
    const entryRows = entries.map(e => ({
      journal_day_id: dayData.id,
      time: e.time,
      activity: e.activity,
      tag: e.tag || "neutral",
      confidence: e.confidence || "high",
    }));

    await supabase.from("journal_entries").insert(entryRows);

    // Save goals if any
    if (goals && goals.filter(g => g).length > 0) {
      await supabase.from("journal_goals").insert({
        date: date || new Date().toISOString().split("T")[0],
        goal_1: goals[0] || null,
        goal_2: goals[1] || null,
        goal_3: goals[2] || null,
      });
    }

    console.log("Saved successfully!");
    return Response.json({ insights, saved: true });

  } catch (error) {
    console.error("Analyse error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}