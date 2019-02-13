class PiotError extends Error {
    constructor(code, ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PiotError);
        }

        this.code = code;
    }
}

module.exports = PiotError;
