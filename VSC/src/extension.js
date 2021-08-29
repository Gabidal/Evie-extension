"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
var dgram_1 = require("dgram");
var vscode = require("vscode");
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
var Position = /** @class */ (function () {
    function Position(position, FileName) {
        this.Line = 0;
        this.Character = 0;
        this.Local = 0;
        this.Absolute = 0;
        this.File_Name = "";
        this.Line = position.line;
        this.Character = position.character;
        this.Local = 0;
        this.Absolute = 0;
        this.File_Name = FileName;
    }
    return Position;
}());
var Socket_Handle = /** @class */ (function () {
    function Socket_Handle(socket, port) {
        this.socket = socket;
        this.port = port;
    }
    Socket_Handle.prototype.Send = function (request, document, position) {
        var payload = JSON.stringify({ Type: request, Uri: document.uri.toString(), Document: document.getText(), Position: new Position(position, document.uri.path) });
        var Bytes = new Uint32Array(1);
        Bytes[0] = payload.length;
        this.socket.send(new Uint8Array(Bytes), this.port, "localhost");
        this.socket.send(payload, this.port, "localhost");
    };
    Socket_Handle.prototype.Open = function (folder) {
        var payload = JSON.stringify({ Type: RequestType.Open, Uri: folder, Document: '', Position: { Line: -1, Character: -1 } });
        var Bytes = new Uint32Array(1);
        Bytes[0] = payload.length;
        this.socket.send(new Uint8Array(Bytes), this.port, "localhost");
        this.socket.send(payload, this.port, "localhost");
        return this.Response();
    };
    Socket_Handle.prototype.Response = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.socket.once('message', function (data, _) {
                resolve(data.toString('utf-8'));
            });
        });
    };
    return Socket_Handle;
}());
var Wellfare = /** @class */ (function () {
    function Wellfare(SuccessMessage, Elements) {
        this.Elements = Elements;
        this.SuccessMessage = parseInt(SuccessMessage);
    }
    return Wellfare;
}());
var Send_Text_To_Evie = /** @class */ (function () {
    function Send_Text_To_Evie(H) {
        this.Handle = H;
    }
    Send_Text_To_Evie.prototype.provideCompletionItems = function (document, position, _) {
        // Send the current state of the document to the compiler service, which will analyze it
        //Yeah what he says.
        this.Handle.Send(RequestType.Completions, document, position);
        return this.Handle.Response()
            //change the raw response data into a json object
            .then(function (response) { return JSON.parse(response); })
            .then(function (response) {
            if (response.SuccessMessage == MSG_Type.SUCCESS) {
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
            .then(function (items) { return items.map(function (i) { return new vscode.CompletionItem(i.Identifier /*, i.Type*/); }); });
    };
    return Send_Text_To_Evie;
}());
function activate(context) {
    console.log('Intellisense Starting...');
    Start_Evie(context);
}
exports.activate = activate;
function Start_Evie(context) {
    var service = require('child_process').spawn('Evie.exe', ['-service']);
    if (service.pid == undefined)
        vscode.window.showErrorMessage("Error while loading Evie as a service.");
    service.stdout.on('data', function (data) {
        var output = data.toString('utf-8');
        Start_Evie_Service(context, output);
    });
}
function Start_Evie_Service(context, Port) {
    var Private_Port = parseInt(Port);
    var Private_Socket = dgram_1.createSocket('udp4');
    //const Diagnostics_Socket = createSocket('udp4')
    var Private_Handler = new Socket_Handle(Private_Socket, Private_Port);
    //const Diagnostics_Handler = new Socket_Handle(Diagnostics_Socket, Private_Port)
    var Folder = vscode.workspace.workspaceFolders[0].uri.toString();
    Private_Handler.Open(Folder);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: 'Evie' }, new Send_Text_To_Evie(Private_Handler), '.', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'));
}
//# sourceMappingURL=extension.js.map