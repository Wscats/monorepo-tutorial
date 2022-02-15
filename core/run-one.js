function getProjects(projectGraph, project) {
    let projects = [projectGraph.nodes[project]];
    let projectsMap = {
        [project]: projectGraph.nodes[project],
    };

    return { projects, projectsMap };
}

module.exports = { getProjects };
