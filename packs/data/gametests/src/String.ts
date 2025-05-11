
declare global {
   interface String {
      /**
       * Changes string to title case
       * @returns { string }
       */
      toTitle(): string;

      /**
       * Ensures proper capitalization is made on words that are meant to be abbreviations
       * @param { number } threshold
       * Number of characters a word must be to be considered an abbreviation
       * @returns { string }
       */
      abrevCaps(threshold?: number): string;
   }
}

String.prototype.toTitle = function() {
   return this.replace(/(^|\s)\S/g, function(t) {
      return t.toUpperCase();
   });
};

String.prototype.abrevCaps = function(threshold: number = 4) {
   const _IGNORED_WORDS = ['and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'as', 'by', 'an', 'a', 'or', 'but', 'nor', 'yet', 'so'];
   return this.split(' ').map(word => (word.length < threshold) && !_IGNORED_WORDS.includes(word.toLowerCase()) ? word.toUpperCase() : word).join(' ');
};

export {};
