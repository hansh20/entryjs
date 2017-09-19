/*
 * @fileoverview Func object for entry function.
 */
'use strict';

goog.require("Entry.Utils");

/**
 * Block variable constructor
 * @param {variable model} variable
 * @constructor
 */
Entry.Func = function(func) {
    this.id = func ? func.id : Entry.generateHash();
    var content;
    //inspect empty content
    if (func && func.content && func.content.length > 4)
        content = func.content;
    this.content = content ? new Entry.Code(content) : new Entry.Code([
        [
            {
                type: "function_create",
                copyable: false,
                deletable: false,
                x: 40, y: 40
            }
        ]
    ]);
    this.block = null;
    this.blockMenuBlock = null;
    this._backupContent = null;
    this.hashMap = {};

    this.paramMap = {};

    Entry.generateFunctionSchema(this.id);

    if (func && func.content) {
        var blockMap = this.content._blockMap;
        for (var key in blockMap) {
            Entry.Func.registerParamBlock(blockMap[key].type);
        }
        Entry.Func.generateWsBlock(this);
    }

    Entry.Func.registerFunction(this);

    Entry.Func.updateMenu();
};

Entry.Func.threads = {};

Entry.Func.registerFunction = function(func) {
    if (!Entry.playground) return;
    var workspace = Entry.playground.mainWorkspace;
    if (!workspace) return;
    var blockMenu = workspace.getBlockMenu();
    var menuCode = blockMenu.code;

    this._targetFuncBlock = menuCode.createThread([{
        type: "func_" + func.id,
        category: 'func',
        x: -9999
    }]);
    func.blockMenuBlock = this._targetFuncBlock;
};

Entry.Func.executeFunction = function(threadHash) {
    var script = this.threads[threadHash];
    script = Entry.Engine.computeThread(script.entity, script);
    if (script) {
        this.threads[threadHash] = script;
        return true;
    } else {
        delete this.threads[threadHash];
        return false;
    }
};

Entry.Func.clearThreads = function() {
    this.threads = {};
};

Entry.Func.prototype.init = function(model) {
    this.id = model.id;
    this.content = Blockly.Xml.textToDom(model.content);
    var xmlText = '<xml>' + model.block + '</xml>';
    this.block = Blockly.Xml.textToDom(xmlText).childNodes[0];
};

Entry.Func.prototype.destroy = function() {
    this.blockMenuBlock && this.blockMenuBlock.destroy();
};

Entry.Func.edit = function(func) {
    if (!func) return;

    if (typeof func === "string") {
        func = Entry.variableContainer.getFunction(
            /(func_)?(.*)/.exec(func)[2]);
    }

    this.unbindFuncChangeEvent();
    this.unbindWorkspaceStateChangeEvent();

    this.cancelEdit();

    this.targetFunc = func;
    if (this.initEditView(func.content) === false)
        return; // edit fail
    Entry.Func.isEdit = true;
    this.bindFuncChangeEvent(func);
    this.updateMenu();
    setTimeout(function() {
        var schema = Entry.block["func_" + func.id];
        if (schema && schema.paramsBackupEvent)
            schema.paramsBackupEvent.notify();

        this._backupContent = func.content.stringify();
    }.bind(this), 0);
};

Entry.Func.initEditView = function(content) {
    if (!this.menuCode)
        this.setupMenuCode();
    var workspace = Entry.getMainWS();
    if (workspace.setMode(Entry.Workspace.MODE_OVERLAYBOARD) === false) {
        this.endEdit("cancelEdit");
        return false;
    }
    workspace.changeOverlayBoardCode(content);
    this._workspaceStateEvent =
        workspace.changeEvent.attach(this, function(message) {
            this.endEdit(message || 'cancelEdit');
            if (workspace.getMode() === Entry.Workspace.MODE_VIMBOARD) {
                workspace.blockMenu.banClass('functionInit');
            }
        });
    content.board.alignThreads();
};

Entry.Func.endEdit = function(message) {
    this.unbindFuncChangeEvent();
    this.unbindWorkspaceStateChangeEvent();
    var targetFuncId = this.targetFunc.id;

    if (this.targetFunc && this.targetFunc.content)
        this.targetFunc.content.destroyView();

    switch (message) {
        case "save":
            this.save();
            break;
        case "cancelEdit":
            this.cancelEdit();
            break;
    }

    this._backupContent = null;

    delete this.targetFunc;
    var blockSchema = Entry.block["func_" + targetFuncId];
    if (blockSchema && blockSchema.destroyParamsBackupEvent)
        blockSchema.destroyParamsBackupEvent.notify();
    this.updateMenu();
    Entry.Func.isEdit = false;
};

Entry.Func.save = function() {
    this.targetFunc.generateBlock(true);
    Entry.variableContainer.saveFunction(this.targetFunc);

    var ws = Entry.getMainWS();
    if (ws && (ws.overlayModefrom == Entry.Workspace.MODE_VIMBOARD)) {
        var mode = {};
        mode.boardType = Entry.Workspace.MODE_VIMBOARD;
        mode.textType = Entry.Vim.TEXT_TYPE_PY;
        mode.runType = Entry.Vim.WORKSPACE_MODE;
        Entry.getMainWS().setMode(mode);
        Entry.variableContainer.functionAddButton_.addClass('disable');
    }
};

Entry.Func.syncFuncName = function(dstFName) {
    var index = 0;
    var dstFNameTokens = [];
    dstFNameTokens = dstFName.split(' ');
    var name ="";
    var blocks = [];
    blocks =  Blockly.mainWorkspace.getAllBlocks();
    for(var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        if(block.type === "function_general") {
            var iList = [];
            iList = block.inputList;
            for(var j=0; j < iList.length; j++) {
                var input = iList[j];
                if(input.fieldRow.length > 0 && (input.fieldRow[0] instanceof Blockly.FieldLabel) && (input.fieldRow[0].text_ != undefined)) {
                    name += input.fieldRow[0].text_;
                    name += " ";
                }
            }
            name = name.trim();
            if(name === this.srcFName && (this.srcFName.split(' ').length == dstFNameTokens.length)) {
                for(var k=0; k < iList.length; k++) {
                    var input = iList[k];
                    if(input.fieldRow.length > 0 && (input.fieldRow[0] instanceof Blockly.FieldLabel) && (input.fieldRow[0].text_ != undefined)) {
                        if(dstFNameTokens[index] === undefined) {
                            iList.splice(k,1);
                            break;
                        } else {
                           input.fieldRow[0].text_ = dstFNameTokens[index];
                        }
                        index++;
                    }
                }
            }
            name = '';
            index = 0;
        }
    }

    var updatedDom = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)
    Blockly.mainWorkspace.clear();
    Blockly.Xml.domToWorkspace(Blockly.mainWorkspace, updatedDom);
};

Entry.Func.cancelEdit = function() {
    if (!this.targetFunc) return;

    if (!this.targetFunc.block) {
        this._targetFuncBlock.destroy();
        delete Entry.variableContainer.functions_[this.targetFunc.id];
        delete Entry.variableContainer.selected;
    } else {
        if (this._backupContent) {
            this.targetFunc.content.load(this._backupContent);
            Entry.generateFunctionSchema(this.targetFunc.id);
            Entry.Func.generateWsBlock(this.targetFunc, true);
        }
    }
    Entry.variableContainer.updateList();

    var ws = Entry.getMainWS();
    if (ws && (ws.overlayModefrom == Entry.Workspace.MODE_VIMBOARD)) {
        var mode = {};
        mode.boardType = Entry.Workspace.MODE_VIMBOARD;
        mode.textType = Entry.Vim.TEXT_TYPE_PY;
        mode.runType = Entry.Vim.WORKSPACE_MODE;
        Entry.getMainWS().setMode(mode);
        Entry.variableContainer.functionAddButton_.addClass('disable');
    }
};

Entry.Func.getMenuXml = function() {
    var blocks = [];
    if (!this.targetFunc)
        blocks = blocks.concat(this.createBtn);
    if (this.targetFunc) {
        var fieldXml = this.FIELD_BLOCK;
        fieldXml = fieldXml.replace('#1', Entry.generateHash());
        fieldXml = fieldXml.replace('#2', Entry.generateHash());
        var xml = Blockly.Xml.textToDom(fieldXml).childNodes;
        blocks = blocks.concat(Entry.nodeListToArray(xml));
    }
    for (var i in Entry.variableContainer.functions_) {
        var func = Entry.variableContainer.functions_[i];
        if (func === this.targetFunc) {
            var block = Entry.Func.generateBlock(
                this.targetFunc,
                Blockly.Xml.workspaceToDom(Entry.Func.workspace),
                func.id).block;
            blocks.push(block);
        } else
            blocks.push(func.block);
    }
    return blocks;
};

Entry.Func.syncFunc = function() {
    var func = Entry.Func;
    if (!func.targetFunc)
        return;
    var fieldText = func.workspace.topBlocks_[0].toString();
    var workspaceLength = func.workspace.topBlocks_.length;
    if ((func.fieldText != fieldText ||
        func.workspaceLength != workspaceLength) &&
            Blockly.Block.dragMode_ < 1) {
        func.updateMenu();
        func.fieldText = fieldText;
        func.workspaceLength = workspaceLength;
    }
};

Entry.Func.setupMenuCode = function() {
    var workspace = Entry.playground.mainWorkspace;
    if (!workspace) return;
    var blockMenu = workspace.getBlockMenu();
    var menuCode = blockMenu.code;
    var CATEGORY = 'func';
    this._fieldLabel = menuCode.createThread([{
        type: "function_field_label",
        copyable: false,
        category: CATEGORY,
        x: -9999
    }]).getFirstBlock();

    this._fieldString = menuCode.createThread([{
        type: "function_field_string",
        category: CATEGORY,
        x: -9999,
        copyable: false,
        params: [
            {type: this.requestParamBlock("string")}
        ]
    }]).getFirstBlock();

    this._fieldBoolean = menuCode.createThread([{
        type: "function_field_boolean",
        copyable: false,
        category: CATEGORY,
        x: -9999,
        params: [
            {type: this.requestParamBlock("boolean")}
        ]
    }]).getFirstBlock();

    this.menuCode = menuCode;
    blockMenu.align();
};

Entry.Func.refreshMenuCode = function() {
    if (!Entry.playground.mainWorkspace) return;
    if (!this.menuCode) this.setupMenuCode();

    this._fieldString.params[0]
        .changeType(this.requestParamBlock("string"));
    this._fieldBoolean.params[0]
        .changeType(this.requestParamBlock("boolean"));
};

Entry.Func.requestParamBlock = function(type) {
    var blockPrototype;
    switch (type) {
        case "string":
            blockPrototype = Entry.block.function_param_string;
            break;
        case "boolean":
            blockPrototype = Entry.block.function_param_boolean;
            break;
        default:
            return null;
    }

    var blockType = type + "Param_" + Entry.generateHash();
    Entry.block[blockType] =
        Entry.Func.createParamBlock(blockType, blockPrototype, type);
    return blockType;
};

Entry.Func.registerParamBlock = function(type) {
    if (!type) return;

    var blockPrototype;
    if (type.indexOf("stringParam") > -1)
        blockPrototype = Entry.block.function_param_string;
    else if (type.indexOf("booleanParam") > -1)
        blockPrototype = Entry.block.function_param_boolean;

    //not a function param block
    if (!blockPrototype) return;

    Entry.Func.createParamBlock(type, blockPrototype, type);
};

Entry.Func.createParamBlock = function(type, blockPrototype, originalType) {
    originalType = /string/gi.test(originalType) ?
        "function_param_string" : "function_param_boolean";
    var blockSchema = function () {};
    blockSchema.prototype = blockPrototype;
    blockSchema = new blockSchema();
    blockSchema.changeEvent = new Entry.Event();
    blockSchema.template = Lang.template[originalType];

    Entry.block[type] = blockSchema;
    return blockSchema;
};

Entry.Func.updateMenu = function() {
    var workspace = Entry.getMainWS();
    if (!workspace) return;
    var blockMenu = workspace.getBlockMenu();
    if (this.targetFunc) {
        !this.menuCode && this.setupMenuCode();
        blockMenu.banClass("functionInit", true);
        blockMenu.unbanClass("functionEdit", true);
    } else {
        !workspace.isVimMode() && blockMenu.unbanClass("functionInit", true);
        blockMenu.banClass("functionEdit", true);
    }
    blockMenu.lastSelector === 'func' && blockMenu.align();
};

Entry.Func.prototype.edit = function() {
    if (Entry.Func.isEdit)
        return;
    Entry.Func.isEdit = true;
    if (!Entry.Func.svg)
        Entry.Func.initEditView();
    else {
        this.parentView.appendChild(this.svg);
    }
};

Entry.Func.generateBlock = function(func) {
    var blockSchema = Entry.block["func_" + func.id];
    var block = {
        template: blockSchema.template,
        params: blockSchema.params
    };

    var reg = /(%\d)/mi;
    var templateParams = blockSchema.template.split(reg);
    var description = "";
    var booleanIndex = 0;
    var stringIndex = 0;
    for (var i in templateParams) {
        var templateChunk = templateParams[i];
        if (reg.test(templateChunk)) {
            var paramIndex = Number(templateChunk.split('%')[1]) - 1;
            var param = blockSchema.params[paramIndex];
            if (param.type === "Indicator") {
            } else if (param.accept === "boolean") {
                description +=
                    Lang.template.function_param_boolean +
                    (booleanIndex ? booleanIndex : "");
                booleanIndex++;
            } else {
                description += Lang.template.function_param_string +
                    (stringIndex ? stringIndex : "");
                stringIndex++;
            }
        } else {
            description += templateChunk
        }
    }

    return {block: block, description: description};
};

Entry.Func.prototype.generateBlock = function(toSave) {
    var generatedInfo = Entry.Func.generateBlock(this);
    this.block = generatedInfo.block;
    this.description = generatedInfo.description;
};

Entry.Func.generateWsBlock = function(targetFunc, isRestore) {
    this.unbindFuncChangeEvent();
    targetFunc = targetFunc ? targetFunc : this.targetFunc;
    var defBlock = targetFunc.content.getEventMap("funcDef")[0];

    if (!defBlock) return;

    var outputBlock = defBlock.params[0];
    var booleanIndex = 0;
    var stringIndex = 0;
    var schemaParams = [];
    var schemaTemplate = "";
    var hashMap = targetFunc.hashMap;
    var paramMap = targetFunc.paramMap;
    var blockIds = [];

    while (outputBlock) {
        var value = outputBlock.params[0];
        var valueType = value.type;
        switch (outputBlock.type) {
            case 'function_field_label':
                schemaTemplate = schemaTemplate + " " + value;
                break;
            case 'function_field_boolean':
                Entry.Mutator.mutate(valueType, {
                    template: Lang.Blocks.FUNCTION_logical_variable +
                        " " + (booleanIndex + 1)
                });
                hashMap[valueType] = false;
                paramMap[valueType] = booleanIndex + stringIndex;
                booleanIndex++;
                schemaParams.push({
                    type: "Block",
                    accept: "boolean"
                });
                schemaTemplate += " %" + (booleanIndex + stringIndex);
                blockIds.push(outputBlock.id);
                break;
            case 'function_field_string':
                Entry.Mutator.mutate(valueType, {
                    template: Lang.Blocks.FUNCTION_character_variable +
                        " " + (stringIndex + 1)
                });
                hashMap[valueType] = false;
                paramMap[valueType] = booleanIndex + stringIndex;
                stringIndex++;
                schemaTemplate += " %" + (booleanIndex + stringIndex);
                schemaParams.push({
                    type: "Block",
                    accept: "string"
                });
                blockIds.push(outputBlock.id);
                break;
        }
        outputBlock = outputBlock.getOutputBlock();
    }

    schemaTemplate += " %" + (booleanIndex + stringIndex + 1);
    schemaParams.push({
        "type": "Indicator",
        "img": "block_icon/function_03.png",
        "size": 12
    });

    var funcName = "func_" + targetFunc.id;
    var block = Entry.block[funcName];

    var originParams = block.params.slice(0, block.params.length - 1);
    var newParams = schemaParams.slice(0, schemaParams.length - 1);
    var originParamsLength = originParams.length;
    var newParamsLength = newParams.length;

    var changeData = {};

    if (newParamsLength > originParamsLength) {
        var outputBlockIds = targetFunc.outputBlockIds;
        if (outputBlockIds) {
            var startPos = 0;
            while (outputBlockIds[startPos] === blockIds[startPos])
                startPos++;

            var endPos = 0;
            while (outputBlockIds[outputBlockIds.length - endPos -1] ===
                blockIds[blockIds.length - endPos - 1])
                endPos++;

            endPos = blockIds.length - endPos -1;
            changeData = {
                type: 'insert',
                startPos: startPos,
                endPos: endPos
            };
        }
    } else if (newParamsLength < originParamsLength) {
        changeData = {
            type: 'cut',
            pos: newParamsLength
        };
    } else changeData = { type: 'noChange' };

    changeData.isRestore = isRestore;

    targetFunc.outputBlockIds = blockIds;

    Entry.Mutator.mutate(
        funcName,
        {
            params: schemaParams,
            template: schemaTemplate,
        },
        changeData
    );

    for (var key in hashMap) {
        var state = hashMap[key];
        if (state) {
            var text = /string/.test(key) ?
                Lang.Blocks.FUNCTION_character_variable :
                Lang.Blocks.FUNCTION_logical_variable;

            Entry.Mutator.mutate(key, { template: text });
        } else hashMap[key] = true;
    }

    this.bindFuncChangeEvent(targetFunc);
};

Entry.Func.bindFuncChangeEvent = function(targetFunc) {
    targetFunc = targetFunc ? targetFunc : this.targetFunc;
    if (!this._funcChangeEvent && targetFunc.content.getEventMap("funcDef")[0].view)
        this._funcChangeEvent = targetFunc.content
            .getEventMap("funcDef")[0].view._contents[1]
            .changeEvent.attach(this, this.generateWsBlock);
};

Entry.Func.unbindFuncChangeEvent = function() {
    if (!this._funcChangeEvent)
        return;
    this._funcChangeEvent.destroy();
    delete this._funcChangeEvent;
};

Entry.Func.unbindWorkspaceStateChangeEvent = function() {
    if (!this._workspaceStateEvent)
        return;
    this._workspaceStateEvent.destroy();
    delete this._workspaceStateEvent;
};

