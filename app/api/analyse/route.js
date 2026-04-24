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
      ? goals.filter(g => g).map((g, i) => `${i + 1}. ${g}`).join("\n")
      : null;

    console.log("Analysing entries:", entriesText);
    console.log("Goals:", goalsText);

    const goalResultsFormat = goalsText
      ? `"goalResults": [${goals.filter(g => g).map(g =>
          `{"goal": "${g}", "status": "pending", "note": "one short warm encouraging sentence about this goal"}`
        ).join(", ")}]`
      : `"goalResults": []`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `You are an ADHD productivity coach analysing an interstitial journal.

The user has tagged each entry as one of:
- [deep] = intentional focused work
- [interrupt] = something that pulled them away from deeper work
- [neutral] = normal transition like lunch, commute, admin

Entries with tags:
${entriesText}

${goalsText ? `The user set these goals for today — do NOT judge if they were completed, just return them with status "pending" and a warm encouraging note:\n${goalsText}` : ""}

Use the tags as ground truth — do not override what the user has told you.
ONLY reference times and activities explicitly in the entries above.
Never invent data not present in the entries.

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
  },
  ${goalResultsFormat}
}`,
        },
      ],
      max_tokens: 1200,
    });

    const text = response.choices[0].message.content;
    console.log("Raw AI response:", text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse response" }, { status: 500 });
    }

    const insights = JSON.parse(jsonMatch[0]);

    // Save to database
    const { data: dayData, error: dayError } = await supabase
      .from("journal_days")
      .insert({
        date: date || new Date().toISOString().split("T")[0],
        day_score: insights.dayScore?.score || null,
        day_label: insights.dayScore?.label || null,
        day_summary: insights.dayScore?.summary || null,
        goal_1: goals?.[0] || null,
        goal_2: goals?.[1] || null,
        goal_3: goals?.[2] || null,
        goal_1_status: "pending",
        goal_2_status: "pending",
        goal_3_status: "pending",
      })
      .select()
      .single();

    if (dayError) {
      console.error("Error saving day:", dayError);
      return Response.json({ insights, saved: false });
    }

    const entryRows = entries.map(e => ({
      journal_day_id: dayData.id,
      time: e.time,
      activity: e.activity,
      tag: e.tag || "neutral",
      confidence: e.confidence || "high",
    }));

    const { error: entriesError } = await supabase
      .from("journal_entries")
      .insert(entryRows);

    if (entriesError) {
      console.error("Error saving entries:", entriesError);
      return Response.json({ insights, saved: false });
    }

    console.log("Saved successfully! Day ID:", dayData.id);
    return Response.json({ insights, saved: true, dayId: dayData.id });

  } catch (error) {
    console.error("Analyse error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}