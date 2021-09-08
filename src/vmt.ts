import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionList, Range, SemanticTokensBuilder, SemanticTokensLegend, languages, HoverProvider, Hover, ProviderResult } from 'vscode'
import { KeyvalueDocument } from './keyvalue';
import { KvTokensProviderBase } from './keyvalue-parser/kv-token-provider-base';
import { Tokenizer } from './keyvalue-parser/kv-tokenizer';
import { ShaderParam } from './shader-param';
import { output } from './main'
import * as fs from 'fs'
import { listFilesSync } from 'list-files-in-dir'

export const legend = new SemanticTokensLegend([
    'struct',
    'comment',
    'variable',
    'string',
    'number',
    'operator',
    'keyword'
], [
    'declaration',
    'readonly'
]);

export let shaderParams: ShaderParam[];

export function initShaderParams(params: ShaderParam[]) {
    shaderParams = params;
}

export class VmtSemanticTokenProvider extends KvTokensProviderBase {

    protected keyProcessors: { processor: Function; regex: RegExp; }[] = [
        { regex: /\$\w+/, processor: this.processKeyShader },
        { regex: /\%\w+/, processor: this.processKeyCompile }
    ];

    protected valueProcessors: { processor: Function; regex: RegExp; }[] = [
        
    ];

    constructor() {
        super(legend, languages.createDiagnosticCollection('vmt'));
    }

    processKeyShader(content: string, range: Range, tokensBuilder: SemanticTokensBuilder, captures: RegExpMatchArray) {
        tokensBuilder.push(range, 'keyword');
    }

    processKeyCompile(content: string, range: Range, tokensBuilder: SemanticTokensBuilder, captures: RegExpMatchArray) {
        tokensBuilder.push(range, 'keyword', ['readonly']);
    }

}

export class ShaderParamCompletionItemProvider implements CompletionItemProvider {

    public provideCompletionItems(document: TextDocument, position: Position, cancellationToken: CancellationToken): CompletionList {
        
        // TODO: Optimize this. Shouldn't create a new KeyvalueDocument and tokenize the whole thing every time we want completion. Very dirty
        const tokenizer = new Tokenizer();
        tokenizer.tokenizeFile(document.getText());
        const kvDoc = new KeyvalueDocument(document, tokenizer.tokens);
        const kv = kvDoc.getKeyValueAt(position.line);

        if(kv == null) return new CompletionList();

        // FIXME: Eww!
        if(kv.keyRange.contains(position)) {
            const suggestions = shaderParams.filter(p => p.name.includes(kv.key));
            const completions = suggestions.map(s => {
                const completion = new CompletionItem(s.name);
                completion.insertText = s.name.substring(1);
                if(s.defaultCompletion != null) {
                    completion.insertText += " " + s.defaultCompletion.toString();
                }
                return completion;
            });
            
            return new CompletionList(completions);
        }

        if(kv.valueRange.contains(position) && kv.value === "") {
            const param = shaderParams.find(p => p.name == kv.key);

            const completions = new CompletionList();

            if(param == null) return new CompletionList();

            if(param.defaultCompletion != null) {
                completions.items.push( new CompletionItem(param.defaultCompletion.toString()) );
            }

            if(param.type === "texture" && document.uri.scheme === "file") {
                const path = document.uri.path;
                const materialPathIndex = path.indexOf("materials") + "materials".length;
                if(materialPathIndex > 0) {
                    const materialRoot = path.substring(0, materialPathIndex);
                    const textureFiles = listFilesSync(materialRoot, "vtf");
                    textureFiles.forEach( t => {
                        const completion = new CompletionItem(t.substring(materialPathIndex + 1));
                        completion.insertText = t.substring(materialPathIndex + 1, t.length - 4);
                        completions.items.push(completion);
                    });
                } 
            }

            return completions;

        }

        return new CompletionList();
        
    }
}

export class ShaderParamHoverProvider implements HoverProvider {

    provideHover(document: TextDocument, position: Position, token: CancellationToken): Hover | null {

        // TODO: Optimize this. Shouldn't create a new KeyvalueDocument and tokenize the whole thing every time we want completion. Very dirty
        const tokenizer = new Tokenizer();
        tokenizer.tokenizeFile(document.getText());
        const kvDoc = new KeyvalueDocument(document, tokenizer.tokens);
        const kv = kvDoc.getKeyValueAt(position.line);

        if(kv?.keyRange.contains(position) && kv.key !== "") {
            const param = shaderParams.find(p => p.name == kv.key);

            if(param == null) return null;

            const name = param.name;
            const defaultCompletion = param.defaultCompletion;
            const description = param.description;
            const uri = param.wikiUri;

            let hoverText = `(Shader Parameter) **${name}** ${defaultCompletion != null ? ("- Default: " + defaultCompletion) : ""}`
            if(description != null) hoverText += `\n\n${description}`;
            if(uri != null) hoverText += `\n\n[Wiki](${uri})`;

            return new Hover(hoverText, kv.keyRange);

        }

        return null;
    }

}