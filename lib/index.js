const HDLC = require('./hdlc');
const Commands = require('./commands');
const Errors = require('./errors');
const PiotError = require('./error');
const Bytes = require ('./bytes');
const Topics = require('./message_definitions');

const SerialPort = require('serialport');
const Events = require('events');

const RECONNECTION_TIMEOUT = 5000;
const OPEN_CLOSE_TIMEOUT = 3000;
const HAT_COMMAND_TIMEOUT = 500;

class Piot {
    /*
     * List will take the list of available serial ports, open each one and send the
     * command to get the PiOT controller version number. If this completes successfully
     * it is added to the list.
     * Returns a promise, when resolved will contain the list of serial ports that have
     * a PiOT controller attached.
     * Version property is added to each object.
     *
     * Piot.list().then(function(list){
     *   console.log(list);
     * });
     */
    static list(wait) {
        return new Promise(function(resolve, reject) {
            SerialPort.list().then(function(serialPorts) {
                // interrogate each serial port and ask for version number
                // we can create list of Piot controllers only
                let serialPortPromises = [];

                for (let i=0; i<serialPorts.length; i++) {
                    // create an array of promises, so we can wait for all to finish
                    // before we return the final list
                    serialPortPromises.push(
                        new Promise(function(resolve, reject) {
                            let serialPort = new SerialPort(serialPorts[i].comName);
                            let timeout;

                            // create HDLC object and set callback
                            // only if we get valid data here do we add to list
                            let hdlc = new HDLC(function(payload) {

                                if (payload.length === 6) {
                                    if (payload[0] == (Commands.GET_HAT_TYPE_VERSION | 0b10000000)
                                    && payload[1] == Commands.OK) {

                                        // there can be some data left in the TX buffer on the hat
                                        // don't close until we've given some time to clear it
                                        clearTimeout(timeout);
                                        serialPort.flush();
                                        serialPort.close();

                                        serialPorts[i].type = Bytes.getUint16(payload, 2);
                                        serialPorts[i].version = Bytes.getUint16(payload, 4);

                                        resolve(serialPorts[i]);
                                    }
                                }
                            });

                            // on any error resolve undefined
                            serialPort.on('error', (err) => {
                                // no error thrown if timeout not valid here
                                clearTimeout(timeout);
                                if (serialPort.isOpen) {
                                    serialPort.flush();
                                    serialPort.close();
                                }
                                resolve();
                            });

                            serialPort.on('open', () => {
                                serialPort.flush();

                                // send command to read hat
                                let command = new Uint8Array(1);
                                command[0] = Commands.GET_HAT_TYPE_VERSION;
                                serialPort.write(hdlc.createFrame(command, 1));

                                // if timeout reached after we send command resolve undefined
                                timeout = setTimeout(function() {
                                    if (serialPort.isOpen) {
                                        serialPort.flush();
                                        serialPort.close();
                                    }
                                    resolve();
                                }, wait);
                            });

                            serialPort.on('data', (data) => {
                                hdlc.frameUpdatedArray (data, data.length);
                            });
                        })
                    );
                };

                Promise.all(serialPortPromises).then(function(piotControllers) {
                    // if serial port failed to open, or doesn't respond correctly
                    // then promise is resolved with empty string
                    // strip them here
                    piotControllers = piotControllers.filter(Boolean)
                    resolve(piotControllers);
                });

            }, function(err) {
                reject(err);
            });
        });
    }

    constructor(serialPortPath, autoConnect) {
        this._autoConnect = false;
        if (autoConnect !== undefined) {
            this._autoConnect = autoConnect;
        }

        this._reconnectionTimeout;
        this._emitter = new Events.EventEmitter();
        this._hdlc = new HDLC(this._hdlcReceived, this);
        this._serialPortPath = serialPortPath;
        this._closing = false;

        this._serialPort = new SerialPort(this._serialPortPath, { autoOpen: false });

        this._serialPort.on('error', (err) => {
            this._emitter.emit('error', err);
            this._reconnect();
        });

        this._serialPort.on('open', () => {
            if (this._autoConnect) {
                clearTimeout(this._reconnectionTimeout);
            }
            this._emitter.emit('open');
        });

        this._serialPort.on('close', () => {
            this._emitter.emit('closed');
            if (this._autoConnect) {
                this._reconnect();
            }
        });

        this._serialPort.on('data', (data) => {
            // push the data into the HDLC decoder
            this._hdlc.frameUpdatedArray (data, data.length);
        });

        if (this._autoConnect) {
            this._serialPort.open();
        }
    }

    _hexString(value, length) {
        return ('00000000' + value.toString(16).toUpperCase()).slice(-length);
    }

    _checkCommand(command) {
        if (typeof command !== 'number' || command < 1 || command > 255) {
            return false;
        }
        return true;
    }

    _checkData(data) {
        if (data === undefined || data === null) {
            return false;
        }
        if ((Array.isArray(data) || data.buffer instanceof ArrayBuffer) && data.length > 0) {
            return true;
        }
        return false;
    }

    _reconnect() {
        if (!this._closing) {
            this._reconnectionTimeout = setTimeout(() => {
                this._serialPort.open();
            }, RECONNECTION_TIMEOUT);
        }
        else {
            clearTimeout(this._reconnectionTimeout);
        }
    }

    // this is called when a complete HDLC frame has been received
    _hdlcReceived(payload) {
        // TODO: handle multiple commands per payload

        let offset = 0;
        if (payload[offset] === Commands.PUBLISH) {
            this._emitter.emit('publish', payload);
        }
        else {
            this._emitter.emit('data', payload);
        }
    }

    send(command, data) {
        let checkFailed = false;

        if (!this._checkCommand(command)) {
            throw new PiotError(checkFailed, "parameter check failed");
        }

        if (!this._checkData(data)) {
            data = {length: 0};
        }

        let buffer = new Uint8Array(data.length + 1);
        buffer[0] = command;

        for (let i=0; i<data.length; i++) {
            buffer[1 + i] = data[i];
        }

        let hdlcFrame = this._hdlc.createFrame(buffer, buffer.length);
        this._serialPort.write(hdlcFrame);
    }

    sendReceive(command, data, waitTime) {
        if (typeof waitTime !== 'number' || waitTime < 50) {
            waitTime = HAT_COMMAND_TIMEOUT;
        }

        return new Promise((resolve, reject) => {
            this.send(command, data);

            // reply is <0> command with top bit set, <1> return code
            let payloadReceive = (payload) => {
                if (payload.length >= 2 && payload[0] == (command | 0b10000000)) {
                    this._emitter.off('data', payloadReceive);
                    clearTimeout(timeout);
                    resolve(payload);
                }
            };

            let timeout = setTimeout(() => {
                reject(new PiotError(Errors.RECEIVE_TIMEOUT, "reply timeout"));
                this._emitter.off('data', payloadReceive);
            }, waitTime);

            // use on, instead of prependOnceListener as we could get some
            // topic data coming through from the hat
            this._emitter.on('data', payloadReceive);
        });
    }

    isOpen() {
        return this._serialPort.isOpen;
    }

    on(event, listener) {
        this._emitter.on(event,listener);
    }

    off(event, listener) {
        this._emitter.off(event,listener);
    }

    open() {
        this._closing = false;
        return new Promise((resolve, reject) => {
            if (!this._serialPort.isOpen) {
                let timeout = setTimeout(() => {
                    reject(new PiotError(Errors.OPEN_PORT_TIMEOUT, "port open timeout"));
                }, OPEN_CLOSE_TIMEOUT);

                this._serialPort.open(() => {
                    clearTimeout(timeout);
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }

    close() {
        this._closing = true;
        return new Promise((resolve, reject) => {
            if (this._serialPort.isOpen) {
                let timeout = setTimeout(() => {
                    reject(new PiotError(Errors.CLOSE_PORT_TIMEOUT, "port close timeout"));
                }, OPEN_CLOSE_TIMEOUT);

                this._serialPort.close(() => {
                    this._serialPort.flush();
                    clearTimeout(timeout);
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}

module.exports = Piot;
