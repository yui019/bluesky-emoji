/** @type {Element | null} */
let ProseMirror = null;

/** @type {HTMLElement | null} */
let SuggestionsPopup = null;

let suggestionsPopupSelectedEmojiIndex = null;
let suggestionsPopupSuggestions = [];

let currentlyTypingEmoji = false;

/**
 * Create and add SuggestionsPopup to page, run once on initial load
 */
function initSuggestionsPopup() {
    SuggestionsPopup = document.createElement("div");
    SuggestionsPopup.id = "bluesky-emojis-extension-suggestions-popup";

    // Invisible by default
    SuggestionsPopup.classList.add("bluesky-emojis-extension-suggestions-popup-invisible");

    document.body.appendChild(SuggestionsPopup);
}

/**
 * Show SuggestionsPopup right above the passed coordinates
 * 
 * @param {{x: number, yTop: number, yBottom: number}} coordinates
 */
function showSuggestionsPopup(coordinates) {
    if (!SuggestionsPopup) {
        return;
    }

    // Remove invisibility class
    SuggestionsPopup.classList.remove("bluesky-emojis-extension-suggestions-popup-invisible");

    // Set left coordinate
    SuggestionsPopup.style.left = `${coordinates.x}px`;

    // Set top coordinate
    // In case there's enough space for the popup, show it above the text,
    // below otherwise
    const height = SuggestionsPopup.getBoundingClientRect().height;
    if (coordinates.yTop - height > 0) {
        SuggestionsPopup.style.top = `${coordinates.yTop - height}px`;
    } else {
        SuggestionsPopup.style.top = `${coordinates.yBottom}px`;
    }
}

/**
 * Hide SuggestionsPopup
 */
function hideSuggestionsPopup() {
    if (!SuggestionsPopup) {
        return;
    }

    suggestionsPopupSuggestions = [];

    // Add invisibility class
    SuggestionsPopup.classList.add("bluesky-emojis-extension-suggestions-popup-invisible");
}

/**
 * 
 * @param {Array<Array<String>>}} suggestions 
 */
function fillSuggestionsPopup(suggestions) {
    // Clear all current children
    SuggestionsPopup.innerHTML = "";

    suggestions.forEach(suggestion => {
        const [emoji, name] = suggestion;

        let element = document.createElement("div");
        element.innerHTML = `${emoji} <span>:${name}:</span>`;

        element.addEventListener("click", () => {
            insertEmoji(ProseMirror, emoji);
            hideSuggestionsPopup();
            currentlyTypingEmoji = false;
        });

        SuggestionsPopup.appendChild(element);
    });

    // Update global state
    suggestionsPopupSuggestions = suggestions;
    suggestionsPopupSelectedEmojiIndex = 0;
    suggestionPopupSelectionUpdated(null);
}

/**
 * Scroll to the selected emoji and highlight it
 * 
 * @param {number | null} previousIndex The previous suggestionsPopupSelectedEmojiIndex
 */
function suggestionPopupSelectionUpdated(previousIndex) {
    const newEmoji = SuggestionsPopup.children[suggestionsPopupSelectedEmojiIndex];

    // Scroll to new emoji
    const offset = newEmoji.offsetTop;
    SuggestionsPopup.scrollTo(0, offset);

    // Unhighlight previous emoji if there was one
    if (previousIndex != null) {
        const prevEmoji = SuggestionsPopup.children[previousIndex];
        prevEmoji.classList.remove("highlighted");
    }

    // Highlight new emoji
    newEmoji.classList.add("highlighted");
}

function handleUpKeyInSuggestionsPopup() {
    const prevIndex = suggestionsPopupSelectedEmojiIndex;

    if (suggestionsPopupSelectedEmojiIndex == null) {
        suggestionsPopupSelectedEmojiIndex = 0;
    } else if (suggestionsPopupSelectedEmojiIndex > 0) {
        suggestionsPopupSelectedEmojiIndex -= 1;
    }

    suggestionPopupSelectionUpdated(prevIndex);
}

function handleDownKeyInSuggestionsPopup() {
    const prevIndex = suggestionsPopupSelectedEmojiIndex;

    if (suggestionsPopupSelectedEmojiIndex == null) {
        suggestionsPopupSelectedEmojiIndex = suggestionsPopupSuggestions.length - 1;
    } else if (suggestionsPopupSelectedEmojiIndex < suggestionsPopupSuggestions.length - 1) {
        suggestionsPopupSelectedEmojiIndex += 1;
    }

    suggestionPopupSelectionUpdated(prevIndex);
}

function handleEnterKeyInSuggestionsPopup() {
    insertEmoji(
        ProseMirror,
        suggestionsPopupSuggestions[suggestionsPopupSelectedEmojiIndex][0]
    );
    hideSuggestionsPopup();
    currentlyTypingEmoji = false;
}

/**
 * Get text from ProseMirror while retaining new lines.
 * 
 * @returns {string}
 */
function getProseMirrorText() {
    if (!ProseMirror) {
        return "";
    }

    let lines = [];
    ProseMirror.querySelectorAll("p").forEach(l => lines.push(l.textContent));

    return lines.join("\n");
}

/**
 * Get position of cursor inside ProseMirror.
 * 
 * @returns {number}
 */
function getProseMirrorCursorPosition() {
    // Credit to: https://phuoc.ng/collection/html-dom/get-or-set-the-cursor-position-in-a-content-editable-element/#getting-cursor-position
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const clonedRange = range.cloneRange();
    clonedRange.selectNodeContents(ProseMirror);
    clonedRange.setStart(ProseMirror.firstChild, 0);
    clonedRange.setEnd(range.endContainer, range.endOffset);

    // The value to be accumulated and returned
    let cursorPosition = 0;

    // Add length of all child nodes' text
    const contents = clonedRange.cloneContents();
    contents.childNodes.forEach(node => {
        if (node.nodeType == Node.TEXT_NODE) {
            cursorPosition += node.textContent.length;
        } else if (node.nodeType == Node.ELEMENT_NODE) {
            cursorPosition += node.innerText.length;
        } else {
            // This should (probably) be unreachable
        }
    });

    // Also account for new lines (each child node is one line)
    if (cursorPosition > 0) {
        cursorPosition += contents.childNodes.length - 1;
    }

    return cursorPosition;
}

/**
 * Check if the user is currently typing an emoji and return its name if so,
 * null otherwise.
 * 
 * The user is typing an emoji if he's typed a colon at some point in the text
 * before where his cursor is and if there's no spaces or new lines in between
 * the colon and cursor.
 * 
 * @returns {string | null}
 */
function getEmojiBeingTyped() {
    const text = getProseMirrorText();
    const cursorPosition = getProseMirrorCursorPosition() - 1;

    // The cursor position starts at 1 (not 0) and I substracted 1 from it above.
    // So here I'm early returning null if ProseMirror is empty.
    // (this happens if the user has typed something and then erases everything)
    if (cursorPosition == -1) {
        return null;
    }

    // Early return null if the user's only just typed the colon and nothing
    // else yet
    if (text[cursorPosition] == ":") {
        return null;
    }

    let emojiName = "";
    for (let i = cursorPosition; i >= 0; i--) {
        let char = text[i];

        if (char == ":") {
            return emojiName;
        } else if (char == " " || char == "\n") {
            return null;
        } else {
            // push char to front of emojiName
            emojiName = char + emojiName;
        }
    }

    return null;
}

/**
 * Get top and right coordinates of the colon character (start of an emoji)
 * NOTE: this function expects that the user is currently typing an emoji
 *       (i.e. getEmojiBeingTyped didn't return null)
 * 
 * @returns {{x: number, yTop: number, yBottom: number} | null}
 */
function getColonCoordinates() {
    // Get selection range
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    // Find index of colon character
    let colonIndex = range.endOffset - 1;
    const lastLineElement = range.endContainer;
    for (let i = colonIndex; i >= 0; i--) {
        if (lastLineElement.textContent[i] == ":") {
            colonIndex = i;
            break;
        }
    }

    // Create a new range from the start of the last line containing
    // just the colon character
    let newRange = document.createRange();
    newRange.setStart(lastLineElement, colonIndex);
    newRange.setEnd(lastLineElement, colonIndex + 1);

    // Extract that range's coordinates
    return {
        x: newRange.getBoundingClientRect().right,
        yTop: newRange.getBoundingClientRect().top,
        yBottom: newRange.getBoundingClientRect().bottom,
    };
}


/**
 * 
 * @param {InputEvent} _event 
 */
function onProseMirrorInput(_event) {
    const emoji = getEmojiBeingTyped();

    if (emoji) {
        currentlyTypingEmoji = true;

        fillSuggestionsPopup(getSuggestions(emoji));

        const caretCoordinates = getColonCoordinates();

        showSuggestionsPopup(caretCoordinates);
    } else {
        currentlyTypingEmoji = false;

        hideSuggestionsPopup();
    }

}

/**
 * 
 * @param {KeyboardEvent} event 
 */
function onProseMirrorKeyDown(event) {
    // Do nothing if not typing emoji right now
    if (!currentlyTypingEmoji) {
        return;
    }

    if (event.key == "ArrowUp") {
        event.preventDefault();
        handleUpKeyInSuggestionsPopup();
    } else if (event.key == "ArrowDown") {
        event.preventDefault();
        handleDownKeyInSuggestionsPopup();
    } else if (event.key == "Enter") {
        event.preventDefault();
        handleEnterKeyInSuggestionsPopup();
    }
}

initSuggestionsPopup();

// Fired when a new element is focused
document.addEventListener('focusin', function () {
    // If the focused element contains the ProseMirror class, then it's the
    // popup where a new post is typed into
    if (document.activeElement.classList.contains("ProseMirror")) {
        // Remove previous event listeners if the ProseMirror was previously set
        if (ProseMirror) {
            ProseMirror.removeEventListener("input", onProseMirrorInput);
            ProseMirror.removeEventListener("keydown", onProseMirrorKeyDown);
        }

        // Update ProseMirror global
        ProseMirror = document.activeElement;

        // Set new event listeners
        ProseMirror.addEventListener("input", onProseMirrorInput);
        ProseMirror.addEventListener("keydown", onProseMirrorKeyDown, true); // it took me so long to figure out I need that true here.... ugh
    }
}, true);