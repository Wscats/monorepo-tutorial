const { writeFileSync } = require('fs');
function createCache(
    nxJson,
    packageJsonDeps,
    projectGraph,
    tsConfig
) {
    const nxJsonPlugins = (nxJson.plugins || []).map((p) => ({
        name: p,
        version: packageJsonDeps[p],
    }));
    const newValue = {
        version: projectGraph.version || '5.0',
        deps: packageJsonDeps,
        // compilerOptions may not exist, especially for repos converted through add-nx-to-monorepo
        pathMappings: tsConfig?.compilerOptions?.paths || {},
        nxJsonPlugins,
        nodes: projectGraph.nodes,
        externalNodes: projectGraph.externalNodes,
        dependencies: projectGraph.dependencies,
    };
    return newValue;
}

/**
 * Serializes the given data to a JSON string.
 * By default the JSON string is formatted with a 2 space intendation to be easy readable.
 *
 * @param input Object which should be serialized to JSON
 * @param options JSON serialize options
 * @returns the formatted JSON representation of the object
 */
function serializeJson(
    input,
    options
) {
    return JSON.stringify(input, null, options?.spaces || 2) + '\n';
}

/**
 * Serializes the given data to JSON and writes it to a file.
 *
 * @param path A path to a file.
 * @param data data which should be serialized to JSON and written to the file
 * @param options JSON serialize options
 */
function writeJsonFile(
    path,
    data,
    options
) {
    const serializedJson = serializeJson(data, options);
    const content = options?.appendNewLine
        ? `${serializedJson}\n`
        : serializedJson;
    writeFileSync(path, content, { encoding: 'utf-8' });
}

function writeCache(cache) {
    writeJsonFile('.cache/nxdeps.json', cache);
}

module.exports = { createCache, writeCache }
