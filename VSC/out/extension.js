"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
//import { createSocket, RemoteInfo, Socket, SocketType } from 'dgram';
const vscode = require("vscode");
function activate(context) {
    console.log('Vivid languange extension starting...');
    //execute_compiler_service(context)
    //start_compiler_service(context, "1111")
    const disposable = vscode.commands.registerCommand('extension.hello', () => {
        vscode.window.showInformationMessage('Hello');
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map