import { Socket } from 'net';
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
	FindReferences,
	Asm
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
	
	public static init1(position: vscode.Position, FileName: string){
		var Result = new Position()

		Result.Line = position.line;
		Result.Character = position.character;
		Result.Local = 0;
		Result.Absolute = 0;
		Result.File_Name = FileName;

		return Result
	}

	public static init2(line: number, character: number){
		var Result = new Position()

		Result.Line = line;
		Result.Character = character;
		Result.Local = 0;
		Result.Absolute = 0;
		Result.File_Name = "";

		return Result;
	}
}

class Socket_Handle{
	private socket: Socket
	private port: number

	constructor(socket: Socket, port: number) {
		this.socket = socket
		this.port = port
	}

	public async Connect(){
		return await new Promise<void>((resolve, reject) => {
			this.socket.connect(this.port, "localhost", () => {
				resolve()
			})
		})
	}

	public Send(request: RequestType, document: vscode.TextDocument, position: vscode.Position) {
		var payload = JSON.stringify({ Type: request as number, Uri: document.uri.toString(), /*Document: document.getText(),*/ Position: Position.init1(position, document.uri.path) });
		
		payload += "{" + document.getText() + "}";

		const Bytes = new Uint8Array(4)

		Bytes[0] = payload.length & 0xFF
		Bytes[1] = (payload.length & 0xFF00) >> 8
		Bytes[2] = (payload.length & 0xFF0000) >> 16
		Bytes[3] = (payload.length & 0xFF000000) >> 24

		this.socket.write(Bytes)
		
		this.socket.write(payload)
	}

	public Open(folder: string) {
		const payload = JSON.stringify({ Type: RequestType.Open as number, Uri: folder, Document: '', Position: Position.init2(-1, -1) })
		
		const Bytes = new Uint32Array(1)

		Bytes[0] = payload.length

		this.socket.write(new Uint8Array(Bytes.buffer))
		
		this.socket.write(payload)
		return this.Response()
	}

	public Response() {
		return new Promise<string>((resolve) => {
			this.socket.once('data', (data: Buffer) => {
				resolve(data.toString('utf-8'))
			})
		})
	}
}

class Wellfare{
	public Status: number
	public Elements: string

	constructor(Status: string, Elements: string){
		this.Elements = Elements;
		this.Status = parseInt(Status);
	}
}

class Send_Text_To_Evie implements vscode.CompletionItemProvider{
	private Handle: Socket_Handle

	constructor(H: Socket_Handle) {
		this.Handle = H
	}

	public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _: vscode.CancellationToken) : Promise<vscode.CompletionItem[]> {
		// Send the current state of the document to the compiler service, which will analyze it
		//Yeah what he says.
		this.Handle.Send(RequestType.Completions, document, position)

		return this.Handle.Response()
			//change the raw response data into a json object
			.then(response => {
				return JSON.parse(response) as Wellfare
			})
			.then(response => {
				if (response.Status == MSG_Type.SUCCESS) {
					return JSON.parse(response.Elements) as string[]
				}
				
				//if it is not a success but still has been returned an element table tell the user.
				if (response.Elements.length > 0) {
					vscode.window.showErrorMessage(response.Elements)
				}
				
				// Return an empty array of completion items, since no items could be produced
				//Yeah what he says.
				return []
			})
			.then(items => items.map(i => new vscode.CompletionItem(i/*, i.Type*/, vscode.CompletionItemKind.Variable)))
			.catch(error => {
				console.log(error)
				return []
			})
	}
}

function Send_Asm_generation_Code(Code: vscode.TextDocument){
	const Provider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return "mov eax, rcx"
		}
	})();

	vscode.workspace.registerTextDocumentContentProvider("asm:", Provider)

	vscode.commands.registerCommand("Haloo", async () => {
		const Document = await vscode.workspace.openTextDocument("asm:filename")
		await vscode.window.showTextDocument(Document)
	} )

}

var Console = ""

export function activate(context: vscode.ExtensionContext) {
	console.log('Intellisense Starting...')
	Start_Evie(context)
	//Start_Evie_Service(context, "1111")
}

function Start_Evie(context: vscode.ExtensionContext){
	const service = require('child_process').spawn('Evie.exe', [ '-service' ])

	if (service.pid == undefined)
		vscode.window.showErrorMessage("Error while loading Evie as a service.")

	service.on("exit", (code: number) => {
		vscode.window.showErrorMessage(`Evie has shutten downed ${code}`)
		setTimeout(() => Start_Evie(context), 100)
		return;
	})

	service.stdout.on('data', (data: Buffer) => {
		const output = data.toString('utf-8')

		var NewLine_Count = 0;
		for (var i = 0; i < output.length; i++) {
			if (output[i] == '\n') {
				NewLine_Count++;
			}
		}

		if (NewLine_Count == 1){
			Start_Evie_Service(context, output)
		}
		else{
			Console += output;
		}
	})
}

async function Start_Evie_Service(context: vscode.ExtensionContext, Port: string){

	const Private_Port = parseInt(Port)
	const Private_Socket = new Socket()
	//const Diagnostics_Socket = createSocket('udp4')
	
	const Private_Handler = new Socket_Handle(Private_Socket, Private_Port)

	await Private_Handler.Connect();
	//const Diagnostics_Handler = new Socket_Handle(Diagnostics_Socket, Private_Port)

	const Folder = vscode.workspace.workspaceFolders![0].uri.toString();

	Private_Handler.Open(Folder)

	const Asm_Provider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
			const Find = vscode.workspace.textDocuments.find((i)=> {
				if (i.uri.fsPath == uri.fsPath)
					return i
			})

			if (Find == undefined){
				vscode.window.showErrorMessage("Ei toimi :/");
			}

			Private_Handler.Send(RequestType.Asm, Find!, new vscode.Position(0, 0))

			return Private_Handler.Response().then(response => {
				return JSON.parse(response) as Wellfare
			}).then(wellfare =>{
				return wellfare.Elements.slice(2, wellfare.Elements.length - 2)
			}).catch((E) => {
				return ""
			})
		}
		onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  		onDidChange = this.onDidChangeEmitter.event;
	})();


	vscode.workspace.registerTextDocumentContentProvider("asm", Asm_Provider)	
	
	
	//make a new provider that outputs the standard output of the compiler service to a new window that is below the current one.
	//This new Output_Provider will save the standard output and show it to the user when a onDidSaveTextDocument event is fired.
	const Output_Provider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			//get the standard output from 
			return Console;
		}
		onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  		onDidChange = this.onDidChangeEmitter.event;
	})();
	
	vscode.workspace.registerTextDocumentContentProvider("Console", Output_Provider)	

	context.subscriptions.push(

		vscode.languages.registerCompletionItemProvider(
			{ language: 'Evie' },
			new Send_Text_To_Evie(Private_Handler),
			'.', '->',
			'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
			'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
		),

		vscode.workspace.onDidSaveTextDocument( async (e) => {

			const Asm_File = vscode.Uri.parse("asm:" + e.uri.fsPath)
			
			const Output_File = vscode.Uri.parse("Console:" + e.uri.fsPath)

			Console = ""

			Asm_Provider.onDidChangeEmitter.fire(Asm_File)
			
			Output_Provider.onDidChangeEmitter.fire(Output_File)

			//const Document = await vscode.workspace.openTextDocument({language: "asm-intel-x86-generic", content: Result.slice(2, Result.length - 2)})

			const Asm_Documet = (await vscode.window.showTextDocument(Asm_File, {viewColumn: vscode.ViewColumn.Beside, preserveFocus: true})).document

			vscode.languages.setTextDocumentLanguage(Asm_Documet, "asm-intel-x86-generic")

			//set the visual studio code editor layout to two rows right of the current editor.
			vscode.commands.executeCommand('workbench.action.editorLayoutTwoRowsRight')

			const Output_Documet = (await vscode.window.showTextDocument(Output_File, {viewColumn: vscode.ViewColumn.Three, preserveFocus: true})).document
		})

	)



}

