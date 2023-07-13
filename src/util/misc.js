/**
 * Sleeps for the specified number of seconds and then resolves
 * @param {number} ms The number of milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(res => setTimeout(res, ms))
}

/* Export functions */
module.exports.sleep = sleep
