/**;
 * @fileoverview Object for Entry.
 */
'use strict';

/**
 * Class for entry object.
 * @param {?object model} model for object
 * @constructor
 */
Entry.EntryObject = function(model) {
    var that = this;
    if (model) {
        /** @type {string} */
        this.id = model.id;

        /** @type {string} */
        this.name = model.name || model.sprite.name;

        this.text = model.text || this.name;

        /** @type {string} */
        this.objectType = model.objectType;
        if (!this.objectType)
            this.objectType = 'sprite';

        var script = model.script ? model.script : [];
        this.script = new Entry.Code(script, this);

        /** @type {Array.<picture object>} */
        this.pictures = Entry.Utils.copy(model.sprite.pictures || []);

        /** @type {Array.<sound object>} */
        this.sounds = Entry.Utils.copy(model.sprite.sounds || []);

        for (var i=0; i<this.sounds.length; i++) {
            if (!this.sounds[i].id) {
                this.sounds[i].id = Entry.generateHash();
            }
            Entry.initSound(this.sounds[i]);
        }

        /** @type {string} */
        this.lock = model.lock ? model.lock : false;

        this.isEditing = false;

        if (this.objectType == "sprite") {
            if (!model.selectedPictureId)
                this.selectedPicture = this.pictures[0];
            else
                this.selectedPicture = this.getPicture(model.selectedPictureId);
        }

        this.scene = Entry.scene.getSceneById(model.scene) || Entry.scene.selectedScene;

        this.setRotateMethod(model.rotateMethod);

        //entity
        this.entity = new Entry.EntityObject(this);
        this.entity.injectModel(
            this.selectedPicture ? this.selectedPicture : null,
            model.entity ? model.entity : this.initEntity(model)
        );

        this.clonedEntities = [];

        Entry.stage.loadObject(this);

        var entityId = this.entity.id;
        var cachePicture = Entry.container.cachePicture.bind(Entry.container);
        var pictures = this.pictures;

        for (var i in pictures) {
            (function (picture) {
                picture.objectId = this.id;
                if (!picture.id)
                    picture.id = Entry.generateHash();

                var image = new Image();
                Entry.Loader.addQueue();

                image.onload = function(e) {
                    delete this.triedCnt;
                    Entry.container.cachePicture(
                        picture.id + entityId, this);
                    Entry.Loader.removeQueue();
                    this.onload = null;
                };

                image.onerror = function(err) {
                    if (!this.triedCnt) {
                        if (Entry.type !== "invisible")
                        console.log('err=', picture.name, 'load failed');
                        this.triedCnt = 1;
                        this.src = getImageSrc(picture);
                    } else if (this.triedCnt < 3) {
                        this.triedCnt++;
                        this.src = Entry.mediaFilePath + '_1x1.png';
                    } else {
                        //prevent infinite call
                        delete this.triedCnt;
                        Entry.Loader.removeQueue();
                        this.onerror = null;
                    }
                }

                image.src = getImageSrc(picture);
            })(this.pictures[i]);

        }
        Entry.requestUpdate = true;
    }
    this._isContextMenuEnabled = true;

    function getImageSrc(picture) {
        if (picture.fileurl) return picture.fileurl;

        var fileName = picture.filename;
        return Entry.defaultPath + '/uploads/' + fileName.substring(0, 2) + '/' +
            fileName.substring(2, 4) + '/image/' + fileName + '.png';
    }
};

(function(p) {
    /**
     * View generator for workspace or others.
     * @return {!Element}
     */
    p.generateView = function() {
        if (Entry.type == "workspace") {
            var objectView = Entry.createElement('li', this.id);
            var fragment = document.createDocumentFragment('div');
            fragment.appendChild(objectView);
            objectView.addClass('entryContainerListElementWorkspace');
            objectView.object = this;
            // generate context menu
            Entry.Utils.disableContextmenu(objectView);
            var object = this;
            var longPressTimer = null;

            $(objectView).bind('mousedown touchstart', function(e){
                if (Entry.container.getObject(this.id)) {
                    Entry.do(
                        'containerSelectObject',
                        this.id
                    );
                }
                var doc = $(document);
                var eventType = e.type;
                var handled = false;

                if (Entry.Utils.isRightButton(e)) {
                    e.stopPropagation();
                    Entry.documentMousedown.notify(e);
                    handled = true;
                    object._rightClick(e);
                    return;
                }

                var mouseDownCoordinate = {
                    x: e.clientX, y: e.clientY
                };

                if (eventType === 'touchstart' && !handled) {
                    e.stopPropagation();
                    Entry.documentMousedown.notify(e);

                    longPressTimer = setTimeout(function() {
                        if (longPressTimer) {
                            longPressTimer = null;
                            object._rightClick(e);
                        }
                    }, 1000);

                    doc.bind('mousemove.object touchmove.object', onMouseMove);
                    doc.bind('mouseup.object touchend.object', onMouseUp);
                }


                function onMouseMove(e) {
                    e.stopPropagation();
                    if (!mouseDownCoordinate) return;
                    var diff = Math.sqrt(Math.pow(e.pageX - mouseDownCoordinate.x, 2) +
                                    Math.pow(e.pageY - mouseDownCoordinate.y, 2));
                    if (diff > 5 && longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }

                function onMouseUp(e) {
                    e.stopPropagation();
                    doc.unbind('.object');
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }
            });

            /** @type {!Element} */
            this.view_ = objectView;

            var thisPointer = this;
            var objectInfoView = Entry.createElement('ul');
            objectInfoView.addClass('objectInfoView');
            if (!Entry.objectEditable) {
                objectInfoView.addClass('entryHide');
            }
            var objectInfo_visible = Entry.createElement('li');
            objectInfo_visible.addClass('objectInfo_visible');
            if (!this.entity.getVisible())
                objectInfo_visible.addClass('objectInfo_unvisible');
            objectInfo_visible.bindOnClick(function (e) {
                if (Entry.engine.isState('run'))
                    return;
                var entity = thisPointer.entity;
                var visible = entity.setVisible(!entity.getVisible());
                if (visible)
                    this.removeClass('objectInfo_unvisible');
                else
                    this.addClass('objectInfo_unvisible');
            });

            var objectInfo_lock = Entry.createElement('li');
            objectInfo_lock.addClass('objectInfo_unlock');
            if (this.getLock())
                objectInfo_lock.addClass('objectInfo_lock');

            objectInfo_lock.bindOnClick(function (e) {
                if (Entry.engine.isState('run'))
                    return;
                var object = thisPointer;
                var isLocked = object.setLock(!object.getLock());
                if (isLocked)
                    this.addClass('objectInfo_lock');
                else
                    this.removeClass('objectInfo_lock');
                object.updateInputViews(object.getLock());
            });
            objectInfoView.appendChild(objectInfo_visible);
            objectInfoView.appendChild(objectInfo_lock);
            this.view_.appendChild(objectInfoView);

            var thumbnailView = Entry.createElement('div');
            thumbnailView.addClass('entryObjectThumbnailWorkspace');
            this.view_.appendChild(thumbnailView);
            this.thumbnailView_ = thumbnailView;

            var wrapperView = Entry.createElement('div');
            wrapperView.addClass('entryObjectWrapperWorkspace');
            this.view_.appendChild(wrapperView);


            var nameView = Entry.createElement('input');
            nameView.bindOnClick(function (e) {
                e.preventDefault();
                if (!this.readOnly) {
                    this.focus();
                    this.select();
                }
            });
            nameView.addClass('entryObjectNameWorkspace');

            wrapperView.appendChild(nameView);
            this.nameView_ = nameView;
            this.nameView_.entryObject = this;
            nameView.setAttribute("readonly", true);

            var self = this;
            this.nameView_.onblur = function(bool) {
                this.entryObject.name = this.value;
                Entry.playground.reloadPlayground();
            };

            this.nameView_.onkeypress = function(e) {
                if (e.keyCode == 13) {
                    self.editObjectValues(false);
                }
            };

            this.nameView_.value = this.name;

            var editView = Entry.createElement('div');
            editView.addClass('entryObjectEditWorkspace');
            editView.object = this;
            this.editView_ = editView;
            this.view_.appendChild(editView);

            $(editView).mousedown(function(e) {
                e.stopPropagation();
                Entry.documentMousedown.notify(e);
                Entry.do(
                    'objectEditButtonClick',
                    object.id
                );
            });

            editView.blur = function(e){
                object.editObjectComplete();
            };

            if (Entry.objectEditable && Entry.objectDeletable) {
                var deleteView = Entry.createElement('div');
                deleteView.addClass('entryObjectDeleteWorkspace');
                deleteView.object = this;
                this.deleteView_ = deleteView;
                this.view_.appendChild(deleteView);
                deleteView.bindOnClick(function (e) {
                    if (Entry.engine.isState('run')) {
                        return;
                    }
                    Entry.container.removeObject(this.object);
                });
            }

            var informationView = Entry.createElement('div');
            informationView.addClass('entryObjectInformationWorkspace');
            informationView.object = this;
            this.isInformationToggle = false;
            wrapperView.appendChild(informationView);
            this.informationView_ = informationView;

            var rotationWrapperView = Entry.createElement('div');
            rotationWrapperView.addClass('entryObjectRotationWrapperWorkspace');
            rotationWrapperView.object = this;
            this.view_.appendChild(rotationWrapperView);

            var coordinateView = Entry.createElement('span');
            coordinateView.addClass('entryObjectCoordinateWorkspace');
            rotationWrapperView.appendChild(coordinateView);
            var xCoordi = Entry.createElement('span');
            xCoordi.addClass('entryObjectCoordinateSpanWorkspace');
            xCoordi.innerHTML = 'X:';
            var xInput = Entry.createElement('input');
            xInput.addClass('entryObjectCoordinateInputWorkspace');
            xInput.setAttribute("readonly", true);
            xInput.bindOnClick(function (e) {
                e.stopPropagation();
                this.select();
            });

            var yCoordi = Entry.createElement('span');
            yCoordi.addClass('entryObjectCoordinateSpanWorkspace');
            yCoordi.innerHTML = 'Y:';
            var yInput = Entry.createElement('input');
            yInput.addClass('entryObjectCoordinateInputWorkspace entryObjectCoordinateInputWorkspace_right');
            yInput.bindOnClick(function (e) {
                e.stopPropagation();
                this.select();
            });
            yInput.setAttribute("readonly", true);
            var sizeSpan = Entry.createElement('span');
            sizeSpan.addClass('entryObjectCoordinateSizeWorkspace');
            sizeSpan.innerHTML = Lang.Workspace.Size + ' : ';
            var sizeInput = Entry.createElement('input');
            sizeInput.addClass('entryObjectCoordinateInputWorkspace',
                               'entryObjectCoordinateInputWorkspace_size');
            sizeInput.bindOnClick(function (e) {
                e.stopPropagation();
                this.select();
            });
            sizeInput.setAttribute("readonly", true);
            coordinateView.appendChild(xCoordi);
            coordinateView.appendChild(xInput);
            coordinateView.appendChild(yCoordi);
            coordinateView.appendChild(yInput);
            coordinateView.appendChild(sizeSpan);
            coordinateView.appendChild(sizeInput);
            coordinateView.xInput_ = xInput;
            coordinateView.yInput_ = yInput;
            coordinateView.sizeInput_ = sizeInput;
            this.coordinateView_ = coordinateView;
            var thisPointer = this;

            xInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    thisPointer.editObjectValues(false);
                }
            };

            xInput.onblur = function (bool) {
                if (Entry.Utils.isNumber(xInput.value)) {
                    thisPointer.entity.setX(Number(xInput.value));
                }
                thisPointer.updateCoordinateView();
                Entry.stage.updateObject();

            };

            yInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    thisPointer.editObjectValues(false);
                }
            };

            yInput.onblur =  function(bool){
                if (Entry.Utils.isNumber(yInput.value)) {
                    thisPointer.entity.setY(Number(yInput.value));
                }
                thisPointer.updateCoordinateView();
                Entry.stage.updateObject();
            };

            sizeInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    thisPointer.editObjectValues(false);
                }
            };


            sizeInput.onblur = function (bool) {
                if (Entry.Utils.isNumber(sizeInput.value)) {
                    thisPointer.entity.setSize(Number(sizeInput.value));
                }
                thisPointer.updateCoordinateView();
                Entry.stage.updateObject();
            };

            var rotateLabelWrapperView = Entry.createElement('div');
            rotateLabelWrapperView.addClass('entryObjectRotateLabelWrapperWorkspace');
            this.view_.appendChild(rotateLabelWrapperView);
            this.rotateLabelWrapperView_ = rotateLabelWrapperView;

            var rotateSpan = Entry.createElement('span');
            rotateSpan.addClass('entryObjectRotateSpanWorkspace');
            rotateSpan.innerHTML = Lang.Workspace.rotation + ' : ';
            var rotateInput = Entry.createElement('input');
            rotateInput.addClass('entryObjectRotateInputWorkspace');
            rotateInput.setAttribute("readonly", true);
            rotateInput.bindOnClick(function (e) {
                e.stopPropagation();
                this.select();
            });
            this.rotateSpan_ = rotateSpan;
            this.rotateInput_ = rotateInput;

            var directionSpan = Entry.createElement('span');
            directionSpan.addClass('entryObjectDirectionSpanWorkspace');
            directionSpan.innerHTML = Lang.Workspace.direction + ' : ';
            var directionInput = Entry.createElement('input');
            directionInput.addClass('entryObjectDirectionInputWorkspace');
            directionInput.setAttribute("readonly", true);
            directionInput.bindOnClick(function (e) {
                e.stopPropagation();
                this.select();
            });
            this.directionInput_ = directionInput;

            rotateLabelWrapperView.appendChild(rotateSpan);
            rotateLabelWrapperView.appendChild(rotateInput);
            rotateLabelWrapperView.appendChild(directionSpan);
            rotateLabelWrapperView.appendChild(directionInput);
            rotateLabelWrapperView.rotateInput_ = rotateInput;
            rotateLabelWrapperView.directionInput_ = directionInput;
            var thisPointer = this;
            rotateInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    thisPointer.editObjectValues(false);
                }
            };
            rotateInput.onblur = function (bool) {
                var value = rotateInput.value;
                if (value.indexOf('˚') != -1)
                    value = value.substring(0, value.indexOf('˚'));
                if (Entry.Utils.isNumber(value)) {
                    thisPointer.entity.setRotation(Number(value));
                }
                thisPointer.updateRotationView();
                Entry.stage.updateObject();
            };

            directionInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    thisPointer.editObjectValues(false);
                }
            };
            directionInput.onblur = function (bool) {
                var value = directionInput.value;
                if (value.indexOf('˚') != -1)
                    value = value.substring(0,value.indexOf('˚'));
                if (Entry.Utils.isNumber(value))
                    thisPointer.entity.setDirection(Number(value));
                thisPointer.updateRotationView();
                Entry.stage.updateObject();
            };

            var rotationMethodWrapper = Entry.createElement('div');
            rotationMethodWrapper.addClass('rotationMethodWrapper');
            rotationWrapperView.appendChild(rotationMethodWrapper);
            this.rotationMethodWrapper_ = rotationMethodWrapper;

            var rotateMethodLabelView = Entry.createElement('span');
            rotateMethodLabelView.addClass('entryObjectRotateMethodLabelWorkspace');
            rotationMethodWrapper.appendChild(rotateMethodLabelView);
            rotateMethodLabelView.innerHTML = Lang.Workspace.rotate_method + ' : ';

            var rotateModeAView = Entry.createElement('div');
            rotateModeAView.addClass('entryObjectRotateModeWorkspace entryObjectRotateModeAWorkspace');
            rotateModeAView.object = this;
            this.rotateModeAView_ = rotateModeAView;
            rotationMethodWrapper.appendChild(rotateModeAView);
            rotateModeAView.bindOnClick(function(e){
                if (Entry.engine.isState('run') || this.object.getLock()) {
                    return;
                }
                this.object.initRotateValue('free');
                this.object.setRotateMethod('free');
            });

            var rotateModeBView = Entry.createElement('div');
            rotateModeBView.addClass('entryObjectRotateModeWorkspace entryObjectRotateModeBWorkspace');
            rotateModeBView.object = this;
            this.rotateModeBView_ = rotateModeBView;
            rotationMethodWrapper.appendChild(rotateModeBView);
            rotateModeBView.bindOnClick(function(e){
                if (Entry.engine.isState('run') || this.object.getLock()) {
                    return;
                }
                this.object.initRotateValue('vertical');
                this.object.setRotateMethod('vertical');
            });

            var rotateModeCView = Entry.createElement('div');
            rotateModeCView.addClass('entryObjectRotateModeWorkspace entryObjectRotateModeCWorkspace');
            rotateModeCView.object = this;
            this.rotateModeCView_ = rotateModeCView;
            rotationMethodWrapper.appendChild(rotateModeCView);
            rotateModeCView.bindOnClick(function(e){
                if (Entry.engine.isState('run') || this.object.getLock())
                    return;
                this.object.initRotateValue('none');
                this.object.setRotateMethod('none');
            });

            this.updateThumbnailView();
            this.updateCoordinateView();
            this.updateRotateMethodView();
            this.updateInputViews();

            this.updateCoordinateView(true);
            this.updateRotationView(true);

            return this.view_;
        } else if (Entry.type == "phone") {
            var objectView = Entry.createElement('li', this.id);
            objectView.addClass('entryContainerListElementWorkspace');
            objectView.object = this;
            objectView.bindOnClick(function(e) {
                if (Entry.container.getObject(this.id))
                    Entry.container.selectObject(this.id);
            });

            // generate context menu
            if ($) {
                var object = this;
                context.attach('#' + this.id, [
                    {
                        text: Lang.Workspace.context_rename,
                        href: '/',
                        action: function(e){
                            e.preventDefault();
                        }
                    },
                    {
                        text: Lang.Workspace.context_duplicate,
                        href: '/',
                        action: function(e){
                            e.preventDefault();
                            Entry.container.addCloneObject(object);
                        }
                    },
                    {
                        text: Lang.Workspace.context_remove,
                        href: '/',
                        action: function(e){
                            e.preventDefault();
                            Entry.container.removeObject(object);
                        }
                    }
                ]);
            }
            /** @type {!Element} */
            this.view_ = objectView;


            var objectInfoView = Entry.createElement('ul');
            objectInfoView.addClass('objectInfoView');
            var objectInfo_visible = Entry.createElement('li');
            objectInfo_visible.addClass('objectInfo_visible');
            var objectInfo_lock = Entry.createElement('li');
            objectInfo_lock.addClass('objectInfo_lock');
            objectInfoView.appendChild(objectInfo_visible);
            objectInfoView.appendChild(objectInfo_lock);
            this.view_.appendChild(objectInfoView);


            var thumbnailView = Entry.createElement('div');
            thumbnailView.addClass('entryObjectThumbnailWorkspace');
            this.view_.appendChild(thumbnailView);
            this.thumbnailView_ = thumbnailView;

            var wrapperView = Entry.createElement('div');
            wrapperView.addClass('entryObjectWrapperWorkspace');
            this.view_.appendChild(wrapperView);

            var nameView = Entry.createElement('input');
            nameView.addClass('entryObjectNameWorkspace');
            wrapperView.appendChild(nameView);
            this.nameView_ = nameView;
            this.nameView_.entryObject = this;
            this.nameView_.onblur = function() {
                this.entryObject.name = this.value;
                Entry.playground.reloadPlayground();
            };
            this.nameView_.onkeypress = function(e) {
                if (e.keyCode == 13)
                    thisPointer.editObjectValues(false);
            };
            this.nameView_.value = this.name;

            if (Entry.objectEditable && Entry.objectDeletable) {
                var deleteView = Entry.createElement('div');
                deleteView.addClass('entryObjectDeletePhone');
                deleteView.object = this;
                this.deleteView_ = deleteView;
                this.view_.appendChild(deleteView);
                deleteView.bindOnClick(function (e) {
                    if (Entry.engine.isState('run')) {
                        return;
                    }
                    Entry.container.removeObject(this.object);
                });
            }

            var editBtn = Entry.createElement('button');
            editBtn.addClass('entryObjectEditPhone');
            editBtn.object = this;
            editBtn.bindOnClick(function(e) {
                var object = Entry.container.getObject(this.id);
                if (object) {
                    Entry.container.selectObject(object.id);
                    Entry.playground.injectObject(object);
                }
            });
            this.view_.appendChild(editBtn);


            var informationView = Entry.createElement('div');
            informationView.addClass('entryObjectInformationWorkspace');
            informationView.object = this;
            this.isInformationToggle = false;
            wrapperView.appendChild(informationView);
            this.informationView_ = informationView;




            var rotateLabelWrapperView = Entry.createElement('div');
            rotateLabelWrapperView.addClass('entryObjectRotateLabelWrapperWorkspace');
            this.view_.appendChild(rotateLabelWrapperView);
            this.rotateLabelWrapperView_ = rotateLabelWrapperView;

            var rotateSpan = Entry.createElement('span');
            rotateSpan.addClass('entryObjectRotateSpanWorkspace');
            rotateSpan.innerHTML = Lang.Workspace.rotation + ' : ';
            var rotateInput = Entry.createElement('input');
            rotateInput.addClass('entryObjectRotateInputWorkspace');
            this.rotateSpan_ = rotateSpan;
            this.rotateInput_ = rotateInput;

            var directionSpan = Entry.createElement('span');
            directionSpan.addClass('entryObjectDirectionSpanWorkspace');
            directionSpan.innerHTML = Lang.Workspace.direction + ' : ';
            var directionInput = Entry.createElement('input');
            directionInput.addClass('entryObjectDirectionInputWorkspace');
            this.directionInput_ = directionInput;

            rotateLabelWrapperView.appendChild(rotateSpan);
            rotateLabelWrapperView.appendChild(rotateInput);
            rotateLabelWrapperView.appendChild(directionSpan);
            rotateLabelWrapperView.appendChild(directionInput);
            rotateLabelWrapperView.rotateInput_ = rotateInput;
            rotateLabelWrapperView.directionInput_ = directionInput;
            var thisPointer = this;
            rotateInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    var value = rotateInput.value;
                    if (value.indexOf('˚') != -1)
                        value = value.substring(0, value.indexOf('˚'));
                    if (Entry.Utils.isNumber(value)) {
                        thisPointer.entity.setRotation(Number(value));
                    }
                    thisPointer.updateRotationView();
                    rotateInput.blur();
                }
            };
            rotateInput.onblur = function (e) {
                thisPointer.entity.setRotation(thisPointer.entity.getRotation());
                Entry.stage.updateObject();
            };
            directionInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    var value = directionInput.value;
                    if (value.indexOf('˚') != -1)
                        value = value.substring(0,value.indexOf('˚'));
                    if (Entry.Utils.isNumber(value)) {
                        thisPointer.entity.setDirection(Number(value));
                    }
                    thisPointer.updateRotationView();
                    directionInput.blur();
                }
            };
            directionInput.onblur = function (e) {
                thisPointer.entity.setDirection(thisPointer.entity.getDirection());
                Entry.stage.updateObject();
            };

            var rotationWrapperView = Entry.createElement('div');
            rotationWrapperView.addClass('entryObjectRotationWrapperWorkspace');
            rotationWrapperView.object = this;
            this.view_.appendChild(rotationWrapperView);

            var coordinateView = Entry.createElement('span');
            coordinateView.addClass('entryObjectCoordinateWorkspace');
            rotationWrapperView.appendChild(coordinateView);
            var xCoordi = Entry.createElement('span');
            xCoordi.addClass('entryObjectCoordinateSpanWorkspace');
            xCoordi.innerHTML = 'X:';
            var xInput = Entry.createElement('input');
            xInput.addClass('entryObjectCoordinateInputWorkspace');
            var yCoordi = Entry.createElement('span');
            yCoordi.addClass('entryObjectCoordinateSpanWorkspace');
            yCoordi.innerHTML = 'Y:';
            var yInput = Entry.createElement('input');
            yInput.addClass('entryObjectCoordinateInputWorkspace entryObjectCoordinateInputWorkspace_right');
            var sizeTitle = Entry.createElement('span');
            sizeTitle.addClass('entryObjectCoordinateSpanWorkspace');
            sizeTitle.innerHTML = Lang.Workspace.Size;
            var sizeInput = Entry.createElement('input');
            sizeInput.addClass('entryObjectCoordinateInputWorkspace',
                               'entryObjectCoordinateInputWorkspace_size');
            coordinateView.appendChild(xCoordi);
            coordinateView.appendChild(xInput);
            coordinateView.appendChild(yCoordi);
            coordinateView.appendChild(yInput);
            coordinateView.appendChild(sizeTitle);
            coordinateView.appendChild(sizeInput);
            coordinateView.xInput_ = xInput;
            coordinateView.yInput_ = yInput;
            coordinateView.sizeInput_ = sizeInput;
            this.coordinateView_ = coordinateView;
            var thisPointer = this;
            xInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    if (Entry.Utils.isNumber(xInput.value)) {
                        thisPointer.entity.setX(Number(xInput.value));
                    }
                    thisPointer.updateCoordinateView();
                    thisPointer.blur();
                }
            };
            xInput.onblur = function (e) {
                thisPointer.entity.setX(thisPointer.entity.getX());
                Entry.stage.updateObject();
            };

            yInput.onkeypress = function (e) {
                if (e.keyCode == 13) {
                    if (Entry.Utils.isNumber(yInput.value)) {
                        thisPointer.entity.setY(Number(yInput.value));
                    }
                    thisPointer.updateCoordinateView();
                    thisPointer.blur();
                }
            };
            yInput.onblur = function (e) {
                thisPointer.entity.setY(thisPointer.entity.getY());
                Entry.stage.updateObject();
            };

            var rotationMethodWrapper = Entry.createElement('div');
            rotationMethodWrapper.addClass('rotationMethodWrapper');
            rotationWrapperView.appendChild(rotationMethodWrapper);
            this.rotationMethodWrapper_ = rotationMethodWrapper;

            var rotateMethodLabelView = Entry.createElement('span');
            rotateMethodLabelView.addClass('entryObjectRotateMethodLabelWorkspace');
            rotationMethodWrapper.appendChild(rotateMethodLabelView);
            rotateMethodLabelView.innerHTML = Lang.Workspace.rotate_method + ' : ';

            var rotateModeAView = Entry.createElement('div');
            rotateModeAView.addClass('entryObjectRotateModeWorkspace');
            rotateModeAView.addClass('entryObjectRotateModeAWorkspace');
            rotateModeAView.object = this;
            this.rotateModeAView_ = rotateModeAView;
            rotationMethodWrapper.appendChild(rotateModeAView);
            rotateModeAView.bindOnClick(function(e){
                if (Entry.engine.isState('run')) {
                    return;
                }
                this.object.setRotateMethod('free');
            });

            var rotateModeBView = Entry.createElement('div');
            rotateModeBView.addClass('entryObjectRotateModeWorkspace');
            rotateModeBView.addClass('entryObjectRotateModeBWorkspace');
            rotateModeBView.object = this;
            this.rotateModeBView_ = rotateModeBView;
            rotationMethodWrapper.appendChild(rotateModeBView);
            rotateModeBView.bindOnClick(function(e){
                if (Entry.engine.isState('run')) {
                    return;
                }
                this.object.setRotateMethod('vertical');
            });

            var rotateModeCView = Entry.createElement('div');
            rotateModeCView.addClass('entryObjectRotateModeWorkspace');
            rotateModeCView.addClass('entryObjectRotateModeCWorkspace');
            rotateModeCView.object = this;
            this.rotateModeCView_ = rotateModeCView;
            rotationMethodWrapper.appendChild(rotateModeCView);
            rotateModeCView.bindOnClick(function(e){
                if (Entry.engine.isState('run'))
                    return;
                this.object.setRotateMethod('none');
            });

            this.updateThumbnailView();
            this.updateCoordinateView();
            this.updateRotateMethodView();

            this.updateInputViews();
            return this.view_;
        }
    };

    /**
     * Object name setter
     * @param {!string} name
     */
    p.setName = function(name) {
        Entry.assert(typeof name == "string", 'object name must be string');
        this.name = name;
        this.nameView_.value = name;
    };

    /**
     * Object text setter
     * @param {!string} name
     */
    p.setText = function(text) {
        Entry.assert(typeof text == "string", 'object text must be string');
        this.text = text;
    };

    /**
     * Object script setter
     * @param {!xml script} script
     */
    p.setScript = function(script) {
        this.script = script;
    };

    /**
     * Object script getter
     * @return {!xml script} script
     */
    p.getScriptText = function() {
        return JSON.stringify(this.script.toJSON());
    };

    /**
     * Initialize entity model if not exist
     * @param {!object model} model for object
     * @return {entity model}
     */
    p.initEntity = function(model) {
        var json = {};
        json.x = json.y = 0;
        json.rotation = 0;
        json.direction = 90;
        if (this.objectType == 'sprite') {
            var dimension = model.sprite.pictures[0].dimension;
            json.regX = dimension.width/2;
            json.regY = dimension.height/2;
            var scale;
            if (model.sprite.category.main == "background" ||
                model.sprite.category.main == "new")
                scale = Math.max(270/dimension.height, 480/dimension.width);
            else if (model.sprite.category.main == "new")
                scale = 1;
            else
                scale = 200 / (dimension.width + dimension.height);
            json.scaleX = json.scaleY = scale;
            json.width = dimension.width;
            json.height = dimension.height;
        } else if (this.objectType == 'textBox') {
            json.regX = 25;
            json.regY = 12;
            json.scaleX = json.scaleY = 1.5;
            json.width = 50;
            json.height = 24;
            json.text = model.text;
            if (model.options) {
                var options = model.options;
                var fontStyle = '';
                if (options.bold)
                    fontStyle += 'bold ';
                if (options.italic)
                    fontStyle += 'italic ';

                json.underline = options.underline;
                json.strike = options.strike;
                json.font = fontStyle + "20px " + options.font.family;
                json.colour = options.colour;
                json.bgColor = options.background;
                json.lineBreak = options.lineBreak;
                if (options.lineBreak) {
                    json.width = 256;
                    json.height = json.width * 0.5625;
                    json.regX = json.width / 2;
                    json.regY = json.height / 2;
                }
            } else {
                json.underline = false;
                json.strike = false;
                json.font = '20px Nanum Gothic';
                json.colour = '#000000';
                json.bgColor = '#ffffff';
            }
        }
        return json;
    };

    /**
     * Update thumbnail view;
     */
    p.updateThumbnailView = function() {
        var thumb = this.thumbnailView_;
        var picture = this.entity.picture;
        var objectType = this.objectType;

        if (objectType == 'sprite') {
            if (picture.fileurl) {
                thumb.style.backgroundImage = 'url("' + picture.fileurl + '")';
            } else {
                var fileName = picture.filename;
                thumb.style.backgroundImage =
                    'url("' + Entry.defaultPath + '/uploads/' + fileName.substring(0, 2) + '/' +
                    fileName.substring(2, 4) + '/thumb/' + fileName + '.png")';
            }
        } else if (objectType == 'textBox') {
            var textIconPath = Entry.mediaFilePath + '/text_icon.png';
            thumb.style.backgroundImage = "url(" + textIconPath + ")";
        }
    };

    /**
     * Update coordinate view;
     */
    p.updateCoordinateView = function(isForced) {
        if (!this.isSelected() && !isForced)
            return;

        var view = this.coordinateView_;
        if (view && view.xInput_ && view.yInput_) {
            var originX = view.xInput_.value,
                originY = view.yInput_.value,
                size = view.sizeInput_.value,
                entity = this.entity,
                newX = entity.getX(1),
                newY = entity.getY(1),
                newSize = entity.getSize(1);

            if (originX != newX)
                view.xInput_.value = newX;
            if (originY != newY)
                view.yInput_.value = newY;
            if (size != newSize)
                view.sizeInput_.value = newSize;
        }
    };

    /**
     * Update rotation view;
     */
    p.updateRotationView = function(isForced) {
        if ((!this.isSelected() || !this.view_) && !isForced)
            return;
        var rotateMethod = this.getRotateMethod();
        var entity = this.entity;
        var className = 'entryRemove';

        if (rotateMethod == 'free') {
            this.rotateSpan_.removeClass(className);
            this.rotateInput_.removeClass(className);

            this.rotateInput_.value = entity.getRotation(1) + '˚';
            this.directionInput_.value = entity.getDirection(1) + '˚';
        } else {
            this.rotateSpan_.addClass(className);
            this.rotateInput_.addClass(className);
            this.directionInput_.value = entity.getDirection(1) + '˚';
        }
    };

    /**
     * Select this object on view
     */
    p.select = function(pictureId) {
        console.log(this);
    };

    /**
     * Add picture object by picture model.
     * @param {picture model} picture
     */
    p.addPicture = function(picture, index) {
        picture.objectId = this.id;
        if (!index && index !== 0)
            this.pictures.push(picture);
        else {
            this.pictures.splice(index, 0, picture);
        }
        Entry.playground.injectPicture(this);
    };

    /**
     * Remove picture object.
     * @param {string} pictureId
     * @return {boolean} return true if success
     */
    p.removePicture = function(pictureId) {
        if (this.pictures.length < 2)
            return false;

        var playground = Entry.playground;

        var picture = this.getPicture(pictureId);
        var index = this.pictures.indexOf(picture);

        this.pictures.splice(index, 1);
        if (picture === this.selectedPicture)
            playground.selectPicture(this.pictures[0]);

        Entry.container.unCachePictures(
            this.entity, picture);

        playground.injectPicture(this);
        playground.reloadPlayground();
        return true;
    };

    /**
     * Get picture object by Id.
     * @param {?string} pictureId
     * @return {picture object}
     */
    p.getPicture = function(value) {
        //priority
        //1. pictureId
        //2. pictureName
        //3. index
        if (!value)
            return this.selectedPicture;
        value = (value + "").trim();
        var pictures = this.pictures,
            len = pictures.length;
        for (var i=0; i<len; i++) {
            if (pictures[i].id == value)
                return pictures[i];
        }
        for (i=0; i<len; i++) {
            if (pictures[i].name == value)
                return pictures[i];
        }
        var checker = Entry.parseNumber(value);
        if (!(checker === false && typeof checker == 'boolean') && len >= checker && checker > 0) {
            return pictures[checker-1];
        }
        return null;
    };

    p.setPicture = function(picture) {
        for (var i in this.pictures) {
            var picture_ = this.pictures[i];
            if (picture.id === picture_.id) {
                this.pictures[i] = picture;
                return;
            }
        }
        throw new Error('No picture found');
    };

    /**
     * Get previous picture object by Id.
     * @param {?string} pictureId
     * @return {picture object}
     */
    p.getPrevPicture = function(pictureId) {
        var pictures = this.pictures,
            len = pictures.length;
        for (var i = 0; i < len; i++) {
            var picture = pictures[i];
            if (picture.id == pictureId)
                return pictures[i == 0 ? len-1 : i-1];
        }
    };

    /**
     * Get next picture object by Id.
     * @param {?string} pictureId
     * @return {picture object}
     */
    p.getNextPicture = function(pictureId) {
        var pictures = this.pictures,
            len = pictures.length;
        for (var i = 0; i < len; i++) {
            var picture = pictures[i];
            if (picture.id == pictureId)
                return pictures[i == len-1 ? 0 : i+1];
        }
    };

    /**
     * Select picture object by Id.
     * @param {!string} pictureId
     * @return {picture object}
     */
    p.selectPicture = function(pictureId) {
        var picture = this.getPicture(pictureId);
        if (picture) {
            this.selectedPicture = picture;
            this.entity.setImage(picture);
            this.updateThumbnailView();
            return;
        }
        throw new Error('No picture with pictureId : ' + pictureId);
    };

    /**
     * Add sound to object
     * @param {sound model} sound
     */
    p.addSound = function(sound, index) {
        if (!sound.id)
            sound.id = Entry.generateHash();

        Entry.initSound(sound, index);

        if (!index && index !== 0)
            this.sounds.push(sound);
        else {
            this.sounds.splice(index, 0, sound);
        }
        Entry.playground.injectSound(this);
    };

    /**
     * Remove sound object.
     * @param {string} soundId
     * @return {boolean} return true if success
     */
    p.removeSound = function(soundId) {
        var index, sound;
        sound = this.getSound(soundId);
        index = this.sounds.indexOf(sound);
        this.sounds.splice(index, 1);
        Entry.playground.reloadPlayground();
        Entry.playground.injectSound(this);
    };

    /**
     * rotate method getter
     * @return {string}
     */
    p.getRotateMethod = function() {
        if(!this.rotateMethod)
            this.rotateMethod = 'free';
        return this.rotateMethod;
    };

    /**
     * rotate method setter
     * @param {string} rotateMethod
     */
    p.setRotateMethod = function(rotateMethod) {
        /** @type {string} */
        if(!rotateMethod)
            rotateMethod = 'free';
        this.rotateMethod = rotateMethod;
        this.updateRotateMethodView();

        if(Entry.stage.selectedObject && Entry.stage.selectedObject.entity) {
            Entry.stage.updateObject();
            Entry.stage.updateHandle();
        }
    };

    p.initRotateValue = function(rotateMethod) {
        if(this.rotateMethod != rotateMethod) {
            var entity = this.entity;
            entity.rotation = 0.0;
            entity.direction = 90.0;
            entity.flip = false;
        }
    };

    p.updateRotateMethodView = function() {
        var rotateMethod = this.rotateMethod;
        if (!this.rotateModeAView_)
            return;
        this.rotateModeAView_.removeClass('selected');
        this.rotateModeBView_.removeClass('selected');
        this.rotateModeCView_.removeClass('selected');
        if (rotateMethod == 'free')
            this.rotateModeAView_.addClass('selected');
        else if (rotateMethod == 'vertical')
            this.rotateModeBView_.addClass('selected');
        else
            this.rotateModeCView_.addClass('selected');
        this.updateRotationView();
    };

    /**
     * Toggle information panel
     * @param {?boolean} isToggle
     */
    p.toggleInformation = function(isToggle) {
        this.setRotateMethod(this.getRotateMethod());
        if (isToggle === undefined)
            isToggle = this.isInformationToggle = !this.isInformationToggle;
        if (isToggle) {
            this.view_.addClass('informationToggle');
        } else {
            this.view_.removeClass('informationToggle');

        }
    };

    /**
     * Add clone entity for clone block
     * If parameter given, this clone the parameter entity itself.
     * Otherwise, this clone this object's entity.
     * @param {?Entry.EntryObject} object
     * @param {?Entry.EntityObject} entity
     * @param {?xml block} script
     */
    p.addCloneEntity = function(object, entity, script) {
        if (this.clonedEntities.length > Entry.maxCloneLimit)
            return;

        var clonedEntity = new Entry.EntityObject(this);
        clonedEntity.isClone = true;

        entity = entity || this.entity;

        clonedEntity.injectModel(
            entity.picture ? entity.picture : null,
            entity.toJSON()
        );
        clonedEntity.snapshot_ = entity.snapshot_;
        if (entity.effect) {
            clonedEntity.effect = Entry.cloneSimpleObject(entity.effect);
            clonedEntity.applyFilter();
        }
        if (entity.brush)
            Entry.setCloneBrush(clonedEntity, entity.brush);

        Entry.engine.raiseEventOnEntity(
            clonedEntity,
            [clonedEntity, 'when_clone_start']
        );

        clonedEntity.isStarted = true;
        this.addCloneVariables(
            this, clonedEntity,
            entity ? entity.variables : null,
            entity ? entity.lists : null
        );

        this.clonedEntities.push(clonedEntity);
        Entry.stage.loadEntity(clonedEntity);
    };

    /**
     * Splitter is resizing playground handle.
     * This add mouse move and mouse up event to document.
     * @param {!Element} splitter
     */
    p.initializeSplitter = function(splitter) {
        splitter.onmousedown = function(e) {
            Entry.container.disableSort();
            Entry.container.splitterEnable = true;
        };
        document.addEventListener('mousemove', function(e) {
            if (Entry.container.splitterEnable) {
                Entry.resizeElement({canvasWidth: e.x || e.clientX});
            }
        });
        document.addEventListener('mouseup', function(e) {
            Entry.container.splitterEnable = false;
            Entry.container.enableSort();
        });
    };

    /**
     * return true when object is selected
     * @return {Boolean}
     */
    p.isSelected = function() {
        return this.isSelected_;
    };

    /**
     * convert this object's data to JSON.
     * @return {JSON}
     */
    p.toJSON = function(isClone) {
        var json = {};
        json.id = isClone ? Entry.generateHash() : this.id;
        json.name = this.name;
        if (this.objectType == 'textBox')
            json.text = this.text;
        json.script = this.getScriptText();
        json.objectType = this.objectType;
        json.rotateMethod = this.getRotateMethod();
        json.scene = this.scene.id;
        json.sprite = {
            pictures: Entry.getPicturesJSON(this.pictures, isClone),
            sounds: Entry.getSoundsJSON(this.sounds, isClone)
        };
        if (this.objectType == 'sprite')
            json.selectedPictureId = json.sprite.pictures[this.pictures.indexOf(this.selectedPicture)].id;
        json.lock = this.lock;
        json.entity = this.entity.toJSON();
        return json;
    };

    /**
     * destroy this object
     */
    p.destroy = function() {
        this.entity && this.entity.destroy();
        this.view_ && Entry.removeElement(this.view_);
    };

    /**
     * Get sound object by Id.
     * @param {?string} soundId
     * @return {sound object}
     */
    p.getSound = function(value) {
        //priority
        //1. soundId
        //2. soundName
        //3. index
        value = (value + "").trim();
        var sounds = this.sounds,
            len = sounds.length;
        for (var i=0; i<len; i++)
            if (sounds[i].id == value) return sounds[i];

        for (i=0; i<len; i++)
            if (sounds[i].name == value ) return sounds[i];

        var checker = Entry.parseNumber(value);
        if (!(checker === false && typeof checker == 'boolean') &&
            len >= checker && checker > 0) {
            return sounds[checker-1];
        }
        return null;
    };

    p.addCloneVariables = function(object, entity, variables, lists) {
        entity.variables = [];
        entity.lists = [];
        var keyName = 'object_';
        if (!variables)
            variables = Entry.findObjsByKey(
                Entry.variableContainer.variables_,
                keyName,
                object.id
            );
        if (!lists)
            lists = Entry.findObjsByKey(
                Entry.variableContainer.lists_,
                keyName,
                object.id
            );

        for (var i=0; i<variables.length; i++)
            entity.variables.push(variables[i].clone());
        for (var i=0; i<lists.length; i++)
            entity.lists.push(lists[i].clone());
    };

    p.getLock = function() {
        return this.lock;
    };

    p.setLock = function(bool) {
        this.lock = bool;
        Entry.stage.updateObject();
        return bool;
    };

    p.updateInputViews = function(isLocked) {
        isLocked = isLocked || this.getLock();
        var inputs = [
            this.nameView_, this.coordinateView_.xInput_,
            this.coordinateView_.yInput_, this.rotateInput_,
            this.directionInput_,
            this.coordinateView_.sizeInput_
        ];
        if (isLocked){
            if(inputs[0].getAttribute("readonly") != true){
                for (var i=0; i<inputs.length; i++) {
                    inputs[i].removeClass('selectedEditingObject');
                    inputs[i].setAttribute('readonly', false);
                    this.isEditing = false;
                }
            }
        }
    };


    p.editObjectValues = function(click) {
        var inputs;
        if(this.getLock()) {
            inputs = [this.nameView_];
        } else {
            inputs = [
                this.coordinateView_.xInput_,
                this.coordinateView_.yInput_, this.rotateInput_,
                this.directionInput_, this.coordinateView_.sizeInput_
            ];
        }

        if (click) {
            var nameView_ = this.nameView_;

            $(inputs).removeClass('selectedNotEditingObject');
            $(nameView_).removeClass('selectedNotEditingObject');

            window.setTimeout(function() {
                $(nameView_).removeAttr('readonly');
                nameView_.addClass("selectedEditingObject");
            });
            for(var i=0; i<inputs.length; i++){
                $(inputs[i]).removeAttr('readonly');
                inputs[i].addClass("selectedEditingObject");
            }
            this.isEditing = true;
        } else {
            for(var i=0; i<inputs.length; i++)
                inputs[i].blur(true);

            this.nameView_.blur(true);

            this.blurAllInput();
            this.isEditing = false;
        }
    };

    p.blurAllInput = function() {
        var inputs = document.getElementsByClassName('');
        $('.selectedEditingObject').removeClass('selectedEditingObject');

        inputs = [
            this.nameView_, this.coordinateView_.xInput_,
            this.coordinateView_.yInput_, this.rotateInput_,
            this.directionInput_, this.coordinateView_.sizeInput_
        ];

        for(var i=0; i<inputs.length; i++) {
            var input = inputs[i];
            input.addClass('selectedNotEditingObject');
            input.setAttribute('readonly', true);
        }
    };

    /**
     * Add stamp entity for brush_stamp block
     * If parameter given, this clone the parameter entity itself.
     * Otherwise, this clone this object's entity.
     * @param {?Entry.EntryObject} object
     * @param {?Entry.EntityObject} entity
     * @param {?xml block} script
     */
    p.addStampEntity = function(entity) {
        var stampEntity = new Entry.StampEntity(this, entity);
        var stage = Entry.stage;
        stage.loadEntity(stampEntity);
        this.clonedEntities.push(stampEntity);
        Entry.stage.sortZorder();
    };

    /**
     *  get only clonedEntities among clonedEntities except for stamp entity
     *  @return {Array<clone Entity> } entities
     */
    p.getClonedEntities = function() {
        return this.clonedEntities.filter(function (e) {
            return !e.isStamp;
        });
    };

    /**
     *  get only stamp entities among clonedEntities
     *  @return {Array<stampEntity> } entities
     */
    p.getStampEntities = function() {
        return this.clonedEntities.filter(function (e) {
            return e.isStamp;
        });
    };

    p.clearExecutor = function() {
        this.script.clearExecutors();

        var clonedEntities = this.clonedEntities;
        for (var j = clonedEntities.length-1; j>=0; j--)
            clonedEntities[j].removeClone(true);
    };

    p._rightClick = function(e) {
        if (!this.isContextMenuEnabled())
            return;

        var object = this;
        var options = [
            {
                text: Lang.Workspace.context_rename,
                callback: function(e){
                    e.stopPropagation();
                    (function (o){
                        o.setLock(false);
                        o.editObjectValues(true);
                        o.nameView_.select();
                    })(object);
                }
            },
            {
                text: Lang.Workspace.context_duplicate,
                enable: !Entry.engine.isState('run'),
                callback: function(){
                    Entry.container.addCloneObject(object);
                }
            },
            {
                text: Lang.Workspace.context_remove,
                callback: function(){
                    Entry.dispatchEvent('removeObject', object);
                    Entry.container.removeObject(object);
                }
            },
            {
                text: Lang.Workspace.copy_file,
                callback: function(){
                    Entry.container.setCopiedObject(object);
                }
            },
            {
                text: Lang.Blocks.Paste_blocks,
                enable: !Entry.engine.isState('run') && !!Entry.container.copiedObject,
                callback: function(){
                    if (Entry.container.copiedObject)
                        Entry.container.addCloneObject(Entry.container.copiedObject);
                    else
                        Entry.toast.alert(Lang.Workspace.add_object_alert, Lang.Workspace.object_not_found_for_paste);
                }
            }
        ];

        e = Entry.Utils.convertMouseEvent(e);
        Entry.ContextMenu.show(
            options, 'workspace-contextmenu',
            { x: e.clientX, y: e.clientY }
        );
    };

    p.enableContextMenu = function() {
        this._isContextMenuEnabled = true;
    };

    p.disableContextMenu = function() {
        this._isContextMenuEnabled = false;
    };

    p.isContextMenuEnabled = function() {
        return this._isContextMenuEnabled && Entry.objectEditable;
    };

    p.toggleEditObject = function() {
        var current = this.isEditing;
        if(Entry.engine.isState('run')) return;

        if (current === false) {
            this.editObjectValues(!current);
            if (Entry.playground.object !== this)
                Entry.container.selectObject(this.id);
            this.nameView_.select();
            return;
        }
    };

    p.toggleEditObject = function() {
        var current = this.isEditing;
        if(Entry.engine.isState('run')) return;

        if (current === false) {
            this.editObjectValues(!current);
            if (Entry.playground.object !== this)
                Entry.container.selectObject(this.id);
            this.nameView_.select();
            return;
        }
    };

    p.getDom = function(query) {
        if (!query || query.length === 0)
            return this.view_;

        if (query.length >= 1) {
            switch(query.shift()) {
                case "editButton":
                    return this.editView_;
            }
        } else {
        }
    };

})(Entry.EntryObject.prototype);
