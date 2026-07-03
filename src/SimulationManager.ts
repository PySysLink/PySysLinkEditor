import * as vscode from 'vscode';
import * as path from 'path';
import { PythonServerManager } from './simulation/PythonServerManager';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export class SimulationManager {
    private currentSimulationOptionsFileChangedHandler: ((newPath: string) => void)[] = [];
    private currentInitializationScriptFileChangedHandler: ((newPath: string) => void)[] = [];
    private currentToolkitConfigurationFileChangedHandler: ((newPath: string) => void)[] = [];

    private currentPslkPath: string | undefined = undefined;
    private currentSimulationOptionsPath: string | undefined = undefined;
    private currentInitializationScriptPath: string | undefined = undefined;
    private currentToolkitConfigurationFilePath: string | undefined = undefined;


    constructor(private readonly context: vscode.ExtensionContext) {
    }

    public registerCurrentSimulationOptionsFileChangedHandler(handler: ((currentSimulationPath: string) => void)): void {
      this.currentSimulationOptionsFileChangedHandler.push(handler);
    }
    
    public registerCurrentInitializationScriptFileChangedHandler(handler: ((currentInitializationScriptPath: string) => void)): void {
      this.currentInitializationScriptFileChangedHandler.push(handler);
    }

    public registerCurrentToolkitConfigurationFileChangedHandler(handler: ((currentToolkitConfigurationPath: string) => void)): void {
      this.currentToolkitConfigurationFileChangedHandler.push(handler);
    }
    

    public setCurrentSimulationOptionsPath(currentSimulationOptionsPath: string) {
      this.currentSimulationOptionsPath = currentSimulationOptionsPath;
    }

    public setCurrentInitializationScriptPath(currentInitializationScriptPath: string) {
      this.currentInitializationScriptPath = currentInitializationScriptPath;
    }
    
    public setCurrentToolkitConfigurationFilePath(currentToolkitConfigurationFilePath: string) {
      this.currentToolkitConfigurationFilePath = currentToolkitConfigurationFilePath;
    }


    public openSimulationOptionsFileSelector = async () => {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        defaultUri: this.currentSimulationOptionsPath && this.currentPslkPath ? vscode.Uri.file(path.resolve(path.dirname(this.currentPslkPath), this.currentSimulationOptionsPath)) : undefined
      };

      vscode.window.showOpenDialog(options).then(fileUri => {
          if (fileUri && fileUri[0]) {
              console.log('Selected file: ' + fileUri[0].fsPath);
              let selectedPath = fileUri[0].fsPath;
              if (this.currentPslkPath) {
                const baseDir = path.dirname(this.currentPslkPath);
                selectedPath = path.relative(baseDir, selectedPath);
              }
              this.currentSimulationOptionsPath = selectedPath;
              // Notify all registered handlers about the change
              this.currentSimulationOptionsFileChangedHandler.forEach(handler => {
                handler(this.currentSimulationOptionsPath!);
              });               
          }
      });
    };
    
    
    public openInitializationScriptFileSelector = async () => {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        defaultUri: this.currentInitializationScriptPath && this.currentPslkPath ? vscode.Uri.file(path.resolve(path.dirname(this.currentPslkPath), this.currentInitializationScriptPath)) : undefined
      };

      vscode.window.showOpenDialog(options).then(fileUri => {
          if (fileUri && fileUri[0]) {
              console.log('Selected file: ' + fileUri[0].fsPath);
              let selectedPath = fileUri[0].fsPath;
              if (this.currentPslkPath) {
                const baseDir = path.dirname(this.currentPslkPath);
                selectedPath = path.relative(baseDir, selectedPath);
              }
              this.currentInitializationScriptPath = selectedPath;
              // Notify all registered handlers about the change
              this.currentInitializationScriptFileChangedHandler.forEach(handler => {
                handler(this.currentInitializationScriptPath!);
              });               
          }
      });
    };
    
    public openToolkitConfigurationFileSelector = async () => {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        defaultUri: this.currentToolkitConfigurationFilePath && this.currentPslkPath ? vscode.Uri.file(path.resolve(path.dirname(this.currentPslkPath), this.currentToolkitConfigurationFilePath)) : undefined
      };

      vscode.window.showOpenDialog(options).then(fileUri => {
          if (fileUri && fileUri[0]) {
              console.log('Selected file: ' + fileUri[0].fsPath);
              let selectedPath = fileUri[0].fsPath;
              if (this.currentPslkPath) {
                const baseDir = path.dirname(this.currentPslkPath);
                selectedPath = path.relative(baseDir, selectedPath);
              }
              this.currentToolkitConfigurationFilePath = selectedPath;
              // Notify all registered handlers about the change
              this.currentToolkitConfigurationFileChangedHandler.forEach(handler => {
                handler(this.currentToolkitConfigurationFilePath!);
              });               
          }
      });
    };
  }
  