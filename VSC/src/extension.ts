import { createSocket, RemoteInfo, Socket, SocketType } from 'dgram';
import * as vscode from 'vscode'
import { SignatureHelp } from 'vscode';
import { SignatureInformation } from 'vscode';

enum RequestType {
	NONE,
	Completions,
	Signatures,
	Diagnose,
	Open,
	Definition,
	Information,
	FindReferences
}

class Position{
    Line: number = 0
    Character: number = 0
    Local: number = 0
    Absolute: number = 0
    File_Name: string = ""

	constructor(position: vscode.Position, FileName: string){
		this.Line = position.line;
		this.Character = position.character;
		this.Local = 0;
		this.Absolute = 0;
		this.File_Name = FileName;
	}
}

class Socket_Handle{
	private socket: Socket
	private port: number

	constructor(socket: Socket, port: number) {
		this.socket = socket
		this.port = port
	}

	public Send(request: RequestType, document: vscode.TextDocument, position: vscode.Position) {
		const payload = JSON.stringify({ Type: request as number, Uri: document.uri.toString(), Document: document.getText(), Position: new Position(position, document.uri.path) });
		
		const Bytes = new Uint32Array(1)

		Bytes[0] = payload.length;

		this.socket.send(new Uint8Array(Bytes), this.port, "localhost");
		
		this.socket.send(payload, this.port, "localhost")
	}

	public Open(folder: string) {
		const payload = JSON.stringify({ Type: RequestType.Open as number, Uri: folder, Document: '', Position: { Line: -1, Character: -1 } })
		
		const Bytes = new Uint32Array(1)

		Bytes[0] = payload.length;

		this.socket.send(new Uint8Array(Bytes), this.port, "localhost");
		
		this.socket.send(payload, this.port, "localhost")
		return this.Response()
	}

	public Response() {
		return new Promise<string>((resolve) => {
			this.socket.once('message', (data: Buffer, _: RemoteInfo) => {
				resolve(data.toString('utf-8'))
			})
		})
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Intellisense Starting...')
	Start_Evie(context)
}

function Start_Evie(context: vscode.ExtensionContext){
	const service = require('child_process').spawn('Evie.exe', [ '-service' ])

	if (service.pid == undefined)
		vscode.window.showErrorMessage("Error while loading Evie as a service.")

	service.stdout.on('data', (data: Buffer) => {
		const output = data.toString('utf-8')
		Start_Evie_Service(context, output)
	})
}

function Start_Evie_Service(context: vscode.ExtensionContext, Port: string){

	const Private_Port = parseInt(Port)
	const Private_Socket = createSocket('udp4')
	const Diagnostics_Socket = createSocket('udp4')
	
	const Private_Handler = new Socket_Handle(Private_Socket, Private_Port)
	const Diagnostics_Handler = new Socket_Handle(Diagnostics_Socket, Private_Port)

	const Folder = vscode.workspace.workspaceFolders![0].uri.toString();
	Private_Handler.Open(Folder)

	
}