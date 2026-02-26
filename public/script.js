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
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image, mediaType: imageMediaType })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    displayResults(data.result);

  } catch (err) {
    document.getElementById("resultContent").innerHTML =
      `<p style="color:red;">Something went wrong. Please try again.</p>`;
    document.getElementById("results").classList.remove("hidden");
    console.error(err);
  } finally {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("analyzeBtn").classList.remove("hidden");
  }
}

// ── Stroke Order via KanjiVG ───────────────────────────────

async function fetchStrokePaths(kanji) {
  const code = kanji.codePointAt(0).toString(16).padStart(5, "0");
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`;
  try {
    console.log("Fetching stroke SVG from:", url);
    const res = await fetch(url);
    console.log("Response status:", res.status);
    if (!res.ok) return null;
    const svgText = await res.text();
    console.log("SVG preview:", svgText.substring(0, 200));
    return svgText;
  } catch (err) {
    console.error("Stroke fetch error:", err);
    return null;
  }
}

function parsePaths(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  // KanjiVG paths are inside groups - get them in order
  return Array.from(doc.querySelectorAll("path[d]")).map(p => p.getAttribute("d"));
}

function getPointAlongPath(pathEl, t = 0.15) {
  try {
    const len = pathEl.getTotalLength();
    const pt = pathEl.getPointAtLength(len * t);
    return { x: pt.x, y: pt.y };
  } catch {
    return null;
  }
}

async function drawStrokeOrder(kanji, canvas) {
  const ctx = canvas.getContext("2d");
  const size = 109;
  canvas.width = size;
  canvas.height = size;
  const scale = size / 109; // KanjiVG viewBox is 109x109

  // Background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);

  // Light grid lines for reference
  ctx.strokeStyle = "#f0e0e0";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
  ctx.stroke();

  const svgText = await fetchStrokePaths(kanji);
  if (!svgText) {
    ctx.fillStyle = "#aaa";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Not available", size / 2, size / 2);
    return;
  }

  const pathStrings = parsePaths(svgText);
  if (!pathStrings.length) return;

  // Draw each stroke
  pathStrings.forEach((d, i) => {
    // Create a temporary SVG path to measure
    const svgNS = "http://www.w3.org/2000/svg";
    const tempSvg = document.createElementNS(svgNS, "svg");
    tempSvg.setAttribute("viewBox", "0 0 109 109");
    tempSvg.style.position = "absolute";
    tempSvg.style.opacity = "0";
    tempSvg.style.pointerEvents = "none";
    document.body.appendChild(tempSvg);

    const pathEl = document.createElementNS(svgNS, "path");
    pathEl.setAttribute("d", d);
    tempSvg.appendChild(pathEl);

    // Draw stroke on canvas
    ctx.save();
    ctx.scale(scale, scale);
    const p = new Path2D(d);
    ctx.strokeStyle = "#2c2c2c";
    ctx.lineWidth = 3 / scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(p);
    ctx.restore();

    // Draw stroke number
    const pt = getPointAlongPath(pathEl, 0.1);
    if (pt) {
      const nx = pt.x * scale;
      const ny = pt.y * scale;

      // Red circle background
      ctx.beginPath();
      ctx.arc(nx, ny, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#c0392b";
      ctx.fill();

      // Number
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i + 1, nx, ny);
    }

    document.body.removeChild(tempSvg);
  });
}

// ── Display Results ────────────────────────────────────────

function displayResults(text) {
  const container = document.getElementById("resultContent");
  container.innerHTML = "";

  if (text.includes("NO_KANJI_FOUND")) {
    container.innerHTML = `<p>No Kanji was detected in the image. Please try a clearer photo.</p>`;
    document.getElementById("results").classList.remove("hidden");
    return;
  }

  const wordMatch    = text.match(/WORD:\s*(.+)/);
  const wordReading  = text.match(/WORD_READING:\s*(.+)/);
  const wordMeaning  = text.match(/WORD_MEANING:\s*(.+)/);
  const wordUsage    = text.match(/WORD_USAGE:\s*(.+)/);

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

  const blocks = text.split(/(?=KANJI:)/g).filter(b => b.trim().startsWith("KANJI:"));

  blocks.forEach(block => {
    const get = (label) => {
      const match = block.match(new RegExp(`${label}:\\s*(.+)`));
      return match ? match[1].trim() : "—";
    };

    const kanji = get("KANJI");

    const card = document.createElement("div");
    card.className = "kanji-card";

    // Create canvas for stroke order
    const canvas = document.createElement("canvas");
    canvas.className = "stroke-canvas";
    canvas.title = `Stroke order for ${kanji}`;

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
        </div>
      </div>
    `;

    const strokeDiv = card.querySelector(".stroke-order");
    strokeDiv.appendChild(canvas);
    container.appendChild(card);

    // Draw asynchronously after card is in DOM
    drawStrokeOrder(kanji, canvas);
  });

  document.getElementById("results").classList.remove("hidden");
}