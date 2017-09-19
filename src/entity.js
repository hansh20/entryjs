/**
 * @fileoverview entity object is class for entry object canvas view.
 */
'use strict';

/**
 * Construct entity class
 * @param {!Entry.EntryObject} object
 * @constructor
 */
Entry.EntityObject = function(object) {
    /** @type {!string} */
    this.parent = object;
    this.type = object.objectType;
    /** @type {Array<xml script>} */
    this.flip = false;
    this.collision = Entry.Utils.COLLISION.NONE;
    this.id = Entry.generateHash();
    this.removed = false;

    if (this.type == 'sprite') {
        this.object = new createjs.Bitmap();
        this.setInitialEffectValue();
    } else if (this.type == 'textBox') {
        this.object = new createjs.Container();
        this.textObject = new createjs.Text();
        this.textObject.font = "20px Nanum Gothic";
        this.textObject.textBaseline = "middle";
        this.textObject.textAlign = "center";
        this.bgObject = new createjs.Shape();
        this.bgObject.graphics.setStrokeStyle(1)
            .beginStroke("#f00").drawRect(0,0,100,100);
        this.object.addChild(this.bgObject);
        this.object.addChild(this.textObject);

        this.fontType = "Nanum Gothic";
        this.fontSize = 20;
        this.fontBold = false;
        this.fontItalic = false;
        this.underLine = false;
        this.strike = false;
    }

    this.object.entity = this;
    this.object.cursor = "pointer";

    this.object.on('mousedown', function(evt) {
        var id = this.entity.parent.id;
        Entry.dispatchEvent('entityClick', this.entity);
        Entry.stage.isObjectClick = true;

        if (Entry.type != 'minimize' && Entry.stage.isEntitySelectable()) {
            this.offset = {x:-this.parent.x+this.entity.getX()-(evt.stageX*0.75 -240),
                y:-this.parent.y-this.entity.getY()-(evt.stageY*0.75 -135)};
            this.cursor = "move";
            this.entity.initCommand();
            Entry.container.selectObject(id);
        }
    });

    this.object.on("pressup", function(evt) {
        Entry.dispatchEvent('entityClickCanceled', this.entity);
        this.cursor = "pointer";
        this.entity.checkCommand();
    });

    this.object.on("pressmove", function(evt) {
        if (Entry.type != 'minimize' && Entry.stage.isEntitySelectable()) {
            if (this.entity.parent.getLock())
                return;
            this.entity.doCommand();
            this.entity.setX((evt.stageX*0.75 -240) + this.offset.x);
            this.entity.setY(-(evt.stageY*0.75 -135) - this.offset.y);
            Entry.stage.updateObject();
        }
    });
};

/**
 * Construct entity class
 * @param {?picture model} pictureModel
 * @param {?entity model} entityModel
 * @constructor
 */
Entry.EntityObject.prototype.injectModel = function(pictureModel, entityModel) {
    if (this.type == 'sprite') {
        this.setImage(pictureModel);
    } else if (this.type == 'textBox') {
        var parent = this.parent;
        entityModel.text = entityModel.text || parent.text || parent.name;
        this.setFont(entityModel.font);
        this.setBGColour(entityModel.bgColor);
        this.setColour(entityModel.colour);
        this.setUnderLine(entityModel.underLine);
        this.setStrike(entityModel.strike);
        this.setText(entityModel.text);
    }

    //entity
    if (entityModel) {
        this.syncModel_(entityModel);
    } else {}
};

/**
 * sync this model with parameter
 * @param {!entity model} entityModel
 * @private
 */
Entry.EntityObject.prototype.syncModel_ = function(entityModel) {
    this.setX(entityModel.x);
    this.setY(entityModel.y);
    this.setRegX(entityModel.regX);
    this.setRegY(entityModel.regY);
    this.setScaleX(entityModel.scaleX);
    this.setScaleY(entityModel.scaleY);
    this.setRotation(entityModel.rotation);
    this.setDirection(entityModel.direction, true);
    this.setLineBreak(entityModel.lineBreak);
    this.setWidth(entityModel.width);
    this.setHeight(entityModel.height);
    this.setText(entityModel.text);
    this.setTextAlign(entityModel.textAlign);
    this.setFontSize(entityModel.fontSize || this.getFontSize());
    this.setVisible(entityModel.visible);
};

Entry.EntityObject.prototype.initCommand = function() {
    if (!Entry.engine.isState('stop'))
        return;
    this.isCommandValid = false;
    if (Entry.stateManager)
        Entry.stateManager.addCommand(
            "edit entity",
            this,
            this.restoreEntity,
            this.toJSON()
        );
};

Entry.EntityObject.prototype.doCommand = function() {
    this.isCommandValid = true;
};

Entry.EntityObject.prototype.checkCommand = function() {
    if (Entry.engine.isState('stop') && !this.isCommandValid)
        Entry.dispatchEvent('cancelLastCommand');
};

/**
 * for redo and undo
 * @param {!entity model} entityModel
 * @return {Entry.State} capture current state
 */
Entry.EntityObject.prototype.restoreEntity = function(entityModel) {
    var currentModel = this.toJSON();
    this.syncModel_(entityModel);
    Entry.dispatchEvent('updateObject');
    if (Entry.stateManager)
        Entry.stateManager.addCommand(
            "restore object",
            this,
            this.restoreEntity,
            currentModel
        );
};

/**
 * X coordinate setter
 * @param {number} x
 */
Entry.EntityObject.prototype.setX = function(x) {
    if (typeof x != 'number') return;

    /** @type {number} */
    this.x = x;
    this.object.x = this.x;
    !this.isClone && this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * X coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getX = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.x, toFixedValue);
    else return this.x;
};

/**
 * Y coordinate setter
 * @param {number} y
 */
Entry.EntityObject.prototype.setY = function(y) {
    if (typeof y != 'number') return;

    /** @type {number} */
    this.y = y;
    this.object.y = -this.y;
    !this.isClone && this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * Y coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getY = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.y, toFixedValue);
    else return this.y;
};


/**
 * direction getter
 * @return {number}
 */
Entry.EntityObject.prototype.getDirection = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.direction, toFixedValue);
    else return this.direction;
};

/**
 * direction setter
 * @param {number} direction
 * @param {boolean} flippable
 */
Entry.EntityObject.prototype.setDirection = function(direction, flippable) {
    if (!direction) direction = 0;

    if (this.parent.getRotateMethod() == 'vertical' && !flippable) {
        var previousIsRight = this.direction >= 0 && this.direction < 180;
        var afterIsRight = direction >= 0 && direction < 180;
        if (previousIsRight != afterIsRight) {
            this.setScaleX(-this.getScaleX());
            Entry.stage.updateObject();
            this.flip = !this.flip;
        }
    }
    /** @type {number} */
    this.direction = direction.mod(360);
    this.object.direction = this.direction;
    !this.isClone && this.parent.updateRotationView();
    Entry.dispatchEvent('updateObject');
    Entry.requestUpdate = true;
};

/**
 * rotation setter
 * @param {number} rotation
 * */
Entry.EntityObject.prototype.setRotation = function(rotation) {
    /** @type {number} */
    if (this.parent.getRotateMethod() !== 'free')
        rotation = 0;

    this.rotation = rotation.mod(360);
    this.object.rotation = this.rotation;
    this.updateDialog();
    !this.isClone && this.parent.updateRotationView();
    Entry.dispatchEvent('updateObject');
    Entry.requestUpdate = true;
};

/**
 * rotation getter
 * @return {number}
 */
Entry.EntityObject.prototype.getRotation = function(toFixedValue) {
    if (toFixedValue) return Entry.Utils.toFixed(this.rotation, toFixedValue);
    else return this.rotation;
};

/**
 * regX coordinate setter
 * @param {number} regX
 */
Entry.EntityObject.prototype.setRegX = function(regX) {
    if (this.type == 'textBox')
        regX = 0;
    /** @type {number} */
    this.regX = regX;
    this.object.regX = this.regX;
    Entry.requestUpdate = true;
};

/**
 * regX coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getRegX = function() {
    return this.regX;
};

/**
 * regY coordinate setter
 * @param {number} regY
 */
Entry.EntityObject.prototype.setRegY = function(regY) {
    if (this.type == 'textBox')
        regY = 0;
    /** @type {number} */
    this.regY = regY;
    this.object.regY = this.regY;
    Entry.requestUpdate = true;
};

/**
 * regY coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getRegY = function() {
    return this.regY;
};

/**
 * scaleX coordinate setter
 * @param {number} scaleX
 */
Entry.EntityObject.prototype.setScaleX = function(scaleX) {
    /** @type {number} */
    this.scaleX = scaleX;
    this.object.scaleX = this.scaleX;
    this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * scaleX coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getScaleX = function() {
    return this.scaleX;
};

/**
 * scaleY coordinate setter
 * @param {number} scaleY
 */
Entry.EntityObject.prototype.setScaleY = function(scaleY) {
    /** @type {number} */
    this.scaleY = scaleY;
    this.object.scaleY = this.scaleY;
    this.parent.updateCoordinateView();
    this.updateDialog();
    Entry.requestUpdate = true;
};

/**
 * scaleY coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getScaleY = function() {
    return this.scaleY;
};

/**
 * object size setter
 * @param {number} size
 */
Entry.EntityObject.prototype.setSize = function(size) {
    if(size < 1)
        size = 1;
    var scale = size / this.getSize();
    this.setScaleX(this.getScaleX() * scale);
    this.setScaleY(this.getScaleY() * scale);
    !this.isClone && this.parent.updateCoordinateView();
    Entry.requestUpdate = true;
};

/**
 * get object size
 * @return {number}
 */
Entry.EntityObject.prototype.getSize = function(toFixedValue) {
    var value = (this.getWidth() * Math.abs(this.getScaleX()) + this.getHeight() * Math.abs(this.getScaleY())) / 2;
    if (toFixedValue) return Entry.Utils.toFixed(value, toFixedValue);
    return value;
};

/**
 * width coordinate setter
 * @param {number} width
 */
Entry.EntityObject.prototype.setWidth = function(width) {
    /** @type {number} */
    this.width = width;
    this.object.width = this.width;
    if (this.textObject && this.getLineBreak())
        this.textObject.lineWidth = this.width;
    this.updateDialog();
    this.updateBG();
    Entry.requestUpdate = true;
};

/**
 * width coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getWidth = function() {
    return this.width;
};

/**
 * height coordinate setter
 * @param {number} height
 */
Entry.EntityObject.prototype.setHeight = function(height) {
    /** @type {number} */
    this.height = height;
    if (this.textObject) {
        this.object.height = this.height;
        this.alignTextBox();
    }
    this.updateDialog();
    this.updateBG();
    Entry.requestUpdate = true;
};

/**
 * height coordinate getter
 * @return {number}
 */
Entry.EntityObject.prototype.getHeight = function() {
    return this.height;
};

/**
 * colour setter
 * @param {?string} colour
 */
Entry.EntityObject.prototype.setColour = function(colour) {
    /** @type {string} */
    this.colour = colour || '#000000';
    if (this.textObject)
        this.textObject.color = this.colour;
    Entry.requestUpdate = true;
};

/**
 * colour getter
 * @return {colour}
 */
Entry.EntityObject.prototype.getColour = function() {
    return this.colour;
};

/**
 * BG colour setter, for textBox object
 * @param {?string} colour
 */
Entry.EntityObject.prototype.setBGColour = function(colour) {
    /** @type {string} */
    this.bgColor = colour || 'transparent';
    this.updateBG();
    //this.object.color = this.colour;
    Entry.requestUpdate = true;
};

/**
 * BG colour getter, for textBox object
 * @return {colour}
 */
Entry.EntityObject.prototype.getBGColour = function() {
    return this.bgColor;
};

Entry.EntityObject.prototype.setUnderLine = function(underLine) {
    if (underLine === undefined)
        underLine = false;
    this.underLine = underLine;
    this.textObject.underLine = underLine;
    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype.getUnderLine = function() {
    return this.underLine;
};

Entry.EntityObject.prototype.setStrike = function(strike) {
    if (strike === undefined)
        strike = false;
    this.strike = strike;
    this.textObject.strike = strike;
    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype.getStrike = function() {
    return this.strike;
};

/**
 * font getter
 */
Entry.EntityObject.prototype.getFont = function() {
    var fontArray = [];
    if (this.fontBold)
        fontArray.push("bold");
    if (this.fontItalic)
        fontArray.push("italic");
    fontArray.push(this.getFontSize() + 'px');
    fontArray.push(this.fontType);
    return fontArray.join(" ");
};

/**
 * font setter
 */
Entry.EntityObject.prototype.setFont = function(font) {
    if (this.parent.objectType != 'textBox')
        return;
    if (this.font === font)
        return;
    if (!font)
        font = "20px Nanum Gothic";

    var fontArray = font.split(" ");
    var i = 0;

    if (i = fontArray.indexOf("bold") > -1) {
        fontArray.splice(i - 1, 1);
        this.setFontBold(true);
    }
    if (i = fontArray.indexOf("italic") > -1) {
        fontArray.splice(i - 1, 1);
        this.setFontItalic(true);
    }
    var fontSize = parseInt(fontArray.shift());
    this.setFontSize(fontSize);
    this.setFontType(fontArray.join(" "));

    this.font = this.getFont();
    this.textObject.font = font;
    Entry.stage.update();
    this.setWidth(this.textObject.getMeasuredWidth());
    this.updateBG();
    Entry.stage.updateObject();
};

Entry.EntityObject.prototype.setLineHeight = function() {
    switch(this.getFontType()) {
        case "Nanum Gothic Coding": {
            this.textObject.lineHeight = this.fontSize;
            break;
        }
        default: {
            this.textObject.lineHeight = 0;
            break;
        }
    }
};

Entry.EntityObject.prototype.syncFont = function() {
    this.textObject.font = this.getFont();
    this.setLineHeight();
    Entry.stage.update();
    if (this.getLineBreak()) {
        if (this.fontType == "Nanum Gothic Coding") {
            var textObjectHeight = this.textObject.getMeasuredLineHeight();
            this.textObject.y = (textObjectHeight / 2 - this.getHeight() / 2) + 10;
        }

    } else {
        this.setWidth(this.textObject.getMeasuredWidth());
        this.setHeight(this.textObject.getMeasuredHeight());
    }
    Entry.stage.updateObject();
    Entry.requestUpdate = true;
};

/**
 * font type getter
 */
Entry.EntityObject.prototype.getFontType = function() {
    return this.fontType;
};

/**
 * font type setter
 */
Entry.EntityObject.prototype.setFontType = function(fontType) {
    if (this.parent.objectType != 'textBox')
        return;
    fontType = fontType ? fontType : "Nanum Gothic";
    this.fontType = fontType;
    this.syncFont();
};

/**
 * font size getter
 */
Entry.EntityObject.prototype.getFontSize = function(fontSize) {
    return this.fontSize;
};

/**
 * font size setter
 */
Entry.EntityObject.prototype.setFontSize = function(fontSize) {
    if (this.parent.objectType != 'textBox')
        return;
    if (this.fontSize == fontSize)
        return;
    this.fontSize = fontSize ? fontSize : 20;
    this.syncFont();
    this.alignTextBox();
};

/**
 * set font bold state
 */
Entry.EntityObject.prototype.setFontBold = function(isFontBold) {
    this.fontBold = isFontBold;
    Entry.requestUpdate = true;
};

/**
 * toggle bold on,off and return current
 */
Entry.EntityObject.prototype.toggleFontBold = function() {
    this.fontBold = !this.fontBold;
    this.syncFont();
    return this.fontBold;
};

/**
 * set font italic state
 */
Entry.EntityObject.prototype.setFontItalic = function(isFontItalic) {
    this.fontItalic = isFontItalic;
    Entry.requestUpdate = true;
};

/**
 * toggle italic on,off and return current
 */
Entry.EntityObject.prototype.toggleFontItalic = function() {
    this.fontItalic = !this.fontItalic;
    this.syncFont();
    return this.fontItalic;
};

Entry.EntityObject.prototype.setFontName = function(fontName) {
    var currentFontArray = this.font.split(' ');
    var tempArray = [];
    for (var i=0,len=currentFontArray.length; i<len; i++) {
        if (currentFontArray[i] === 'bold' ||
           currentFontArray[i] === 'italic' ||
           currentFontArray[i].indexOf('px') > -1) {
            tempArray.push(currentFontArray[i]);
        }
    }
    this.setFont(tempArray.join(' ') + ' ' + fontName);
};

Entry.EntityObject.prototype.getFontName = function() {
    if (this.type != 'textBox')
        return;
    if (!this.font)
        return '';
    var currentFontArray = this.font.split(' ');
    var tempArray = [];
    for (var i=0,len=currentFontArray.length; i<len; i++) {
        if (currentFontArray[i] !== 'bold' &&
           currentFontArray[i] !== 'italic' &&
           currentFontArray[i].indexOf('px') === -1) {
            tempArray.push(currentFontArray[i]);
        }
    }
    return tempArray.join(' ').trim();
};

/**
 * text setter
 * @param {string} text
 */
Entry.EntityObject.prototype.setText = function(text) {
    if (this.parent.objectType != 'textBox')
        return;
    /** @type {string} */
    if (text === undefined)
        text = '';
    this.text = text;
    this.textObject.text = this.text;
    if (!this.lineBreak) {
        this.setWidth(this.textObject.getMeasuredWidth());
        this.parent.updateCoordinateView();
    }
    this.updateBG();
    Entry.stage.updateObject();
};

/**
 * text getter
 * @return {string}
 */
Entry.EntityObject.prototype.getText = function() {
    return this.text;
};

/**
 * textAlign setter
 * @param {number} textAlign
 */
Entry.EntityObject.prototype.setTextAlign = function(textAlign) {
    if (this.parent.objectType != 'textBox')
        return;
    if (textAlign === undefined)
        textAlign = Entry.TEXT_ALIGN_CENTER;
    this.textAlign = textAlign;

    this.textObject.textAlign = Entry.TEXT_ALIGNS[this.textAlign];
    this.alignTextBox();
    this.updateBG();
    Entry.stage.updateObject();
    /*
    this.setWidth(this.textObject.getMeasuredWidth());
    this.updateBG();
    */
};

/**
 * textAlign getter
 * @return {number}
 */
Entry.EntityObject.prototype.getTextAlign = function() {
    return this.textAlign;
};

/**
 * lineBreak setter
 * @param {boolean} lineBreak
 */
Entry.EntityObject.prototype.setLineBreak = function(lineBreak) {
    if (this.parent.objectType != 'textBox') return;

    if (lineBreak === undefined) lineBreak = false;

    var previousState = this.lineBreak;
    this.lineBreak = lineBreak;

    if (previousState && !this.lineBreak) {
        this.textObject.lineWidth = null;
        this.setHeight(this.textObject.getMeasuredLineHeight());
        this.setText(this.getText().replace(/\n/g, ''));
    } else if (!previousState && this.lineBreak) {
        this.setFontSize(this.getFontSize() * this.getScaleX());
        this.setHeight(this.textObject.getMeasuredLineHeight() * 3);
        this.setWidth(this.getWidth() * this.getScaleX());
        this.setScaleX(1);
        this.setScaleY(1);
        this.textObject.lineWidth = this.getWidth();
        this.alignTextBox();
        if (this.fontType == "Nanum Gothic Coding") {
            var textObjectHeight = this.textObject.getMeasuredLineHeight();
            this.textObject.y = (textObjectHeight / 2 - this.getHeight() / 2) + 10;
        }
    }

    Entry.stage.updateObject();
};

/**
 * lineBreak getter
 * @return {number}
 */
Entry.EntityObject.prototype.getLineBreak = function() {
    return this.lineBreak;
};

/**
 * visible setter
 * @param {boolean} visible
 */
Entry.EntityObject.prototype.setVisible = function(visible) {
    /** @type {string} */
    if(visible === undefined)
        visible = true;
    this.visible = visible;
    this.object.visible = this.visible;
    if (this.dialog)
        this.syncDialogVisible();
    Entry.requestUpdate = true;
    return this.visible;
};

/**
 * visible getter
 * @return {boolean}
 */
Entry.EntityObject.prototype.getVisible = function() {
    return this.visible;
};

/**
 * Change picture
 * @param {?picture model} pictureModel
 */
Entry.EntityObject.prototype.setImage = function(pictureModel) {
    var that = this;
    delete pictureModel._id;

    Entry.assert(this.type == 'sprite', "Set image is only for sprite object");
    if (!pictureModel.id)
        pictureModel.id = Entry.generateHash();

    this.picture = pictureModel;
    var dimension = this.picture.dimension;
    var entityWidth = this.getWidth();
    var entityHeight = this.getHeight();

    var absoluteRegX = this.getRegX() - entityWidth/2;
    var absoluteRegY = this.getRegY() - entityHeight/2;
    this.setWidth(dimension.width);
    this.setHeight(dimension.height);
    if (!dimension.scaleX) {
        dimension.scaleX = this.getScaleX();
        dimension.scaleY = this.getScaleY();
    }

    this.setScaleX(this.scaleX);
    this.setScaleY(this.scaleY);
    this.setRegX(this.width/2 + absoluteRegX);
    this.setRegY(this.height/2 + absoluteRegY);

    //pictureId can be duplicated by copy/paste
    //add entityId in order to differentiate copied pictures
    var cacheId = !this.isClone ?
        pictureModel.id + this.id : pictureModel.id;

    var image = Entry.container.getCachedPicture(cacheId);

    if (!image) {
        image = new Image();

        image.onload = function(e) {
            if (!that.removed)
                Entry.container.cachePicture(cacheId, this);

            this.onload = null;
            setImage(this);
        };

        var fileUrl = pictureModel.fileurl;
        if (fileUrl) image.src = fileUrl;
        else {
            var fileName = pictureModel.filename;
            image.src =
                Entry.defaultPath + '/uploads/' +
                fileName.substring(0, 2) + '/' +
                fileName.substring(2, 4) + '/image/' +
                fileName + '.png';
        }

        that.object.image = image;
        if (that.object.filters && that.object.filters.length)
            that.cache();
        else
            that.object.uncache();
    } else setImage(image);

    function setImage(datum) {
        Entry.image = datum;
        that.object.image = datum;
        if (that.object.filters && that.object.filters.length)
            that.cache();
        else
            that.object.uncache();
        Entry.requestUpdate = true;
    }

    Entry.dispatchEvent('updateObject');
};

/**
 * Apply easel filter
 */
Entry.EntityObject.prototype.applyFilter = function(isForce, forceEffects) {
    var effects = this.effect;
    var object = this.object;

    var diffEffects = isEqualEffects(effects, this.getInitialEffectValue());
    if (!isForce && diffEffects.length === 0)
        return;

    if (Array.isArray(forceEffects)) {
        diffEffects = diffEffects.concat(forceEffects);
    }

    (function(e, obj) {
        var f = [];
        var adjust = Entry.adjustValueWithMaxMin;

        if(diffEffects.indexOf('brightness') > -1) {
            e.brightness = e.brightness;
            var cmBrightness = new createjs.ColorMatrix();
            cmBrightness.adjustColor(adjust(e.brightness, -100, 100), 0, 0, 0);
            var brightnessFilter = new createjs.ColorMatrixFilter(cmBrightness);
            f.push(brightnessFilter);
        }

        if(diffEffects.indexOf('hue') > -1) {
            e.hue = e.hue.mod(360);
            var cmHue = new createjs.ColorMatrix();
            cmHue.adjustColor(0, 0, 0, e.hue);
            var hueFilter = new createjs.ColorMatrixFilter(cmHue);
            f.push(hueFilter);
        }

        if(diffEffects.indexOf('hsv') > -1) {
            var matrixValue = [
                1, 0, 0, 0, 0,
                0, 1, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 1, 0,
                0, 0, 0, 0, 1
            ];

            var degrees = e.hsv*3.6;
            var r = (degrees*3) * Math.PI / 180;
            var cosVal = Math.cos(r);
            var sinVal = Math.sin(r);

            var v = Math.abs(e.hsv/100);
            if (v>1) {
                v = v-Math.floor(v);
            }

            if (v > 0 && v <= 0.33) {
                var matrixValue = [
                    1, 0, 0, 0, 0,
                    0, cosVal, sinVal, 0, 0,
                    0, -1*sinVal, cosVal, 0, 0,
                    0, 0, 0, 1, 0,
                    0, 0, 0, 0, 1
                ];
            } else if (v <= 0.66) {
                var matrixValue = [
                    cosVal, 0, sinVal, 0, 0,
                    0, 1, 0, 0, 0,
                    sinVal, 0, cosVal, 0, 0,
                    0, 0, 0, 1, 0,
                    0, 0, 0, 0, 1
                ];
            } else if (v <= 0.99) {
                var matrixValue = [
                    cosVal, sinVal, 0, 0, 0,
                    -1*sinVal, cosVal, 0, 0, 0,
                    0, 0, 1, 0, 0,
                    0, 0, 0, 1, 0,
                    0, 0, 0, 0, 1
                ];
            }

            var calcMatrix = new createjs.ColorMatrix().concat(matrixValue);
            var colorFilter = new createjs.ColorMatrixFilter(calcMatrix);
            f.push(colorFilter);
        }

        if (diffEffects.indexOf('alpha') > -1) {
            obj.alpha = e.alpha = adjust(e.alpha, 0, 1);
        }

        obj.filters = f;

    })(effects, object);

    this.cache();

    function isEqualEffects(effectsA, effectsB) {
        var diffEffects = [];
        for (var key in effectsA) {
            if (effectsA[key] !== effectsB[key]) {
                diffEffects.push(key);
            }
        }
        return diffEffects;
    }
};

/**
 * Remove all filter
 */
Entry.EntityObject.prototype.resetFilter = function() {
    if (this.parent.objectType !== 'sprite') return;

    var object = this.object;
    object.filters = [];
    this.setInitialEffectValue();
    object.alpha = this.effect.alpha;

    object.uncache();
};

/**
 * update dialog position if exist
 */
Entry.EntityObject.prototype.updateDialog = function() {
    if (this.dialog) this.dialog.update();
    Entry.requestUpdate = true;
};

/**
 * save current state data to 'snapshot_'
 */
Entry.EntityObject.prototype.takeSnapshot = function() {
    this.snapshot_ = this.toJSON();
    this.collision = Entry.Utils.COLLISION.NONE;
};

/**
 * load snapshot to current entity
 */
Entry.EntityObject.prototype.loadSnapshot = function() {
    if (this.snapshot_)
        this.syncModel_(this.snapshot_);
    if (this.parent.objectType === 'sprite')
        this.setImage(this.parent.getPicture());

    Entry.requestUpdate = true;
};

/**
 * Remove itself when this is clone
 */
Entry.EntityObject.prototype.removeClone = function(isLast) {
    if (!this.isClone) return;

    var clonedEntities = this.parent.clonedEntities;

    if (isLast !== true) {
        var index = clonedEntities.indexOf(this);
        if (index > -1) clonedEntities.splice(index, 1);
    } else clonedEntities.pop();

    if (Entry.Utils.isFunction(this.clearExecutor))
        this.clearExecutor();

    this.destroy(true);
};

Entry.EntityObject.prototype.clearExecutor = function() {
    this.parent.script.clearExecutorsByEntity(this);
};

/**
 * convert this entity's data to JSON.
 * @return {JSON}
 */
Entry.EntityObject.prototype.toJSON = function() {
    var json = {};
    json.x = Entry.cutDecimal(this.getX());
    json.y = Entry.cutDecimal(this.getY());
    json.regX = Entry.cutDecimal(this.getRegX());
    json.regY = Entry.cutDecimal(this.getRegY());
    json.scaleX = this.getScaleX();
    json.scaleY = this.getScaleY();
    json.rotation = Entry.cutDecimal(this.getRotation());
    json.direction = Entry.cutDecimal(this.getDirection());
    json.width = Entry.cutDecimal(this.getWidth());
    json.height = Entry.cutDecimal(this.getHeight());
    json.font = this.getFont();
    json.visible = this.getVisible();

    if (this.parent.objectType == 'textBox') {
        json.colour = this.getColour();
        json.text = this.getText();
        json.textAlign = this.getTextAlign();
        json.lineBreak = this.getLineBreak();
        json.bgColor = this.getBGColour();
        json.underLine = this.getUnderLine();
        json.strike = this.getStrike();
        json.fontSize = this.getFontSize();
    }
    return json;
};

/*
 * Return initial effect value
 * @return {effect}
 */
Entry.EntityObject.prototype.setInitialEffectValue = function () {
    this.effect = this.getInitialEffectValue();
    Entry.requestUpdate = true;
};

/*
 * Return initial effect value
 * @return {effect}
 */
Entry.EntityObject.prototype.getInitialEffectValue = function () {
    return  {
        'blur': 0,
        'hue': 0,
        'hsv': 0,
        'brightness': 0,
        'contrast': 0,
        'saturation': 0,
        'alpha': 1
    };
};

/*
 * remove brush
 */
Entry.EntityObject.prototype.removeBrush = function () {
    Entry.stage.selectedObjectContainer.removeChild(this.shape);
    this.brush = null;
    this.shape = null;
};

/*
 * erase brush
 */
Entry.EntityObject.prototype.eraseBrush = function () {
    var brush = this.brush;
    if (brush) {
        var stroke = brush._stroke.style;
        var style = brush._strokeStyle.width;
        brush.clear().setStrokeStyle(style).beginStroke(stroke);
        brush.moveTo(this.getX(), this.getY()*-1);
        Entry.requestUpdate = true;
    }
};

Entry.EntityObject.prototype.updateBG = function () {
    if (!this.bgObject)
        return;
    this.bgObject.graphics.clear();
    var width = this.getWidth();
    var height = this.getHeight();
    this.bgObject.graphics.setStrokeStyle(1).beginStroke()
                 .beginFill(this.getBGColour())
                 .drawRect(-width/2,-height/2,width,height);
    if (this.getLineBreak()) {
        this.bgObject.x = 0;
    } else {
        var fontAlign = this.getTextAlign();
        switch (fontAlign) {
            case Entry.TEXT_ALIGN_LEFT:
                this.bgObject.x = width/2;
                break;
            case Entry.TEXT_ALIGN_CENTER:
                this.bgObject.x = 0;
                break;
            case Entry.TEXT_ALIGN_RIGHT:
                this.bgObject.x = - width/2;
                break;
        }
    }
};

Entry.EntityObject.prototype.alignTextBox = function () {
    if (this.type != 'textBox')
        return;
    var textObject = this.textObject;
    if (this.lineBreak) {
        var textObjectHeight = textObject.getMeasuredLineHeight();
        textObject.y = textObjectHeight / 2 - this.getHeight() / 2;
        if (this.fontType == "Nanum Gothic Coding") {
            textObject.y = (textObjectHeight / 2 - this.getHeight() / 2) + 10;
        }
        switch (this.textAlign) {
            case Entry.TEXT_ALIGN_CENTER:
                textObject.x = 0;
                break;
            case Entry.TEXT_ALIGN_LEFT:
                textObject.x = - this.getWidth() / 2;
                break;
            case Entry.TEXT_ALIGN_RIGHT:
                textObject.x = this.getWidth() / 2;
                break;
        }
        textObject.maxHeight = this.getHeight();
    } else {
        textObject.x = 0;
        textObject.y = 0;
    }
};

Entry.EntityObject.prototype.syncDialogVisible = function() {
    if (this.dialog) this.dialog.object.visible = this.visible;
};

Entry.EntityObject.prototype.destroy = function(isClone) {
    if (this.removed) return;

    this.removed = true;

    var object = this.object;
    if (object) {
        object.uncache();
        object.removeAllEventListeners();
        delete object.image;
        delete object.entity;
    }

    this.dialog && this.dialog.remove();
    this.brush && this.removeBrush();
    Entry.stage.unloadEntity(this);

    var container = Entry.container;
    if (container)
        container.unCachePictures(
            this, this.parent.pictures, isClone
        );

};

Entry.EntityObject.prototype.cache = function() {
    this.object && this.object.cache(0, 0, this.getWidth(), this.getHeight());
    Entry.requestUpdate = true;
};

Entry.EntityObject.prototype.reset = function() {
    this.loadSnapshot();
    this.resetFilter();
    this.dialog && this.dialog.remove();
    this.shape && this.removeBrush();
};
