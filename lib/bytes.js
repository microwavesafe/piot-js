// NOTE: view.set functions will throw RangeError if try to
// read or assign out of bounds of the buffer

function setInt8(buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setInt8(offset, value, true);
}

function setUint8(buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setUint8(offset, value, true);
}

function setInt16(buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setInt16(offset, value, true);
}

function setUint16(buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setUint16(offset, value, true);
}

function setInt32(buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setInt32(offset, value, true);
}

function setUint32(buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setUint32(offset, value, true);
}

function setFloat32 (buffer, offset, value) {
    let view = new DataView(buffer.buffer);
    return view.setFloat32(offset, value, true);
}

function getInt8 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getInt8(offset, true);
}

function getUint8 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getUint8(offset, true);
}

function getInt16 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getInt16(offset, true);
}

function getUint16 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getUint16(offset, true);
}

function getInt32 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getInt32(offset, true);
}

function getUint32 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getUint32(offset, true);
}

function getFloat32 (buffer, offset) {
    let view = new DataView(buffer.buffer);
    return view.getFloat32(offset, true);
}

function isIterable(obj) {
    // checks for null and undefined
    if (obj == null) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

function bufferCopy(buffer1, offset1, buffer2, offset2, length) {
    for (let i=offset1; i<offset1+length; i++) {
        buffer1[i] = buffer2[offset2++];
    }
}

module.exports = {
    setInt8,
    setUint8,
    setInt16,
    setUint16,
    setInt32,
    setUint32,
    setFloat32,
    getInt8,
    getUint8,
    getInt16,
    getUint16,
    getInt32,
    getUint32,
    getFloat32,
    isIterable,
    bufferCopy,
};
