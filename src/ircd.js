/**
 * @typedef IrcdTlsOptions Options for initializing an IRCd using TLS
 * @property {string} keyPath The path to the key file
 * @property {string} certPath The path to the certificate file
 */

/**
 * @callback IrcClientConnectHandler
 * @param {IrcClient} client The client that connected
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

const { createServer } = require('node:net')
const { readFile } = require('node:fs/promises')
const IrcClient = require('./client')

/** @typedef {import('node:net').Server} Server */
/** @typedef {import('node:net').Socket} Socket */

// Check for TLS support
/** @type {typeof import('node:tls') | null} */
let tls = null
try {
    tls = require('node:tls')
} catch(err) {
    // TLS support is not available
}

/**
 * Main IRC server class.
 * Contains all IRC server state, including connected and authenticated clients.
 *
 * To start the server, use {@link listen}, or create your own {@link Server} and provide the class' {@link socketHandler} as its callback.
 *
 * @example Using your own {@link Server}
 * ```js
 * const { Ircd } = require('ircd-base')
 * const { createServer } = require('node:net')
 *
 * const ircd = new Ircd('my.server')
 * const server = createServer(ircd.socketHandler.bind(ircd))
 * server.listen('6667', '127.0.0.1')
 * ```
 *
 * @since 1.0.0
 */
class Ircd {
    /**
     * All currently connected clients.
     * This includes unauthenticated clients.
     * @type {IrcClient[]}
     * @readonly
     * @public
     * @since 1.0.0
     */
    connectedClients = []
    /**
     * All authenticated clients
     * @type {IrcClient[]}
     * @readonly
     * @public
     * @since 1.0.0
     */
    authenticatedClients = []

    /**
     * The server's hostname.
     * Does not affect where the server listens, is only cosmetic.
     * @type {string}
     * @public
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
     * @public
     * @since 1.0.0
     */
    authenticationTimeout = 10_000

    /**
     * The period of time between proactively pinging clients
     * @type {number}
     * @public
     * @since 1.0.0
     */
    clientPingPeriod = 10_000

    /**
     * Creates a new IRCd
     * @param {string} hostname The hostname to use for server messages (does not affect bind host)
     * @public
     * @since 1.0.0
     */
    constructor(hostname) {
        this.hostname = hostname
    }

    /**
     * Handler for incoming socket connections.
     * .
     * You only need to use this if you're managing your own {@link Server}.
     * If you don't know if you need to use this, then you don't, and will need to use {@link listen} to start the server.
     * @param {Socket} sock The socket
     * @since 1.2.0
     */
    async socketHandler(sock) {
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
     *
     * If TLS options are provided, the server will listen with TLS.
     * This method may be called multiple times on the same server to listen on multiple ports and interfaces.
     *
     * If you need control over the underlying {@link Server} instance, you can create your own server and
     * use the {@link socketHandler} method as its callback.
     * Just make sure you either use `.bind(this)` on the method or wrap a call to it in an anonymous function.
     *
     * See the {@link Ircd} class' JSDoc for more information on using your own {@link Server}.
     * @param {number} port The port to listen on
     * @param {string} [host='127.0.0.1'] The host to listen on (defaults to `'127.0.0.1'`)
     * @param {IrcdTlsOptions | null} [tlsOptions=null] TLS options, or null not to listen with TLS (defaults to null)
     * @returns {Promise<void>}
     * @public
     * @since 1.0.0
     */
    async listen(port, host = '127.0.0.1', tlsOptions = null) {
        /** @type {import('node:net').Server} */
        let server
        if (tlsOptions === null) { // No TLS options provided; create plaintext server
            server = createServer(this.socketHandler.bind(this))
        } else { // TLS options provided; create TLS server
            // Check for TLS support
            if(tls === null)
                throw new Error(`System is missing TLS support; IRCd cannot listen with TLS on ${host}:${port}`)

            // If TLS options are provided, load files
            const key = await readFile(tlsOptions.keyPath)
            const cert = await readFile(tlsOptions.certPath)

            // Create TLS-enabled server
            server = tls.createServer({ key, cert }, this.socketHandler.bind(this))
        }

        await new Promise((res, _rej) => server.listen(port, host, /** @type {() => void} */ (res)))
    }

    /**
     * Registers a client connect handler
     * @param {IrcClientConnectHandler} handler The handler
     * @public
     * @since 1.0.0
     */
    onConnect(handler) {
        this.#connectHandlers.push(handler)
    }

    /**
     * Broadcasts a notice to all clients
     * @param {string} message The notice
     * @param {string | null} [name=null] The name that will appear next to the announcement, or null for none (defaults to null)
     * @param {boolean} [awaitAll=false] Whether to await the sending of all the notices.
     * Use this only when you want to absolutely ensure delivery, because this will be slow if there are many connected clients.
     * If {@link awaitAll} is `true`, this method will also throw an error if any of the notices fails to send.
     * In contrast, if {@link awaitAll} is `false`, this method will be executed in a fire-and-forget manner.
     * Defaults to `false`.
     * @returns {Promise<void>}
     * @public
     * @since 1.0.0
     */
    async broadcastNotice(message, name = null, awaitAll = false) {
        if (awaitAll) {
            /** @type {Promise<void>[]} */
            const promises = []
            for (const client of this.connectedClients)
                promises.push(client.sendNotice(message, name))

            await Promise.all(promises)
        } else {
            for (const client of this.connectedClients)
                client.sendNotice(message, name).finally()
        }
    }

    /**
     * Returns whether there is a client with the specified nick connected
     * @param {string} nick The nick to check for
     * @returns {boolean} Whether there is a client with the specified nick connected
     * @public
     * @since 1.0.0
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
     * @public
     * @since 1.0.0
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
     * @public
     * @since 1.0.0
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
