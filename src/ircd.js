const net = require('net')
const IrcClient = require('./client')

/**
 * @callback IrcClientConnectHandler
 * @param {IrcClient} client The client that connected
 * @returns {Promise<void>}
 * @since 1.0.0
 */

/**
 * Main IRCd class
 * @since 1.0.0
 */
class Ircd {
    /**
     * All currently connected clients.
     * This includes unauthenticated clients.
     * @type {IrcClient[]}
     * @readonly
     * @since 1.0.0
     */
    connectedClients = []
    /**
     * All authenticated clients
     * @type {IrcClient[]}
     * @readonly
     * @since 1.0.0
     */
    authenticatedClients = []

    /**
     * The server bind host
     * @type {string}
     * @since 1.0.0
     */
    host = 'localhost'

    /**
     * The custom hostname if any
     * @type {string|null}
     */
    #customHostname = null

    /**
     * The server's current hostname, derived from either the bind host or a custom hostname set using this property
     * @returns {string}
     * @since 1.0.0
     */
    get hostname() {
        if(this.#customHostname !== null)
            return this.#customHostname
        else
            return this.host
    }
    /**
     * Sets a custom hostname for the server
     * @param {string} hostname
     * @since 1.0.0
     */
    set hostname(hostname) {
        if(hostname)
            this.#customHostname = hostname
    }

    /**
     * Registered connection handlers
     * @type {IrcClientConnectHandler[]}
     */
    #connectHandlers = []

    /**
     * The time before a client connection is closed for not authenticating (in milliseconds)
     * @type {number}
     * @since 1.0.0
     */
    authenticationTimeout = 10_000

    /**
     * The period of time between proactively pinging clients
     * @type {number}
     * @since 1.0.0
     */
    clientPingPeriod = 10_000

    /**
     * Creates a new IRCd object
     * @param {string?} customHostname The custom hostname to use for server messages (does not affect bind host)
     * @since 1.0.0
     */
    constructor(customHostname) {
        if(customHostname)
            this.#customHostname = customHostname
    }

    /**
     * Starts the server listens on the specified port, and optionally host
     * @param {number} port The port to listen on
     * @param {string?} host The host to listen on (leave blank to bind on the local interface)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async listen(port, host) {
        // Assign port and host
        this.port = port
        if(host)
            this.host = host

        // Start server
        const server = net.createServer(async sock => {
            // Create client object
            const client = new IrcClient(sock, this)

            // Add client to clients list
            this.connectedClients.push(client)

            // Dispatch connect event
            for (const handler of this.#connectHandlers)
                await handler(client)

            // Register client handlers to manage connected client lists
            let clientIsAuthed = false
            client.onSuccessfulLogin(() => {
                // Add client to authenticated clients list
                clientIsAuthed = true
                this.authenticatedClients.push(client)
            })
            client.onDisconnect(() => {
                // Remove client from connected clients list
                for(let i = 0; i < this.connectedClients.length; i++)
                    if(this.connectedClients[i] === client)
                        this.connectedClients.splice(i, 1)

                // Remove client from authenticated clients list if authenticated
                if(clientIsAuthed)
                    for(let i = 0; i < this.authenticatedClients.length; i++)
                        if(this.authenticatedClients[i] === client)
                            this.authenticatedClients.splice(i, 1)
            })

            // Initialize the client
            client.initialize()
        })
        await new Promise((res, _rej) => server.listen(this.port, this.host, res))
    }

    /**
     * Registers a client connect handler
     * @param {IrcClientConnectHandler} handler The handler
     * @since 1.0.0
     */
    onConnect(handler) {
        this.#connectHandlers.push(handler)
    }

    /**
     * Broadcasts a notice to all clients
     * @param {string} message The notice
     * @param {string|null} name The name that will appear next to the announcement, or null for none (defaults to null)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    broadcastNotice(message, name = null) {
        for(const client of this.connectedClients)
            client.sendNotice(message, name).finally()
    }

    /**
     * Returns whether there is a client with the specified nick connected
     * @param {string} nick The nick to check for
     * @returns {boolean} Whether there is a client with the specified nick connected
     */
    isNickConnected(nick) {
        for(const client of this.authenticatedClients)
            if(client.nick === nick)
                return true

        return false
    }

    /**
     * Returns the client with the specified nick or null if none was found.
     * If you have multiple clients connected with the same nick, you may want to use getClientsByNick(nick).
     * @param {string} nick The nick to search for
     * @returns {IrcClient|null} The client or null if none was found
     */
    getClientByNick(nick) {
        for(const client of this.authenticatedClients)
            if(client.nick === nick)
                return client

        return null
    }

    /**
     * Returns all clients with the specified nick
     * If you just want to return one client, you may want to use getClientByNick(nick).
     * @param {string} nick The nick to search for
     * @returns {IrcClient[]} The clients
     */
    getClientsByNick(nick) {
        const res = []

        for(const client of this.authenticatedClients)
            if(client.nick === nick)
                res.push(client)

        return res
    }
}

/* Export class */
module.exports = Ircd