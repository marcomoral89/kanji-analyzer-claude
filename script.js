// ⚠️ Replace with your actual Claude API key
const API_KEY = "YOUR_API_KEY_HERE";

let base64Image = "";
let imageMediaType = "";

document.getElementById("imageInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById("fileName").textContent = file.name;
  imageMediaType = file.type;

  const reader = new FileReader();
  reader.onload = function (event) {
    const previewImg = document.getElementById("previewImage");
    previewImg.src = event.target.result;
    document.getElementById("previewContainer").classList.remove("hidden");
    base64Image = event.target.result.split(",")[1];
    document.getElementById("analyzeBtn").classList.remove("hidden");
    document.getElementById("results").classList.add("hidden");
  };
  reader.readAsDataURL(file);
});

async function analyzeKanji() {
  if (!base64Image) return;

  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("analyzeBtn").classList.add("hidden");
  document.getElementById("results").classList.add("hidden");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
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
                source: { type: "base64", media_type: imageMediaType, data: base64Image }
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
    const text = data.content[0].text;
    displayResults(text);

  } catch (err) {
    document.getElementById("resultContent").innerHTML = `<p style="color:red;">Something went wrong. Please check your API key and try again.</p>`;
    document.getElementById("results").classList.remove("hidden");
    console.error(err);
  } finally {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("analyzeBtn").classList.remove("hidden");
  }
}

// Fetch stroke order GIF from KanjiAlive API (free, no key needed)
function getStrokeOrderUrl(kanji) {
  const code = kanji.codePointAt(0).toString(16).padStart(5, "0");
  return `https://raw.githubusercontent.com/mistval/kanji_images/master/gifs/${code}.gif`;
}

function displayResults(text) {
  const container = document.getElementById("resultContent");
  container.innerHTML = "";

  if (text.includes("NO_KANJI_FOUND")) {
    container.innerHTML = `<p>No Kanji was detected in the image. Please try a clearer photo.</p>`;
    document.getElementById("results").classList.remove("hidden");
    return;
  }

  // --- WORD SECTION ---
  const wordMatch = text.match(/WORD:\s*(.+)/);
  const wordReading = text.match(/WORD_READING:\s*(.+)/);
  const wordMeaning = text.match(/WORD_MEANING:\s*(.+)/);
  const wordUsage = text.match(/WORD_USAGE:\s*(.+)/);

  if (wordMatch) {
    const wordCard = document.createElement("div");
    wordCard.className = "word-card";
    wordCard.innerHTML = `
      <h2>${wordMatch[1].trim()}</h2>
      <p><span class="label">🔊 Reading:</span> ${wordReading ? wordReading[1].trim() : "—"}</p>
      <p><span class="label">📖 Meaning:</span> ${wordMeaning ? wordMeaning[1].trim() : "—"}</p>
      ${wordUsage ? `<p><span class="label">💬 Example:</span> <em>${wordUsage[1].trim()}</em></p>` : ""}
    `;
    container.appendChild(wordCard);

    const divider = document.createElement("h3");
    divider.className = "breakdown-title";
    divider.textContent = "Individual Kanji Breakdown";
    container.appendChild(divider);
  }

  // --- INDIVIDUAL KANJI BLOCKS ---
  const blocks = text.split(/(?=KANJI:)/g).filter(b => b.trim().startsWith("KANJI:"));

  blocks.forEach(block => {
    const get = (label) => {
      const match = block.match(new RegExp(`${label}:\\s*(.+)`));
      return match ? match[1].trim() : "—";
    };

    const kanji = get("KANJI");
    const strokeUrl = getStrokeOrderUrl(kanji);

    const card = document.createElement("div");
    card.className = "kanji-card";
    card.innerHTML = `
      <div class="kanji-top">
        <div class="kanji-info">
          <h3>${kanji}</h3>
          <p><span class="label">📖 Meaning:</span> ${get("MEANING")}</p>
          <p><span class="label">🔊 On'yomi:</span> ${get("ONYOMI")}</p>
          <p><span class="label">🔉 Kun'yomi:</span> ${get("KUNYOMI")}</p>
          <p><span class="label">📊 Frequency:</span> ${get("FREQUENCY")}</p>
        </div>
        <div class="stroke-order">
          <p class="label">✍️ Stroke Order</p>
          <img 
            src="${strokeUrl}" 
            alt="Stroke order for ${kanji}"
            onerror="this.parentElement.innerHTML='<p class=stroke-unavailable>Stroke order not available</p>'"
          />
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  document.getElementById("results").classList.remove("hidden");
}