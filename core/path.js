const path = require("path");
function removeWindowsDriveLetter(osSpecificPath) {
    return osSpecificPath.replace(/^[A-Z]:/, '');
}

/**
 * Coverts an os specific path to a unix style path
 */
function normalizePath(osSpecificPath) {
    return removeWindowsDriveLetter(osSpecificPath).split('\\').join('/');
}

/**
 * Normalized path fragments and joins them
 */
function joinPathFragments(...fragments) {
    return normalizePath(path.join(...fragments));
}

module.exports = { normalizePath, joinPathFragments };