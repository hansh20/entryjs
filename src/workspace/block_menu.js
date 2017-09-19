"use strict";

goog.provide("Entry.BlockMenu");

goog.require("Entry.Dom");
goog.require("Entry.Model");
goog.require("Entry.Utils");

/*
 *
 * @param {object} dom which to inject playground
 */
Entry.BlockMenu = function(dom, align, categoryData, scroll, readOnly) {
    Entry.Model(this, false);

    this.reDraw = Entry.Utils.debounce(this.reDraw, 100);
    this._dAlign = this.align;
    this._setDynamic = Entry.Utils.debounce(this._setDynamic, 150);
    this._dSelectMenu = Entry.Utils.debounce(this.selectMenu, 0);

    this._align = align || "CENTER";
    this.setAlign(this._align);
    this._scroll = scroll !== undefined ? scroll : false;
    this._bannedClass = [];
    this._categories = [];
    this.suffix = 'blockMenu';
    this._isSelectingMenu = false;
    this._dynamicThreads = [];
    this._setDynamicTimer = null;
    this._renderedCategories = {};
    this.categoryRendered = false;
    this.readOnly = readOnly === undefined ? true : readOnly;

    if (typeof dom === "string") dom = $('#' + dom);
    else dom = $(dom);

    if (dom.prop("tagName") !== "DIV")
        return console.error("Dom is not div element");

    this.view = dom;

    this.visible = true;
    this.hwCodeOutdated = false;
    this._svgId = 'blockMenu' + new Date().getTime();
    this._clearCategory();
    this._categoryData = categoryData;
    this._generateView(categoryData);

    this._splitters = [];
    this.setWidth();

    this.svg = Entry.SVG(this._svgId);
    Entry.Utils.addFilters(this.svg, this.suffix);
    var returnVal = Entry.Utils.addBlockPattern(this.svg, this.suffix);
    this.pattern = returnVal.pattern;

    this.svgGroup = this.svg.elem("g");

    this.svgThreadGroup = this.svgGroup.elem("g");
    this.svgThreadGroup.board = this;

    this.svgBlockGroup = this.svgGroup.elem("g");
    this.svgBlockGroup.board = this;

    this.changeEvent = new Entry.Event(this);
    this.categoryDoneEvent = new Entry.Event(this);

    this.observe(this, "_handleDragBlock", ["dragBlock"]);

    this.changeCode(new Entry.Code([]));
    categoryData && this._generateCategoryCodes();

    if (this._scroll) {
        this._scroller = new Entry.BlockMenuScroller(this);
        this._addControl(dom);
    }

    if (Entry.documentMousedown)
        Entry.documentMousedown.attach(this, this.setSelectedBlock);
    if (this.code && Entry.keyPressed)
        Entry.keyPressed.attach(this, this._captureKeyEvent);
    if (Entry.windowResized) {
        var dUpdateOffset = _.debounce(this.updateOffset, 200);
        Entry.windowResized.attach(this, dUpdateOffset);
    }

    Entry.addEventListener('setBlockMenuDynamic', function() {
        this._setDynamicTimer = this._setDynamic.apply(this, arguments);
    }.bind(this));

    Entry.addEventListener('cancelBlockMenuDynamic', this._cancelDynamic.bind(this));
    Entry.addEventListener('fontLoaded', this.reDraw.bind(this));
};

(function(p) {
    var VARIABLE = 'variable';
    var HW = 'arduino';

    var splitterHPadding = 20;

    p.schema = {
        code: null,
        dragBlock: null,
        closeBlock: null,
        selectedBlockView: null
    };

    p._generateView = function(categoryData) {
        var parent = this.view;
        var that = this;

        categoryData && this._generateCategoryView(categoryData);

        this.blockMenuContainer = Entry.Dom('div', {
            'class':'blockMenuContainer',
            'parent':parent
        });

        this.svgDom = Entry.Dom(
            $('<svg id="' + this._svgId +'" class="blockMenu" version="1.1" xmlns="http://www.w3.org/2000/svg"></svg>'),
            { parent: this.blockMenuContainer }
        );

        this.svgDom.mouseenter(function(e) {
            that._scroller && that._scroller.setOpacity(1);

            var selectedBlockView = that.workspace.selectedBlockView;
            if (!Entry.playground || Entry.playground.resizing ||
                (selectedBlockView && selectedBlockView.dragMode === Entry.DRAG_MODE_DRAG)) return;
            Entry.playground.focusBlockMenu = true;
            var bBox = that.svgGroup.getBBox();
            var adjust = that.hasCategory() ? 64 : 0;
            var expandWidth = bBox.width + bBox.x + adjust;
            if (expandWidth > Entry.interfaceState.menuWidth) {
                this.widthBackup = Entry.interfaceState.menuWidth - adjust;
                $(this).stop().animate({
                    width: expandWidth - adjust
                }, 200);
            }
        });

        this.svgDom.mouseleave(function(e) {
            if (!Entry.playground || Entry.playground.resizing) return;

            if (that._scroller)
                that._scroller.setOpacity(0);

            var widthBackup = this.widthBackup;
            if (widthBackup)
                $(this).stop().animate({
                    width: widthBackup
                }, 200);
            delete this.widthBackup;
            delete Entry.playground.focusBlockMenu;
        });

        $(window).scroll(function() {
            that.updateOffset();
        });
    };

    p.changeCode = function(code, isImmediate) {
        if (code instanceof Array)
            code = new Entry.Code(code);

        if (!(code instanceof Entry.Code))
            return console.error("You must inject code instance");
        if (this.codeListener)
            this.code.changeEvent.detach(this.codeListener);

        var that = this;
        this.set({code:code});
        this.codeListener = this.code.changeEvent.attach(
            this,
            function() {that.changeEvent.notify();}
        );
        code.createView(this);
        var workspace = this.workspace;

        if (isImmediate)
            this.align();
        else this._dAlign();
    };

    p.bindCodeView = function(codeView) {
        this.svgBlockGroup.remove();
        this.svgThreadGroup.remove();
        this.svgBlockGroup = codeView.svgBlockGroup;
        this.svgThreadGroup = codeView.svgThreadGroup;
        this.svgGroup.appendChild(this.svgThreadGroup);
        this.svgGroup.appendChild(this.svgBlockGroup);
        if (this._scroller)
            this.svgGroup.appendChild(this._scroller.svgGroup);
    };

    p.align = function() {
        var code = this.code;
        if (!(this._isOn() && code)) return;
        this._clearSplitters();

        var vPadding = 15,
            marginFromTop = 10,
            hPadding = this._align == 'LEFT' ? 10 : this.svgDom.width()/2;

        var pastClass;
        var blocks = this._getSortedBlocks();
        var inVisibles = blocks[1];
        var visibles = blocks[0];

        inVisibles.forEach(function(block) {
            var blockView = block.view;
            blockView.set({display:false});
            blockView.detach();
        });

        var shouldReDraw = !this._renderedCategories[this.lastSelector];
        visibles.forEach(function(block) {
            var blockView = block.view;
            blockView.attach();
            blockView.set({display:true});
            shouldReDraw && blockView.reDraw();

            var className = Entry.block[block.type].class;
            if (pastClass && pastClass !== className) {
                this._createSplitter(marginFromTop);
                marginFromTop += vPadding;
            }
            pastClass = className;

            var left = hPadding - blockView.offsetX;
            if (this._align == 'CENTER')
                left -= blockView.width/2;

            marginFromTop -= blockView.offsetY;
            blockView._moveTo(
                left,
                marginFromTop,
                false);
            marginFromTop += blockView.height + vPadding;
        }.bind(this));

        this.updateSplitters();

        if (this.workspace) {
            var mode = this.workspace.getMode()
            switch (mode) {
                case Entry.Workspace.MODE_BOARD:
                case Entry.Workspace.MODE_OVERLAYBOARD:
                    this.renderBlock(blocks);
                    break;
                case Entry.Workspace.MODE_VIMBOARD:
                    this.renderText(blocks);
                    break;
                default:
                    this.renderBlock(blocks);
            }
        }

        if (this.lastSelector !== 'func')
            this._renderedCategories[this.lastSelector] = true;
        this.changeEvent.notify();
    };

    p.cloneToGlobal = function(e) {
        var blockView = this.dragBlock;
        if (this._boardBlockView || blockView === null) return;

        var GS = Entry.GlobalSvg;
        var workspace = this.workspace;
        var workspaceMode = workspace.getMode();
        var WORKSPACE = Entry.Workspace;

        var svgWidth = this._svgWidth;

        var board = workspace.selectedBoard;
        var mouseDownCoordinate = blockView.mouseDownCoordinate;
        var dx = 0,
            dy = 0;

        if (mouseDownCoordinate) {
            dx = e.pageX - mouseDownCoordinate.x;
            dy = e.pageY - mouseDownCoordinate.y;
        }

        if (board && (workspaceMode === WORKSPACE.MODE_BOARD ||
            workspaceMode === WORKSPACE.MODE_OVERLAYBOARD)) {
            if (!board.code) {
                if (Entry.toast) {
                    Entry.toast.alert(
                        Lang.Workspace.add_object_alert,
                        Lang.Workspace.add_object_alert_msg
                    );
                }
                if (this.selectedBlockView) {
                    this.selectedBlockView.removeSelected();
                    this.set({
                        selectedBlockView: null,
                        dragBlock: null
                    });
                }
                return;
            }

            var block = blockView.block;
            var code = this.code;
            var currentThread = block.getThread();
            if (block && currentThread) {
                var distance =
                    this.offset().top -
                    board.offset().top -
                    $(window).scrollTop();

                var datum = currentThread.toJSON(true);
                datum[0].x = datum[0].x - svgWidth + (dx || 0);
                datum[0].y = datum[0].y + distance + (dy || 0);
                var newBlockView =
                    this._boardBlockView =
                    Entry.do("addThreadFromBlockMenu", datum)
                        .value.getFirstBlock().view;
                newBlockView.onMouseDown.call(
                    newBlockView, e
                );
                newBlockView.dragInstance.set({isNew:true});
                GS.setView(
                    newBlockView,
                    workspaceMode
                );
            }
        } else {
            if (GS.setView(blockView, workspaceMode)) {
                GS.adjust(dx, dy);
                GS.addControl(e);
            }
        }
    };

    p.terminateDrag = function() {
        if (!this._boardBlockView) return;

        var boardBlockView = this._boardBlockView;
        if (!boardBlockView) return;
        var thisCode = this.code;
        var workspace = this.workspace;
        var boardCode = workspace.getBoard().code;

        this._boardBlockView = null;

        //board block should be removed below the amount of range
        var blockLeft = Entry.GlobalSvg.left;
        var width = Entry.GlobalSvg.width/2;
        var boardLeft = boardBlockView.getBoard().offset().left;
        return blockLeft < boardLeft - width;
    };

    p.getCode = function(thread) {return this.code;};

    p.setSelectedBlock = function(blockView) {
        var old = this.selectedBlockView;

        if (old) old.removeSelected();

        if (blockView instanceof Entry.BlockView) {
            blockView.addSelected();
        } else blockView = null;

        this.set({selectedBlockView:blockView});
    };

    p.hide = function() {this.view.addClass('entryRemove');};

    p.show = function() {this.view.removeClass('entryRemove');};

    p.renderText = function(blocks) {
        if (!this._isOn()) return;

        var blocks = blocks || this._getSortedBlocks();
        var targetMode = Entry.BlockView.RENDER_MODE_TEXT;

        blocks[0].forEach(function(block) {
            if (targetMode === block.view.renderMode)
                return;
            var thread = block.getThread();
            if (thread.view) {
                thread.view.renderText();
            } else
                thread.createView(this, Entry.BlockView.RENDER_MODE_TEXT)
        }.bind(this));
        return blocks;
    };

    p.renderBlock = function(blocks) {
        if (!this._isOn()) return;

        blocks = blocks ||this._getSortedBlocks();
        var targetMode = Entry.BlockView.RENDER_MODE_BLOCK;

        blocks[0].forEach(function(block) {
            if (targetMode === block.view.renderMode)
                return;
            var thread = block.getThread();
            if (thread.view) {
                thread.view.renderBlock();
            } else
                thread.createView(this, Entry.BlockView.RENDER_MODE_BLOCK)
        }.bind(this));
        return blocks;
    };

    p._createSplitter = function(topPos) {
        var width = this._svgWidth;
        var svgBlockGroup = this.svgBlockGroup;
        var line = svgBlockGroup.elem("line", {
            x1: splitterHPadding,
            y1: topPos,
            x2: width-splitterHPadding,
            y2: topPos,
            stroke : '#b5b5b5'
        });
        this._splitters.push(line);
    };

    p.updateSplitters = function(y) {
        y = y === undefined ? 0 : y;
        var splitters = this._splitters;
        var width = this._svgWidth;
        var xDest = width - splitterHPadding;
        var yDest;
        splitters.forEach(function(line) {
            yDest = parseFloat(line.getAttribute('y1')) + y;
            line.attr({
                x2: xDest, y1:yDest, y2:yDest
            });
        });
    };

    p._clearSplitters = function() {
        var splitters = this._splitters;
        for (var i = splitters.length-1; i>=0; i--) {
            splitters[i].remove();
            splitters.pop();
        }
    };

    p.setWidth = function() {
        this._svgWidth = this.blockMenuContainer.width();
        this.updateSplitters();
    };

    p.setMenu = function(doNotAlign) {
        if (!this.hasCategory()) return;

        this._categoryData.forEach(function(data) {
            var category = data.category;
            var threads = data.blocks;

            if (category === 'func') {
                var funcThreads = this.code.getThreadsByCategory('func')
                            .map(function(t) {return t.getFirstBlock().type});
                threads = funcThreads.length ? funcThreads : threads;
            }

            var count = threads.length;
            for (var i=0; i<threads.length; i++) {
                if(this.checkBanClass(Entry.block[threads[i]]))
                    count--;
            }
            var elem = this._categoryElems[category];
            if (count === 0) elem.addClass('entryRemove');
            else elem.removeClass('entryRemove');
        }.bind(this));

        this.selectMenu(0, true, doNotAlign);
    };


    p.getCategoryCodes = function(selector) {
        //TODO if needed
    };

    p._convertSelector = function(selector) {
        if (!Entry.Utils.isNumber(selector)) return selector;

        selector = Number(selector);
        var categories = this._categories;
        var elems = this._categoryElems;
        for (var i = 0; i < categories.length; i++) {
            var key = categories[i];
            var visible = !elems[key].hasClass('entryRemove');
            if (visible)
                if (selector-- === 0) return key;
        }
    };

    p.selectMenu = function(selector, doNotFold, doNotAlign) {
        if (!this._isOn() || !this._categoryData) return;

        var className = 'entrySelectedCategory';
        var oldView = this._selectedCategoryView;

        var name = this._convertSelector(selector);
        if (selector !== undefined && !name) {
            this._dAlign();
            return;
        }

        if (name) this.lastSelector = name;

        this._isSelectingMenu = true;
        switch (name) {
            case VARIABLE:
                Entry.playground.checkVariables();
                break;
            case HW:
                this._generateHwCode();
                this.align();
                break;
        }

        var elem = this._categoryElems[name];
        var animate = false;
        var board = this.workspace.board,
            boardView = board.view;

        if (oldView)
            oldView.removeClass(className);

        doNotFold = doNotFold || !this.hasCategory();

        if (elem == oldView && !doNotFold) {
            boardView.addClass('folding');
            this._selectedCategoryView = null;
            elem && elem.removeClass(className);
            Entry.playground.hideTabs();
            animate = true;
            this.visible = false;
        } else if (!oldView && this.hasCategory()) {
            if (!this.visible) {
                animate = true;
                boardView.addClass('foldOut');
                Entry.playground.showTabs();
            }
            boardView.removeClass('folding');
            this.visible = true;
        } else if (!name)
            this._selectedCategoryView = null;

        if (animate) {
            Entry.bindAnimationCallbackOnce(boardView, function(){
                board.scroller.resizeScrollBar.call(board.scroller);
                boardView.removeClass('foldOut');
                Entry.windowResized.notify();
            });
        }

        this._isSelectingMenu = false;

        if (this.visible) {
            this._selectedCategoryView = elem;
            elem && elem.addClass(className);
        }

        doNotAlign !== true && this._dAlign();
    };

    p._generateCategoryCodes = function(elems) {
        if (!elems) {
            this.categoryRendered = false;
            this.view.addClass('init');
            elems = Object.keys(this._categoryElems);
        }
        if (elems.length) {
            var key = elems.shift();
            if (key !== HW) {
                this._generateCategoryCode(key);
            }  else this._generateHwCode(true);

            if (elems.length) {
                this._generateCodesTimer =
                    setTimeout(function() {
                        this._generateCategoryCodes(elems);
                }.bind(this), 0);
            } else {
                this._generateCodesTimer = null;
                this.view.removeClass('init');
                this.align();
                this.categoryRendered = true;
                this.categoryDoneEvent.notify();
            }
        }
    };

    p._generateCategoryCode = function(key) {
        if (!this._categoryData)
            return;
        var code = this.code;
        var codes = [];
        var datum = this._categoryData.filter(function(obj) {
            return obj.category == key;
        })[0];

        if (!datum)
            return;
        var category = key;
        var blocks = datum.blocks;
        blocks.forEach(function(b){
            var block = Entry.block[b];
            block.category = datum.category;
            if (!block || !block.def) {
                codes.push([{
                    type:b,
                    category: category
                }]);
            } else {
                if (block.defs) {
                    block.defs.forEach(function(d) {
                        d.category = category;
                    });
                    for (var i =0; i <block.defs.length; i++) {
                        codes.push([
                            block.defs[i]
                        ]);
                    }
                } else {
                    block.def.category = category;
                    codes.push([
                        block.def
                    ]);
                }
            }
        });

        this._categories.push(category);

        var index;
        if (key == 'func') {
            var threads = this.code.getThreadsByCategory('func');
            if (threads.length)
                index = this.code.getThreadIndex(threads[0]);
        }
        codes.forEach(function(t) {
            if (!t || !t[0]) return;
            t[0].x = -99999;
            code.createThread(t, index);
            if (index !== undefined)
                index++;
            delete t[0].x;
        });
    };

    p.banClass = function(className, doNotAlign) {
        var index = this._bannedClass.indexOf(className);
        if (index < 0) {
            this._bannedClass.push(className);
            doNotAlign !== true && this._dAlign();
        }
    };

    p.unbanClass = function(className, doNotAlign) {
        var index = this._bannedClass.indexOf(className);
        if (index > -1) {
            this._bannedClass.splice(index, 1);
            doNotAlign !== true && this._dAlign();
        }
    };

    p.checkBanClass = function(blockInfo) {
        if (!blockInfo) return;
        var isNotFor = blockInfo.isNotFor;
        if (!isNotFor || isNotFor.length === 0) return false;

        var current;
        var banned = this._bannedClass;
        for (var i=0; i<isNotFor.length; i++) {
            current = isNotFor[i];
            if (current && banned.indexOf(current) === -1) {
                return false;
            }
        }

        return true;
    };

    p.checkCategory = function(blockInfo) {
        if (!this.hasCategory() || !blockInfo) return;

        if (!this.lastSelector || this._selectDynamic)
            return true;

        var category = 'category_' + this.lastSelector;
        var isFor = blockInfo.isFor;

        if (this.lastSelector && isFor) {
            if (isFor.indexOf(category) < 0)
                return true;
        }
    };

    p._addControl = function(dom) {
        var that = this;
        var svgDom = this.svgDom;

        dom.on('wheel', function(){
            that._mouseWheel.apply(that, arguments);
        });

        if (that._scroller) {
            $(this.svg).bind('mousedown touchstart', function(e) {
                that.onMouseDown.apply(that, arguments);
            });
        }
    };

    p.removeControl = function(eventType) {
        this.svgDom.off(eventType);
    };

    p.onMouseDown = function(e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();

        var blockMenu = this;
        if (e.button === 0 || (e.originalEvent && e.originalEvent.touches)) {
            var mouseEvent = Entry.Utils.convertMouseEvent(e);

            if (Entry.documentMousedown)
                Entry.documentMousedown.notify(mouseEvent);
            var doc = $(document);

            doc.bind('mousemove.blockMenu', onMouseMove);
            doc.bind('mouseup.blockMenu', onMouseUp);
            doc.bind('touchmove.blockMenu', onMouseMove);
            doc.bind('touchend.blockMenu', onMouseUp);
            this.dragInstance = new Entry.DragInstance({
                startY: mouseEvent.pageY,
                offsetY: mouseEvent.pageY
            });
        }

        function onMouseMove(e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();

            var mouseEvent = Entry.Utils.convertMouseEvent(e);

            var dragInstance = blockMenu.dragInstance;
            blockMenu._scroller.scroll(
                -mouseEvent.pageY + dragInstance.offsetY
            );
            dragInstance.set({
                offsetY: mouseEvent.pageY
            });
        }

        function onMouseUp(e) {
            $(document).unbind('.blockMenu');
            delete blockMenu.dragInstance;
        }
    };

    p._mouseWheel = function(e) {
        e = e.originalEvent;
        e.preventDefault();
        var disposeEvent = Entry.disposeEvent;
        if (disposeEvent)
            disposeEvent.notify(e);
        this._scroller.scroll(
            -e.wheelDeltaY || e.deltaY / 3
        );
    };

    p.dominate = function(block) {
        this.svgBlockGroup
            .appendChild(block.view.svgGroup);
    };

    p.reDraw = function() {
        if (!this._isOn()) return;
        var selector = this.lastSelector;
        if (this._selectDynamic)
            selector = undefined;
        this.selectMenu(selector, true);
        this._getSortedBlocks()
            .shift()
            .forEach(function(block) {
                block.view.reDraw();
            });
    };

    p._handleDragBlock = function() {
        this._boardBlockView = null;
        if (this._scroller) this._scroller.setOpacity(0);
    };

    p._captureKeyEvent = function(e) {
        var keyCode = e.keyCode;

        if (e.ctrlKey && Entry.type == 'workspace') {
            if (keyCode > 48 && keyCode < 58) {
                e.preventDefault();
                setTimeout(function() {
                    this._cancelDynamic(true);
                    this._dSelectMenu(keyCode - 49, true);
                }.bind(this), 200);
            }
        }
    };

    p.enablePattern = function() {
        this.pattern.removeAttribute('style');
    };

    p.disablePattern = function() {
        this.pattern.attr({ style: "display: none" });
    };

    p._clearCategory = function() {
        if (this._generateCodesTimer) {
            clearTimeout(this._generateCodesTimer);
            this._generateCodesTimer = null;
        }
        this._selectedCategoryView = null;
        this._categories = [];

        var categories = this._categoryElems;
        for (var key in categories)
            categories[key].remove();
        this._categoryElems = {};

        if (this.code && this.code.constructor == Entry.Code)
            this.code.clear();
        this._categoryCol && this._categoryCol.remove();
        this._categoryData = null;
    };

    p.clearCategory = p._clearCategory;

    p.setCategoryData = function(data) {
        this._clearCategory();
        this._categoryData = data;
        this._generateCategoryView(data);
        this._generateCategoryCodes();
        this.setMenu();
        Entry.resizeElement();
    };

    p.setNoCategoryData = function(data) {
        this._clearCategory();
        Entry.resizeElement();
        this.changeCode(data, true);
        this.categoryDoneEvent.notify();
    };

    p._generateCategoryView = function(data) {
        if (!data) return;

        this._categoryCol && this._categoryCol.remove && this._categoryCol.remove();

        this._categoryCol = Entry.Dom('ul', {
            class: 'entryCategoryListWorkspace'
        });
        this.view.prepend(this._categoryCol);

        for (var i=0; i<data.length; i++)
            this._generateCategoryElement(data[i].category);
    };

    p._generateCategoryElement = function(name) {
        var that = this;
        var element = Entry.Dom('li', {
            id: 'entryCategory' + name,
            class: 'entryCategoryElementWorkspace entryRemove',
            parent: this._categoryCol
        });

        (function(elem, name){
            elem.text(Lang.Blocks[name.toUpperCase()]);
            that._categoryElems[name] = elem;
            elem.bindOnClick(function(e) {
                that._cancelDynamic(true, function() {
                    that.selectMenu(name, undefined, true);
                    that.align();
                    //Entry.do(
                        //'selectBlockMenu',
                        //name, undefined, true
                    //);
                });
            });
        })(element, name);
    };

    p.updateOffset = function () {
        this._offset = this.svgDom.offset();
    };


    p.offset = function() {
        if (!this._offset || (this._offset.top === 0 && this._offset.left === 0))  {
            this.updateOffset();
        }
        return this._offset;
    };

    p._generateHwCode = function(shouldHide) {
        var code = this.code;
        var threads = code.getThreadsByCategory(HW);

        if (!(this._categoryData && this.shouldGenerateHwCode(threads)))
            return;

        threads.forEach(function(t) {
            t.destroy();
        });

        var data = this._categoryData;
        var blocks;
        for (var i = data.length-1; i >= 0; i--) {
            var category = data[i].category;
            if (category === HW) {
                blocks = data[i].blocks;
                break;
            }
        }

        if (!blocks) return;
        var threads = [];

        for (i =0; i<blocks.length; i++) {
            var type = blocks[i];
            var block = Entry.block[type];
            if(!this.checkBanClass(block)) {
                if (!block || !block.def) {
                    threads.push([{
                        type:type,
                        category: HW
                    }]);
                } else {
                    if (block.defs) {
                        block.defs.forEach(function(d) {
                            d.category = HW;
                        });
                        for (var i =0; i <block.defs.length; i++)
                            threads.push([
                                block.defs[i]
                            ]);
                    } else {
                        block.def.category = HW;
                        threads.push([
                            block.def
                        ]);
                    }
                }
            }
        }

        threads.forEach(function(t) {
            if (shouldHide)
                t[0].x = -99999;
            code.createThread(t);
            delete t[0].x;
        });
        this.hwCodeOutdated = false;
    };

    p.setAlign = function(align) {
        this._align = align || "CENTER";
    };

    p._isNotVisible = function(blockInfo) {
        return this.checkCategory(blockInfo) ||
            this.checkBanClass(blockInfo);
    };

    p._getSortedBlocks = function() {
        var visibles = [];
        var inVisibles = [];

        var threads = this.code.getThreads();

        if (this._selectDynamic) {
            visibles = new Array(this._dynamicThreads.length)
            for (var i=0; i<threads.length; i++) {
                var block = threads[i].getFirstBlock();

                if (!block) continue;

                var type = block.type;
                var index = this._dynamicThreads.indexOf(type);
                if (index > -1)
                    visibles[index] = block
                else inVisibles.push(block);
            }
            visibles = visibles.filter(function(b) {
                return b instanceof Entry.Block;
            });
        } else {
            for (var i=0; i<threads.length; i++) {
                var block = threads[i].getFirstBlock();

                if (!block) continue;

                var type = block.type;
                var blockInfo = Entry.block[type];
                if (this._isNotVisible(blockInfo))
                    inVisibles.push(block);
                else visibles.push(block);
            }
        }

        return [visibles, inVisibles];
    };

    p._setDynamic = function(blocks) {
        if (!this._isOn()) return;

        this._selectDynamic = true;
        this._dynamicThreads = blocks;
        this.selectMenu(undefined, true);
    };

    p._cancelDynamic = function(fromElement, cb) {
        if (this._setDynamicTimer) {
            clearTimeout(this._setDynamicTimer);
            this._setDynamicTimer = null;
        }
        this._selectDynamic = false;
        this._dynamicThreads = [];
        if (fromElement !== true)
            this.selectMenu(this.lastSelector, true);
        cb && cb();
    };

    p._isOn = function() {
        return this.view.css('display') !== 'none';
    };

    p.deleteRendered = function(name) {
        delete this._renderedCategories[name];
    };

    p.hasCategory = function() {
        return !!this._categoryData;
    };

    p.getDom = function(query) {
        if (query.length >= 1) {
            if (query[0] === 'category')
                return this._categoryElems[query[1]];
            else {
                var type = query[0][0].type;
                var dom = this.getSvgDomByType(type);
                this.align();
                this.scrollToType(type);
                return dom;
            }
        } else {
        }
    };

    p.getSvgDomByType = function(type) {
        var code = this.code;

        var threads = code.getThreads();

        for (var i=0; i<threads.length; i++) {
            var block = threads[i].getFirstBlock();
            if (block.type === type)
                return block.view.svgGroup;
        }
    };

    p.scrollToType = function(type) {
        if (!type) return;
        var blockView = this.code.getBlockList(false, type)[0].view;
        var dom = this.getSvgDomByType(type);
        var rect = dom.getBoundingClientRect();
        if (isOverFlow()) {
            var currentY = blockView.y;
            var targetY = 20;
            var diff = currentY - targetY;
            this._scroller.scrollByPx(diff);
        }

        function isOverFlow() {
            return rect.bottom > $(window).height() - 10;
        }
    };

    p.shouldGenerateHwCode = function(threads) {
        return this.hwCodeOutdated || threads.length === 0;
    };

})(Entry.BlockMenu.prototype);
