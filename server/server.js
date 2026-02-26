const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = 3000;

// Debug line - remove once working
console.log("API Key loaded:", process.env.ANTHROPIC_API_KEY ? "✅ Found" : "❌ Not found");
console.log("Key value starts with:", process.env.ANTHROPIC_API_KEY?.substring(0, 10));

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/analyze", async (req, res) => {
  const { base64Image, mediaType } = req.body;

  if (!base64Image || !mediaType) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64Image }
              },
              {
                type: "text",
                text: `You are a Japanese language expert. Analyze the Kanji or Japanese word in this image.

IMPORTANT RULES:
- If you see multiple Kanji characters that form a WORD (like 近所, 東京, 日本), treat them FIRST as a complete word, then break down each individual Kanji after.
- If you see a single Kanji, just analyze that one character.

Use this EXACT format:

--- WORD SECTION (only if multiple kanji form a word) ---
WORD: [the full word]
WORD_READING: [hiragana and romaji reading of the full word]
WORD_MEANING: [English meaning of the full word]
WORD_USAGE: [a short natural example sentence using the word in Japanese with English translation]
--- END WORD SECTION ---

Then for EACH individual Kanji character, repeat this block:

KANJI: [single kanji character]
MEANING: [English meaning]
ONYOMI: [On'yomi reading in katakana and romaji]
KUNYOMI: [Kun'yomi reading in hiragana and romaji]
FREQUENCY: [e.g. "Very Common – Top 100 Kanji (~95% of texts)" or "Common – Joyo Kanji" or "Uncommon"]

If no Kanji is found, say: NO_KANJI_FOUND`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    console.log("Claude raw response:", JSON.stringify(data, null, 2));

    if (data.error) {
      console.error("Claude API returned an error:", data.error);
      return res.status(500).json({ error: `Claude API error: ${data.error.message}` });
    }

    if (!data.content || !data.content[0]) {
      console.error("Unexpected response structure:", data);
      return res.status(500).json({ error: "Unexpected response from Claude." });
    }

    res.json({ result: data.content[0].text });

  } catch (err) {
    console.error("Claude API error:", err);
    res.status(500).json({ error: "Something went wrong analyzing the image." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Kanji Analyzer running at http://localhost:${PORT}`);
});