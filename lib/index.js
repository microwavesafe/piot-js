const HDLC = require('./hdlc')
const SerialPort = require('serialport');
const events = require("events");

const COMMAND__OPEN_SOCKET = 1;
const COMMAND__CLOSE_SOCKET = 2;
const COMMAND__SEND_PACKET = 3;
const COMMAND__RECEIVED_PACKET = 4;
const COMMAND__VERSION = 255;

const RECONNECTION_TIMEOUT = 5000;

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

                                if (payload.length === 5 && payload[0] === COMMAND__VERSION && payload[1] === 1) {
                                    serialPorts[i].version = "" + payload[1] + "." + payload[2] + "." + payload[3];
                                    resolve(serialPorts[i]);
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
                                serialPort.write(hdlc.createFrame(Uint8Array.of(COMMAND__VERSION), 1));

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

    constructor(serialPortPath) {
        this._emitter = new events.EventEmitter();
        this._hdlc = new HDLC(this._hdlcReceived, this);
        this._serialPortPath = serialPortPath;
        this._closing = false;
        this._connect();
    }

    _reconnect() {
        let piotObj = this;
        if (!this._closing) {
            this._reconnectionTimeout = setTimeout(function() {
                piotObj._connect();
            }, RECONNECTION_TIMEOUT);
        }
        else {
            clearTimeout(this._reconnectionTimeout);
        }
    }

    _connect() {
        this._reconnectionTimeout;
        let piotObj = this;
        this._serialPort = new SerialPort(this._serialPortPath);

        this._serialPort.on('error', (err) => {
            this._emitter.emit('error', err);
            this._reconnect();
        });
        
        this._serialPort.on('open', () => {
            clearTimeout(this._reconnectionTimeout);
            this._emitter.emit('open');
        });

        this._serialPort.on('close', () => {
            this._emitter.emit('closed');
            this._reconnect();
        });

        this._serialPort.on('data', (data) => {
            // push the data into the HDLC decoder
            this._hdlc.frameUpdatedArray (data, data.length);
        });
    }

    // this is called when a complete HDLC frame has been received
    _hdlcReceived(payload) {
        // only forward received radio packets to data listeners
        if (payload[0] === COMMAND__RECEIVED_PACKET) {
            // use sub array to remove the command byte
            this._emitter.emit('data', payload.subarray(1));
        }
        // TODO: test return codes for commands?
        else {
            this._emitter.emit('rc', payload);
        }
    }

    _send(buffer) {
        let hdlcFrame = this._hdlc.createFrame(buffer, buffer.length);
        this._serialPort.write(hdlcFrame);
    }

    isOpen() {
        return this._serialPort.isOpen;
    }

    on(event, listener) {
        this._emitter.on(event,listener);
    }

    open() {
        this._closing = false;
        if (!this._serialPort.isOpen) {
            this._connect();
        }
    }

    close(callback) {
        this._closing = true;
        if (callback instanceof Function) {
            if (this._serialPort.isOpen) {
                this._serialPort.close(callback);
            }
            else {
                callback();
            }
        }
        else if (this._serialPort.isOpen) {
            this._serialPort.close();
        }
    }

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
}

module.exports = Piot;
