var util = require('util');
var EventEmitter = require('events').EventEmitter;

function MultiEvent(){
    this.handlers = {};
}

util.inherits(MultiEvent, EventEmitter);
MultiEvent.parent = EventEmitter;

MultiEvent.prototype.multiOn = function (event, f) {
  var map = this.handlers;
    if (!(event in map))
        map[event] = [f];
    else
        map[event].push(f);
}

MultiEvent.prototype.multiEmit = function (event){
    var map = this.handlers;
    if (!(event in map))
        return;
    var handlers = map[event];
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < handlers.length; i++)
        handlers[i].apply(null, args);
}

module.exports = MultiEvent;
