class TrieNode {
    constructor(value) {
        this.value = value;
        this.isEndOfWord = false;
        this.children = {};
    }

    getWords(prefix) {
        let words = [];
        if (this.isEndOfWord) {
            words.push(prefix + this.value);
        }

        for (const child in this.children) {
            words = words.concat(this.children[child].getWords(prefix + this.value));
        }

        return words;
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode(null);
    }

    insert(word) {
        let current = this.root;
        for (let character of word) {
            if (current.children[character] === undefined) {
                current.children[character] = new TrieNode(character);
            }
            current = current.children[character];
        }

        current.isEndOfWord = true;
    }

    search(query) {
        let current = this.root;
        for (let character of query) {
            if (current.children[character] === undefined) {
                return [];
            }
            current = current.children[character];
        }

        const prefix = query.substr(0, query.length - 1);
        return current.getWords(prefix);
    }
}

const trie = new Trie();
for (const emoji in EMOJI_NAMES) {
    trie.insert(emoji);
}

/**
 * 
 * @param {string} query 
 * @returns Array<Array<string>>
 */
function getSuggestions(query) {
    const names = trie.search(query);

    let suggestions = [];

    names.forEach(name => {
        EMOJI_NAMES[name].forEach(emoji => {
            if (suggestions.findIndex(e => e[0] == emoji) == -1) {
                suggestions.push([emoji, name]);
            }
        });
    });

    return suggestions;
}