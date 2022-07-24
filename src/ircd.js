const net = require('net')
const { readFile } = require('fs/promises')
const IrcClient = require('./client')

// Check for TLS support
let tls = null
try {
    tls = require('tls')
} catch(err) {
    // TLS support is not available
}

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
     * The server's hostname.
     * Does not affect where the server listens, is only cosmetic.
     * @type {string}
     * @since 1.0.0
     */
    hostname

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
     * Creates a new IRCd
     * @param {string} hostname The hostname to use for server messages (does not affect bind host)
     * @since 1.0.0
     */
    constructor(hostname) {
        this.hostname = hostname
    }

    /**
     * Handler for connecting sockets
     * @param {net.Socket} sock The socket
     */
    async #socketHandler(sock) {
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
        await client.initialize()
    }

    /**
     * Listens on the specified port, and optionally host.
     * If TLS options are provided, the server will listen with TLS.
     * This method may be called multiple times on the same server to listen on multiple ports and interfaces.
     * @param {number} port The port to listen on
     * @param {string|null} host The host to listen on, or null to bind on the local interface (defaults to null)
     * @param {{ keyPath: string, certPath: string }|null} tlsOptions TLS options (keyPath: the path to the key file, certPath: the path to the cert file), or null not to listen with TLS (defaults to null)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async listen(port, host = null, tlsOptions = null) {
        let server
        if(tlsOptions === null) { // No TLS options provided; create plaintext server
            server = net.createServer(sock => this.#socketHandler(sock))
        } else { // TLS options provided; create TLS server
            // Check for TLS support
            if(tls === null)
                throw new Error(`System is missing TLS support; IRCd cannot listen with TLS on ${host}:${port}`)

            // If TLS options are provided, load files
            const key = await readFile(tlsOptions.keyPath)
            const cert = await readFile(tlsOptions.certPath)

            // Create TLS-enabled server
            server = tls.createServer({ key, cert }, sock => this.#socketHandler(sock))
        }

        // Listen
        await new Promise((res, _rej) => server.listen(port, host || '127.0.0.1', res))
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