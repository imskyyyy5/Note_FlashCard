
require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

app.post("/api/flashcards", async (req, res) => {
    try {
        const { text, count = 8 } = req.body;

        if (typeof text !== "string" || !text.trim()) {
            return res.status(400).json({
                error: "Please provide your extracted notes."
            });
        }

        if (text.length > 30000) {
            return res.status(400).json({
                error: "Please submit a shorter section of notes."
            });
        }

        const cardCount = Math.min(
            15,
            Math.max(1, Number(count) || 8)
        );

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: `
You are NoteWise AI, an exam-focused study assistant.

Create up to ${cardCount} useful flashcards from the student's notes.

Rules:
- Select important concepts, not every sentence.
- Prioritize definitions, principles, formulas, key facts,
  comparisons, and cause-and-effect relationships.
- Avoid repetition and trivial details.
- Keep questions clear and answers concise.
- Never invent facts or pretend unclear OCR text is reliable.
- If the notes contain errors or unclear formulas, flag them.
- Use only information supported by the notes.
- Return valid JSON only, using this format:
{
  "flashcards": [
    {
      "question": "Question here",
      "answer": "Answer here"
    }
  ]
}

Student's notes:
${text}
            `
        });

        const raw = response.text;

        if (!raw) {
            throw new Error("The AI returned an empty response.");
        }

        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

        const result = JSON.parse(cleaned);

        if (!Array.isArray(result.flashcards)) {
            throw new Error("The AI returned an invalid flashcard format.");
        }

        const flashcards = result.flashcards
            .filter(card =>
                card &&
                typeof card.question === "string" &&
                typeof card.answer === "string"
            )
            .slice(0, cardCount);

        res.json({ flashcards });

    } catch (error) {
        console.error("Flashcard generation failed:", error.message);

        res.status(500).json({
            error: "Could not generate flashcards. Check the server terminal."
        });
    }
});

app.listen(PORT, () => {
    console.log(`NoteWise AI running at http://localhost:${PORT}`);
});
