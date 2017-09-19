/*
 *
 */
"use strict";

goog.require("Entry.Command");
goog.require("Entry.STATIC");

(function(c) {
    var COMMAND_TYPES = Entry.STATIC.COMMAND_TYPES;

    c[COMMAND_TYPES.containerSelectObject] = {
        do: function(objectId) {
            Entry.container.selectObject(objectId);
        },
        state: function(objectId) {
            return [
                Entry.playground.object.id,
                objectId
            ];
        },
        log: function(objectId) {
            return [
                ['objectId', objectId],
                ['objectIndex', Entry.container.getObjectIndex(objectId)],
            ];
        },
        undo: "containerSelectObject",
        recordable: Entry.STATIC.RECORDABLE.SUPPORT,
        dom: ['container', 'objectIndex', '&1']
    };
})(Entry.Command);

