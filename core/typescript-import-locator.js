const path = require("path");
const { stripSourceCode } = require("./strip-source-code");
const app_root = require("./app-root");
const { existsSync, readFileSync } = require("fs");
const { DependencyType } = require("./type");

function defaultFileRead(filePath) {
    return readFileSync(path.join(app_root.appRootPath, filePath), 'utf-8');
}

let tsModule;
class TypeScriptImportLocator {
    constructor() {
        tsModule = require('typescript');
        this.scanner = tsModule.createScanner(tsModule.ScriptTarget.Latest, false);
    }
    fromFile(filePath, visitor) {
        const extension = path.extname(filePath);
        if (extension !== '.ts' &&
            extension !== '.tsx' &&
            extension !== '.js' &&
            extension !== '.jsx') {
            return;
        }
        const content = defaultFileRead(filePath);
        const strippedContent = stripSourceCode(this.scanner, content);
        if (strippedContent !== '') {
            const tsFile = tsModule.createSourceFile(filePath, strippedContent, tsModule.ScriptTarget.Latest, true);
            this.fromNode(filePath, tsFile, visitor);
        }
    }
    fromNode(filePath, node, visitor) {
        if (tsModule.isImportDeclaration(node) ||
            (tsModule.isExportDeclaration(node) && node.moduleSpecifier)) {
            if (!this.ignoreStatement(node)) {
                const imp = this.getStringLiteralValue(node.moduleSpecifier);
                visitor(imp, filePath, DependencyType.static);
            }
            return; // stop traversing downwards
        }
        if (tsModule.isCallExpression(node) &&
            node.expression.kind === tsModule.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1 &&
            tsModule.isStringLiteral(node.arguments[0])) {
            if (!this.ignoreStatement(node)) {
                const imp = this.getStringLiteralValue(node.arguments[0]);
                visitor(imp, filePath, DependencyType.dynamic);
            }
            return;
        }
        if (tsModule.isCallExpression(node) &&
            node.expression.getText() === 'require' &&
            node.arguments.length === 1 &&
            tsModule.isStringLiteral(node.arguments[0])) {
            if (!this.ignoreStatement(node)) {
                const imp = this.getStringLiteralValue(node.arguments[0]);
                visitor(imp, filePath, DependencyType.static);
            }
            return;
        }
        if (node.kind === tsModule.SyntaxKind.PropertyAssignment) {
            const name = this.getPropertyAssignmentName(node.name);
            if (name === 'loadChildren') {
                const init = node.initializer;
                if (init.kind === tsModule.SyntaxKind.StringLiteral &&
                    !this.ignoreLoadChildrenDependency(node.getFullText())) {
                    const childrenExpr = this.getStringLiteralValue(init);
                    visitor(childrenExpr, filePath, DependencyType.dynamic);
                    return; // stop traversing downwards
                }
            }
        }
        /**
         * Continue traversing down the AST from the current node
         */
        tsModule.forEachChild(node, (child) => this.fromNode(filePath, child, visitor));
    }
    ignoreStatement(node) {
        return stripSourceCode(this.scanner, node.getFullText()) === '';
    }
    ignoreLoadChildrenDependency(contents) {
        this.scanner.setText(contents);
        let token = this.scanner.scan();
        while (token !== tsModule.SyntaxKind.EndOfFileToken) {
            if (token === tsModule.SyntaxKind.SingleLineCommentTrivia ||
                token === tsModule.SyntaxKind.MultiLineCommentTrivia) {
                const start = this.scanner.getStartPos() + 2;
                token = this.scanner.scan();
                const isMultiLineCommentTrivia = token === tsModule.SyntaxKind.MultiLineCommentTrivia;
                const end = this.scanner.getStartPos() - (isMultiLineCommentTrivia ? 2 : 0);
                const comment = contents.substring(start, end).trim();
                if (comment === 'nx-ignore-next-line') {
                    return true;
                }
            }
            else {
                token = this.scanner.scan();
            }
        }
        return false;
    }
    getPropertyAssignmentName(nameNode) {
        switch (nameNode.kind) {
            case tsModule.SyntaxKind.Identifier:
                return nameNode.getText();
            case tsModule.SyntaxKind.StringLiteral:
                return nameNode.text;
            default:
                return null;
        }
    }
    getStringLiteralValue(node) {
        return node.getText().substr(1, node.getText().length - 2);
    }
}

module.exports = { TypeScriptImportLocator }
