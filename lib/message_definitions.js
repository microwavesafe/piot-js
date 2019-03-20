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
 * There are two types of topic, basic and command mapped.
 * Basic will convert data to a single value and back again.
 * Command mapped will extract a section of a topic to read the topic, and send the index
 * followed by the value to write the topic.
 *
 * Any topic numbers which is described with an array of topic names is treated as a command
 * mapped topic.
 *
 */


module.exports = Object.freeze({

    0x0001: {
        typeName: "node",
        topicNumbers: {
            0x0001: {
                topics: [
                    { name: "type", type: MessTypes.UINT16 },
                    { name: "version", type: MessTypes.UINT16 },
                ],
            },
            0x0002: {
                // when a topic is broken down into an array
                // message from PiOT network is split into values according to sizes in each entry
                // message to PiOT network sets first byte as index of topic, then data as set in type
                topics: [
                    /* awake interval in seconds, minimum 5 seconds, max 1 day (86400) */
                    { name: "awake_interval", type: MessTypes.UINT32 },
                    /* transmit power, 5 to 20 dBm */
                    { name: "transmit_power", type: MessTypes.UINT32 },
                ],
            },

            0x0003: { name: "gpio_read", type: MessTypes.UINT32 },
            /* read, write - node in advanced mode
            * bitmap of GPIO state */
            0x0004: {
                topics: [
                    { name: "gpio_write", type: MessTypes.UINT32 },
                    { name: "gpio_set", type: MessTypes.UINT32 },
                    { name: "gpio_clear", type: MessTypes.UINT32 },
                    { name: "gpio_toggle", type: MessTypes.UINT32 },
                    { name: "gpio_pulse_high", type: MessTypes.UINT32 }, // CUSTOM need pulse length
                    { name: "gpio_pulse_low", type: MessTypes.UINT32 },
                    { name: "gpio_mirror", type: MessTypes.UINT8 },
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
                    { name: "type", type: MessTypes.UINT16 },
                    { name: "version", type: MessTypes.UINT16 },
                ],
            },
            0x0002: { name: "gpio", type: MessTypes.BITMAP32 },
        }
    },
})
