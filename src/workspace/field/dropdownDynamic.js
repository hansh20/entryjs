/*
 */
"use strict";

goog.provide("Entry.FieldDropdownDynamic");

goog.require("Entry.FieldDropdown");
/*
 *
 */
Entry.FieldDropdownDynamic = function(content, blockView, index) {
    this._block = blockView.block;
    this._blockView = blockView;

    var box = new Entry.BoxModel();
    this.box = box;

    this.svgGroup = null;

    this._contents = content;
    this._index = index;

    var arrowColor = content.arrowColor;
    if (this._block.deletable === Entry.Block.DELETABLE_FALSE_LIGHTEN || this._block.emphasized) {
        arrowColor = blockView._fillColor;
    }

    this._arrowColor = arrowColor;

    var menuName = this._contents.menuName;

    if (Entry.Utils.isFunction(menuName))
        this._menuGenerator = menuName;
    else this._menuName = menuName;

    this._CONTENT_HEIGHT = this.getContentHeight(content.dropdownHeight);

    this._font_size = this.getFontSize(content.fontSize);

    this._ROUND = content.roundValue || 3;
    this.renderStart(blockView);
    if (blockView && blockView.getBoard() && blockView.getBoard().workspace
        && blockView.getBoard().workspace.changeEvent) {
        blockView.getBoard().workspace.changeEvent.attach(
            this, this._updateValue);
    }
};

Entry.Utils.inherit(Entry.FieldDropdown, Entry.FieldDropdownDynamic);

(function(p) {
    p.constructor = Entry.FieldDropDownDynamic;

    p._updateValue = function() {
        var object = this._block.getCode().object;
        var options = [];
        if (Entry.container) {
            if (this._menuName)
                options = Entry.container.getDropdownList(this._menuName, object);
            else options = this._menuGenerator();
        }

        this._contents.options = options;
        var value = this.getValue();
        if (this._blockView.isInBlockMenu || !value || value == 'null')
            value = (options.length !== 0 ? options[0][1] : null);

        this._updateOptions();
        this.setValue(value);
    };

    p.renderOptions = function() {
        var that = this;

        var blockView = this._block.view;

        this._attachDisposeEvent();

        this.optionGroup = Entry.Dom('ul', {
            class:'entry-widget-dropdown',
            parent: $('body')
        });

        this.optionGroup.bind('mousedown touchstart', function(e) {
            e.stopPropagation();
        });

        var options;
        if (this._menuName)
            options = Entry.container.getDropdownList(this._contents.menuName);
        else options = this._menuGenerator();
        this._contents.options = options;

        var OPTION_X_PADDING = 30;
        var maxWidth = 0;

        var CONTENT_HEIGHT = this._CONTENT_HEIGHT + 4;

        for (var i=0; i<options.length; i++) {
            var option = options[i];
            var text = option[0] = this._convert(option[0], option[1]);
            var value = option[1];
            var element = Entry.Dom('li', {
                class: 'rect',
                parent: this.optionGroup
            });
            var left = Entry.Dom('span', {
                class: 'left',
                parent: element
            });

            Entry.Dom('span', {
                class: 'right',
                parent: element
            }).text(text);

            if (this.getValue() == value) left.text('\u2713');


            (function(elem, value) {
                //prevent propagation to document
                elem.mousedown(function(e) {
                    e.stopPropagation();
                });

                elem.mouseup(function(e){
                    e.stopPropagation();
                    that.applyValue(value);
                    that.destroyOption(undefined, true);
                    that._selectBlockView();
                });
            })(element, value);
        }
        this._position();

        this.optionDomCreated();
    };

})(Entry.FieldDropdownDynamic.prototype);
