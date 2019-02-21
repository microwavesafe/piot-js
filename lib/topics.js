module.exports = Object.freeze({

    // Common to all remote (node) devices

    /* read, write
     * <0:3> awake interval in mS, minimum 5 seconds */
    AWAKE_INTERVAL: 0x101,

    /* read, write
     * <0> power, 5 to 20 dBm */
    TRANSMIT_POWER: 0x102,
})
