const Chrome = require('chrome-remote-interface/lib/chrome');
const formatUrl = require('url').format;
const parseUrl = require('url').parse;
const EventEmitter = require('events');
const WebSocket = require('isomorphic-ws');


const isNode = (typeof self === 'undefined');

// ===========================================================================
class RemoteChrome extends Chrome
{
  async _fetchDebuggerURL(options) {
    let url = await super._fetchDebuggerURL(options);

    const urlObject = parseUrl(url);

    urlObject.host = this.host;
    urlObject.port = this.port;
    urlObject.protocol = this.secure ? "wss:" : "ws:";
    return formatUrl(urlObject);
  }

  _connectToWebSocket() {
    return new Promise((fulfill, reject) => {
        // create the WebSocket
        try {
            if (this.secure) {
                this.webSocketUrl = this.webSocketUrl.replace(/^ws:/i, 'wss:');
            }
            this._ws = new WebSocket(this.webSocketUrl);
        } catch (err) {
            // handles bad URLs
            reject(err);
            return;
        }
        // set up event handlers
        this._ws.onopen = () => {
            fulfill();
        };

        this._ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
        };

        this._ws.onclose = (event) => {
            this.emit('disconnect');
        };

        this._ws.onerror = (event) => {
            console.log('error');
            reject(event.data);
        };
    });
  }

  _enqueueCommand(method, params, callback) {
    const id = this._nextCommandId++;
    const message = {
      id, method,
      params: params || {}
    };

    const onSent = (err) => {
      if (err) {
        // handle low-level WebSocket errors
        if (typeof callback === 'function') {
          callback(err);
        }
      } else {
        this._callbacks[id] = callback;
      }
    }

    if (isNode) {
      this._ws.send(JSON.stringify(message), onSent);
    } else {
      try {
        this._ws.send(JSON.stringify(message));
        onSent();
      } catch (err) {
        onSent(err);
      }
    }
  }

  async _fetchProtocol(options) {
    const protocol = await super._fetchProtocol(options);

    this.domains = [];

    for (const domain of protocol.domains) {
      this.domains.push(domain.domain);
    }

    return protocol;
  }

  close(callback) {
    const closeWebSocket = (callback) => {
      // don't close if it's already closed
      if (this._ws.readyState === 3) {
        callback();
      } else {
        if (isNode) {
          // don't notify on user-initiated shutdown ('disconnect' event)
          this._ws.removeAllListeners('close');
          this._ws.once('close', () => {
            this._ws.removeAllListeners();
            callback();
          });
          this._ws.close();
        } else {
          this._ws.close();
          callback();
        }
      }
    }

    if (typeof callback === 'function') {
      closeWebSocket(callback);
      return undefined;
    } else {
      return new Promise((fulfill, reject) => {
        closeWebSocket(fulfill);
      });
    }
  }
}


// ===========================================================================
class CDP
{
  constructor(prefixUrl) {
    const urlObject = parseUrl(prefixUrl);

    this.options = {
      useHostName: true,
      host: urlObject.host,
      port: urlObject.port ? urlObject.port : (urlObject.protocol === "https:" ? 443 : 80),
      secure: urlObject.protocol === "https:",
      alterPath: (path) => {
        return urlObject.pathname + path;
      }
    }

    this.notifier = new EventEmitter();
    this.cdp = null;

    this.AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  }

  async connect() {
    this.cdp = await new Promise((fulfill, reject) => {
        this.notifier.once('connect', fulfill);
        this.notifier.once('error', reject);
        new RemoteChrome(this.options, this.notifier);
    });

    this.domainValues = [];

    for (const domain of this.cdp.domains) {
      this.domainValues.push(this.cdp[domain]);
    }
  }

  ondisconnect(func) {
    if (this.cdp) {
      this.cdp.on('disconnect', func);
    }
  }

  close() {
    if (this.cdp) {
      this.cdp.close();
    }
  }

  eval(text, params = {}) {
    const fn = new this.AsyncFunction(...this.cdp.domains, ...Object.keys(params), text);
    return fn.call(null, ...this.domainValues, ...Object.values(params));
  }
}


// ===========================================================================
async function main(prefix, url) {
  const cdp = new CDP(prefix);

  try {
    await cdp.connect();
  } catch (e) {
    console.log(e);
  }

  cdp.eval(`

const res = await Page.navigate({"url": "${url}"});
console.log(res);

`);

  //const res = await Page.navigate({"url": url});
  //return res;
}

if (isNode) {
  main(process.argv[2], "https://github.com/");
}

module.exports = { CDP, main };
