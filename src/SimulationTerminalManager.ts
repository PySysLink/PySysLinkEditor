import * as vscode from 'vscode';

export class SimulationTerminalManager {
    private terminal?: vscode.Terminal;

    public getTerminal(): vscode.Terminal {
        if (!this.terminal) {
            this.terminal = vscode.window.createTerminal(
                "PySysLink Simulation"
            );

            vscode.window.onDidCloseTerminal(closed => {
                if (closed === this.terminal) {
                    this.terminal = undefined;
                }
            });
        }

        return this.terminal;
    }

    public runCommand(command: string): void {
        const terminal = this.getTerminal();
        terminal.show(true);
        terminal.sendText(command);
    }
}