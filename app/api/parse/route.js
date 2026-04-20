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
Return ONLY a JSON array, no other text, in this exact format:
[
  { "time": "9:00", "activity": "description of activity" },
  { "time": "9:45", "activity": "description of activity" }
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
