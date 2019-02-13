function setInt16(buffer, offset, value) {
    if ((buffer.length - offset) >= 2) {
        buffer[offset] = value & 0xFF;
        buffer[offset + 1] = (value >> 8) & 0xFF;
        return;
    }

    console.error("bytes::setInt16 offset out of bounds");
}

function setInt32(buffer, offset, value) {
    if ((buffer.length - offset) >= 4) {
        buffer[offset] = value & 0xFF;
        buffer[offset + 1] = (value >> 8) & 0xFF;
        buffer[offset + 2] = (value >> 16) & 0xFF;
        buffer[offset + 3] = (value >> 24) & 0xFF;
        return;
    }

    console.error("setInt32 offset out of bounds");
}

function getInt16 (buffer, offset) {
    if ((buffer.length - offset) >= 2) {
        return (buffer[offset + 1] << 8) + buffer[offset];
    }
    return 0;
}

function getInt32 (buffer, offset) {
    if ((buffer.length - offset) >= 4) {
        // in javascript bit shifts are always performed on signed 32bit ints (even though storage is 64bit int!)
        // solution is to use *256 instead of bit shift
        let value = 0;
        for ( let i = 3; i >= 0; i--) {
            value = (value * 256) + buffer[offset + i];
        }
        return value;
    }
    return 0;
}

module.exports = {
    setInt16,
    setInt32,
    getInt16,
    getInt32,
};
