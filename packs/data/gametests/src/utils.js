
/**
 * 
 * @param { string } str
 * 
 * @remarks
 * Changes string to title case
 * 
 * @returns { string }
 */
export function toTitle(str) {
  return str.replace(/(^|\s)\S/g, function(t) { return t.toUpperCase() });
}


/**
 * 
 * @param { string } str 
 * @param { number } threshold
 * 
 * @remarks
 * Ensures proper capitalization is
 * made on words that are meant to
 * be abbreviations
 * 
 * @returns { string }
 */
export function prettyCaps(str, threshold=4) {
  let _a = [];
  str.split(' ').forEach(word => {
    if (word.length < threshold) _a.push(word.toUpperCase()); else _a.push(word);
  })
  return _a.toString().replace(/,/g, ' ')
}


/**
 * 
 * @param { number } num 
 * @param { number } size 
 * 
 * @remarks
 * Adds leading zeroes to the
 * string
 * 
 * @returns { number }
 */
export function zFill(num, size) {
  num = num.toString();
  while (num.length < size) num = "0" + num;
  return num;
}
