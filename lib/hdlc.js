const CRC16 = require('./crc16')

const HDLC_START_END = 0x7E;
const HDLC_ESCAPE = 0x7D;
const HDLC_ESCAPE_XOR = 0x20;
const HDLC_MAXIMUM_PAYLOAD_LENGTH = 1024;

class HDLC {

    // payloadReceivedCallback - function to call when whole frame decoded
    // thisArg - value to use as this when executing callback
    constructor(payloadReceivedCallback, thisArg) {

        if (typeof payloadReceivedCallback === 'function') {
            if (typeof thisArg !== 'undefined') {
                this.payloadReceivedCallback = payloadReceivedCallback.bind(thisArg);
            }
            else {
                this.payloadReceivedCallback = payloadReceivedCallback;
            }
        }

        this.sendCRC = new CRC16();
        this.receiveCRC = new CRC16();

        this.byteEscaped = 0;
        this.failedFrame = 0;
        this.crcEnabled = true;

        this.payload = new Uint8Array(HDLC_MAXIMUM_PAYLOAD_LENGTH);
        this.payloadLength = 0;
    }

    _requiresEscaping (byte) {
        return ((byte == HDLC_ESCAPE) || (byte == HDLC_START_END));
    }

    _escapeByte (buffer, byte, index) {
        let bytesAdded = 1;

        if (this._requiresEscaping(byte)) {
            buffer[index++] = HDLC_ESCAPE;
            byte ^= HDLC_ESCAPE_XOR;
            bytesAdded = 2;
        }

        buffer[index] = byte;

        return bytesAdded;
    };

    enableCRC () {
        this.crcEnabled = true;
    };

    disableCRC () {
        this.crcEnabled = false;
    };

    createFrame (buffer, length) {
        if (!(buffer instanceof Uint8Array)) {
            console.error("HDLC::sendFrame incorrect param type, should be Uint8Array");
            return;
        }

        let bufferLength = buffer.byteLength;

        if (typeof length === 'number') {
            bufferLength = length;
        }

        // calculate length (add up all HDLC_ESCAPE and HDLC_START_END characters and add 2 for start and end)
        let i;
        let charactersToEscape = 0;
        let crc;

        for (i=0; i<bufferLength; i++) {
            if ((buffer[i] === HDLC_START_END) || (buffer[i] === HDLC_ESCAPE)) {
                charactersToEscape++;
            }
        }

        if (this.crcEnabled) {
            // add two for CRC bytes
            charactersToEscape += 2;

            // can calculate CRC here as we only need the original buffer
            crc = this.sendCRC.calculate(buffer);
            // invert CRC so can calculate received frame using magic number
            crc ^= 0xFFFF;

            // does the CRC bytes contain any characters that need escaping
            if (this._requiresEscaping((crc >> 8) & 0xff)) {
                charactersToEscape++;
            }
            if (this._requiresEscaping(crc & 0xff)) {
                charactersToEscape++;
            }
        }

        // create buffer with correct size
        let hdlcFrame = new Uint8Array(charactersToEscape + bufferLength + 2);

        let index = 0;
        hdlcFrame[index++] = HDLC_START_END;

        // create escaped data
        for (i=0; i<bufferLength; i++) {
            let byte = buffer[i];
            index += this._escapeByte(hdlcFrame, byte, index);
        }

        // add CRC
        if (this.crcEnabled) {
            // send CRC high byte first
            index += this._escapeByte(hdlcFrame, ((crc >> 8) & 0xff), index);
            index += this._escapeByte(hdlcFrame, (crc & 0xff), index);
        }

        hdlcFrame[index] = HDLC_START_END;

        // maintaining a reference to this typed array will prevent it from being garbage collected
        return hdlcFrame;
    };

    frameUpdatedByte (byte) {

        // detect start end
        if (byte === HDLC_START_END) {

            // escape followed by end is incorrect, drop frame
            if (this.byteEscaped) {
                this.byteEscaped = 0;
            }

            // check CRC and minimum length (CRC two bytes + one byte of data)
            else {

                if ((this.payloadLength >= 3) && ((this.receiveCRC.test() || this.crcEnabled == 0))) {
                    if (this.crcEnabled == 1) {
                        this.payloadLength -= 2;
                    }

                    if (typeof this.payloadReceivedCallback === 'function') {
                        // create new buffer with payload contents
                        let payload = new Uint8Array(this.payloadLength);

                        for (let i=0; i<this.payloadLength; i++) {
                            payload[i] = this.payload[i];
                        }

                        this.payloadReceivedCallback(payload);
                    }
                }
            }

            // reset payload
            this.payloadLength = 0;
            this.failedFrame = 0;

            if (this.crcEnabled == 1) {
                this.receiveCRC.initialise();
            }

            return;
        }

        if (this.failedFrame) {
            return;
        }

        // de-escape byte if set
        if (this.byteEscaped) {
            this.byteEscaped = 0;
            byte ^= HDLC_ESCAPE_XOR;
        }
        // else flag escaped byte if escape character
        else if (byte == HDLC_ESCAPE) {
            this.byteEscaped = 1;
            return;
        }

        if (this.payloadLength === HDLC_MAXIMUM_PAYLOAD_LENGTH) {
            // invalidate the CRC
            this.receiveCRC.initialise();
            this.failedFrame = 1;
            return;
        }

        this.payload[this.payloadLength] = byte;
        this.payloadLength++;

        this.receiveCRC.update(byte);
    };

    // works from both Uint8Array or Buffer
    frameUpdatedArray (buffer, length) {
        let bufferLength = buffer.length;

        if (typeof length === 'number') {
            bufferLength = length;
        }

        for (let i=0; i<bufferLength; i++) {
            this.frameUpdatedByte(buffer[i]);
        }
    }
}

module.exports = HDLC