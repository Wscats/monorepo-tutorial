const DependencyType = {
    /**
     * Static dependencies are tied to the loading of the module
     */
    static: 'static',
    /**
     * Dynamic dependencies are brought in by the module at run time
     */
    dynamic: 'dynamic',
    /**
     * Implicit dependencies are inferred
     */
    implicit: 'implicit',
}

module.exports = { DependencyType }