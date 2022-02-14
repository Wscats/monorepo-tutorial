const path = require("path");
const app_root = require("./app-root");
const normalizedAppRoot = app_root.appRootPath.replace(/\\/g, '/');
let tsModule;
function readTsConfig(tsConfigPath) {
    if (!tsModule) {
        tsModule = require('typescript');
    }
    const readResult = tsModule.readConfigFile(tsConfigPath, tsModule.sys.readFile);
    return tsModule.parseJsonConfigFileContent(readResult.config, tsModule.sys, (0, path.dirname)(tsConfigPath));
}
exports.readTsConfig = readTsConfig;
function readTsConfigOptions(tsConfigPath) {
    if (!tsModule) {
        tsModule = require('typescript');
    }
    const readResult = tsModule.readConfigFile(tsConfigPath, tsModule.sys.readFile);
    // we don't need to scan the files, we only care about options
    const host = {
        readDirectory: () => [],
        fileExists: tsModule.sys.fileExists,
    };
    return tsModule.parseJsonConfigFileContent(readResult.config, host, (0, path.dirname)(tsConfigPath)).options;
}
let compilerHost;
/**
 * Find a module based on it's import
 *
 * @param importExpr Import used to resolve to a module
 * @param filePath
 * @param tsConfigPath
 */
function resolveModuleByImport(importExpr, filePath, tsConfigPath) {
    compilerHost = compilerHost || getCompilerHost(tsConfigPath);
    const { options, host, moduleResolutionCache } = compilerHost;
    const { resolvedModule } = tsModule.resolveModuleName(importExpr, filePath, options, host, moduleResolutionCache);
    if (!resolvedModule) {
        return;
    }
    else {
        return resolvedModule.resolvedFileName.replace(`${normalizedAppRoot}/`, '');
    }
}
function getCompilerHost(tsConfigPath) {
    const options = readTsConfigOptions(tsConfigPath);
    const host = tsModule.createCompilerHost(options, true);
    const moduleResolutionCache = tsModule.createModuleResolutionCache(app_root.appRootPath, host.getCanonicalFileName);
    return { options, host, moduleResolutionCache };
}

module.exports = { resolveModuleByImport }