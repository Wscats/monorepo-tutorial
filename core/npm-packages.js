const path = require("path");
const fs = require("fs");
function readJsonFile(path) {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

function buildNpmPackageNodes(builder, appRootPath) {
    const packageJson = readJsonFile(path.join(appRootPath, 'package.json'));
    const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    Object.keys(deps).forEach((d) => {
        builder.addExternalNode({
            type: 'npm',
            name: `npm:${d}`,
            data: {
                version: deps[d],
                packageName: d,
            },
        });
    });
}

module.exports = { buildNpmPackageNodes }