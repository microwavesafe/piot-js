const HDLC = require('./hdlc');
const commands = require('./commands');
const errors = require('./errors');
const PiotError = require('./error');
const bytes = require ('./bytes');
const SerialPort = require('serialport');
const events = require('events');

const RECONNECTION_TIMEOUT = 5000;
const OPEN_CLOSE_TIMEOUT = 3000;
const HAT_COMMAND_TIMEOUT = 500;
const NODE_COMMAND_TIMEOUT = 10000;

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
    static list() {
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
                                clearTimeout(timeout);
                                serialPort.close();

                                if (payload.length === 6) {
                                    let commandNumber = bytes.getInt16 (payload, 0);

                                    if (commandNumber == commands.TYPE_VERSION) {
                                        serialPorts[i].type = bytes.getInt16(payload, 2);
                                        serialPorts[i].version = bytes.getInt16(payload, 4);
                                        resolve(serialPorts[i]);
                                    }
                                }

                                resolve("");
                            });

                            // on any error resolve empty string
                            serialPort.on('error', (err) => {
                                // no error thrown if timeout not valid here
                                clearTimeout(timeout);
                                if (serialPort.isOpen) {
                                    serialPort.close();
                                }
                                resolve("");
                            });

                            serialPort.on('open', () => {
                                // send command to get version
                                let command = new Uint8Array(2);
                                bytes.setInt16(command, 0, commands.TYPE_VERSION);
                                serialPort.write(hdlc.createFrame(command, 2));

                                // if timeout reached after we send command resolve empty string
                                timeout = setTimeout(function() {
                                    if (serialPort.isOpen) {
                                        serialPort.close();
                                    }
                                    resolve("");
                                }, 200);
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
        this._emitter = new events.EventEmitter();
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

    _checkCommand(command) {
        // Number.isNaN does not coerce argument
        if (Number.isNaN(command) || command < 1 || command > 65535) {
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

    _checkAddress(address) {
        if (address instanceof Number === false || address < 0x0001 || address >= 0xFFFF) {
            return false;
        }
        return true;
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
        this._emitter.emit('data', payload);
    }

    sendReceive(command, data, waitTime) {
        return new Promise((resolve, reject) => {
            this.send(command, data);

            // confirmation of command, is command number
            let payloadReceive = (payload) => {
                if (bytes.getInt16(payload, 0) == command) {
                    clearTimeout(timeout);
                    resolve(payload);
                }
            };

            let timeout = setTimeout(() => {
                reject(new PiotError(errors.RECEIVE_TIMEOUT, "reply timeout"));
                this._emitter.off('data', payloadReceive);
            }, waitTime);

            this._emitter.prependOnceListener('data', payloadReceive);
        });
    }

    send(command, data) {
        let buffer = new Uint8Array(data.length + 2);
        bytes.setInt16(buffer, 0, command);

        for (let i=0; i<data.length; i++) {
            buffer[2 + i] = data[i];
        }

        let hdlcFrame = this._hdlc.createFrame(buffer, buffer.length);
        this._serialPort.write(hdlcFrame);
    }

    write(command, data) {
        let checkFailed = false;

        if (!this._checkCommand(command)) {
            checkFailed = errors.COMMAND_INVALID;
        }
        else if (!this._checkData(data)) {
            checkFailed = errors.DATA_INVALID;
        }
        if (checkFailed) {
            return new Promise((resolve, reject) => {
                reject(new PiotError(checkFailed, "parameter check failed"));
            });
        }

        return sendReceive(command, data, HAT_COMMAND_TIMEOUT);
    }

    read(command) {
        if (!this._checkCommand(command)) {
            return new Promise((resolve, reject) => {
                reject(new PiotError(errors.COMMAND_INVALID, "parameter check failed"));
            });
        }

        return this.sendReceive(command, [], HAT_COMMAND_TIMEOUT);
    }

    writeNode(address, command, data) {
        if (!this._checkCommand(command) || !this._checkData(data) || !_checkAddress(address)) {
            return new Promise((resolve, reject) => {
                reject();
            });
        }

    }

    readNode(address, command) {
        if (!this._checkCommand(command) || !_checkAddress(address)) {
            return new Promise((resolve, reject) => {
                reject();
            });
        }

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
                    reject(new PiotError(errors.OPEN_PORT_TIMEOUT, "port open timeout"));
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
                    reject(new PiotError(errors.CLOSE_PORT_TIMEOUT, "port close timeout"));
                }, OPEN_CLOSE_TIMEOUT);

                this._serialPort.close(() => {
                    clearTimeout(timeout);
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
/*
    openRadioSocket(protocol, port, filterAddress, blockBroadcast, encryption, encryptionKey) {
        let buffer = new Uint8Array(42);
        buffer[0] = COMMAND__OPEN_SOCKET;

        buffer[1] = protocol;
        buffer[2] = port & 0xFF;
        buffer[3] = (port >> 8) & 0xFF;
        buffer[4] = this.filterAddr & 0xFF;
        buffer[5] = (this.filterAddr >> 8) & 0xFF;
        buffer[6] = (this.filterAddr >> 16) & 0xFF;
        buffer[7] = (this.filterAddr >> 24) & 0xFF;
        buffer[8] = blockBroadcast;

	if (protocol === 2) {
            encryption = 1;
        }

        buffer[9] = encryption;

        for (let i=0; i<32; i++) {
            buffer[10 + 1] = encryptionKey[i];
        }

        this._send(buffer);
    }

    closeRadioSocket(port) {
        let buffer = new Uint8Array(3);
        buffer[0] = COMMAND__CLOSE_SOCKET;
        buffer[1] = port & 0xFF;
        buffer[2] = (port >> 8) & 0xFF;

        this._send(buffer);
    }

    sendRadioPacket(address, port, data) {
        // command 1 byte, address 4 bytes, port 2 bytes
        let buffer = new Uint8Array(data.length + 7);
        buffer[0] = COMMAND__SEND_PACKET;
        buffer[1] = address & 0xFF;
        buffer[2] = (address >> 8) & 0xFF;
        buffer[3] = (address >> 16) & 0xFF;
        buffer[4] = (address >> 24) & 0xFF;
        buffer[5] = port & 0xFF;
        buffer[6] = (port >> 8) & 0xFF;

        for (let i=0; i<data.length; i++) {
            buffer[7 + i] = data[i];
        }

        this._send(buffer);
    }
*/
}

module.exports = Piot;
