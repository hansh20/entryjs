/*
 *
 */
"use strict";

goog.provide("Entry.Field");

/*
 *
 */
Entry.Field = function() {};

(function(p) {
    p.TEXT_LIMIT_LENGTH = 20;

    p.destroy = function() {
        this.svgGroup && $(this.svgGroup).unbind('mouseup touchend');
        this.destroyOption(true);
    };

    p.command = function(forceCommand) {
        if (!this._blockView.isInBlockMenu && this._startValue !== undefined &&
            (forceCommand || this._startValue !== this.getValue())) {
            Entry.do(
                'setFieldValue',
                this.pointer(),
                this._nextValue || this.getValue(),
                this._code
            );
            delete this._nextValue;
            delete this._code;
        }
        delete this._startValue;
    };

    p.destroyOption = function(skipCommand, forceCommand) {
        this.isEditing() && Entry.Utils.blur();

        if (this.documentDownEvent) {
            Entry.documentMousedown.detach(this.documentDownEvent);
            delete this.documentDownEvent;
        }

        if (this.disposeEvent) {
            Entry.disposeEvent.detach(this.disposeEvent);
            delete this.documentDownEvent;
        }

        if (this.optionGroup) {
            this.optionGroup.remove();
            delete this.optionGroup;
        }

        this._isEditing = false;

        skipCommand !== true && this.command(forceCommand);
    };

    p._attachDisposeEvent = function(func) {
        var that = this;

        func = func || function(skipCommand) {
            that.destroyOption(skipCommand);
        };
        that.disposeEvent =
            Entry.disposeEvent.attach(that, func);
    };

    p.align = function(x, y, animate) {
        animate = animate === undefined ? true : animate;
        var svgGroup = this.svgGroup;
        if (this._position) {
            if (this._position.x)
                x = this._position.x;
            if (this._position.y)
                y = this._position.y;
        }

        var transform = "translate(" + x + "," + y + ")";

        if (animate)
            svgGroup.animate({
                transform: transform
            }, 300, mina.easeinout);
        else
            svgGroup.attr({
                transform: transform
            });

        this.box.set({
            x: x,
            y: y
        });
    };

    //get absolute position of field from parent board
    p.getAbsolutePosFromBoard = function() {
        var blockView = this._block.view;
        var contentPos = blockView.getContentPos();
        var absPos = blockView.getAbsoluteCoordinate();

        return {
            x: absPos.x + this.box.x + contentPos.x,
            y: absPos.y + this.box.y + contentPos.y
        };
    };

    //get absolute position of field from parent document
    p.getAbsolutePosFromDocument = function() {
        var blockView = this._block.view;
        var contentPos = blockView.getContentPos();
        var absPos = blockView.getAbsoluteCoordinate();
        var offset = blockView.getBoard().svgDom.offset();

        return {
            x: absPos.x + this.box.x + contentPos.x + offset.left,
            y: absPos.y + this.box.y + contentPos.y
                + offset.top - $(window).scrollTop()
        };
    };

    //get relative position of field from blockView origin
    p.getRelativePos = function() {
        var blockView = this._block.view;
        var contentPos = blockView.getContentPos();
        var box = this.box;

        return {
            x: box.x + contentPos.x,
            y: box.y + contentPos.y
        };
    };

    p.truncate = function() {
        var value = String(this._convert(this.getValue()));
        var limit = this.TEXT_LIMIT_LENGTH;
        var ret = value.substring(0, limit);
        if (value.length > limit)
            ret += '...';
        return ret;
    };

    p.appendSvgOptionGroup = function() {
        return this._block.view.getBoard().svgGroup.elem('g');
    };

    p.getValue = function() {
        var data = this._block.params[this._index];
        if (this._contents && this._contents.reference && this._contents.reference.length) {
            var reference = this._contents.reference.concat();
            if (reference[0][0] === "%")
                data = this._block.params[parseInt(reference.shift().substr(1)) - 1];
            if (!data)
                return data;
            return data.getDataByPointer(reference);
        }
        else
            return data;
    };

    p.setValue = function(value, reDraw) {
        if (this.value == value) return;
        this.value = value;
        if (this._contents && this._contents.reference && this._contents.reference.length) {
            var ref = this._contents.reference.concat();
            var index = ref.pop();
            var targetBlock = this._block.params[this._index];
            if (ref.length && ref[0][0] === "%")
                targetBlock = this._block.params[parseInt(ref.shift().substr(1)) - 1];
            if (ref.length)
                targetBlock = targetBlock.getDataByPointer(ref);
            targetBlock.params[index] = value;
        } else
            this._block.params[this._index] = value;
        if (reDraw) this._blockView.reDraw();
    };

    p._isEditable = function() {
        if (Entry.ContextMenu.visible || this._blockView.getBoard().readOnly) return false;
        var dragMode = this._block.view.dragMode;
        if (dragMode == Entry.DRAG_MODE_DRAG) return false;
        var blockView = this._block.view;
        var board = blockView.getBoard();
        if (board.disableMouseEvent === true) return false;

        var selectedBlockView = board.workspace.selectedBlockView;

        if (!selectedBlockView || board != selectedBlockView.getBoard()) return false;

        var root = blockView.getSvgRoot();

        return root == selectedBlockView.svgGroup ||
                $(root).has($(blockView.svgGroup));
    };

    p._selectBlockView = function() {
        var blockView = this._block.view;
        blockView.getBoard().setSelectedBlock(blockView);
    };

    p._bindRenderOptions = function() {
        var that = this;

        $(this.svgGroup).bind('mouseup touchend', function(e){
            if (that._isEditable()) {
                that._code = that.getCode();
                that.destroyOption();
                that._startValue = that.getValue();
                that.renderOptions();
                that._isEditing = true;
            }
        });
    };

    p.pointer = function(pointer) {
        pointer = pointer || [];
        pointer.unshift(this._index);
        pointer.unshift(Entry.PARAM);
        return this._block.pointer(pointer);
    };

    p.getFontSize = function(size) {
        return size || this._blockView.getSkeleton().fontSize || 12;
    };

    p.getContentHeight = function() {
        return Entry.isMobile() ? 22 : 16;
    };

    p._getRenderMode = function() {
        var mode = this._blockView.renderMode;
        return mode !== undefined ?
            mode : Entry.BlockView.RENDER_MODE_BLOCK;
    };

    p._convert = function(key, value) {
        value = value !== undefined ? value : this.getValue();
        var reg = /&value/gm;
        if (reg.test(value))
            return value.replace(reg, '');
        else if (this._contents.converter) {
            return this._contents.converter(key, value);
        } else return key;
    };

    p._updateOptions = function() {
        var block = Entry.block[this._blockView.type];
        if (!block) return;

        var syntaxes = block.syntax;

        for (var key in syntaxes) {
            var syntax = syntaxes[key];
            if (!syntax) continue;
            if (syntax.length === 0) continue;

            var textParams = syntax[0].textParams;
            if (!textParams)
                continue;

            textParams[this._index].options = this._contents.options;
        }
    };

    p._shouldReturnValue = function(value) {
        var obj = this._block.getCode().object;
        return value === '?' ||
            !obj || obj.constructor !== Entry.EntryObject;
    };

    p.isEditing = function(value) {
        return !!this._isEditing;
    };

    p.getDom = function(query) {
        if (query.length) {
            var key = query.shift();
            if (key === "option")
                return this.optionGroup;

        }

        return this.svgGroup;
    };

    p.optionDomCreated = function() {
        this._blockView.getBoard().workspace.widgetUpdateEvent.notify();
    };

    p.fixNextValue = function(value) {
        this._nextValue = value;
    };

    p.getFieldRawType = function() {
        if (this instanceof Entry.FieldTextInput)
            return 'textInput';
        else if (this instanceof Entry.FieldDropdown)
            return 'dropdown';
        else if (this instanceof Entry.FieldDropdownDynamic)
            return 'dropdownDynamic';
        else if (this instanceof Entry.FieldKeyboard)
            return 'keyboard';
    };

    p.getTextValueByValue = function(value) {
        switch (this.getFieldRawType()) {
            case 'keyboard':
                return Entry.getKeyCodeMap()[value];
            case 'dropdown':
            case 'dropdownDynamic':
                var options = this._contents.options;
                for (var i=0; i<options.length; i++) {
                    var o = options[i];
                    if (o[1] === value)
                        return o[0];
                }
                break;
            case 'textInput':
                return value;
        }
    };

    p.getBoard = function() {
        var view = this._blockView;
        return view && view.getBoard();
    };

    p.getCode = function() {
        var board = this.getBoard();
        return board && board.code;
    };

    p.getTextValue = function() {
        return this.getValue();
    };

    p.getTextBBox = (function() {
        var _cache = {};
        var svg;

        //make invisible svg dom to body
        //in order to calculate text width
        function generateDom() {
            svg = Entry.Dom(
               $('<svg id="invisibleBoard" class="entryBoard" width="1px" height="1px"' +
                'version="1.1" xmlns="http://www.w3.org/2000/svg"></svg>'),
               { parent: $('body') }
            );
        }

        var clearDoms = Entry.Utils.debounce(function() {
            if (!svg) return;
            $(svg).empty();
        }, 500);

        return function() {
            if (window.fontLoaded && !svg) generateDom();

            var value = this.getTextValue();

            //empty string check
            if (!value) return { width: 0, height: 0 };

            var fontSize = this._font_size || '';

            var key = value + '&&' + fontSize;
            var bBox = _cache[key];

            if (bBox) return bBox;

            var textElement = this.textElement;
            if (svg) {
                textElement = textElement.cloneNode(true);
                svg.append(textElement);
            }

            bBox = textElement.getBoundingClientRect();
            clearDoms();

            bBox = {
                width: Math.round(bBox.width*100)/100,
                height: Math.round(bBox.height*100)/100,
            };

            if (fontSize && window.fontLoaded &&
                bBox.width && bBox.height)
                _cache[key] = bBox;
            return bBox;
        };
    })();

})(Entry.Field.prototype);
