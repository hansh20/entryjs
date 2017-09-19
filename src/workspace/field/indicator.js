/*
 */
"use strict";

goog.provide("Entry.FieldIndicator");

goog.require("Entry.Field");
goog.require("Entry.SVG");
/*
 *
 */
Entry.FieldIndicator = function(content, blockView, index) {
    this._block = blockView.block;
    this._blockView = blockView;

    var box = new Entry.BoxModel();
    this.box = box;

    this._size = content.size;
    if (content.img) {
        if(this._block.deletable === Entry.Block.DELETABLE_FALSE_LIGHTEN)
            this._imgUrl = content.img.replace('.png', '_un.png');
        else this._imgUrl = content.img;
    } else if (content.color) {
        this._color = content.color
    }
    this._boxMultiplier = content.boxMultiplier || 2;
    this._highlightColor =
        content.highlightColor? content.highlightColor : "#F59900";
    this._position = content.position;

    this._index = index;
    this.svgGroup = null;
    this._path = null;
    this._imgElement = null;
    this.setValue(null);

    this.renderStart();
};

Entry.Utils.inherit(Entry.Field, Entry.FieldIndicator);

(function(p) {
    p.renderStart = function() {
        if (!this.svgGroup)
            this.svgGroup = this._blockView.contentSvgGroup.elem("g");

        var options;

        if (this._imgUrl) {
            options = {
                href: Entry.mediaFilePath + this._imgUrl,
                x: this._position ? this._size * -1 : 0,
                y: this._size * -1,
                width: this._size * 2,
                height: this._size * 2,
            };
            if (!this._imgElement)
                this._imgElement = this.svgGroup.elem("image");

            this._imgElement.attr(options);

            if (this._block.emphasized && this._imgUrl.lastIndexOf('_un.png') === -1) {
                this._imgUrl = this._imgUrl.replace('.png', '_un.png');
            }
        }

        var path = "m %s,-%s a %s,%s 0 1,1 -0.1,0 z"
            .replace(/%s/gi, this._size);

        options = {
            d: path,
            x: this._position ? this._size * -1 : 0,
            y: this._size * -1,
            stroke: "none",
            fill: this._color ? this._color : "none"
        };

        if (!this._path)
            this._path = this.svgGroup.elem("path");

        this._path.attr(options);

        this.box.set({
            width: this._size * this._boxMultiplier +
                (this._position ? - this._size : 0),
            height: this._size * this._boxMultiplier
        });
    };

    p.enableHighlight = function() {
        var pathLen = this._path.getTotalLength();
        var path = this._path;
        this._path.attr({
            stroke: this._highlightColor,
            strokeWidth: 2,
            "stroke-linecap": "round",
            "stroke-dasharray": pathLen + " " + pathLen,
            "stroke-dashoffset": pathLen
        });
        setInterval(function() {
            path.attr({"stroke-dashoffset": pathLen})
            .animate({"stroke-dashoffset": 0}, 300);
        }, 1400, mina.easeout);
        setTimeout(function() {
            setInterval(function() {
                path.animate({"stroke-dashoffset": - pathLen}, 300);
            }, 1400, mina.easeout);
        }, 500);
    };

})(Entry.FieldIndicator.prototype);
