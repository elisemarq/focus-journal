import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { transcript } = await request.json();

    console.log("Voice transcript received:", transcript);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `You are parsing a spoken journal entry into a structured format.

The user said: "${transcript}"

Extract the time and activity from what they said.
Times might be spoken as "six thirty", "half past nine", "around 2pm", "just after lunch" etc.
Convert spoken times to numeric format like "6:30", "9:30", "2:00".
If no time is mentioned, return null for time.
If the time is vague like "just after lunch", make a reasonable guess like "12:30".

Return ONLY raw JSON, no backticks:
{
  "time": "6:30" or null,
  "activity": "clean description of what they were doing",
  "confidence": "high" or "low"
}`,
        },
      ],
      max_tokens: 100,
    });

    const text = response.choices[0].message.content;
    console.log("Voice parse response:", text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse" }, { status: 500 });
    }

    const entry = JSON.parse(jsonMatch[0]);
    return Response.json({ entry });

  } catch (error) {
    console.error("Voice error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}