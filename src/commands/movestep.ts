import * as vscode from 'vscode';

import * as ast from '../porter/ast';

const EMPTY_DISPOSABLE = new vscode.Disposable(() => undefined);

abstract class MoveStepDirection {
    abstract allowsMove(action: ast.PorterActionYAML, stepIndex: number): boolean;
    abstract readonly utmost: string;
    abstract readonly name: string;
    abstract moverIndex(stepIndex: number): number;
    abstract moveTargetIndex(stepIndex: number): number;

    static readonly UP: MoveStepDirection = {
        allowsMove(_action, stepIndex) {
            return stepIndex > 0;
        },
        utmost: 'top',
        name: 'up',
        moverIndex(stepIndex) { return stepIndex; },
        moveTargetIndex(stepIndex) { return stepIndex - 1; }
    };

    static readonly DOWN: MoveStepDirection = {
        allowsMove(action, stepIndex) {
            return stepIndex < action.steps.length - 1;
        },
        utmost: 'bottom',
        name: 'down',
        moverIndex(stepIndex) { return stepIndex + 1; },
        moveTargetIndex(stepIndex) { return stepIndex; }
    };
}

export function moveStepUp(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]): vscode.Disposable {
    return moveStep(editor, edit, MoveStepDirection.UP);
}

export function moveStepDown(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]): vscode.Disposable {
    return moveStep(editor, edit, MoveStepDirection.DOWN);
}

function moveStep(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, direction: MoveStepDirection): vscode.Disposable {
    const document = editor.document;
    if (!document.uri.fsPath.toLowerCase().endsWith('porter.yaml')) {
        vscode.window.showErrorMessage('This command requires an open editor containing the porter.yaml to insert into');
        return EMPTY_DISPOSABLE;
    }
    const manifest = ast.parse(document.getText());
    if (!manifest) {
        vscode.window.showErrorMessage('Unable to parse open porter.yaml file: please fix any errors and try again');
        return EMPTY_DISPOSABLE;
    }

    const cursorLocation = locateCursorInActions(manifest, editor.selection.active.line);
    if (!cursorLocation) {
        vscode.window.showErrorMessage('This command requires the cursor to be on the step you want to move');
        return EMPTY_DISPOSABLE;
    }

    const [action, stepIndex] = cursorLocation;

    if (!direction.allowsMove(action, stepIndex)) {
        vscode.window.showInformationMessage(`This step is already at the ${direction.utmost} and cannot be moved ${direction.name}`);
        return EMPTY_DISPOSABLE;
    }

    // TODO: MOVE IT MOVE IT
    const movingStepIndex = direction.moverIndex(stepIndex);
    const moveTargetIndex = direction.moveTargetIndex(stepIndex);

    const movingStep = action.steps[movingStepIndex];
    const moveTargetStep = action.steps[moveTargetIndex];

    const movingStepRange = new vscode.Range(movingStep.startLine, 0, movingStep.endLine + 1, 0);
    const movingStepText = editor.document.getText(movingStepRange);
    const targetPosition = new vscode.Position(moveTargetStep.startLine, 0);

    edit.delete(movingStepRange);
    edit.insert(targetPosition, movingStepText);

    // TODO: position cursor at the location where it originally was within the moved step

    return EMPTY_DISPOSABLE;
}

function locateCursorInActions(manifest: ast.PorterManifestYAML, line: number): [ast.PorterActionYAML, number] | undefined {
    for (const action of manifest.actions) {
        for (let i = 0; i < action.steps.length; ++i) {
            const step = action.steps[i];
            if (step.startLine <= line && line <= step.endLine) {
                return [action, i];
            }
        }
    }
    return undefined;
}
