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

enum MSG_Type {
	NORMAL,
	ERROR,
	WARNING,
	SOLUTION,
	INFO,
	FAIL,
	SUCCESS,
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

class Wellfare{
	public SuccessMessage: number
	public Elements: string

	constructor(SuccessMessage: string, Elements: string){
		this.Elements = Elements;
		this.SuccessMessage = parseInt(SuccessMessage);
	}
}

class Send_Text_To_Evie implements vscode.CompletionItemProvider{
	private Handle: Socket_Handle


	constructor(H: Socket_Handle) {
		this.Handle = H
	}

	public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _: vscode.CancellationToken) : Promise<vscode.CompletionItem[]> {
		// Send the current state of the document to the compiler service, which will analyze it
		//Yeah what he says.
		this.Handle.Send(RequestType.Completions, document, position)

		return this.Handle.Response()
			//change the raw response data into a json object
			.then(response => JSON.parse(response) as Wellfare)
			.then(response => {
				if (response.SuccessMessage == MSG_Type.SUCCESS) {
					return JSON.parse(response.Elements) as { Identifier: string /*, Type: number*/ }[]
				}
				
				//if it is not a success but still has been returned an element table tell the user.
				if (response.Elements.length > 0) {
					vscode.window.showErrorMessage(response.Elements)
				}
				
				// Return an empty array of completion items, since no items could be produced
				//Yeah what he says.
				return []
			})
			.then(items => items.map(i => new vscode.CompletionItem(i.Identifier/*, i.Type*/)))
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
	//const Diagnostics_Socket = createSocket('udp4')
	
	const Private_Handler = new Socket_Handle(Private_Socket, Private_Port)
	//const Diagnostics_Handler = new Socket_Handle(Diagnostics_Socket, Private_Port)

	const Folder = vscode.workspace.workspaceFolders![0].uri.toString();
	Private_Handler.Open(Folder)

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
		{ language: 'Evie' },
		new Send_Text_To_Evie(Private_Handler),
		'.', 
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
	))
}