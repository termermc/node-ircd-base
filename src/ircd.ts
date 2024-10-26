import { createServer } from 'node:net'
import type { Server, Socket } from 'node:net'
import { readFile } from 'node:fs/promises'
import { IrcClient } from './client.js'

/**
 * Options for initializing an IRCd using TLS.
 */
export type IrcdTlsOptions = {
	/**
	 * The path to the key file.
	 */
	keyPath: string

	/**
	 * The path to the certificate file.
	 */
	certPath: string
}

/**
 * Handler for client connect events.
 * @param client The client that connected
 * @since 1.0.0
 */
type IrcClientConnectHandler = (client: IrcClient) => Promise<void> | void

// Check for TLS support
let tls: typeof import('node:tls') | null = null
try {
	tls = require('node:tls')
} catch (err) {
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
 * import { Ircd } from 'ircd-base'
 * import { createServer } from 'node:net'
 *
 * const ircd = new Ircd('my.server')
 * const server = createServer(ircd.socketHandler.bind(ircd))
 * server.listen('6667', '127.0.0.1')
 * ```
 *
 * @since 1.0.0
 */
export class Ircd {
	/**
	 * All currently connected clients.
	 * This includes unauthenticated clients.
	 * @since 1.0.0
	 */
	public readonly connectedClients: IrcClient[] = []
	/**
	 * All authenticated clients
	 * @since 1.0.0
	 */
	public readonly authenticatedClients: IrcClient[] = []

	/**
	 * The server's hostname.
	 * Does not affect where the server listens, is only cosmetic.
	 * @since 1.0.0
	 */
	public hostname: string

	/**
	 * Registered connection handlers.
	 */
	#connectHandlers: IrcClientConnectHandler[] = []

	/**
	 * The time before a client connection is closed for not authenticating (in milliseconds).
	 * @since 1.0.0
	 */
	public authenticationTimeout: number = 10_000

	/**
	 * The period of time between proactively pinging clients.
	 * @since 1.0.0
	 */
	public clientPingPeriod: number = 10_000

	/**
	 * Creates a new IRCd.
	 * @param hostname The hostname to use for server messages (does not affect bind host)
	 * @since 1.0.0
	 */
	public constructor(hostname: string) {
		this.hostname = hostname
	}

	/**
	 * Handler for incoming socket connections.
	 *
	 * You only need to use this if you're managing your own {@link Server}.
	 * If you don't know if you need to use this, then you don't, and will need to use {@link listen} to start the server.
	 * @param {Socket} sock The socket
	 * @since 1.2.0
	 */
	public async socketHandler(sock: Socket) {
		// Create client object
		const client = new IrcClient(sock, this)

		// Add client to clients list
		this.connectedClients.push(client)

		// Initialize the client.
		// It's important to initialize the client before any await calls are made,
		// because the method is responsible for wiring up socket events, including
		// errors, which could otherwise crash the process.
		client._initialize()

		// Dispatch connect event
		for (const handler of this.#connectHandlers) {
			await handler(client)
		}

		// Register client handlers to manage connected client lists
		let clientIsAuthed = false
		client.onSuccessfulLogin(() => {
			// Add client to authenticated clients list
			clientIsAuthed = true
			this.authenticatedClients.push(client)
		})
		client.onDisconnect(() => {
			// Remove client from connected clients list
			for (let i = 0; i < this.connectedClients.length; i++) {
				if (this.connectedClients[i] === client) {
					this.connectedClients.splice(i, 1)
				}
			}

			// Remove client from authenticated clients list if authenticated
			if (clientIsAuthed) {
				for (let i = 0; i < this.authenticatedClients.length; i++) {
					if (this.authenticatedClients[i] === client) {
						this.authenticatedClients.splice(i, 1)
					}
				}
			}
		})
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
	 * @param port The port to listen on
	 * @param host The host to listen on (defaults to `'127.0.0.1'`)
	 * @param tlsOptions TLS options, or null not to listen with TLS (defaults to null)
	 * @since 1.0.0
	 */
	public async listen(
		port: number,
		host: string = '127.0.0.1',
		tlsOptions: IrcdTlsOptions | null = null,
	): Promise<void> {
		let server: Server
		if (tlsOptions === null) {
			// No TLS options provided; create plaintext server
			server = createServer(this.socketHandler.bind(this))
		} else {
			// TLS options provided; create TLS server
			// Check for TLS support
			if (tls === null) {
				throw new Error(`System is missing TLS support; IRCd cannot listen with TLS on ${host}:${port}`)
			}

			// If TLS options are provided, load files
			const key = await readFile(tlsOptions.keyPath)
			const cert = await readFile(tlsOptions.certPath)

			// Create TLS-enabled server
			server = tls.createServer({ key, cert }, this.socketHandler.bind(this))
		}

		await new Promise<void>((res, rej) => {
			let isListening = false

			server.listen(port, host, () => {
				isListening = true

				res()
			})
			server.once('error', err => {
				if (isListening) {
					return
				}

				rej(err)
			})
		})
	}

	/**
	 * Registers a client connect handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onConnect(handler: IrcClientConnectHandler) {
		this.#connectHandlers.push(handler)
	}

	/**
	 * Broadcasts a notice to all clients.
	 * @param message The notice
	 * @param name The name that will appear next to the announcement, or null for none (defaults to null)
	 * @param awaitAll Whether to await the sending of all the notices (defaults to false).
	 * Use this only when you want to absolutely ensure delivery, because this will be slow if there are many connected clients.
	 * If {@link awaitAll} is `true`, this method will also throw an error if any of the notices fails to send.
	 * In contrast, if {@link awaitAll} is `false`, this method will be executed in a fire-and-forget manner.
	 * Defaults to `false`.
	 * @since 1.0.0
	 */
	public async broadcastNotice(
		message: string,
		name: string | null = null,
		awaitAll: boolean = false,
	): Promise<void> {
		if (awaitAll) {
			const promises: Promise<void>[] = []
			for (const client of this.connectedClients) {
				promises.push(client.sendNotice(message, name))
			}

			await Promise.all(promises)
		} else {
			for (const client of this.connectedClients) client.sendNotice(message, name).finally()
		}
	}

	/**
	 * Returns whether there is a client with the specified nick connected.
	 * @param nick The nick to check for
	 * @returns Whether there is a client with the specified nick connected
	 * @since 1.0.0
	 */
	public isNickConnected(nick: string): boolean {
		for (const client of this.authenticatedClients) {
			if (client.nick === nick) {
				return true
			}
		}

		return false
	}

	/**
	 * Returns the client with the specified nick or null if none was found.
	 * If you have multiple clients connected with the same nick, you may want to use getClientsByNick(nick).
	 * @param nick The nick to search for
	 * @returns The client or null if none was found
	 * @since 1.0.0
	 */
	public getClientByNick(nick: string): IrcClient | null {
		for (const client of this.authenticatedClients) {
			if (client.nick === nick) {
				return client
			}
		}

		return null
	}

	/**
	 * Returns all clients with the specified nick.
	 * If you just want to return one client, you may want to use getClientByNick(nick).
	 * @param nick The nick to search for
	 * @returns The clients
	 * @since 1.0.0
	 */
	public getClientsByNick(nick: string): IrcClient[] {
		const res = []

		for (const client of this.authenticatedClients) if (client.nick === nick) res.push(client)

		return res
	}
}
