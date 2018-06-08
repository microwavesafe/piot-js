
module.exports = Object.freeze({
    // Defines for encryption field when opening socket
    // chacha20 encryption, with Poly1305 authentication 12 byte nonce
    CHACHA20_POLY1305: 0x01,
    // chacha20 encryption, with Poly1305 authentication 6 byte nonce
    // nonce is padded with 32bit address at each end, so nonce is guaranteed unique between nodes
    CHACHA20_POLY1305_OPT1: 0x21,
})