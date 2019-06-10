const MessDefs = require ('./message_definitions');
const MessTypes = require ('./message_types');
const Bytes = require ('./bytes');

/*
interface Device {
    address: number,
    addressHex: string,
    type: number,
    typeName: string,
};

interface PiotMessage {
    topic: Uint8Array,
    number: number,
    length: number,
    data: Uint8Array,
};

interface Message {
    name: string,
    topic: string,
    length: number,
    offset: number,
    value: any,
    split: boolean,
    readOnly: boolean,
    description: string,
};
*/

class MessageConversion {
    // These functions take the input and create the internal state for later conversion

    convertFromPiotMessageBytes(buffer, offset) {
        this._resetInternalState();

        this.piotMessage.topic = buffer.slice(offset, 8 + offset);
        this.piotMessage.number = Bytes.getUint16(buffer, offset);
        this.piotMessage.length = buffer[8 + offset];

        if (buffer.length >= (9 + this.piotMessage.length)) {
            this.piotMessage.data = buffer.slice(9 + offset, 9 + offset + this.piotMessage.length);
        }

        this._convertFromPiot();
    }

    convertFromPiotMessage(topic, data) {
        this._resetInternalState();

        this.piotMessage.topic = topic;
        this.piotMessage.number = Bytes.getUint16(this.piotMessage.topic, 0);
        this.piotMessage.data = new Uint8Array(Buffer.from(data));
        this.piotMessage.length = this.piotMessage.data.length;

        this._convertFromPiot();
    }

    convertDataFromPiot(data) {
        // this relies on previous call to another setup function to set internal state
        if (this.hasOwnProperty('converted') && this.converted === true) {
            this.piotMessage.length = data.length;
            this.piotMessage.data = data;
            this._convertDataFromPiot();
        }
    }

    convertFromMessage(path, value) {
        this._resetInternalState();

        if (typeof path !== 'string') {
            return;
        }

        let pathLevels = path.split('/');

        if (pathLevels.length < 3) {
            // this is an error
            return;
        }
        // get rid of any preceding path levels
        else if (pathLevels.length >= 4) {
            pathLevels.splice(0, pathLevels.length - 3);
        }

        this.device.address = parseInt(pathLevels[1], 16);
        this.device.addressHex = pathLevels[1];
        this.device.typeName = pathLevels[0];

        this.messages[0].topic = pathLevels.join('/');
        this.messages[0].name = pathLevels[2];
        this.messages[0].value = value;

        this._convertToPiot();
    }

    convertToPiotMessage(offset) {
        let buffer = new Uint8Array(1 + offset + this.piotMessage.topic.length + this.piotMessage.data.length);
        // topic
        Bytes.bufferCopy(buffer, offset, this.piotMessage.topic, 0, this.piotMessage.topic.length);
        // length
        buffer[offset + 8] = this.piotMessage.length;
        Bytes.bufferCopy(buffer, offset + 9, this.piotMessage.data, 0, this.piotMessage.data.length);
        return buffer;
    }

    convertToMessages() {
        if (!this.hasOwnProperty('converted') || this.converted === false) {
            return [];
        }

        let messages = [];
        this.messages.forEach((message) => {
            messages.push({
                topic: message.topic,
                value: message.value,
                readOnly: message.readOnly
            })
        });

        return messages;
    }

    getDevice() {
        return this.device;
    }

    getMessages() {
        return this.messages;
    }

    getPiotMessage() {
        return this.piotMessage;
    }

    hasConverted() {
        if (this.hasOwnProperty('converted')) {
            return this.converted;
        }
        return false;
    }

    _resetInternalState() {
        this.device = {
            address: 0,
            addressHex: '',
            type: 0,
            typeName: '',
        };

        this.piotMessage = {
            topic: undefined,
            number: 0,
            length: 0,
            data: undefined,
        }

        this.messages = [{
            name: '',
            topic: '',
            offset: 0,
            length: 0,
            value: undefined,
            split: false,
            readOnly: false,
            description: '',
        }];

        this.converted = false;
    }

    _hexString(value, length) {
        return ('00000000' + value.toString(16).toUpperCase()).slice(-length);
    }

    _getMessageSize(messDefs) {
        if (messDefs.type === MessTypes.NULL) {
            return 0;
        }
        else if (messDefs.type === MessTypes.UINT8 || messDefs.type === MessTypes.INT8
        || messDefs.type === MessTypes.BITMAP8) {
            return 1;
        }
        else if (messDefs.type === MessTypes.UINT16 || messDefs.type === MessTypes.INT16
        || messDefs.type === MessTypes.BITMAP16) {
            return 2;
        }
        else if (messDefs.type === MessTypes.UINT32 || messDefs.type === MessTypes.INT32
        || messDefs.type === MessTypes.FLOAT32 || messDefs.type === MessTypes.BITMAP32) {
            return 4;
        }
        else if (messDefs.type >= MessTypes.BIT0 && messDefs.type <= MessTypes.BIT7) {
            return 1;
        }
        else if (messDefs.type === MessTypes.CUSTOM) {
            return messDefs.size;
        }
    }

    _convertBytes(messDefs, data, offset) {
        if (messDefs.type === MessTypes.NULL) return 0;
        if (messDefs.type === MessTypes.CUSTOM) return message.convertBytes(data, offset);
        if (messDefs.type === MessTypes.BITMAP8) return Bytes.getUint8(data, offset).toString(2).padStart(8, '0');
        if (messDefs.type === MessTypes.BITMAP16) return Bytes.getUint16(data, offset).toString(2).padStart(16, '0');
        if (messDefs.type === MessTypes.BITMAP32) return Bytes.getUint32(data, offset).toString(2).padStart(32, '0');

        if (messDefs.type >= MessTypes.BIT0 && messDefs.type <= MessTypes.BIT7) {
            return ((Bytes.getUint8(data, offset) >> (messDefs.type - MessTypes.BIT0)) & 1)
        }

        let value;
        if (messDefs.type === MessTypes.UINT8) value = Bytes.getUint8(data, offset);
        else if (messDefs.type === MessTypes.INT8) value = Bytes.getInt8(data, offset);
        else if (messDefs.type === MessTypes.UINT16) value = Bytes.getInt8(data, offset);
        else if (messDefs.type === MessTypes.INT16) value = Bytes.getInt16(data, offset);
        else if (messDefs.type === MessTypes.UINT32) value = Bytes.getUint32(data, offset);
        else if (messDefs.type === MessTypes.INT32) value = Bytes.getInt32(data, offset);
        else if (messDefs.type === MessTypes.FLOAT32) value = Bytes.getFloat32(data, offset);

        if (messDefs.hasOwnProperty('impliedDecimal')) {
            return value * Math.pow(10, messDefs.impliedDecimal);
        }
        return value;
    }

    _convertValue(messDefs, value, data, offset) {

        if (messDefs.type === MessTypes.NULL) return true;
        if (messDefs.type === MessTypes.CUSTOM) return messDefs.convertValue(value, data, offset);

        if (messDefs.type >= MessTypes.BITMAP8 && messDefs.type <= MessTypes.BITMAP32) {
            value = parseInt(value, 2);
            if (messDefs.type === MessTypes.BITMAP8) Bytes.setUint8(data, offset, value);
            else if (messDefs.type === MessTypes.BITMAP16) Bytes.setUint16(data, offset, value);
            else if (messDefs.type === MessTypes.BITMAP32) Bytes.setUint32(data, offset, value);
            return true;
        }

        if (messDefs.type >= MessTypes.BIT0 && messDefs.type <= MessTypes.BIT7) {
            // there is no way to set a bit as we don't have access to the byte value
            // so we would end up clearing the whole byte to set a bit
            return false;
        }

        if (messDefs.type >= MessTypes.UINT8 && messDefs.type <= MessTypes.FLOAT32) {
            value = parseInt(value);

            if (messDefs.hasOwnProperty('impliedDecimal')) {
                value /= Math.pow(10, messDefs.impliedDecimal);
            }

            if (messDefs.type === MessTypes.UINT8) Bytes.setUint8(data, offset, value);
            else if (messDefs.type === MessTypes.INT8) Bytes.setInt8(data, offset, value);
            else if (messDefs.type === MessTypes.UINT16) Bytes.setUint16(data, offset, value);
            else if (messDefs.type === MessTypes.INT16) Bytes.setInt16(data, offset, value);
            else if (messDefs.type === MessTypes.UINT32) Bytes.setUint32(data, offset, value);
            else if (messDefs.type === MessTypes.INT32) Bytes.setInt32(data, offset, value);
            else if (messDefs.type === MessTypes.FLOAT32) Bytes.setFloat32(data, offset, value);
            return true;
        }

        return false;
    }

    _setPiotTopic() {
        this.piotMessage.topic = new Uint8Array(8);
        Bytes.setUint16(this.piotMessage.topic, 0, this.piotMessage.number);
        Bytes.setUint16(this.piotMessage.topic, 2, this.device.type);
        Bytes.setUint32(this.piotMessage.topic, 4, this.device.address);
    }

    _convertToPiot () {

        let deviceDefinition = undefined;
        let messageDefinition = undefined;

        this.device.type = parseInt(Object.keys(MessDefs).find((key) => {
            return MessDefs[key].typeName === this.device.typeName;
        }));

        // see if we can convert type name to type number directly
        if (Number.isNaN(this.device.type)) {
            this.device.type = parseInt(this.device.typeName, 16);
            if (Number.isNaN(this.device.type)) {
                this.device.type = 0;
            }
        }

        // we can find a reference to the device, look for the topic
        if (MessDefs.hasOwnProperty(this.device.type)) {
            deviceDefinition = MessDefs[this.device.type];

            // search for the name
            for (this.piotMessage.number of Object.keys(deviceDefinition.topicNumbers)) {
                this.messages[0].offset = 0;

                const tempMessageDefinition = deviceDefinition.topicNumbers[this.piotMessage.number];
                // do we have an array of topics
                if (tempMessageDefinition.hasOwnProperty('topics')) {
                    for (const splitMessageDefinition of tempMessageDefinition.topics) {
                        if (splitMessageDefinition.name === this.messages[0].name) {
                            messageDefinition = splitMessageDefinition;

                            if (splitMessageDefinition.hasOwnProperty('offset')) {
                                this.messages[0].offset = splitMessageDefinition.offset;
                            }
                            else {
                                this.messages[0].offset = 0;
                            }
                            this.messages[0].split = true;
                            break;
                        }
                    }
                }
                else if (tempMessageDefinition.name === this.messages[0].name) {
                    messageDefinition = tempMessageDefinition;
                }

                // if we've found it break
                if (messageDefinition !== undefined) {
                    this.messages[0].length = this._getMessageSize(messageDefinition);
                    this.messages[0].readOnly = messageDefinition.readOnly ? true : false
                    break;
                }
            }
        }

        if (messageDefinition === undefined) {
            this.piotMessage.number = parseInt(this.messages[0].name, 16);

            if (this.messages[0].hasOwnProperty('value') && Bytes.isIterable(this.messages[0].value)) {
                // if value isn't some kind of array then I don't know how to convert it
                this.messages[0].length = this.messages[0].value.length;
                this.piotMessage.data = new Uint8Array(this.messages[0].value);
            }
            else {
                this.messages[0].length = 0;
            }
            this._setPiotTopic();
            this.converted = true;
            return;
        }

        if (this.messages[0].split > 0) {
            // encode offset as first byte of message payload
            this.piotMessage.data = new Uint8Array(this.messages[0].length + 1);
            this.piotMessage.data[0] = this.messages[0].offset;
            this._convertValue(messageDefinition, this.messages[0].value, this.piotMessage.data, 1);
        }
        else {
            this.piotMessage.data = new Uint8Array(this.messages[0].length);
            this._convertValue(messageDefinition, this.messages[0].value, this.piotMessage.data, 0);
        }

        this.piotMessage.length = this.messages[0].length;
        this._setPiotTopic();
        this.converted = true;
    }

    _convertDataFromPiot () {
        if (!MessDefs.hasOwnProperty(this.device.type)
        || !MessDefs[this.device.type].topicNumbers.hasOwnProperty(this.piotMessage.number)) {
            this.messages[0].value = this.piotMessage.data;
            return;
        }

        let messageDefinitions = [];
        let split = false;

        const tempMessageDefinition = MessDefs[this.device.type].topicNumbers[this.piotMessage.number];
        if (tempMessageDefinition.hasOwnProperty('topics')) {
            messageDefinitions = tempMessageDefinition.topics;
            split = true;
        }
        else {
            messageDefinitions.push(tempMessageDefinition);
        }

        this.messages = [];

        for(const messageDefinition of messageDefinitions) {
            const length = this._getMessageSize(messageDefinition);
            let value;
            let offset = 0;

            if (messageDefinition.hasOwnProperty('offset')) {
                offset = messageDefinition.offset;
            }

            // we want to create all topics, even if there isn't data
            if (this.piotMessage.data instanceof Uint8Array && (this.piotMessage.data.length - offset) >= length) {
                try {
                    value = this._convertBytes(messageDefinition, this.piotMessage.data, offset);
                } catch (err) {
                    value = this.piotMessage.data.slice(offset, length);
                }
            }

            this.messages.push({
                topic: this.device.typeName + "/" + this.device.addressHex + "/" + messageDefinition.name,
                name: messageDefinition.name,
                length: length,
                value: value,
                offset: offset,
                split: split,
                readOnly: messageDefinition.readOnly ? true : false,
                description: messageDefinition.description
            });
        };
    }

    _convertFromPiot () {

        let deviceEntry = true;
        this.device.address = Bytes.getUint32(this.piotMessage.topic, 4);
        this.device.addressHex = this._hexString(this.device.address, 8);
        this.device.type = Bytes.getUint16(this.piotMessage.topic, 2);

        // do we have an entry for device type and topic number
        if (!MessDefs.hasOwnProperty(this.device.type)) {
            deviceEntry = false;
            this.device.typeName = this._hexString(this.device.type, 4);
        }
        else {
            this.device.typeName = MessDefs[this.device.type].typeName;
        }

        if (!deviceEntry || !MessDefs[this.device.type].topicNumbers.hasOwnProperty(this.piotMessage.number)) {
            let name = this._hexString(this.piotMessage.number, 4);
            this.messages = [{
                topic: this.device.typeName + "/" + this.device.addressHex + "/" + name,
                name: name,
                offset: 0,
                length: this.piotMessage.length,
                value: this.piotMessage.data,
                split: false,
                readOnly: false,
                description: ''
            }];
            return;
        }

        this._convertDataFromPiot();
        this.converted = true;
    }
}

module.exports = MessageConversion;
