/**
 * Returns the current millisecond
 * @returns {number} The current millisecond
 */
function getCurrentMs() {
    return new Date().getTime()
}

/**
 * Sleeps for the specified number of seconds and then resolves
 * @param {number} ms The number of milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(function(res) {
        setTimeout(res, ms)
    })
}

/* Export functions */
module.exports.getCurrentMs = getCurrentMs
module.exports.sleep = sleep