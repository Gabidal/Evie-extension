//import { createSocket, RemoteInfo, Socket, SocketType } from 'dgram';
import * as vscode from 'vscode'
import { SignatureHelp } from 'vscode';
import { SignatureInformation } from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Vivid languange extension starting...')

	//execute_compiler_service(context)
	//start_compiler_service(context, "1111")

	const disposable = vscode.commands.registerCommand('extension.hello', () => {
		vscode.window.showInformationMessage('Hello')
	})

	context.subscriptions.push(disposable)
}