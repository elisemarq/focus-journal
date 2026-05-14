import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are reading a handwritten interstitial journal page.
Extract every time entry you can see.

For each time, preserve any AM/PM marker the writer used (e.g. "9:00am", "1:30pm").
If the writer did not write AM/PM, infer from page order and context:
- Entries earlier on the page or before "lunch"/"noon"/"12pm" are usually AM.
- Entries after lunch are usually PM (1–7 without AM/PM almost always means PM).
- If genuinely ambiguous, omit the marker rather than guessing wrong.
24-hour times (e.g. "14:30") should be passed through as-is.

Return ONLY a JSON array, no other text, in this exact format:
[
  { "time": "9:00am", "activity": "description of activity" },
  { "time": "1:30pm", "activity": "description of activity" }
]
If a time is unclear, write your best guess followed by a ? like "9:??"
If an activity is unclear, write your best guess followed by [?]`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const text = response.choices[0].message.content;
    const clean = text.replace(/```json|```/g, "").trim();
    const entries = JSON.parse(clean);

    return Response.json({ entries });
  } catch (error) {
    console.error("Parse error:", error);
    return Response.json(
      { error: "Failed to parse journal" },
      { status: 500 }
    );
  }
}
