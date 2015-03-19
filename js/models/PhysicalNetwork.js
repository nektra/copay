var MultiEvent = require('../MultiEvent');
var _ = require('../../lib/lodash/dist/lodash');
var io = require('socket.io-client');
var log = require('../util/log');

var SocketStatus = {
    Disconnected: 0,
    Connected: 1,
    ConnectionFailed: 2,
    Connecting: 3
};

function PhysicalNetwork(){
    this.knownAsyncs = {};
    this.sockets = {};
    this.notifyOnNextConnect = {};
    this.notifyOnNextDisconnect = {};
    this.registeredMiscCallbacks = {};
};

export.singleton = function (){
    var instance;

    function createInstance(){
        var object = new Object("I am the instance");
        return object;
    }

    return {
        getInstance: function () {
            return instance || (instance = createInstance());
        }
    };
}();

PhysicalNetwork.prototype._connected = function (url){
    return url in self.sockets && self.sockets.status === SocketStatus.Connected;
};

PhysicalNetwork.prototype._connecting = function (url){
    return url in self.sockets && self.sockets.status === SocketStatus.Connecting;
};

PhysicalNetwork.prototype._emitSingle = function (pubKey, event){
    if (!(pubKey in this.knownAsyncs)){
        log.debug('PhysicalNetwork._emitSingle(): Tried to emit to an unknown Async.');
        return;
    }
    var callbacks = this.knownAsyncs[pubKey].callbacks;
    if (!(event in callbacks))
        return;
    var args = Array.prototype.slice.call(arguments, 2);
    callbacks[event].apply(null, args);
};

PhysicalNetwork.prototype._emitAll = function (event){
    for (var pubKey in this.knownAsyncs)
        this._emitSingle.apply(pubKey, arguments);
};

PhysicalNetwork.prototype._notifyConnectionStatus = function (url, event){
    this._notifyConnectionStatus2(this.notifyOnNextConnect, url, event);
};

PhysicalNetwork.prototype._notifyConnectionStatus2 = function(obj, url, event){
    if (!(url in obj))
        return;
    var array = obj[url];
    var args = Array.prototype.slice.call(arguments, 3);
    for (var i in array)
        this._emitSingle.apply(this, [array[i], event].concat(args));
    delete obj[url];
};

function generateMiscEventHandler(self, eventName){
    return function (){
        self._emitAll.apply(self, [eventName].concat(arguments));
    };
};

PhysicalNetwork.prototype._addMiscCallback = function (eventName){
    if (eventName == 'connect')
        return false;
    if (eventName == 'connect_error')
        return false;
    if (eventName == 'disconnect')
        return false;
    if (eventName == 'message')
        return false;
    if (eventName in this.registeredMiscCallbacks)
        return false;
    this.registeredMiscCallbacks[eventName] = null;
    return true;
};

PhysicalNetwork.prototype._addAllMiscCallbacks = function (){
    for (var pubKey in this.knownAsyncs){
        var async = this.knownAsyncs[pubKey];
        for (var eventName in async.callbacks)
            this._addMiscCallback(eventName);
    }
};

PhysicalNetwork.prototype._registerMiscCallbacksInBatch = function (socket){
    for (var eventName in this.registeredMiscCallbacks){
        socket.on(
            eventName,
            generateMiscEventHandler(self, eventName)
        );
    }
};

PhysicalNetwork.prototype.startNetwork = function (pubKey, url, options){
    if (this._connected(url)){
        this._emitSingle(pubKey, 'connect');
        return;
    }
    
    {
        if (!(url in this.notifyOnNextConnect))
            this.notifyOnNextConnect[url] = [];
        this.notifyOnNextConnect[url].push(pubKey);
    }
    
    if (this._connecting(url))
        return;
    
    var socket = io.connect(url, options);
    this.sockets[url] = {
        socket: socket,
        status: SocketStatus.Connecting
    };
    this.knownAsyncs[pubKey].url = url;
    var self = this;
    socket.on(
        'connect',
        function (){
            self.sockets[url].status = SocketStatus.Connected;
            self.notifyOnNextDisconnect[url] = _.clone(self.notifyOnNextConnect[url]);
            socket.on(
                'disconnect',
                function(){
                    self.sockets[url] = {
                        status: SocketStatus.Disconnected
                    };
                    self._notifyConnectionStatus2(self.notifyOnNextDisconnect(), url, 'disconnect');
                }
            );
            self._notifyConnectionStatus(url, 'connect');
        }
    );
    socket.on(
        'connect_error',
        function (){
            self.sockets[url] = {
                status: SocketStatus.ConnectionFailed
            };
            self._notifyConnectionStatus.apply(self, [url, 'connect_error'].concat(arguments));
        }
    );
    socket.on(
        'message',
        function (data){
            vase async = self.knownAsyncs[data.to];
            if (!async)
                return;
            var cb = async.callbacks['message'];
            if (!cb)
                return;
            cb.apply(null, arguments);
        }
    );
    
    this._addAllMiscCallbacks();
    this._registerMiscCallbacksInBatch(socket);
};

PhysicalNetwork.prototype.registerAsync = function (pubKey, callbackMap){
    this.knownAsyncs[pubKey] = {
        callbacks: _.clone(callbackMap)
    };
};

PhysicalNetwork.prototype.registerAsyncCallback = function (pubKey, event, newCallback){
    var map = null;
    if (!(pubKey in this.knownAsyncs))
        this.knownAsyncs[pubKey] = {event: newCallback};
    else
        this.knownAsyncs[pubKey][event] = newCallback;
    if (!this._addMiscCallback(event))
        return;
    for (var url in this.sockets)
        this.sockets[url].socket.on(event, generateMiscEventHandler(event));
};

PhysicalNetwork.prototype._socketFromPublicKey = function(pubKey){
    if (!(pubKey in this.knownAsyncs)){
        log.debug('PhysicalNetwork._socketFromPublicKey(): An unknown Async tried to send data.');
        return null;
    }
    var async = this.knownAsyncs[pubKey];
    if (!(url in async)){
        log.debug('PhysicalNetwork._socketFromPublicKey(): An Async tried to send data before calling startNetwork().');
        return null;
    }
    var url = async.url;
    if (!this._connected(url)){
        log.debug('PhysicalNetwork._socketFromPublicKey(): The socket is not yet ready.');
        return null;
    }
    return this.sockets[url].socket;
}

PhysicalNetwork.prototype.send = function (pubKey, event){
    var socket = this._socketFromPublicKey(pubKey);
    if (!socket)
        return;
    var args = Array.prototype.slice.call(arguments, 1);
    socket.emit.apply(socket, args);
}

PhysicalNetwork.prototype.cleanUp = function (pubKey){
    var async = this.knownAsyncs[pubKey];
    if (!async)
        return;
    delete this.knownAsyncs[pubKey];
    var url = async.url;
    if (!url || !this._connected(url))
        return;
    var any = false;
    for (var a in this.knownAsyncs){
        if (a.url === url){
            any = true;
            break;
        }
    }
    if (any)
        return;
    var socket = this.sockets[url];
    socket.disconnect();
    socket.removeAllListeners();
    delete this.sockets[url];
}

PhysicalNetwork.prototype.isConnected = function(pubKey){
    if (!(pubKey in this.knownAsyncs))
        return false;
    var async = this.knownAsyncs[pubKey];
    if (!(url in async))
        return false;
    return this._connected(async.url);
}
