import HDLC from './lib/hdlc'
import { getInt32, getInt16, setInt32, setInt16, getHexString } from './lib/bytes'

const SerialPort = require('serialport');

const COMMAND__OPEN_SOCKET = 1;
const COMMAND__CLOSE_SOCKET = 2;
const COMMAND__SEND_PACKET = 3;

// Defines for encryption field when opening socket
// chacha20 encryption, with Poly1305 authentication 12 byte nonce
const CHACHA20_POLY1305 = 0x01;
// chacha20 encryption, with Poly1305 authentication 6 byte nonce
// nonce is padded with 32bit address at each end, so nonce is guaranteed unique between nodes
const CHACHA20_POLY1305_OPT1 = 0x21;

class Piot {

    constructor() {

        this.port = new SerialPort('/dev/ttyACM0');
        this.hdlc = new HDLC(this._hdlcReceived, this);

        this.port.on('error', (err) => {
            console.log("error " + err);
        });
        
        this.port.on('open', () => {
            console.log('Port Opened');
            test();
        });
                
        this.port.on('data', (data) => {
            // push the data into the HDLC decoder
            this.hdlc.frameUpdatedArray (data, data.length);
        });

        
    }

    // this is called when a complete HDLC frame has been received
    _hdlcReceived(payload) {
        let hexPayload = getHexString(payload);
        console.log(hexPayload);
        
        if (hexPayload == "cccccccccb1d07ffa1cccccccc") {
            let data = new Uint8Array(20);
            data[0] = 20; // length
            data[1] = 254; // bond complete 
            data[2] = 0x25; // to from
            setInt32(data, 3, 0xccccccc0);           
            this.sendRadioPacket(0xcccccccc, 7625, data);
        }
    }

    _send(buffer) {
        let hdlcFrame = this.hdlc.createFrame(buffer, buffer.length);

        this.port.write(hdlcFrame, (err) => {        
            if (err) {
                return console.log('Error: ', err.message)
            }
        });
    }

    openRadioSocket(protocol, port, filterAddress, blockBroadcast, encryption, encryptionKey) {
        let buffer = new Uint8Array(42);
        buffer[0] = COMMAND__OPEN_SOCKET;

        buffer[1] = protocol;
        setInt16(buffer, 2, port);
        setInt32(buffer, 4, this.filterAddr);
        buffer[8] = blockBroadcast;
        buffer[9] = encryption;
        
        for (let i=0; i<32; i++) {
            buffer[10 + 1] = encryptionKey[i];
        }

        this._send(buffer);
    }

    closeRadioSocket(port) {
        let buffer = new Uint8Array(3);
        buffer[0] = COMMAND__CLOSE_SOCKET;

        setInt16(buffer, 1, port);

        this._send(buffer);
    }

    sendRadioPacket(address, port, data) {
        // command 1 byte, address 4 bytes, port 2 bytes
        let buffer = new Uint8Array(data.length + 7);
        buffer[0] = COMMAND__SEND_PACKET;
        
        setInt32(buffer, 1, address);
        setInt16(buffer, 5, port);

        for (let i=0; i<data.length; i++) {
            buffer[7 + i] = data[i];
        }

        this._send(buffer);
    }
}

let piot = new Piot;

function test() {
    //piot.sendRadioPacket(0xcccccccc, 1, [0,1,2,3,4]);
    piot.closeRadioSocket(7624);
    piot.closeRadioSocket(7625);
    piot.closeRadioSocket(7627);
    piot.openRadioSocket(0, 7627, 0, 0, 0, new Uint8Array(32));
    piot.openRadioSocket(1, 7625, 0, 0, 0, new Uint8Array(32));
    piot.openRadioSocket(1, 7624, 0, 0, 0, new Uint8Array(32));
    //piot.closeRadioSocket(7627);
}
