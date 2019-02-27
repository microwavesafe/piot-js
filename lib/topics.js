const bytes = require ('./bytes');

const RAW = 0;
const UINT8 = 1;
const INT8 = 2;
const UINT16 = 3;
const INT16 = 4;
const UINT32 = 5;
const INT32 = 6;
const FLOAT32 = 7;
const BITMAP8 = 8;
const BITMAP16 = 9;
const BITMAP32 = 10;

module.exports = Object.freeze({
    /* read, write
     * <0:3> awake interval in S, minimum 5 seconds, max 1 day (86400) */
    awake_interval: {
        id: 0x10001,
        type: UINT32,
        size: 4,
        array: false,
        impliedDecimal: 0,
    },

    /* read, write
     * <0> power, 5 to 20 dBm */
    transmit_power: {
        id: 0x10002,
        type: UINT8,
        size: 1,
        array: false,
        impliedDecimal: 0,
    },

    /* read
     * PiOT hat status of RPi GPIO bit map
     * <0:3> bit map of GPIO state */
    gpio: {
        id: 0x20001,
        type: BITMAP32,
        size: 4,
        array: false,
        impliedDecimal: 0,
    },

    exampleArray: {
        id: 0xFFFFFFFF,
        type: UINT8,
        size: 1,
        array: true,
        impliedDecimal: 0
    },

    getTopicName (id) {
        return Object.keys(this).find((key) => {
            return this[key].id === id;
        });
    },

    getTopicId (name) {
        return this[name].id;
    },

    convertBytes(type, topicData, offset, impliedDecimal) {
        let value;
        switch (type) {
            case UINT8:
                value = bytes.getUint8(topicData, offset);
                break;
            case INT8:
                value = bytes.getUint8(topicData, offset);
                break;
            case UINT16:
                value = bytes.getUint16(topicData, offset);
                break;
            case INT16:
                value = bytes.getInt16(topicData, offset);
                break;
            case UINT32:
                value = bytes.getUint32(topicData, offset);
                break;
            case INT32:
                value = bytes.getInt32(topicData, offset);
                break;
            case FLOAT32:
                value = bytes.getFloat32(topicData, offset);
                break;
            case BITMAP8:
                value = bytes.getUint8(topicData, offset);
                return value.toString(2).padStart(8, '0');
            case BITMAP16:
                value = bytes.getUint16(topicData, offset);
                return value.toString(2).padStart(16, '0');
            case BITMAP32:
                value = bytes.getUint32(topicData, offset);
                return value.toString(2).padStart(32, '0');
        }

        if (impliedDecimal) {
            return value / impliedDecimal;
        }
        return value;
    },

    convert(topicData, name) {
        let type = this[name].type
        let typeSize = this[name].size;

        // nothing to do for type binary
        if (type === RAW) {
            return topicData;
        }

        if (topicData.length < typeSize) {
            throw RangeError("topicData length smaller than single type size");
        }

        let convertedData;

        if (this[name].array) {
            let items = topicData.length / typeSize;
            convertedData = [];

            for (let i=0; i<items; i++) {
                convertedData[i] = this.convertBytes(type, topicData, i * typeSize, this[name].impliedDecimal);
            }
        }
        else {
            convertedData = this.convertBytes(type, topicData, 0, this[name].impliedDecimal);
        }

        return convertedData;
    },

    convertToBinary (name, topicData) {
        return this.convert(topicData, name);
    },

    convertToJS (id, topicData) {
        let name = this.getTopicName (id);
        return this.convertToBinary (name, topicData);
    },
})
