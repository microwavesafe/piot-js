/*
 * Reply to write command <0:1> command number
 * Reply to read command <0:1> command number, <2:x> data
 */

module.exports = Object.freeze({

    // Common to add PiOT Devices

    /* read
     * <0:1> device type
     * <2:3> version
     * <4:x> type specific */
    TYPE_VERSION: 0xFFFF,

    // Common to all remote (node) devices

    /* write
     * <0> pin number
     * <1> state */
    SET_PIN: 1,

    /* write
     * <0> pin number */
    TOGGLE_PIN: 2,

    /* write
     * <0> pin number
     * <1:2> pulse length in mS */
    PULSE_PIN: 3,

    /* read, write
     * <0> power, 5 to 20 dBm */
    TRANSMIT_POWER: 0xFFFD,

    /* read, write
     * <0:3> awake interval in mS, minimum 5 seconds */
    AWAKE_INTERVAL: 0xFFFE,

    // PiOT Basic Commands

    SET_OUTPUTS: 0x0010,

    // PiOT Basic Hat Commands

    /* read, list nodes, output is in binary
     * <0:3> - node address
     * <4:5> - device type
     * <6:7> - version
     * <8:11> - awake interval */
    LIST_NODES: 0x0001,

    /* write
     * <0:3> node address to delete */
    DELETE_NODE: 0x0002,
})
