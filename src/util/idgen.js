/**
 * The last ID generated
 * @type {number}
 */
let lastId = 0

/**
 * Generates a new positive sequential integer ID.
 * Once the value exceeds Number.MAX_SAFE_INTEGER, it resets to 0.
 * @returns {number} The generated ID
 */
function genId() {
    const id = lastId++
    if(lastId > Number.MAX_SAFE_INTEGER)
        lastId = 0

    return id
}

/* Export functions */
module.exports.genId = genId