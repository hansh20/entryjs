'use strict';

goog.provide('Entry.GlobalSvg');

(function(gs) {
    gs.DONE = 0;
    gs._inited = false;
    gs.REMOVE = 1;
    gs.RETURN = 2;

    gs.createDom = function() {
        if (this.inited) return;


        //document attached element not removed by angular
        $('#globalSvgSurface').remove();
        $('#globalSvg').remove();

        var body = $('body');
        this._container = Entry.Dom('div', {
            classes: ['globalSvgSurface', 'entryRemove'],
            id: 'globalSvgSurface',
            parent: body
        });

        this.svgDom = Entry.Dom(
            $('<svg id="globalSvg" width="10" height="10"' +
              'version="1.1" xmlns="http://www.w3.org/2000/svg"></svg>'),
            { parent: this._container }
        );

        this.svg = Entry.SVG('globalSvg');
        this.left = 0;
        this.top = 0;
        this._inited = true;
    };

    gs.setView = function(view, mode) {
        if (view == this._view) return;
        var data = view.block;
        if (data.isReadOnly() || !view.movable) return;
        this._view = view;
        this._mode = mode;
        if (mode !== Entry.Workspace.MODE_VIMBOARD)
            view.set({visible:false});

        this.draw();
        this.show();
        this.align();
        this.position();
        return true;
    };

    gs.draw = function() {
        var that = this;
        var blockView = this._view;
        if (this._svg) this.remove();
        var isVimMode = this._mode == Entry.Workspace.MODE_VIMBOARD;
        var bBox = blockView.svgGroup.getBBox();

        this.svgDom.attr({
            width: Math.round(bBox.width + 4) + 'px',
            height: Math.round(bBox.height + 4) + 'px'
        });


        this.svgGroup = Entry.SVG.createElement(
            blockView.svgGroup.cloneNode(true),
            {'opacity':1}
        );

        this.svg.appendChild(this.svgGroup);
        //TODO selectAll function replace
        if (isVimMode) {
            var svg = $(this.svgGroup);

            svg.find('g').css({filter: 'none'});

            svg.find('path, rect, polygon').velocity({
                opacity: 0
            }, {
                duration: 500
            });

            svg.find('text').velocity({
                fill: '#000000'
            }, {
                duration: 530
            });
        }
    };

    gs.remove = function() {
        if (!this.svgGroup) return;
        this.svgGroup.remove();
        delete this.svgGroup;
        delete this._view;
        delete this._offsetX;
        delete this._offsetY;
        delete this._startX;
        delete this._startY;
        this.hide();
    };

    gs.align = function() {
        var offsetX = this._view.getSkeleton().box(this._view).offsetX || 0;
        var offsetY = this._view.getSkeleton().box(this._view).offsetY || 0;
        offsetX *= -1;
        offsetX += 1;
        offsetY *= -1;
        offsetY += 1;
        this._offsetX = offsetX;
        this._offsetY = offsetY;
        var transform = "translate(" + offsetX + "," + offsetY + ')';
        this.svgGroup.attr({transform: transform});
    };

    gs.show = function() {
        this._container.removeClass('entryRemove');
    };

    gs.hide = function() {
        this._container.addClass('entryRemove');
    };

    gs.position = function() {
        var that = this;
        var blockView = this._view;
        if (!blockView) return;
        var pos = blockView.getAbsoluteCoordinate();
        var offset = blockView.getBoard().offset();
        this.left = pos.x + offset.left - this._offsetX;
        this.top = pos.y + offset.top - this._offsetY;

        this._applyDomPos(this.left, this.top);
    };

    gs.adjust = function(adjustX, adjustY) {
        var left = this.left + (adjustX || 0);
        var top = this.top + (adjustY || 0);
        if (left === this.left && top === this.top)
            return;

        this.left = left;
        this.top = top;
        this._applyDomPos(this.left, this.top);
    };

    gs._applyDomPos = function(left, top) {
        this.svgDom.css({
            transform: 'translate3d('+ left + 'px,' + top +'px, 0px)'
        });
    };

    gs.terminateDrag = function(blockView) {
        var mousePos = Entry.mouseCoordinate;
        var board = blockView.getBoard();
        var blockMenu =board.workspace.blockMenu;
        var bLeft = blockMenu.offset().left;
        var bTop = blockMenu.offset().top;
        var bWidth = blockMenu.visible ? blockMenu.svgDom.width() : 0;
        if (mousePos.y > (board.offset().top - 20) && mousePos.x > bLeft + bWidth)
            return this.DONE;
        else if (mousePos.y > bTop && mousePos.x > bLeft && blockMenu.visible) {
            if (!blockView.block.isDeletable()) return this.RETURN;
            else return this.REMOVE;
        } else return this.RETURN;
    };

    gs.addControl = function(e) {
        this.onMouseDown.apply(this, arguments);
    };

    gs.onMouseDown = function(e) {
        this._startY = e.pageY;
        var that = this;
        e.stopPropagation();
        e.preventDefault();
        var doc = $(document);
        doc.bind('mousemove.block', onMouseMove);
        doc.bind('mouseup.block', onMouseUp);
        doc.bind('touchmove.block', onMouseMove);
        doc.bind('touchend.block', onMouseUp);
        this._startX = e.pageX;
        this._startY = e.pageY;

        function onMouseMove(e) {
            var newX = e.pageX;
            var newY = e.pageY;
            var dX = newX - that._startX;
            var dY = newY - that._startY;
            var newLeft = that.left + dX;
            var newTop = that.top + dY;
            that._applyDomPos(newLeft, newTop);
            that._startX = newX;
            that._startY = newY;
            that.left = newLeft;
            that.top = newTop;
        }

        function onMouseUp(e) {
            $(document).unbind('.block');
        }
    };

})(Entry.GlobalSvg);
