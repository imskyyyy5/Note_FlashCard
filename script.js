
const noteInput = document.getElementById("noteInput");
const previewContainer = document.getElementById("previewContainer");
const readNotesButton = document.getElementById("readNotesButton");
const ocrStatus = document.getElementById("ocrStatus");
const extractedText = document.getElementById("extractedText");
const generateButton = document.getElementById("generateButton");
const cardCount = document.getElementById("cardCount");
const generateStatus = document.getElementById("generateStatus");
const flashcardsContainer = document.getElementById("flashcardsContainer");

let selectedFiles = [];

// Clear results when the selected images change
function clearPreviousResults() {
    extractedText.value = "";
    ocrStatus.textContent = "";
    generateStatus.textContent = "";
    flashcardsContainer.innerHTML = "";
}

// Handle image uploads
noteInput.addEventListener("change", function () {
    const files = Array.from(noteInput.files);

    const validImages = files.filter(file =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    selectedFiles.push(...validImages);

    renderPreviews();
    clearPreviousResults();

    readNotesButton.disabled = selectedFiles.length === 0;

    noteInput.value = "";
});

// Display image previews
function renderPreviews() {
    // Release old preview URLs to avoid unnecessary memory use
    previewContainer.querySelectorAll("img").forEach(image => {
        if (image.src.startsWith("blob:")) {
            URL.revokeObjectURL(image.src);
        }
    });

    previewContainer.innerHTML = "";

    selectedFiles.forEach(function (file, index) {
        const card = document.createElement("div");
        card.className = "preview-card";

        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = `Preview of note ${index + 1}`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-button";
        removeButton.textContent = "Remove image";

        removeButton.addEventListener("click", function () {
            selectedFiles.splice(index, 1);

            renderPreviews();
            clearPreviousResults();

            readNotesButton.disabled = selectedFiles.length === 0;
        });

        card.appendChild(image);
        card.appendChild(removeButton);
        previewContainer.appendChild(card);
    });
}

// Extract text from uploaded images using Tesseract.js
readNotesButton.addEventListener("click", async function () {
    if (selectedFiles.length === 0) {
        ocrStatus.textContent = "Please upload an image first.";
        return;
    }

    if (!window.Tesseract) {
        ocrStatus.textContent =
            "OCR library not loaded. Check your internet connection and refresh the page.";
        return;
    }

    readNotesButton.disabled = true;
    ocrStatus.textContent = "Starting text recognition...";
    extractedText.value = "";

    const allText = [];

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            ocrStatus.textContent =
                `Reading image ${i + 1} of ${selectedFiles.length}...`;

            const result = await Tesseract.recognize(
                selectedFiles[i],
                "eng",
                {
                    logger: function (message) {
                        if (message.status === "recognizing text") {
                            const percent = Math.round(
                                message.progress * 100
                            );

                            ocrStatus.textContent =
                                `Reading image ${i + 1} of ${selectedFiles.length}: ${percent}%`;
                        }
                    }
                }
            );

            const text = result.data.text.trim();

            if (text) {
                allText.push(text);
            }
        }

        extractedText.value = allText.join(
            "\n\n--------------------\n\n"
        );

        if (extractedText.value.trim()) {
            ocrStatus.textContent =
                "Text extracted successfully! Review and correct any OCR mistakes before generating flashcards.";
        } else {
            ocrStatus.textContent =
                "No text detected. Try a clearer image with better lighting.";
        }
    } catch (error) {
        console.error("OCR error:", error);

        ocrStatus.textContent =
            "Could not read the notes. Check your internet connection and try again.";
    } finally {
        readNotesButton.disabled = selectedFiles.length === 0;
    }
});

// Generate AI flashcards from the extracted notes
generateButton.addEventListener("click", async function () {
    const notes = extractedText.value.trim();

    if (!notes) {
        generateStatus.textContent =
            "Please read your notes or enter some text first.";
        return;
    }

    generateButton.disabled = true;
    generateStatus.textContent =
        "Selecting important concepts and generating flashcards...";

    flashcardsContainer.innerHTML = "";

    try {
        const response = await fetch("/api/flashcards", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: notes,
                count: Number(cardCount.value)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Flashcard generation failed."
            );
        }

        if (
            !Array.isArray(data.flashcards) ||
            data.flashcards.length === 0
        ) {
            generateStatus.textContent =
                "No flashcards could be generated. Try different notes.";
            return;
        }

        data.flashcards.forEach(function (flashcard) {
            if (
                typeof flashcard.question !== "string" ||
                typeof flashcard.answer !== "string"
            ) {
                return;
            }

            const card = document.createElement("article");
            card.className = "flashcard";

            const question = document.createElement("h3");
            question.textContent = flashcard.question;

            const answer = document.createElement("p");
            answer.textContent = flashcard.answer;
            answer.hidden = true;

            const revealButton = document.createElement("button");
            revealButton.type = "button";
            revealButton.textContent = "Show Answer";

            revealButton.addEventListener("click", function () {
                answer.hidden = !answer.hidden;

                revealButton.textContent = answer.hidden
                    ? "Show Answer"
                    : "Hide Answer";
            });

            card.appendChild(question);
            card.appendChild(answer);
            card.appendChild(revealButton);

            flashcardsContainer.appendChild(card);
        });

        if (flashcardsContainer.children.length === 0) {
            generateStatus.textContent =
                "The AI returned no valid flashcards. Try again.";
        } else {
            generateStatus.textContent =
                `Generated ${flashcardsContainer.children.length} flashcards!`;
        }
    } catch (error) {
        console.error("Flashcard error:", error);

        generateStatus.textContent =
            error.message ||
            "Something went wrong. Check that the server is running.";
    } finally {
        generateButton.disabled = false;
    }
});
