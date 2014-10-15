// casts
//
// © 2014 Dave Goehrig <dave@dloh.org>
//

os = require('os')
util = require('util')
events = require('events')
WebSocket = require('ws')

function EventEmitter(port) {
	var self = this
	self._nodes = {}
	events.EventEmitter.call(this)	

	// override the default EventEmitter.emit with our broadcast option
	self.emit = function() {
		var self = this
		var args = Array.prototype.slice.apply(arguments,[0])
		// For outbound local origin messages rebroadcast!!
		for (node in self._nodes) self._nodes[node].send(JSON.stringify(args))
		events.EventEmitter.prototype.emit.apply(self,args)
	}

	// return a list of node names
	self.nodes = function() {
		var self = this
		var nodes = []
		for (node in self._nodes) nodes.push(node)
		return nodes
	}
	
	// handler for various errors
	self.error = function(e) {
		console.error(e) 
	}

	// handler functions which we need
	self.rebroadcast = function(message) {
		// For incoming messages don't rebroadcast!!
		try {
			var args = JSON.parse(message)
			events.EventEmitter.prototype.emit.apply(self,args)
		} catch (e) { self.error(e) }
	}

	self.node = function(node,callback) {
		var self = this
		var socket = new WebSocket(node)
		socket.on('message', self.rebroadcast)
		// handler for new connections
		var connection = function() {
			socket.send(JSON.stringify(['peer', os.hostname() + ':' + port]))
			if (typeof(callback) == 'function') try {
				callback(socket,node)
			} catch (e) { self.error(e) }
		}
		socket.on('open', connection)
		socket.on('error', self.error)
		socket.on('close', function() { delete self._nodes[node] })
		self._nodes[node] = socket
		return self
	}
	// If we were supplied a port, start listening on that port.
	if (port) {
		self.server = new WebSocket.Server({ port: port })
		self.server.on('connection', function(socket) {
			// Initially, any new raw connection should be ignored until we
			// receive a peer message, as the peer announces they're joining
			var peering = function(message) {
				var args = JSON.parse(message)
				if (args[0] == 'peer') {
					var peer = args[1]
					// once we have a peer, we then change the handler
					socket.on('message',self.rebroadcast)
					self._nodes[peer] = socket
					socket.on('close', function() { delete self._nodes[peer] })
				}
			}
			socket.on('message', peering)
		})
	}
}

util.inherits(EventEmitter,events.EventEmitter)

module.exports = EventEmitter
