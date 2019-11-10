import { TextDocument, Diagnostic, CodeAction } from "vscode";

import * as ast from '../porter/ast';

export interface Linter {
    lint(document: TextDocument, manifest: ast.PorterManifestYAML): Promise<Diagnostic[]>;
    fixes(document: TextDocument, manifest: ast.PorterManifestYAML, diagnostics: Diagnostic[]): CodeAction[];
}
