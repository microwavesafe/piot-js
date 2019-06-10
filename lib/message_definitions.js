const MessTypes = require ('./message_types');

/*
 * To convert between PiOT binary messages and human readable topics
 * they must have a definition here.
 *
 * Topic ID is 8 bytes, this is split into three sections
 * bytes <0:1> topic number
 * bytes <2:3> device type
 * bytes <4:7> client ID of topic creator
 *
 * NOTE:
 * device type ID AND device type name MUST be unique across all devices
 * topic ID AND topic name MUST be unique per device
 * this is so topics can be converted from PiOT binary to JS object and back again
 *
 * There are two types of topic, basic and split.
 * Basic will convert data to a single value and back again.
 * Offset is used when the topics property is an array of message definitions. The value
 * will be split into bytes depending on the type size. A publish from the PiOT network
 * will update all topics. Publishing to the PiOT network can take advantage of the
 * partial write flag to only update the correct bytes of the split command.
 *
 * Split commands are important as each message takes up fixed resources in the PiOT hat.
 * So devices should be optimised to use as few as possible. However this makes interaction
 * with the user and with MQTT complicated. This library is designed to make that conversion
 * simple and easy to use.
 *
 * For split messages, an offset property can be set, otherwise 0 is assumed. By using
 * the same offset you can create multiple topics from the same data.
 *
 * readOnly property is not enforced in this library, it is up to the application code
 * to prevent writing to this message topic. The PiOT broker has no concept of read only.
 */


module.exports = Object.freeze({

    0x0001: {
        typeName: "node",
        topicNumbers: {
            0x0001: {
                topics: [
                    {
                        name: "type", type: MessTypes.UINT16, offset: 0, readOnly: true,
                        description: "read only value to identify personality"
                    },
                    {
                        name: "version", type: MessTypes.UINT16, offset: 2, readOnly: true,
                        description: "read only version number of firmware"
                    },
                    {
                        name: "awake_interval", type: MessTypes.UINT32, offset: 4,
                        description: "number of seconds to sleep, < 10 seconds will keep node awake permanently, 1 to 86400 seconds"
                    },
/*
                    {
                        name: "transmit_power", type: MessTypes.UINT8, offset: 8,
                        description: "transmit power 1 to 5 dBm"
                    },
 */
                ],
            },
            0x0002: {
                topics: [
                    {
                        name: "pin_mode", type: MessTypes.UINT8, offset: 0,
                        description: "set to 0 for Hat GPIO mirror mode, 1 for advanced mode"
                    },
                    {
                        name: "pin_direction", type: MessTypes.UINT32, offset: 1,
                        description: "bit map of GPIO, set to 1 for output 0 for input"
                    },
                    {
                        name: "pin_inputs", type: MessTypes.UINT32, offset: 5, readOnly: true,
                        description: "read only GPIO inputs in advanced mode"
                    },
                    {
                        name: "pin_outputs", type: MessTypes.UINT32, offset: 9,
                        description: "read or write GPIO outputs in advanced mode"
                    },
                ],
            },
            0x0003: {
                topics: [
                    {
                        name: "pulse_mode", type: MessTypes.UINT8, offset: 0,
                        description: "set to 1 for pulse high, 2 to pulse low, 0 for no pulse"
                    },
                    {
                        name: "pulse_length", type: MessTypes.UINT16, offset: 1,
                        description: "length of pulse in mS, 1mS to 1000mS, node is powered up for duration of pulse"
                    },
                    {
                        name: "pulse_pins", type: MessTypes.UINT32, offset: 3,
                        description: "bit map of GPIO to use in pulse, set to 1 to use pin, 0 to ignore"
                    },
                ],
            },
        }
    },
    0x0002: {
        typeName: "hat",
        topicNumbers: {
            0x0001: {
                // when a topic is broken down into an array
                // message from PiOT network is split into values according to sizes in each entry
                // message to PiOT network sets first byte as index of topic, then data as set in type
                topics: [
                    {
                        name: "type", type: MessTypes.UINT16,  offset: 0, readOnly: true,
                        description: "read only value to identify personality"
                    },
                    {
                        name: "version", type: MessTypes.UINT16, offset: 2, readOnly: true,
                        description: "read only version number of firmware"
                    },
                ],
            },
            0x0002: {
                topics: [
                    {
                        name: "gpio", type: MessTypes.UINT32, readOnly: true,
                        description: "read only decimal representation of Rpi GPIO"
                    },
                    {
                        name: "gpio_bits", type: MessTypes.BITMAP32, readOnly: true,
                        description: "read only string bit map of Rpi GPIO"
                    }
                ]
            },
        }
    },
    0x0003: {
        typeName: "buttons1",
        topicNumbers: {
            0x0001: {
                topics: [
                    {
                        name: "type", type: MessTypes.UINT16,  offset: 0, readOnly: true,
                        description: "read only value to identify personality"
                    },
                    {
                        name: "version", type: MessTypes.UINT16, offset: 2, readOnly: true,
                        description: "read only version number of firmware"
                    }
                ],
            },
            0x0002: {
                topics: [
                    {
                        name: "all", type: MessTypes.UINT8, readOnly: true,
                        description: "decimal representation of all 4 buttons"
                    },
                    {
                        name: "1", type: MessTypes.BIT0, readOnly: true,
                        description: "button 1 pressed"
                    },
                    {
                        name: "2", type: MessTypes.BIT1, readOnly: true,
                        description: "button 2 pressed"
                    },
                    {
                        name: "3", type: MessTypes.BIT2, readOnly: true,
                        description: "button 3 pressed"
                    },
                    {
                        name: "4", type: MessTypes.BIT3, readOnly: true,
                        description: "button 4 pressed"
                    }
                ]
            },
        }
    },
    // RESERVED
    0xFFFF: {
        typeName: "system",
        topicNumbers: {
            0x0001: {
                name: "start", readOnly: true,
                description: "sent by hat on power up"
            },
        },
    },
})
