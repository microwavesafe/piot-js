/*
 * Reply to write command <0:1> command number
 * Reply to read command <0:1> command number, <2:x> data
 */

module.exports = Object.freeze({
    /* read
     * <0:1> device type
     * <2:3> version */
    TYPE_VERSION: 0xFFFF,

    /* read
     */
    LIST_NODES: 0x0001,

    /* write
     * <0:3> node address to delete */
    DELETE_NODE: 0x0002,
})
