/**
 * Backwards compatibility adapter for project graph
 * @param {string} sourceVersion
 * @param {string} targetVersion
 * @param projectGraph
 * @param {ProjectGraph} projectGraph
 * @returns {ProjectGraph}
 */
function projectGraphAdapter(
    sourceVersion,
    targetVersion,
    projectGraph
) {
    if (sourceVersion === targetVersion) {
        return projectGraph;
    }
    if (sourceVersion === '5.0' && targetVersion === '4.0') {
        return projectGraphCompat5to4(projectGraph);
    }
    throw new Error(
        `Invalid source or target versions. Source: ${sourceVersion}, Target: ${targetVersion}.
  Only backwards compatibility between "5.0" and "4.0" is supported.
  This error can be caused by "@nrwl/..." packages getting out of sync or outdated project graph cache.
  Check the versions running "nx report" and/or remove your "nxdeps.json" file (in node_modules/.cache/nx folder).
      `
    );
}

module.exports = { projectGraphAdapter }