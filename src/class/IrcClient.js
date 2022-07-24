const net = require('net')
const Ircd = require('../ircd')
const { IRCD_CAPS } = require('../constants')
const carrier = require('carrier');
const { getCurrentMs, sleep } = require('../util/misc')
const { genId } = require('../util/idgen')

/**
 * @typedef IrcUserInfo
 * @property {string} nick The user's nick
 * @property {string} username The user's username
 * @property {string} realname The user's real name
 * @since 1.0.0
 */

/**
 * @typedef IrcClientParsedLine
 * @property {string} raw The raw line
 * @property {string} name The command name (will always be uppercase)
 * @property {string|null} metadata The line metadata, or null if none
 * @property {string|null} content The line content, or null if none
 */

/**
 * @callback IrcClientDisconnectHandler
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientQuitHandler
 * @param {string|null} message The quit message, or null if there was none
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientLineHandler
 * @param {IrcClientParsedLine} line The parsed line
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientLoginAttemptHandler
 * @param {IrcUserInfo} userInfo The user info the client provided
 * @param {string} password The password the client is logged in with (can be null)
 * @param {() => Promise<void>} accept Function to be called signifying that the client's attempt has been accepted
 * @param {() => Promise<void>} deny Function to be called signifying that the client's attempt has been denied
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientSuccessfulLoginHandler
 * @param {IrcUserInfo} userInfo The user info the client provided
 * @param {string|null} password The password the client logged in with (or null if no password was provided)
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientFailedLoginHandler
 * @param {IrcUserInfo} userInfo The user info the client provided
 * @param {string|null} password The password the client logged in with (or null if no password was provided)
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientSocketErrorHandler
 * @param {Error} error The error that occurred
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientPingHandler
 * @param {string} data The data sent by the client to be repeated by the server
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientAuthTimeoutHandler
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * @callback IrcClientOnlineCheck
 * @param {string} nick The nick of the client the client is checking
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * IRC client object
 * @since 1.0.0
 */
class IrcClient {
    /**
     * The client's user info object (null if not authenticated)
     * @type {IrcUserInfo|null}
     * @readonly
     * @since 1.0.0
     */
    userInfo = null

    /**
     * Acknowledged client capabilities
     * @type {string[]}
     * @readonly
     * @since 1.0.0
     */
    capabilities = []

    /**
     * The IRCd this client is connected to
     * @type {Ircd}
     * @readonly
     * @since 1.0.0
     */
    ircd

    /**
     * The underlying network socket for this client
     * @type {net.Socket}
     * @readonly
     * @since 1.0.0
     */
    socket

    /**
     * The date of the last time the client pinged the server or vice-versa
     * @type {Date|null}
     */
    lastPingDate = null

    /**
     * Returns whether the client is authenticated
     * @returns {boolean}
     */
    get isAuthenticated() { return this.userInfo !== null }

    /**
     * Returns the client's nick or null if the client has not authenticated
     * @returns {string|null}
     */
    get nick() { return this.userInfo?.nick || null }

    /**
     * Returns the client's nick or an asterisk if the client has not authenticated
     * @returns {string|'*'}
     */
    get nickOrAsterisk() { return this.userInfo?.nick || '*' }

    /**
     * The user's current mode
     * @type {string}
     */
    #mode = ''

    /**
     * Returns the user's current mode
     * @returns {string}
     */
    get mode() { return this.#mode }

    /**
     * Disconnect handlers
     * @type {IrcClientDisconnectHandler[]}
     */
    #disconnectHandlers = []
    /**
     * Quit handlers
     * @type {IrcClientQuitHandler[]}
     */
    #quitHandlers = []
    /**
     * Line handlers
     * @type {IrcClientLineHandler[]}
     */
    #lineHandlers = []
    /**
     * Login attempt handlers
     * @type {IrcClientLoginAttemptHandler[]}
     */
    #loginAttemptHandlers = []
    /**
     * Successful login handlers
     * @type {IrcClientSuccessfulLoginHandler[]}
     */
    #successfulLoginHandlers = []
    /**
     * Failed login handlers
     * @type {IrcClientFailedLoginHandler[]}
     */
    #failedLoginHandlers = []
    /**
     * Socket error handlers
     * @type {IrcClientSocketErrorHandler[]}
     */
    #socketErrorHandlers = []
    /**
     * Ping handlers
     * @type {IrcClientPingHandler[]}
     */
    #pingHandlers = []
    /**
     * Auth timeout handlers
     * @type {IrcClientAuthTimeoutHandler[]}
     */
    #authTimeoutHandlers = []

    /**
     * Removes a handler from an array of handlers based on its ID
     * @param {{ id: number }[]} handlers The handlers
     * @param {number} id The handler ID
     */
    #removeHandler(handlers, id) {
        for(let i = 0; i < handlers.length; i++) {
            if(handlers[i].id === id) {
                handlers.splice(i, 1)
                break;
            }
        }
    }

    /**
     * Registers a disconnect handler.
     * Disconnect handlers are the last event to be called on a client.
     * @param {IrcClientDisconnectHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onDisconnect(handler) {
        handler.id = genId()
        this.#disconnectHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a disconnect handler
     * @param {number} id The handler ID
     */
    removeOnDisconnect(id) {
        this.#removeHandler(this.#disconnectHandlers, id)
    }

    /**
     * Registers a quit handler.
     * Quit handlers are called when the client sends a QUIT message and is disconnected.
     * Called before onDisconnect, and may not be called at all if the connection was closed without a QUIT message being sent
     * @param {IrcClientQuitHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onQuit(handler) {
        handler.id = genId()
        this.#quitHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a quit handler
     * @param {number} id The handler ID
     */
    removeOnQuit(id) {
        this.#removeHandler(this.#quitHandlers, id)
    }

    /**
     * Registers a line handler.
     * Line handlers are called when the client sends a line, and before it is handled by the server.
     * Since server logic must wait for all line handlers, avoid slow logic unless absolutely necessary.
     * @param {IrcClientLineHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onLine(handler) {
        handler.id = genId()
        this.#lineHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a line handler
     * @param {number} id The handler ID
     */
    removeOnLine(id) {
        this.#removeHandler(this.#lineHandlers, id)
    }

    /**
     * Registers a login attempt handler.
     * Login attempt handlers are called when the client submits login details.
     * Note that once a handler has called accept() or deny(), no other handlers will be called.
     * Ideally only one handler will be registered to avoid confusing situations.
     * @param {IrcClientLoginAttemptHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onLoginAttempt(handler) {
        handler.id = genId()
        this.#loginAttemptHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a login attempt handler
     * @param {number} id The handler ID
     */
    removeOnLoginAttempt(id) {
        this.#removeHandler(this.#loginAttemptHandlers, id)
    }
    
    /**
     * Registers a successful login handler.
     * Successful login handlers are called when the client successfully logs in.
     * It is the obligation of the programmer to set the client's mode after a successful login to let the client know that it is now properly authenticated.
     * @param {IrcClientSuccessfulLoginHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onSuccessfulLogin(handler) {
        handler.id = genId()
        this.#successfulLoginHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a successful login handler
     * @param {number} id The handler ID
     */
    removeOnSuccessfulLogin(id) {
        this.#removeHandler(this.#successfulLoginHandlers, id)
    }

    /**
     * Registers a failed login handler.
     * Failed login handlers are called when the client failed a login attempt.
     * The login process is reset after this point, but the programmer has the option of simply disconnecting the client.
     * @param {IrcClientFailedLoginHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onFailedLogin(handler) {
        handler.id = genId()
        this.#failedLoginHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a failed login handler
     * @param {number} id The handler ID
     */
    removeOnFailedLogin(id) {
        this.#removeHandler(this.#failedLoginHandlers, id)
    }

    /**
     * Registers a socket error handler.
     * Socket error handlers are called when an error occurs on in socket connection.
     * May or may not be fatal; if it was fatal, disconnect handlers will be called after this.
     * @param {IrcClientSocketErrorHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onSocketError(handler) {
        handler.id = genId()
        this.#socketErrorHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a socket error handler
     * @param {number} id The handler ID
     */
    removeOnSocketError(id) {
        this.#removeHandler(this.#socketErrorHandlers, id)
    }

    /**
     * Registers a ping handler.
     * Ping handlers are called when the client sends a ping request.
     * Handlers are called before the server responds, so if handlers are slow then it will reflect badly on the server's ping time.
     * @param {IrcClientPingHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onPing(handler) {
        handler.id = genId()
        this.#pingHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes a ping handler
     * @param {number} id The handler ID
     */
    removeOnPing(id) {
        this.#removeHandler(this.#pingHandlers, id)
    }

    /**
     * Registers an auth timeout handler.
     * Auth timeout handlers are called when the client fails to authenticate within a specified period of time.
     * Disconnect handlers are called afterwards.
     * @param {IrcClientAuthTimeoutHandler} handler The handler
     * @returns {number} The handler ID
     * @since 1.0.0
     */
    onAuthTimeout(handler) {
        handler.id = genId()
        this.#authTimeoutHandlers.push(handler)
        return handler.id
    }
    /**
     * Removes an auth timeout handler
     * @param {number} id The handler ID
     */
    removeOnAuthTimeout(id) {
        this.#removeHandler(this.#authTimeoutHandlers, id)
    }
    
    /**
     * Creates a new client object
     * @param {net.Socket} socket The client's socket
     * @param {Ircd} ircd The IRCd this client is associated with
     * @since 1.0.0
     */
    constructor(socket, ircd) {
        this.socket = socket
        this.ircd = ircd
    }

    /**
     * Dispatches event handlers
     * @param {string} name The event name
     * @param {((...any) => Promise<any>)[]} handlers The handlers
     * @param {any[]} data Data to feed to the handlers
     * @returns {Promise<void>}
     */
    static async #dispatchEvent(name, handlers, data = []) {
        for(const handler of handlers) {
            try {
                await handler(...data)
            } catch(err) {
                console.error(`Internal error occurred while calling ${name} handler: `, err)
            }
        }
    }

    /**
     * Parses the provided IRC client line
     * @param {string} ln The line to parse
     * @returns {IrcClientParsedLine|null} The parsed line or null if the line is malformed
     */
    static parseLine(ln) {
        if(ln.length < 1)
            return null

        const spaceIdx = ln.indexOf(' ')
        if(spaceIdx < 0)
            return { raw: ln, name: ln.toUpperCase(), metadata: null, content: null }

        // Get name
        const name = ln.substring(0, spaceIdx).toUpperCase()

        let content = null
        let metadata

        // Check for content
        const contDivIdx = ln.indexOf(' :')
        if(contDivIdx > -1) {
            content = ln.substring(contDivIdx + 2)
            metadata = ln.substring(name.length+1, contDivIdx)
        } else {
            metadata = ln.substring(name.length+1)
        }

        return { raw: ln, name, metadata: metadata || null, content }
    }

    /**
     * Initializes the client.
     * For internal use only; do not call outside of internal library code.
     * @returns {Promise<void>}
     */
    async initialize() {
        // Setup socket handlers
        this.socket.on('end', () => IrcClient.#dispatchEvent('disconnect', this.#disconnectHandlers))
        this.socket.on('error', err => IrcClient.#dispatchEvent('socket error', this.#socketErrorHandlers, [ err ]))

        // Malformed line error util
        const sendMalformedLnErr = () => this.sendError('Malformed line received')

        // Unfinished user info awaiting completion (only using during the authentication stage)
        let authNick = null
        let authUsername = null
        let authRealname = null
        let authPass = null
        let authCaps = null
        let authCapsEnded = false

        // Authentication timeout
        const authTimeout = setTimeout(async () => {
            await IrcClient.#dispatchEvent('auth timeout', this.#authTimeoutHandlers)
            await this.disconnect('You took too long to authenticate')
        }, this.ircd.authenticationTimeout)

        // Setup line reader
        const carry = carrier.carry(this.socket)
        carry.on('line', async ln => {
            try {
                const parsed = IrcClient.parseLine(ln)
                if (parsed === null) {
                    await sendMalformedLnErr()
                    return
                }

                // Dispatch line event
                await IrcClient.#dispatchEvent('line', this.#lineHandlers, [parsed])

                // Check if it's a QUIT
                if(parsed.name === 'QUIT') {
                    await IrcClient.#dispatchEvent('quit', this.#quitHandlers, [parsed.content])
                    await this.disconnect()
                    return
                }

                try {
                    if(this.isAuthenticated) {
                        if(parsed.name === 'PING') { // Respond to client pings
                            this.lastPingDate = new Date()
                            const pingData = parsed.metadata
                            await IrcClient.#dispatchEvent('ping', this.#pingHandlers, [pingData])
                            await this.sendServerMessage(`PONG ${this.ircd.hostname} ${pingData}`, null, true)
                        } else if(parsed.name === 'PRIVMSG') {
                            // TODO Messaging code
                        } else if(parsed.name !== 'PONG') { // Unknown commands
                            await this.sendError(`Unknown command "${parsed.name}"`)
                        }

                        // TODO Normal logic
                    } else {
                        // Authentication phase logic
                        const authLogic = async () => {
                            // Check if necessary information is available to attempt login
                            if (authNick === null || authUsername === null || authRealname === null || authCaps === null) {
                                await this.disconnect('Insufficient information provided to complete login')
                                return
                            }

                            // If all required information is present, create callbacks and result logic
                            let acceptedOrDenied = false
                            const commonResLogic = async handlers => {
                                acceptedOrDenied = true

                                // Reset temporary auth values
                                authNick = null
                                authUsername = null
                                authRealname = null
                                authPass = null
                                authCaps = null

                                // Call handlers
                                for (const handler of handlers)
                                    await handler(userInfo, authPass)
                            }
                            const accept = async () => {
                                // Set user info and capabilities
                                this.userInfo = userInfo
                                this.capabilities = authCaps

                                await commonResLogic(this.#successfulLoginHandlers)
                            }
                            const deny = async () => {
                                await commonResLogic(this.#failedLoginHandlers)
                            }

                            // Create user info object
                            /**
                             * @type {IrcUserInfo}
                             */
                            const userInfo = {
                                nick: authNick,
                                username: authUsername,
                                realname: authRealname
                            }

                            // Clear auth timeout
                            clearTimeout(authTimeout)

                            // Loop through handlers, calling each one in order until accept() or deny() has been called by one of them
                            const handlers = this.#loginAttemptHandlers
                            for (let i = 0; i < handlers.length && !acceptedOrDenied; i++)
                                await handlers[i](userInfo, authPass, accept, deny)
                        }

                        if (parsed.name === 'NICK') { // Nick setting command
                            authNick = parsed.metadata
                        } else if (parsed.name === 'PASS') { // Password command
                            authPass = parsed.metadata
                        } else if (parsed.name === 'USER') { // User info setting command
                            authUsername = parsed.metadata.split(' ')[0]
                            authRealname = parsed.content
                        } else if (parsed.name === 'CAP') { // Capabilities negotiation commands
                            // Parse CAP command
                            const capArgs = parsed.metadata.split(' ')
                            const capCmd = capArgs[0].toUpperCase()

                            if (capCmd === 'LS') { // List capabilities
                                await this.sendServerMessage('CAP * LS', IRCD_CAPS.join(' '))
                            } else if (capCmd === 'REQ') { // Request capabilities
                                const lnColonIdx = ln.indexOf(':')
                                if (lnColonIdx < 0) {
                                    await sendMalformedLnErr()
                                    return
                                }

                                // Filter requested caps by the ones supported by the IRCd
                                const ackCaps = ln
                                    .substring(lnColonIdx + 1)
                                    .split(' ')
                                    .filter(cap => IRCD_CAPS.includes(cap))

                                // Grant caps
                                await this.sendServerMessage('CAP * ACK', ackCaps.join(' '))

                                // Put granted caps in temporary var
                                if(authCaps === null)
                                    authCaps = ackCaps
                                else
                                    authCaps.push(...ackCaps)

                                // If caps negotiation was ended, perform auth logic
                                if(authCapsEnded)
                                    await authLogic()
                            } else if (capCmd === 'END') { // Terminate capability negotiation
                                // This makes timing problems less likely
                                await sleep(50)

                                // If caps were negotiated, perform auth logic
                                if(authCaps !== null)
                                    await authLogic()
                            }
                        }
                    }
                } catch (err) {
                    console.error('Internal error occurred while handling client line: ', err)
                }
            } catch(err) {
                console.error('Internal error occurred in client line read event: ', err)
            }
        })
    }

    /**
     * Disconnects the client, optionally sending an error message before
     * @param {string|null} errorMsg The error message to send, or null for none (defaults to null)
     * @param {number} msgTimeout The timeout in millilseconds to wait for the error message to send before disconnecting the client (defaults to 5_000) (has no effect is errorMsg is null)
     * @returns {Promise<void>}
     */
    async disconnect(errorMsg = null, msgTimeout = 5_000) {
        // Try to send the error message
        if(errorMsg !== null) {
            await new Promise(async (res, rej) => {
                const timeout = setTimeout(res, msgTimeout)
                this.sendError(errorMsg)
                    .then(() => {
                        res();
                        clearTimeout(timeout)
                    })
                    .catch(rej)
            })
        }

        // Close the client
        await new Promise((res, _rej) => this.socket.end(() => res))
    }

    /**
     * Sends a raw line to the client
     * @param {string} line The line to send
     * @param {boolean} prependTime Whether to prepend the current timestamp (defaults to false)
     * @return {Promise<void>}
     */
    async sendRawLine(line, prependTime = false) {
        const ln = prependTime ? `@time=${new Date().toISOString()} ${line}` : line
        await new Promise((res, _rej) => {
            this.socket.write(ln+'\n', () => res())
        })
    }

    /**
     * Sends a server message to the client
     * @param {string} metadata The message metadata
     * @param {string|null} content The message content or null for none (defaults to null)
     * @param {boolean} prependTime Whether to prepend the current timestamp (defaults to false}
     * @returns {Promise<void>}
     */
    async sendServerMessage(metadata, content = null, prependTime = false) {
        await this.sendRawLine(`:${this.ircd.hostname} ${metadata}${content === null ? '' : ' :'+content}`, prependTime)
    }

    /**
     * Sends a notice to the client
     * @param {string} message The notice
     * @return {Promise<void>}
     */
    async sendNotice(message) {
        const lns = message.split('\n')
        for(const ln of lns)
            if(ln.length > 0)
                await this.sendServerMessage('NOTICE '+this.nickOrAsterisk, ln)
    }

    /**
     * Sends an error message to the client
     * @param {string} message The error message
     * @returns {Promise<void>}
     */
    async sendError(message) {
        const lns = message.split('\n')
        for(const ln of lns)
            if(ln.length > 0)
                await this.sendRawLine('ERROR :'+ln)
    }

    /**
     * Sends Message Of The Day text to the client
     * @param motd
     * @returns {Promise<void>}
     */
    async sendMotd(motd) {
        const lns = motd.split('\n')
        for(const ln of lns)
            await this.sendServerMessage('372 '+this.nickOrAsterisk, ln)
        await this.sendServerMessage('376 '+this.nickOrAsterisk, 'End of MOTD command')
    }

    /**
     * Sets the user's new mode
     * @param {string} mode The new mode string
     * @returns {Promise<void>}
     */
    async setMode(mode) {
        this.#mode = mode
        await this.sendServerMessage('221 '+this.nickOrAsterisk, mode)
    }

    /**
     * Pings the client and returns the number of milliseconds it took to receive a reply
     * @returns {Promise<number>} The number of milliseconds it took to receive a reply
     */
    async ping() {
        const start = getCurrentMs()

        // Send ping
        const pingData = start.toString()
        await this.sendServerMessage('PING '+pingData)

        await new Promise((res, _rej) => {
            let handlerId
            handlerId = this.onLine(ln => {
                if(ln.name === 'PONG' && ln.metadata === pingData) {
                    this.removeOnLine(handlerId)
                    this.lastPingDate = new Date()
                }
                res()
            })
        })

        return getCurrentMs()-start
    }
}


/* Export class */
module.exports = IrcClient