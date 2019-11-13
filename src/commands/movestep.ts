import * as vscode from 'vscode';

import * as ast from '../porter/ast';
import { CommandResult } from './result';

abstract class MoveStepDirection {
    abstract allowsMove(action: ast.PorterActionYAML, stepIndex: number): boolean;
    abstract readonly utmost: string;
    abstract readonly name: string;
    abstract moverIndex(stepIndex: number): number;
    abstract moveTargetIndex(stepIndex: number): number;
    abstract cursorOffsetSizeStepIndex(stepIndex: number): number;
    abstract yFactor: number;

    static readonly UP: MoveStepDirection = {
        allowsMove(_action, stepIndex) {
            return stepIndex > 0;
        },
        utmost: 'top',
        name: 'up',
        moverIndex(stepIndex) { return stepIndex; },
        moveTargetIndex(stepIndex) { return stepIndex - 1; },
        cursorOffsetSizeStepIndex(stepIndex) { return stepIndex - 1; },
        yFactor: -1
    };

    static readonly DOWN: MoveStepDirection = {
        allowsMove(action, stepIndex) {
            return stepIndex < action.steps.length - 1;
        },
        utmost: 'bottom',
        name: 'down',
        moverIndex(stepIndex) { return stepIndex + 1; },
        moveTargetIndex(stepIndex) { return stepIndex; },
        cursorOffsetSizeStepIndex(stepIndex) { return stepIndex + 1; },
        yFactor: 1
    };
}

export function moveStepUp(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]): CommandResult {
    return moveStep(editor, edit, MoveStepDirection.UP);
}

export function moveStepDown(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]): CommandResult {
    return moveStep(editor, edit, MoveStepDirection.DOWN);
}

function moveStep(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, direction: MoveStepDirection): CommandResult {
    const document = editor.document;
    if (!document.uri.fsPath.toLowerCase().endsWith('porter.yaml')) {
        vscode.window.showErrorMessage('This command requires an open editor containing the porter.yaml to insert into');
        return CommandResult.Failed;
    }
    const manifest = ast.parse(document.getText());
    if (!manifest) {
        vscode.window.showErrorMessage('Unable to parse open porter.yaml file: please fix any errors and try again');
        return CommandResult.Failed;
    }

    const originalCursorPosition = editor.selection.active;
    const cursorLocation = locateCursorInActions(manifest, originalCursorPosition.line);
    if (!cursorLocation) {
        vscode.window.showErrorMessage('This command requires the cursor to be on the step you want to move');
        return CommandResult.Failed;
    }

    const [action, stepIndex] = cursorLocation;

    if (!direction.allowsMove(action, stepIndex)) {
        vscode.window.showInformationMessage(`This step is already at the ${direction.utmost} and cannot be moved ${direction.name}`);
        return CommandResult.Succeeded;
    }

    const movingStepIndex = direction.moverIndex(stepIndex);
    const moveTargetIndex = direction.moveTargetIndex(stepIndex);
    const cursorOffsetSizeStepIndex = direction.cursorOffsetSizeStepIndex(stepIndex);

    const movingStep = action.steps[movingStepIndex];
    const moveTargetStep = action.steps[moveTargetIndex];
    const cursorOffsetSizeStep = action.steps[cursorOffsetSizeStepIndex];

    const movingStepRange = new vscode.Range(movingStep.startLine, 0, movingStep.endLine + 1, 0);
    const movingStepText = editor.document.getText(movingStepRange);
    const targetPosition = new vscode.Position(moveTargetStep.startLine, 0);
    const cursorTranslateLines = (cursorOffsetSizeStep.endLine - cursorOffsetSizeStep.startLine + 1) * direction.yFactor;
    const newCursorPosition = originalCursorPosition.translate(cursorTranslateLines, 0);

    edit.delete(movingStepRange);
    edit.insert(targetPosition, movingStepText);
    editor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);

    return CommandResult.Succeeded;
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
