/*
 * Topic Numbers are the lower 4 bytes of a PiOT Topic
 * the upper 4 bytes are the client ID (network address) of the topic creator
 *
 * Object is split into device type, then topics
 *
 * NOTE:
 * device type ID AND device type name MUST be unique across all devices
 * topic ID AND topic name MUST be unique per device
 *
 * this is so topics can be converted from PiOT binary to JS object and back again
 */

const bytes = require ('./bytes');
const commands = require ('./commands');

const NULL = 0;
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
const CUSTOM = 0xFFFF;

module.exports = Object.freeze({
    0x0001: {
        typeName: "node",
        topicNumbers: {
            0x0001: {
                topics: [
                    { name:"type", type:UINT16 },
                    { name:"version", type:UINT16 },
                ],
            },
            0x0002: {
                // when a topic is broken down into an array
                // message from PiOT network is split into values according to sizes in each entry
                // message to PiOT network sets first byte as index of topic, then data as set in type
                topics: [
                    /* awake interval in seconds, minimum 5 seconds, max 1 day (86400) */
                    { name:"awake_interval", type:UINT32 },
                    /* transmit power, 5 to 20 dBm */
                    { name:"transmit_power", type:UINT32 },
                ],
            },

            0x0003: { name:"gpio_read", type:UINT32 },
            /* read, write - node in advanced mode
            * bitmap of GPIO state */
            0x0004: {
                topics: [
                    { name:"gpio_write", type:UINT32 },
                    { name:"gpio_set", type:UINT32 },
                    { name:"gpio_clear", type:UINT32 },
                    { name:"gpio_toggle", type:UINT32 },
                    { name:"gpio_pulse_high", type:UINT32 }, // CUSTOM need pulse length
                    { name:"gpio_pulse_low", type:UINT32 },
                    { name:"gpio_mirror", type:UINT8 },
                ]
            },
        }
    },

    0x0002: {
        typeName: "hat",
        topicNumbers: {
            /* read - hat status of RPi GPIO
             * bit map of GPIO state */
            0x0001: {
                // when a topic is broken down into an array
                // message from PiOT network is split into values according to sizes in each entry
                // message to PiOT network sets first byte as index of topic, then data as set in type
                topics: [
                    { name: "type", type: UINT16 },
                    { name: "version", type: UINT16 },
                ],
            },
            0x0002: { name: "gpio", type: BITMAP32 },
        }
    },

    hexString(value, length) {
        return ('00000000' + value.toString(16).toUpperCase()).slice(-length);
    },

    typeSize(topic) {
        switch (topic.type) {
            case NULL:
                return 0;
            case UINT8:
            case INT8:
            case BITMAP8:
                return 1;
            case UINT16:
            case INT16:
            case BITMAP16:
                return 2;
            case UINT32:
            case INT32:
            case FLOAT32:
            case BITMAP32:
                return 4;
            case CUSTOM:
                return topic.size;
        }
    },

    convertBytes(topic, data, offset) {
        let value;
        switch (topic.type) {
            case NULL:
                value = 0;
                break;
            case UINT8:
                value = bytes.getUint8(data, offset);
                break;
            case INT8:
                value = bytes.getInt8(data, offset);
                break;
            case UINT16:
                value = bytes.getUint16(data, offset);
                break;
            case INT16:
                value = bytes.getInt16(data, offset);
                break;
            case UINT32:
                value = bytes.getUint32(data, offset);
                break;
            case INT32:
                value = bytes.getInt32(data, offset);
                break;
            case FLOAT32:
                value = bytes.getFloat32(data, offset);
                break;
            case BITMAP8:
                value = bytes.getUint8(data, offset);
                return value.toString(2).padStart(8, '0');
            case BITMAP16:
                value = bytes.getUint16(data, offset);
                return value.toString(2).padStart(16, '0');
            case BITMAP32:
                value = bytes.getUint32(data, offset);
                return value.toString(2).padStart(32, '0');
            case CUSTOM:
                return topic.ToJs(data, offset);
        }

        if (topic.hasOwnProperty('impliedDecimal')) {
            return value * Math.pow(10, topic.impliedDecimal);
        }
        return value;
    },

    applyDecimal(topic, value) {
        let adjustedValue = parseInt(value);
        if (topic.hasOwnProperty('impliedDecimal')) {
            adjustedValue /= Math.pow(10, topic.impliedDecimal);
        }
        return adjustedValue;
    },

    convertValue(topic, value, data, offset) {

        switch (topic.type) {
            case NULL:
                value = 0;
                return true;
            case UINT8:
                bytes.setUint8(data, offset, this.applyDecimal(topic, value));
                return true;
            case INT8:
                bytes.setInt8(data, offset, this.applyDecimal(topic, value));
                return true;
            case UINT16:
                bytes.setUint16(data, offset, this.applyDecimal(topic, value));
                return true;
            case INT16:
                bytes.setInt16(data, offset, this.applyDecimal(topic, value));
                return true;
            case UINT32:
                bytes.setUint32(data, offset, this.applyDecimal(topic, value));
                return true;
            case INT32:
                bytes.setInt32(data, offset, this.applyDecimal(topic, value));
                return true;
            case FLOAT32:
                bytes.setFloat32(data, offset, this.applyDecimal(topic, value));
                return true;
            case BITMAP8:
                value = parseInt(value, 2);
                bytes.setUint8(data, offset, value);
                return true;
            case BITMAP16:
                value = parseInt(value, 2);
                bytes.setUint16(data, offset, value);
                return true;
            case BITMAP32:
                value = parseInt(value, 2);
                bytes.setUint32(data, offset, value);
                return true;
            case CUSTOM:
                topic.toBinary(data, offset);
                return true;
        }

        return false;
    },

    setRawId(publish) {
        publish.raw.id = new Uint8Array(8);
        bytes.setUint16(publish.raw.id, 0, publish.topics.number);
        bytes.setUint16(publish.raw.id, 2, publish.device.type);
        bytes.setUint32(publish.raw.id, 4, publish.device.address);
    },

    encodePublishCommand (publish) {
        let payload = new Uint8Array(publish.raw.data.length + publish.raw.id.length + 3);

        // command
        payload[0] = commands.PUBLISH;
        // flags
        payload[1] = publish.raw.flags;
        // id
        bytes.bufferCopy(payload, 2, publish.raw.id, 0, publish.raw.id.length);
        // length
        payload[10] = publish.topics.length;
        bytes.bufferCopy(payload, 11, publish.raw.data, 0, publish.topics.length);
        return payload;
    },

    convertToRaw (topicPath, value) {
        let topicParts = topicPath.split('/');

        if (topicParts.length < 4) {
            // this is an error
            return undefined;
        }

        let publish = {
            raw: {
                id: undefined,
                data: undefined,
                flags: 0,
            },
            device: {
                address: parseInt(topicParts[2], 16),
                addressHex: topicParts[2],
                type: undefined,
                typeName: topicParts[1],
            },
            topics: {
                number: 0,
                length: 0,
                topic: [{
                    name: topicParts[3],
                    length: 0,
                    data: value,
                }],
            },
        };

        let device = undefined;
        let topic = undefined;
        let topicIndex;

        publish.device.type = parseInt(Object.keys(this).find((key) => {
            return this[key].typeName === publish.device.typeName;
        }));

        // we can find a reference to the device, look for the topic name
        if (!Number.isNaN(publish.device.type)) {
            device = this[publish.device.type];

            // search for the name
            for (publish.topics.number of Object.keys(device.topicNumbers)) {
                topicIndex = -1;

                // do we have an array of topics
                if (device.topicNumbers[publish.topics.number].hasOwnProperty('topics')) {
                    topicIndex = 0;
                    for (const testTopic of device.topicNumbers[publish.topics.number].topics) {
                        if (testTopic.name === publish.topics.topic[0].name) {
                            topic = testTopic;
                            break;
                        }
                        topicIndex++;
                    }
                }
                else if (device.topicNumbers[publish.topics.number].name === publish.topics.topic[0].name) {
                    topic = device.topicNumbers[publish.topics.number];
                }

                // if we've found it break
                if (topic !== undefined) {
                    break;
                }
            }
        }

        if (topic === undefined) {
            // if value isn't some kind of array then I don't know how to convert it
            if (!bytes.isIterable(value)) {
                return undefined;
            }

            publish.topics.number = bytes.getUint16(publish.topics.topic[0].name);
            publish.topics.length = value.length;
            publish.topics.topic[0].length = value.length;
            publish.raw.data = new Uint8Array(value);
            this.setRawId(publish);
            return publish;
        }

        if (topicIndex > -1) {
            // encode index as first byte of topic payload
            publish.topics.topic[0].length = this.typeSize(topic) + 1;
            publish.raw.data = new Uint8Array(publish.topics.topic[0].length);
            publish.raw.data[0] = topicIndex;
            this.convertValue(topic, value, publish.raw.data, 1);
        }
        else {
            publish.topics.topic[0].length = this.typeSize(topic);
            publish.raw.data = new Uint8Array(publish.topics.topic[0].length);
            this.convertValue(topic, value, publish.raw.data, 0);
        }

        publish.topics.length = publish.topics.topic[0].length;
        this.setRawId(publish);

        return publish;
    },

    decodePublishCommand(payload, offset) {
        let publish = {
            raw: {
                id: payload.slice(2 + offset, 10 + offset),
                data: undefined,
                flags: payload[1 + offset],
            },
            device: {
                address: bytes.getUint32(payload, 6 + offset),
                addressHex: "",
                type: bytes.getUint16(payload, 4 + offset),
                typeName: ""
            },
            topics: {
                number: bytes.getUint16(payload, 2 + offset),
                length: payload[10 + offset],
                topic: [],
            },
        };

        publish.device.addressHex = this.hexString(publish.device.address, 8);
        publish.raw.data = payload.slice(11 + offset, 11 + offset + publish.topics.length);

        return publish;
    },

    convertToJS (publish) {

        let deviceEntry = true;
        // do we have an entry for device type and topic number
        if (!this.hasOwnProperty(publish.device.type)) {
            deviceEntry = false;
            publish.device.typeName = this.hexString(publish.device.type, 4);
        }
        else {
            publish.device.typeName = this[publish.device.type].typeName;
        }

        if (!deviceEntry || !this[publish.device.type].topicNumbers.hasOwnProperty(publish.topics.number)) {
            publish.topics.topic = [{
                name: this.hexString(publish.topics.number, 4),
                length: publish.raw.data.length,
                data: publish.raw.data,
            }];
            return publish;
        }

        let topics = [];
        const topic = this[publish.device.type].topicNumbers[publish.topics.number];
        if (topic.hasOwnProperty('topics')) {
            topics = topic.topics;
        }
        else {
            topics.push(topic);
        }

        let subOffset = 0;

        for(const topic of topics) {
            const length = this.typeSize(topic);

            let data;

            // we want to create all topics, even if there isn't data
            if ((publish.raw.data.length - subOffset) >= length) {
                try {
                    data = this.convertBytes(topic, publish.raw.data, subOffset);
                } catch (err) {
                    data = publish.raw.data.slice(subOffset, length);
                }
            }

            publish.topics.topic.push({
                name: topic.name,
                length: length,
                data: data,
            });
            subOffset += length;
        };

        return publish;
    },
})
