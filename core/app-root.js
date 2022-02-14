const path = require("path");
const fs = require("fs");
function pathInner(dir) {
    if (process.env.NX_WORKSPACE_ROOT_PATH)
        return process.env.NX_WORKSPACE_ROOT_PATH;
    if (path.dirname(dir) === dir)
        return process.cwd();
    if (fileExists(path.join(dir, 'workspace.json')) ||
        fileExists(path.join(dir, 'nx.json')) ||
        fileExists(path.join(dir, 'angular.json'))) {
        return dir;
    }
    else {
        return pathInner(path.dirname(dir));
    }
}
function fileExists(filePath) {
    try {
        return (0, fs.statSync)(filePath).isFile();
    }
    catch (err) {
        return false;
    }
}

module.exports = {
    appRootPath: pathInner(__dirname),
    fileExists: fileExists
}
