const CRC16_DEFAULT_PRESET  = 0xFFFF;
const CRC16_DEFAULT_RESIDUE = 0x1D0F;

class CRC16 {
    constructor (preset, residue) {
        preset ? this.preset = preset : this.preset = CRC16_DEFAULT_PRESET;
        residue ? this.residue = residue : this.residue = CRC16_DEFAULT_RESIDUE;

        this.initialise();
    }

    initialise () {
        this.crc = this.preset;
    };

    test () {
        return (this.crc === this.residue);
    };

    calculate (buffer, length) {
        if (!(buffer instanceof Uint8Array)) {
            console.error("CRC16::calculate incorrect param type, should be Uint8Array");
            return;
        }

        let bufferLength = buffer.byteLength;

        if (typeof length === 'number') {
            bufferLength = length;
        }

        this.initialise();

        for (let i=0; i<bufferLength; i++) {
            this.update(buffer[i]);
        }

        return this.crc;
    };

    update (data) {
        let x;

        x = ((this.crc >> 8) ^ data) & 0xFF;
        x ^= x >>> 4;

        this.crc = ((this.crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    };

    getCrc () {
        return this.crc;
    };
}

module.exports = CRC16;