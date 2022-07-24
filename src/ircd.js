const carrier = require('carrier')
const net = require('net')
const IrcClient = require('./class/IrcClient')

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
     * @param {string} message The notice message
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async broadcastNotice(message) {
        for(let client of this.connectedClients) {
            try {
                await client.sendNotice(message)
            } catch(e) {
                // TODO Standardize logging, allow attaching a logger, etc
                console.error('Failed to send notice to client: ', e)
                client.onError(e)
            }
        }
    }
}

/* Export class */
module.exports = Ircd