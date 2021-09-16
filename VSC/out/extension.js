"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const net_1 = require("net");
const vscode = require("vscode");
var RequestType;
(function (RequestType) {
    RequestType[RequestType["NONE"] = 0] = "NONE";
    RequestType[RequestType["Completions"] = 1] = "Completions";
    RequestType[RequestType["Signatures"] = 2] = "Signatures";
    RequestType[RequestType["Diagnose"] = 3] = "Diagnose";
    RequestType[RequestType["Open"] = 4] = "Open";
    RequestType[RequestType["Definition"] = 5] = "Definition";
    RequestType[RequestType["Information"] = 6] = "Information";
    RequestType[RequestType["FindReferences"] = 7] = "FindReferences";
    RequestType[RequestType["Asm"] = 8] = "Asm";
})(RequestType || (RequestType = {}));
var MSG_Type;
(function (MSG_Type) {
    MSG_Type[MSG_Type["NORMAL"] = 0] = "NORMAL";
    MSG_Type[MSG_Type["ERROR"] = 1] = "ERROR";
    MSG_Type[MSG_Type["WARNING"] = 2] = "WARNING";
    MSG_Type[MSG_Type["SOLUTION"] = 3] = "SOLUTION";
    MSG_Type[MSG_Type["INFO"] = 4] = "INFO";
    MSG_Type[MSG_Type["FAIL"] = 5] = "FAIL";
    MSG_Type[MSG_Type["SUCCESS"] = 6] = "SUCCESS";
})(MSG_Type || (MSG_Type = {}));
class Position {
    constructor() {
        this.Line = 0;
        this.Character = 0;
        this.Local = 0;
        this.Absolute = 0;
        this.File_Name = "";
    }
    static init1(position, FileName) {
        var Result = new Position();
        Result.Line = position.line;
        Result.Character = position.character;
        Result.Local = 0;
        Result.Absolute = 0;
        Result.File_Name = FileName;
        return Result;
    }
    static init2(line, character) {
        var Result = new Position();
        Result.Line = line;
        Result.Character = character;
        Result.Local = 0;
        Result.Absolute = 0;
        Result.File_Name = "";
        return Result;
    }
}
class Socket_Handle {
    constructor(socket, port) {
        this.socket = socket;
        this.port = port;
    }
    async Connect() {
        return await new Promise((resolve, reject) => {
            this.socket.connect(this.port, "localhost", () => {
                resolve();
            });
        });
    }
    Send(request, document, position) {
        var payload = JSON.stringify({ Type: request, Uri: document.uri.toString(), /*Document: document.getText(),*/ Position: Position.init1(position, document.uri.path) });
        payload += "{" + document.getText() + "}";
        const Bytes = new Uint8Array(4);
        Bytes[0] = payload.length & 0xFF;
        Bytes[1] = (payload.length & 0xFF00) >> 8;
        Bytes[2] = (payload.length & 0xFF0000) >> 16;
        Bytes[3] = (payload.length & 0xFF000000) >> 24;
        this.socket.write(Bytes);
        this.socket.write(payload);
    }
    Open(folder) {
        const payload = JSON.stringify({ Type: RequestType.Open, Uri: folder, Document: '', Position: Position.init2(-1, -1) });
        const Bytes = new Uint32Array(1);
        Bytes[0] = payload.length;
        this.socket.write(new Uint8Array(Bytes.buffer));
        this.socket.write(payload);
        return this.Response();
    }
    Response() {
        return new Promise((resolve) => {
            this.socket.once('data', (data) => {
                resolve(data.toString('utf-8'));
            });
        });
    }
}
class Wellfare {
    constructor(Status, Elements) {
        this.Elements = Elements;
        this.Status = parseInt(Status);
    }
}
class Send_Text_To_Evie {
    constructor(H) {
        this.Handle = H;
    }
    provideCompletionItems(document, position, _) {
        // Send the current state of the document to the compiler service, which will analyze it
        //Yeah what he says.
        this.Handle.Send(RequestType.Completions, document, position);
        return this.Handle.Response()
            //change the raw response data into a json object
            .then(response => {
            return JSON.parse(response);
        })
            .then(response => {
            if (response.Status == MSG_Type.SUCCESS) {
                return JSON.parse(response.Elements);
            }
            //if it is not a success but still has been returned an element table tell the user.
            if (response.Elements.length > 0) {
                vscode.window.showErrorMessage(response.Elements);
            }
            // Return an empty array of completion items, since no items could be produced
            //Yeah what he says.
            return [];
        })
            .then(items => items.map(i => new vscode.CompletionItem(i /*, i.Type*/, vscode.CompletionItemKind.Variable)))
            .catch(error => {
            console.log(error);
            return [];
        });
    }
}
function Send_Asm_generation_Code(Code) {
    const Provider = new (class {
        provideTextDocumentContent(uri) {
            return "mov eax, rcx";
        }
    })();
    vscode.workspace.registerTextDocumentContentProvider("asm:", Provider);
    vscode.commands.registerCommand("Haloo", async () => {
        const Document = await vscode.workspace.openTextDocument("asm:filename");
        await vscode.window.showTextDocument(Document);
    });
}
function activate(context) {
    console.log('Intellisense Starting...');
    Start_Evie(context);
    //Start_Evie_Service(context, "1111")
}
exports.activate = activate;
function Start_Evie(context) {
    const service = require('child_process').spawn('Evie.exe', ['-service']);
    if (service.pid == undefined)
        vscode.window.showErrorMessage("Error while loading Evie as a service.");
    service.on("exit", (code) => {
        vscode.window.showErrorMessage(`Evie has shutten downed ${code}`);
        setTimeout(() => Start_Evie(context), 1000);
        return;
    });
    service.stdout.on('data', (data) => {
        const output = data.toString('utf-8');
        Start_Evie_Service(context, output);
    });
}
async function Start_Evie_Service(context, Port) {
    const Private_Port = parseInt(Port);
    const Private_Socket = new net_1.Socket();
    //const Diagnostics_Socket = createSocket('udp4')
    const Private_Handler = new Socket_Handle(Private_Socket, Private_Port);
    await Private_Handler.Connect();
    //const Diagnostics_Handler = new Socket_Handle(Diagnostics_Socket, Private_Port)
    const Folder = vscode.workspace.workspaceFolders[0].uri.toString();
    Private_Handler.Open(Folder);
    const Provider = new (class {
        constructor() {
            this.onDidChangeEmitter = new vscode.EventEmitter();
            this.onDidChange = this.onDidChangeEmitter.event;
        }
        provideTextDocumentContent(uri) {
            const Find = vscode.workspace.textDocuments.find((i) => {
                if (i.uri.fsPath == uri.fsPath)
                    return i;
            });
            if (Find == undefined) {
                vscode.window.showErrorMessage("Ei toimi :/");
            }
            Private_Handler.Send(RequestType.Asm, Find, new vscode.Position(0, 0));
            return Private_Handler.Response().then(response => {
                return JSON.parse(response);
            }).then(wellfare => {
                return wellfare.Elements.slice(2, wellfare.Elements.length - 2);
            }).catch((E) => {
                return "";
            });
        }
    })();
    vscode.workspace.registerTextDocumentContentProvider("asm", Provider);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: 'Evie' }, new Send_Text_To_Evie(Private_Handler), '.', '->', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'), vscode.workspace.onDidSaveTextDocument(async (e) => {
        const File = vscode.Uri.parse("asm:" + e.uri.fsPath);
        Provider.onDidChangeEmitter.fire(File);
        //const Document = await vscode.workspace.openTextDocument({language: "asm-intel-x86-generic", content: Result.slice(2, Result.length - 2)})
        const Documet = (await vscode.window.showTextDocument(File, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true })).document;
        vscode.languages.setTextDocumentLanguage(Documet, "asm-intel-x86-generic");
    }));
}
//# sourceMappingURL=extension.js.map