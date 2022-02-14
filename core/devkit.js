const jsonc_parser = require("jsonc-parser");
/**
 * Parses the given JSON string and returns the object the JSON content represents.
 * By default javascript-style comments are allowed.
 *
 * @param input JSON content as string
 * @param options JSON parse options
 * @returns Object the JSON content represents
 */
function parseJson(input, options) {
    try {
        if ((options === null || options === void 0 ? void 0 : options.disallowComments) === true ||
            (options === null || options === void 0 ? void 0 : options.expectComments) !== true) {
            return JSON.parse(input);
        }
    }
    catch (error) {
        if ((options === null || options === void 0 ? void 0 : options.disallowComments) === true) {
            throw error;
        }
    }
    const errors = [];
    const result = jsonc_parser.parse(input, errors);
    if (errors.length > 0) {
        const { error, offset } = errors[0];
        throw new Error(`${jsonc_parser.printParseErrorCode(error)} in JSON at position ${offset}`);
    }
    return result;
}

module.exports = { parseJson }