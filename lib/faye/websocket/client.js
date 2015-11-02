var util   = require('util'),
    net    = require('net'),
    tls    = require('tls'),
    driver = require('websocket-driver'),
    API    = require('./api'),
    Event  = require('./api/event'),
    socks  = require("socks"),
    stream = require("stream");
var Client = function(url, protocols, options) {
  options = options || {};

  this.url     = url;
  this._uri    = require('url').parse(url);
  this._driver = driver.client(url, {maxLength: options.maxLength, protocols: protocols});

  ['open', 'error'].forEach(function(event) {
    this._driver.on(event, function() {
      self.headers    = self._driver.headers;
      self.statusCode = self._driver.statusCode;
    });
  }, this);

  var secure     = (this._uri.protocol === 'wss:'),
      onConnect  = function() {
          self._driver.start()
      },
      tlsOptions = {},
      self       = this;

  if (options.ca) tlsOptions.ca = options.ca;

  if (!("socks-options" in options)) {
      // Default
      var connection = secure
          ? tls.connect(this._uri.port || 443, this._uri.hostname, tlsOptions, onConnect)
          : net.createConnection(this._uri.port || 80, this._uri.hostname);

      this._stream = connection;
      if (!secure) this._stream.on('connect', onConnect);
      API.call(this, options);
  }else{
      if (!secure) throw "No implementation for non-SSL. Sorry.";

      var socksOptions = options['socks-options'];

      socksOptions.target = {
          host : this._uri.hostname,
          port : this._uri.port || 443
      };
      var self = this;
      socks.createConnection(socksOptions, function(err, socket, info){
          if (err) {
              console.log("@@@@ ERROR @@@@");
              console.log(err,socket,info);
              // Setup a mock stream, just so we can emit the error event.
              self._stream = new stream.Readable({
                  read: function(n) {}
              });
              self._stream.setTimeout = function(){};
              self._stream.setNoDelay = function(){};
              self._stream.end = function(){};

              API.call(self, options);
              self._stream.emit('error',err);
          }

          self._stream = new tls.TLSSocket(socket, {isServer: false});
          API.call(self, options);
          setTimeout(onConnect, 10);
      });

  }
};
util.inherits(Client, API);

module.exports = Client;
