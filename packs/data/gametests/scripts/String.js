"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
String.prototype.toTitle = function () {
    return this.replace(/(^|\s)\S/g, function (t) {
        return t.toUpperCase();
    });
};
String.prototype.abrevCaps = function (threshold = 4) {
    const _IGNORED_WORDS = [
        "and",
        "the",
        "of",
        "in",
        "on",
        "at",
        "to",
        "for",
        "with",
        "as",
        "by",
        "an",
        "a",
        "or",
        "but",
        "nor",
        "yet",
        "so",
    ];
    return this.split(" ")
        .map((word) => word.length < threshold && !_IGNORED_WORDS.includes(word.toLowerCase())
        ? word.toUpperCase()
        : word)
        .join(" ");
};
