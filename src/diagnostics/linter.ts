import { TextDocument, Diagnostic } from "vscode";

import * as ast from '../porter/ast';

export interface Linter {
    lint(document: TextDocument, manifest: ast.PorterManifestYAML): Promise<Diagnostic[]>;
}
