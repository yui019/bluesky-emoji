/**
 * 
 * @param {HTMLInputElement} ProseMirror
 * @param {string} emoji 
 */
function insertEmoji(ProseMirror, emoji) {
    console.log("Inserting ", emoji)

    // Get selection range
    const selection = window.getSelection();
    const range = selection.getRangeAt(0).cloneRange();
    range.setStart(ProseMirror.firstChild, 0);

    // Find index of colon character
    let colonIndex = range.endOffset - 1;
    const lineNode = range.endContainer;
    for (let i = colonIndex; i >= 0; i--) {
        if (lineNode.textContent[i] == ":") {
            colonIndex = i;
            break;
        }
    }

    // Extract the line as an Element
    let lineCount = range.cloneContents().childNodes.length;
    let lineElement = ProseMirror.childNodes[lineCount - 1];

    // Get substrings before and after the place where the emoji will be placed
    const textBeforeEmoji = lineElement.innerHTML.substr(0, colonIndex)
    const textAfterEmoji = lineElement.innerHTML.substr(range.endOffset, lineElement.innerHTML.length)

    console.log(window.getSelection());

    // Combine substrings and emoji
    lineElement.innerHTML = textBeforeEmoji + emoji + textAfterEmoji;

    // Set cursor position to the emoji's position
    // I actually have NO idea how and why this works!!
    // (if someone could explain it to me I would really appreciate it :D)
    window.getSelection().setPosition(null, 0);
}