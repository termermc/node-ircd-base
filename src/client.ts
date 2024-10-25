import { IRCD_CAPS } from './constants.js'
import { removeFromArray, sleep } from './util/misc.js'
import * as readline from 'node:readline'
import type { Ircd } from './ircd.js'
import type { Socket } from 'node:net'

/**
 * Information about an IRC user.
 * @since 1.0.0
 */
export type IrcUserInfo = {
	/**
	 * The user's nick
	 */
	nick: string

	/**
	 * The user's username
	 */
	username: string

	/**
	 * The user's real name
	 */
	realname: string | null

	/**
	 * The user's hostname (can be real or fake)
	 */
	hostname: string

	/**
	 * The user's status (optional, e.g. 'H@' for online op, 'G' for away, 'G+' for away voiced, 'H~' for online owner, etc)
	 */
	status: string | null
}

/**
 * A parsed IRC client line.
 * @since 1.0.0
 */
export type IrcClientParsedLine = {
	/**
	 * The raw line
	 */
	raw: string

	/**
	 * The command name (will always be uppercase)
	 */
	name: string

	/**
	 * The line metadata, or null if none
	 */
	metadata: string | null

	/**
	 * The line content, or null if none
	 */
	content: string | null
}

/**
 * A handler for a client disconnection event.
 * @since 1.0.0
 */
export type IrcClientDisconnectHandler = () => Promise<void> | void

/**
 * A handler for a client quit event.
 * @param message The quit message, or null if there was none
 * @since 1.0.0
 */
export type IrcClientQuitHandler = (message: string | null) => Promise<void> | void

/**
 * A handler for a client line received event.
 * @param line The parsed line
 * @since 1.0.0
 */
export type IrcClientLineHandler = (line: IrcClientParsedLine) => Promise<void> | void

/**
 * A handler for a client login attempt event.
 * @param userInfo The user info the client provided
 * @param password The password the client is logged in with (can be null)
 * @param accept Function to be called signifying that the client's attempt has been accepted
 * @param deny Function to be called signifying that the client's attempt has been denied (optionally providing a reason string)
 * @since 1.0.0
 */
export type IrcClientLoginAttemptHandler = (
	userInfo: IrcUserInfo,
	password: string | null,
	accept: () => Promise<void>,
	deny: (reason?: string) => Promise<void>,
) => Promise<void> | void

/**
 * A handler for a client successful login event.
 * @param userInfo The user info the client provided
 * @param password The password the client logged in with (or null if no password was provided)
 * @since 1.0.0
 */
export type IrcClientSuccessfulLoginHandler = (userInfo: IrcUserInfo, password: string | null) => Promise<void> | void

/**
 * A handler for a client failed login event.
 * @param userInfo The user info the client provided
 * @param password The password the client logged in with (or null if no password was provided)
 * @param reason The reason the login failed, or null if none was provided (provided by a login attempt handler)
 * @since 1.0.0
 */
export type IrcClientFailedLoginHandler = (
	userInfo: IrcUserInfo,
	password: string | null,
	reason: string | null,
) => Promise<void> | void

/**
 * A handler for a client socket error event.
 * @param error The error that occurred
 * @since 1.0.0
 */
export type IrcClientSocketErrorHandler = (error: Error) => Promise<void> | void

/**
 * A handler for a client ping event.
 * @param data The data sent by the client to be repeated by the server
 * @since 1.0.0
 */
export type IrcClientPingHandler = (data: string) => Promise<void> | void

/**
 * A handler for a client authentication timeout event.
 * @since 1.0.0
 */
export type IrcClientAuthTimeoutHandler = () => Promise<void> | void

/**
 * A handler for a client online check event.
 * @param nicks An array of nicks the client is requesting to check for
 * @since 1.0.0
 */
export type IrcClientOnlineCheckHandler = (nicks: string[]) => Promise<void> | void

/**
 * A handler for a client join event.
 * @param channels The names of the channels the client is requesting to join
 * @since 1.0.0
 */
export type IrcClientJoinHandler = (channels: string[]) => Promise<void> | void

/**
 * A handler for a client part event.
 * @param channel The name of the channel the client is requesting to part
 * @param reason The part reason, or null if none
 * @since 1.0.0
 */
export type IrcClientPartHandler = (channel: string, reason: string | null) => Promise<void> | void

/**
 * A handler for a client channel info event.
 * @param channel The name of the channel the client is requesting info for
 * @since 1.0.0
 */
export type IrcClientChannelInfoHandler = (channel: string) => Promise<void> | void

/**
 * A handler for a client channel users event.
 * @param channel The name of the channel the client is requesting users for
 * @since 1.0.0
 */
export type IrcClientChannelUsersHandler = (channel: string) => Promise<void> | void

/**
 * A handler for a client chat message event.
 * @param channel The channel (or nick, if there is no prefix) in which the client sent the message
 * @param message The chat message
 * @since 1.0.0
 */
export type IrcClientChatMessageHandler = (channel: string, message: string) => Promise<void> | void

/**
 * A handler for a client away event.
 * @param message The away message, or null if there was none
 * @since 1.0.0
 */
export type IrcClientAwayHandler = (message: string | null) => Promise<void> | void

/**
 * A handler for a client back event.
 * @since 1.0.0
 */
export type IrcClientBackHandler = () => Promise<void> | void

/**
 * A handler for a client kick event.
 * @param channel The channel from which the nick is being kicked
 * @param nick The nick that is being kicked
 * @param reason The kick reason, or null if none
 * @since 1.1.1
 */
export type IrcClientKickHandler = (channel: string, nick: string, reason: string | null) => Promise<void> | void

/**
 * A handler for a client topic change event.
 * @param channel The channel that is having its topic changed
 * @param newTopic The new topic
 * @since 1.1.1
 */
export type IrcClientTopicChangeHandler = (channel: string, newTopic: string) => Promise<void> | void

/**
 * A handler for a client user mode change event.
 * @param channel The channel where the user is
 * @param nick The user's nick
 * @param addedModes The modes that were added to the user
 * @param removedModes The modes that were removed from the user
 * @since 1.1.3
 */
export type IrcClientUserModeChangeHandler = (
	channel: string,
	nick: string,
	addedModes: string[],
	removedModes: string[],
) => Promise<void> | void

/**
 * A handler for a client channel mode change event.
 * @param channel The channel
 * @param addedModes The modes that were added to the user
 * @param removedModes The modes that were removed from the user
 * @since 1.1.3
 */
export type IrcClientChannelModeChangeHandler = (
	channel: string,
	addedModes: string[],
	removedModes: string[],
) => Promise<void> | void

/**
 * A handler for a client invite event.
 * @param nick The nick of the user that is being invited
 * @param channel The channel the nick is being invited to
 * @since 1.1.5
 */
export type IrcClientInviteHandler = (nick: string, channel: string) => Promise<void> | void

/**
 * IRC client object.
 * @since 1.0.0
 */
export class IrcClient {
	/**
	 * The client's user info object (null if not authenticated).
	 * @since 1.0.0
	 */
	public userInfo: IrcUserInfo | null = null

	/**
	 * Acknowledged client capabilities.
	 * @since 1.0.0
	 */
	public capabilities: string[] = []

	/**
	 * The IRCd this client is connected to.
	 * @since 1.0.0
	 */
	public readonly ircd: Ircd

	/**
	 * The underlying network socket for this client.
	 * @since 1.0.0
	 */
	public readonly socket: Socket

	/**
	 * The date of the last time the client pinged the server or vice versa.
	 */
	public lastPingDate: Date | null = null

	/**
	 * Returns whether the client is authenticated.
	 */
	public get isAuthenticated(): boolean {
		return this.userInfo !== null
	}

	/**
	 * Returns the client's nick or null if the client has not authenticated.
	 */
	public get nick(): string | null {
		return this.userInfo?.nick || null
	}

	/**
	 * Returns the client's nick or an asterisk if the client has not authenticated.
	 */
	public get nickOrAsterisk(): string | '*' {
		return this.userInfo?.nick || '*'
	}

	/**
	 * The user's current mode.
	 */
	#mode: string = ''

	/**
	 * Whether the client disconnected.
	 */
	#disconnected: boolean = false

	/**
	 * Returns the user's current mode.
	 */
	public get mode(): string {
		return this.#mode
	}

	/**
	 * Returns whether the client is disconnected.
	 */
	public get isDisconnected(): boolean {
		return this.#disconnected
	}

	/**
	 * Disconnect handlers.
	 */
	#disconnectHandlers: IrcClientDisconnectHandler[] = []
	/**
	 * Quit handlers.
	 */
	#quitHandlers: IrcClientQuitHandler[] = []
	/**
	 * Line handlers.
	 */
	#lineHandlers: IrcClientLineHandler[] = []
	/**
	 * Login attempt handlers.
	 */
	#loginAttemptHandlers: IrcClientLoginAttemptHandler[] = []
	/**
	 * Successful login handlers.
	 */
	#successfulLoginHandlers: IrcClientSuccessfulLoginHandler[] = []
	/**
	 * Failed login handlers.
	 */
	#failedLoginHandlers: IrcClientFailedLoginHandler[] = []
	/**
	 * Socket error handlers.
	 */
	#socketErrorHandlers: IrcClientSocketErrorHandler[] = []
	/**
	 * Ping handlers.
	 */
	#pingHandlers: IrcClientPingHandler[] = []
	/**
	 * Auth timeout handlers.
	 */
	#authTimeoutHandlers: IrcClientAuthTimeoutHandler[] = []
	/**
	 * Online check handlers.
	 */
	#onlineCheckHandlers: IrcClientOnlineCheckHandler[] = []
	/**
	 * Join handlers.
	 */
	#joinHandlers: IrcClientJoinHandler[] = []
	/**
	 * Part handlers.
	 */
	#partHandlers: IrcClientPartHandler[] = []
	/**
	 * Channel info handlers.
	 */
	#channelInfoHandlers: IrcClientChannelInfoHandler[] = []
	/**
	 * Channel users handlers.
	 */
	#channelUsersHandlers: IrcClientChannelUsersHandler[] = []
	/**
	 * Chat message handlers.
	 */
	#chatMessageHandlers: IrcClientChatMessageHandler[] = []
	/**
	 * Away handlers.
	 */
	#awayHandlers: IrcClientAwayHandler[] = []
	/**
	 * Back handlers.
	 */
	#backHandlers: IrcClientBackHandler[] = []
	/**
	 * Kick handlers.
	 */
	#kickHandlers: IrcClientKickHandler[] = []
	/**
	 * Topic change handlers.
	 */
	#topicChangeHandlers: IrcClientTopicChangeHandler[] = []
	/**
	 * User mode change handlers.
	 */
	#userModeChangeHandlers: IrcClientUserModeChangeHandler[] = []
	/**
	 * Channel mode change handlers.
	 */
	#channelModeChangeHandlers: IrcClientChannelModeChangeHandler[] = []
	/**
	 * Invite handlers.
	 */
	#inviteHandlers: IrcClientInviteHandler[] = []

	/**
	 * Registers a disconnect handler.
	 * Disconnect handlers are the last event to be called on a client.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onDisconnect(handler: IrcClientDisconnectHandler): void {
		this.#disconnectHandlers.push(handler)
	}
	/**
	 * Removes a disconnect handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnDisconnect(handler: IrcClientDisconnectHandler): void {
		removeFromArray(this.#disconnectHandlers, handler)
	}

	/**
	 * Registers a quit handler.
	 * Quit handlers are called when the client sends a QUIT message and is disconnected.
	 * Called before onDisconnect, and may not be called at all if the connection was closed without a QUIT message being sent.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onQuit(handler: IrcClientQuitHandler): void {
		this.#quitHandlers.push(handler)
	}
	/**
	 * Removes a quit handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnQuit(handler: IrcClientQuitHandler): void {
		removeFromArray(this.#quitHandlers, handler)
	}

	/**
	 * Registers a line handler.
	 * Line handlers are called when the client sends a line, and before it is handled by the server.
	 * Since server logic must wait for all line handlers, avoid slow logic unless absolutely necessary.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onLine(handler: IrcClientLineHandler): void {
		this.#lineHandlers.push(handler)
	}
	/**
	 * Removes a line handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnLine(handler: IrcClientLineHandler): void {
		removeFromArray(this.#lineHandlers, handler)
	}

	/**
	 * Registers a login attempt handler.
	 * Login attempt handlers are called when the client submits login details.
	 * Note that once a handler has called accept() or deny(), no other handlers will be called.
	 * Ideally only one handler will be registered to avoid confusing situations.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onLoginAttempt(handler: IrcClientLoginAttemptHandler): void {
		this.#loginAttemptHandlers.push(handler)
	}
	/**
	 * Removes a login attempt handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnLoginAttempt(handler: IrcClientLoginAttemptHandler): void {
		removeFromArray(this.#loginAttemptHandlers, handler)
	}

	/**
	 * Registers a successful login handler.
	 * Successful login handlers are called when the client successfully logs in.
	 * IMPORTANT: It is the obligation of the programmer to send the server info, send the MotD, and set the client's mode after a successful login to let the client know that it is now properly authenticated.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onSuccessfulLogin(handler: IrcClientSuccessfulLoginHandler): void {
		this.#successfulLoginHandlers.push(handler)
	}
	/**
	 * Removes a successful login handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnSuccessfulLogin(handler: IrcClientSuccessfulLoginHandler): void {
		removeFromArray(this.#successfulLoginHandlers, handler)
	}

	/**
	 * Registers a failed login handler.
	 * Failed login handlers are called when the client failed a login attempt.
	 * The login process is restarted after this point (although negotiated values are still temporarily held), but the programmer has the option of simply disconnecting the client or issuing a taken nick message.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onFailedLogin(handler: IrcClientFailedLoginHandler): void {
		this.#failedLoginHandlers.push(handler)
	}
	/**
	 * Removes a failed login handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnFailedLogin(handler: IrcClientFailedLoginHandler): void {
		removeFromArray(this.#failedLoginHandlers, handler)
	}

	/**
	 * Registers a socket error handler.
	 * Socket error handlers are called when an error occurs on in socket connection.
	 * May or may not be fatal; if it was fatal, disconnect handlers will be called after this.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onSocketError(handler: IrcClientSocketErrorHandler): void {
		this.#socketErrorHandlers.push(handler)
	}
	/**
	 * Removes a socket error handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnSocketError(handler: IrcClientSocketErrorHandler): void {
		removeFromArray(this.#socketErrorHandlers, handler)
	}

	/**
	 * Registers a ping handler.
	 * Ping handlers are called when the client sends a ping request.
	 * Handlers are called before the server responds, so if handlers are slow then it will reflect badly on the server's ping time.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onPing(handler: IrcClientPingHandler): void {
		this.#pingHandlers.push(handler)
	}
	/**
	 * Removes a ping handler.
	 * @param {IrcClientPingHandler} handler The handler
	 * @since 1.0.0
	 */
	public removeOnPing(handler: IrcClientPingHandler): void {
		removeFromArray(this.#pingHandlers, handler)
	}

	/**
	 * Registers an auth timeout handler.
	 * Auth timeout handlers are called when the client fails to authenticate within a specified period of time.
	 * Disconnect handlers are called afterwards.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onAuthTimeout(handler: IrcClientAuthTimeoutHandler): void {
		this.#authTimeoutHandlers.push(handler)
	}
	/**
	 * Removes an auth timeout handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnAuthTimeout(handler: IrcClientAuthTimeoutHandler): void {
		removeFromArray(this.#authTimeoutHandlers, handler)
	}

	/**
	 * Registers an online check handler.
	 * Online check handlers are called when the user asks to know whether a user is online or not.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onOnlineCheck(handler: IrcClientOnlineCheckHandler): void {
		this.#onlineCheckHandlers.push(handler)
	}
	/**
	 * Removes an online check handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnOnlineCheck(handler: IrcClientOnlineCheckHandler): void {
		removeFromArray(this.#onlineCheckHandlers, handler)
	}

	/**
	 * Registers a join handler.
	 * Join handlers are called when the user tries to join a channel.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onJoin(handler: IrcClientJoinHandler): void {
		this.#joinHandlers.push(handler)
	}
	/**
	 * Removes a join handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnJoin(handler: IrcClientJoinHandler): void {
		removeFromArray(this.#joinHandlers, handler)
	}

	/**
	 * Registers a part handler.
	 * Part handlers are called when the user tries to part a channel.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onPart(handler: IrcClientPartHandler): void {
		this.#partHandlers.push(handler)
	}
	/**
	 * Removes a part handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnPart(handler: IrcClientPartHandler): void {
		removeFromArray(this.#partHandlers, handler)
	}

	/**
	 * Registers a channel info handler.
	 * Channel info handlers are called when the user requests info about a channel.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onChannelInfo(handler: IrcClientChannelInfoHandler): void {
		this.#channelInfoHandlers.push(handler)
	}
	/**
	 * Removes a channel info handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnChannelInfo(handler: IrcClientChannelInfoHandler): void {
		removeFromArray(this.#channelInfoHandlers, handler)
	}

	/**
	 * Registers a channel users handler.
	 * Channel users handlers are called when the user requests a channel's user list.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onChannelUsers(handler: IrcClientChannelUsersHandler): void {
		this.#channelUsersHandlers.push(handler)
	}
	/**
	 * Removes a channel users handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnChannelUsers(handler: IrcClientChannelUsersHandler): void {
		removeFromArray(this.#channelUsersHandlers, handler)
	}

	/**
	 * Registers a chat message handler.
	 * Chat message handlers are called when the user sends a chat message, either in a channel or as a private message
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onChatMessage(handler: IrcClientChatMessageHandler): void {
		this.#chatMessageHandlers.push(handler)
	}
	/**
	 * Removes a chat message handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnChatMessage(handler: IrcClientChatMessageHandler): void {
		removeFromArray(this.#chatMessageHandlers, handler)
	}

	/**
	 * Registers an away handler.
	 * Away handlers are called when the user marks himself/herself as away
	 * @param handler The handler
	 */
	public onAway(handler: IrcClientAwayHandler): void {
		this.#awayHandlers.push(handler)
	}
	/**
	 * Removes an away handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnAway(handler: IrcClientAwayHandler): void {
		removeFromArray(this.#awayHandlers, handler)
	}

	/**
	 * Registers a back handler.
	 * Back handlers are called when the user marks himself/herself as back (not away)
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public onBack(handler: IrcClientBackHandler): void {
		this.#backHandlers.push(handler)
	}
	/**
	 * Removes a back handler.
	 * @param handler The handler
	 * @since 1.0.0
	 */
	public removeOnBack(handler: IrcClientBackHandler): void {
		removeFromArray(this.#backHandlers, handler)
	}

	/**
	 * Registers a kick handler.
	 * Kick handlers are called when the user kicks a user from a channel
	 * @param handler The handler
	 * @since 1.1.1
	 */
	public onKick(handler: IrcClientKickHandler): void {
		this.#kickHandlers.push(handler)
	}
	/**
	 * Removes a kick handler.
	 * @param handler The handler
	 * @since 1.1.1
	 */
	public removeOnKick(handler: IrcClientKickHandler): void {
		removeFromArray(this.#kickHandlers, handler)
	}

	/**
	 * Registers a topic change handler.
	 * Topic change handlers are called when the user changes a channel topic
	 * @param handler The handler
	 * @since 1.1.1
	 */
	public onTopicChange(handler: IrcClientTopicChangeHandler): void {
		this.#topicChangeHandlers.push(handler)
	}
	/**
	 * Removes a topic change handler.
	 * @param handler The handler
	 * @since 1.1.1
	 */
	public removeOnTopicChange(handler: IrcClientTopicChangeHandler): void {
		removeFromArray(this.#topicChangeHandlers, handler)
	}

	/**
	 * Registers a user mode change handler.
	 * User mode change handlers are called when the user changes a channel user's mode
	 * @param handler The handler
	 * @since 1.1.3
	 */
	public onUserModeChange(handler: IrcClientUserModeChangeHandler): void {
		this.#userModeChangeHandlers.push(handler)
	}
	/**
	 * Removes a user mode change handler.
	 * @param handler The handler
	 * @since 1.1.3
	 */
	public removeOnUserModeChange(handler: IrcClientUserModeChangeHandler): void {
		removeFromArray(this.#userModeChangeHandlers, handler)
	}

	/**
	 * Registers a channel mode change handler.
	 * User mode change handlers are called when the user changes a channel's mode.
	 * @param handler The handler
	 * @since 1.1.3
	 */
	public onChannelModeChange(handler: IrcClientChannelModeChangeHandler): void {
		this.#channelModeChangeHandlers.push(handler)
	}
	/**
	 * Removes a channel mode change handler.
	 * @param handler The handler
	 * @since 1.1.3
	 */
	public removeOnChannelModeChange(handler: IrcClientChannelModeChangeHandler): void {
		removeFromArray(this.#channelModeChangeHandlers, handler)
	}

	/**
	 * Registers an invite handler.
	 * Invite handlers are called when the user invites another user to a channel
	 * @param handler The handler
	 * @since 1.1.5
	 */
	public onInvite(handler: IrcClientInviteHandler): void {
		this.#inviteHandlers.push(handler)
	}
	/**
	 * Removes an invite handler.
	 * @param handler The handler
	 * @since 1.1.5
	 */
	public removeOnInvite(handler: IrcClientInviteHandler): void {
		removeFromArray(this.#inviteHandlers, handler)
	}

	/**
	 * Creates a new client object.
	 * @param socket The client's socket
	 * @param ircd The IRCd this client is associated with
	 * @since 1.0.0
	 */
	public constructor(socket: Socket, ircd: Ircd) {
		this.socket = socket
		this.ircd = ircd
	}

	/**
	 * Dispatches event handlers.
	 * @param name The event name
	 * @param handlers The handlers
	 * @param data Data to feed to the handlers
	 */
	static async #dispatchEvent(name: string, handlers: ((...args: any) => Promise<any> | void)[], data: any[] = []) {
		for (const handler of handlers) {
			try {
				await handler(...data)
			} catch (err) {
				console.error(`Internal error occurred while calling ${name} handler: `, err)
			}
		}
	}

	/**
	 * Parses a mode delta string (e.g. "+v") into added and removed mode chars.
	 * @param delta The delta string (e.g. "+v")
	 * @returns A 2-element tuple containing the added mode chars and the removed mode chars
	 */
	static #parseModeDelta(delta: string): [string[], string[]] {
		if (delta.length < 2) {
			return [[], []]
		}

		const type = delta[0]
		const chars = delta.substring(1).split('')
		if (type === '+') return [chars, []]
		else if (type === '-') return [[], chars]
		else return [[], []]
	}

	/**
	 * Parses the provided IRC client line.
	 * @param ln The line to parse
	 * @returns The parsed line or null if the line is malformed
	 * @since 1.0.0
	 */
	public static parseLine(ln: string): IrcClientParsedLine | null {
		if (ln.length < 1) {
			return null
		}

		const spaceIdx = ln.indexOf(' ')
		if (spaceIdx < 0) return { raw: ln, name: ln.toUpperCase(), metadata: null, content: null }

		// Get name
		const name = ln.substring(0, spaceIdx).toUpperCase()

		let content = null
		let metadata

		// Check for content
		const contDivIdx = ln.indexOf(' :')
		if (contDivIdx > -1) {
			content = ln.substring(contDivIdx + 2)
			metadata = ln.substring(name.length + 1, contDivIdx)
		} else {
			metadata = ln.substring(name.length + 1)
		}

		return { raw: ln, name, metadata: metadata || null, content }
	}

	/**
	 * Initializes the client.
	 * For internal use only; do not call outside of internal library code.
	 * @since 1.0.0
	 */
	public async initialize(): Promise<void> {
		// Periodically ping the client
		const pingInterval = setInterval(() => this.ping(), this.ircd.clientPingPeriod)

		/**
		 * Whether the client close event has already been handled.
		 */
		let hasHandledClose = false

		const closeHandler = () => {
			if (hasHandledClose) {
				return
			}

			hasHandledClose = true

			if (!this.socket.closed) {
				this.socket.destroy()
			}

			this.#disconnected = true
			clearInterval(pingInterval)

			// Send out disconnect event, but don't wait on it or throw an error if it fails
			IrcClient.#dispatchEvent('disconnect', this.#disconnectHandlers).catch(() => {})
		}

		// Setup socket handlers
		this.socket.on('close', closeHandler)
		this.socket.on('end', closeHandler)
		this.socket.on('error', err => IrcClient.#dispatchEvent('socket error', this.#socketErrorHandlers, [err]))

		/**
		 * Sends a malformed line error to the client.
		 * If the socket is disconnected, it does nothing.
		 * If it fails to send the message because the socket is closed, it will try to close the socket.
		 *
		 * Always return from whatever function this is called in immediately after calling it,
		 * as the socket may have been closed by it.
		 */
		const sendMalformedLnErr = async () => {
			if (this.isDisconnected) {
				return
			}

			try {
				await this.sendError('Malformed line received')
			} catch (err) {
				if ((err as any).code === 'ERR_SOCKET_CLOSED' || (err as any).code === 'ERR_STREAM_WRITE_AFTER_END') {
					closeHandler()
				}
			}
		}

		// Unfinished user info awaiting completion (only using during the authentication stage)
		let authNick: string | null = null
		let authUsername: string | null = null
		let authRealname: string | null = null
		let authPass: string | null = null
		let authCaps: string[] | null = null
		let authCapsEnded = false

		// Authentication timeout
		const authTimeoutFunc = async () => {
			await IrcClient.#dispatchEvent('auth timeout', this.#authTimeoutHandlers)
			await this.disconnect('You took too long to authenticate')
		}
		let authTimeout = setTimeout(authTimeoutFunc, this.ircd.authenticationTimeout)

		// Setup line reader
		const lineReader = readline.createInterface({
			input: this.socket,
			crlfDelay: Infinity,
		})
		lineReader.on('close', closeHandler)
		lineReader.on('line', async ln => {
			try {
				const parsed = IrcClient.parseLine(ln)
				if (parsed === null) {
					await sendMalformedLnErr()
					return
				}

				// Dispatch line event
				await IrcClient.#dispatchEvent('line', this.#lineHandlers, [parsed])

				// Handle QUITs
				if (parsed.name === 'QUIT') {
					await IrcClient.#dispatchEvent('quit', this.#quitHandlers, [parsed.content])
					await this.disconnect()
					return
				}

				try {
					if (this.isAuthenticated) {
						if (parsed.name === 'PING') {
							// Respond to client pings
							this.lastPingDate = new Date()
							const pingData = parsed.metadata
							await IrcClient.#dispatchEvent('ping', this.#pingHandlers, [pingData])
							await this.sendServerMessage(`PONG ${this.ircd.hostname} ${pingData}`, null, true)
						} else if (parsed.name === 'JOIN') {
							// Channel join
							const channels = parsed.metadata?.split(',')
							if (channels) {
								await IrcClient.#dispatchEvent('join', this.#joinHandlers, [channels])
							}
						} else if (parsed.name === 'PART') {
							// Channel part
							const channel = parsed.metadata
							if (channel) {
								await IrcClient.#dispatchEvent('part', this.#partHandlers, [channel, parsed.content])
							}
						} else if (parsed.name === 'MODE') {
							// Mode commands
							const parts = parsed.metadata?.split(' ')

							if (parts != null) {
								if (parts.length === 1) {
									// Channel info request
									await IrcClient.#dispatchEvent('channel info', this.#channelInfoHandlers, [
										parts[0],
									])
								} else if (parts.length === 2) {
									// Channel mode change
									await IrcClient.#dispatchEvent(
										'channel mode change',
										this.#channelModeChangeHandlers,
										[parts[0], ...IrcClient.#parseModeDelta(parts[1])],
									)
								} else if (parts.length === 3) {
									// Channel user mode change
									await IrcClient.#dispatchEvent('user mode change', this.#userModeChangeHandlers, [
										parts[0],
										parts[2],
										...IrcClient.#parseModeDelta(parts[1]),
									])
								}
							}
						} else if (parsed.name === 'WHO') {
							// Channel user list
							if (parsed.metadata != null) {
								await IrcClient.#dispatchEvent('channel users', this.#channelUsersHandlers, [
									parsed.metadata.split(' ')[0],
								]) // Doesn't support the full spec, just fetches all users
							}
						} else if (parsed.name === 'PRIVMSG') {
							// Message
							if (parsed.metadata != null) {
								let chan: string
								let content: string

								if (parsed.content === null) {
									;[chan, content] = parsed.metadata.split(' ')
								} else {
									chan = parsed.metadata
									content = parsed.content
								}

								await IrcClient.#dispatchEvent('chat message', this.#chatMessageHandlers, [
									chan,
									content,
								])
							}
						} else if (parsed.name === 'AWAY') {
							// Away/back
							if (parsed.content === null) {
								await IrcClient.#dispatchEvent('back', this.#backHandlers)
							} else {
								await IrcClient.#dispatchEvent('away', this.#awayHandlers, [parsed.content])
							}
						} else if (parsed.name === 'ISON') {
							// Online check
							if (parsed.metadata != null) {
								await IrcClient.#dispatchEvent('online check', this.#onlineCheckHandlers, [
									parsed.metadata.split(' '),
								])
							}
						} else if (parsed.name === 'KICK') {
							// Channel user kick
							if (parsed.metadata != null) {
								const [channel, nick] = parsed.metadata.split(' ')
								await IrcClient.#dispatchEvent('kick', this.#kickHandlers, [
									channel,
									nick,
									parsed.content,
								])
							}
						} else if (parsed.name === 'TOPIC') {
							// Channel topic change
							await IrcClient.#dispatchEvent('topic change', this.#topicChangeHandlers, [
								parsed.metadata,
								parsed.content,
							])
						} else if (parsed.name === 'INVITE') {
							// Channel invite user
							if (parsed.metadata != null) {
								const [nick, channel] = parsed.metadata.split(' ')
								if (nick && channel) {
									await IrcClient.#dispatchEvent('invite', this.#inviteHandlers, [nick, channel])
								}
							}
						}
					} else {
						// Authentication phase logic
						const authLogic = async () => {
							// Check if necessary information is available to attempt login
							if (authNick === null || authUsername === null || authCaps === null) {
								await this.disconnect('Insufficient information provided to complete login')
								return
							}

							// If all required information is present, create callbacks and result logic
							let acceptedOrDenied = false
							const commonResLogic = async (
								handlers: IrcClientFailedLoginHandler[],
								reason: string | null,
							): Promise<void> => {
								acceptedOrDenied = true

								// Call handlers
								for (const handler of handlers) {
									await handler(userInfo, authPass, reason)
								}
							}
							const accept = async () => {
								if (authCaps == null) {
									throw new Error(
										'BUG: authCaps was null, so it must have been reassigned between the time it took to call this function, and the original check',
									)
								}

								// Set user info and capabilities
								this.userInfo = userInfo
								this.capabilities = authCaps

								await commonResLogic(this.#successfulLoginHandlers, null)
							}
							const deny = async (reason?: string): Promise<void> => {
								await commonResLogic(this.#failedLoginHandlers, reason || null)

								// Because the authentication attempt was denied, reset the authentication timeout
								authTimeout = setTimeout(authTimeoutFunc, this.ircd.authenticationTimeout)
							}

							// Create user info object
							const userInfo: IrcUserInfo = {
								nick: authNick,
								username: authUsername,
								realname: authRealname,
								hostname: this.ircd.hostname,
								status: '',
							}

							// Clear auth timeout to avoid authentication logic being interrupted
							clearTimeout(authTimeout)

							// Loop through handlers, calling each one in order until accept() or deny() has been called by one of them
							const handlers = this.#loginAttemptHandlers
							for (let i = 0; i < handlers.length && !acceptedOrDenied; i++) {
								await handlers[i](userInfo, authPass, accept, deny)
							}
						}

						if (parsed.name === 'NICK') {
							// Nick setting command
							authNick = parsed.metadata

							// If all metadata is already set, call auth logic
							if (authNick !== null && authUsername !== null && authCaps !== null) await authLogic()
						} else if (parsed.name === 'PASS') {
							// Password command
							authPass = parsed.metadata
						} else if (parsed.name === 'USER') {
							// User info setting command
							if (parsed.metadata != null) {
								authUsername = parsed.metadata.split(' ')[0] || authNick
								authRealname = parsed.content
							}
						} else if (parsed.name === 'CAP') {
							// Capabilities negotiation commands
							if (parsed.metadata != null) {
								// Parse CAP command
								const capArgs = parsed.metadata.split(' ')
								const capCmd = capArgs[0].toUpperCase()

								if (capCmd === 'LS') {
									// List capabilities
									await this.sendServerMessage('CAP * LS', IRCD_CAPS.join(' '))
								} else if (capCmd === 'REQ') {
									// Request capabilities
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
									if (authCaps === null) {
										authCaps = ackCaps
									} else {
										authCaps.push(...ackCaps)
									}

									// If caps negotiation was ended, perform auth logic
									if (authCapsEnded) {
										await authLogic()
									}
								} else if (capCmd === 'END') {
									// Terminate capability negotiation
									// This makes timing problems less likely
									await sleep(50)

									// If caps were negotiated, perform auth logic
									if (authCaps !== null) {
										await authLogic()
									}
								}
							}
						}
					}
				} catch (err) {
					console.error('Internal error occurred while handling client line: ', err)
				}
			} catch (err) {
				console.error('Internal error occurred in client line read event: ', err)
			}
		})
	}

	/**
	 * Disconnects the client, optionally sending an error message before.
	 * Does nothing if the client is already disconnected.
	 * @param errorMsg The error message to send, or null for none (defaults to null)
	 * @param msgTimeout The timeout in millilseconds to wait for the error message to send before disconnecting the client (defaults to 5_000) (has no effect is errorMsg is null)
	 * @since 1.0.0
	 */
	public async disconnect(errorMsg: string | null = null, msgTimeout: number = 5_000): Promise<void> {
		if (this.isDisconnected) {
			return
		}

		// Try to send the error message
		if (errorMsg !== null) {
			await new Promise<void>(async (res, rej) => {
				const timeout = setTimeout(res, msgTimeout)
				this.sendError(errorMsg)
					.then(() => {
						res()
						clearTimeout(timeout)
					})
					.catch(rej)
			})
		}

		// Close the client
		this.socket.destroy()
	}

	/**
	 * Sends a raw line to the client.
	 * @param line The line to send
	 * @param prependTime Whether to prepend the current timestamp (defaults to true)
	 * @param timestamp The timestamp to prepend or null for now (defaults to null)
	 * @param errorIfDisconnected Whether to throw an error if the client is disconnected instead of logging a warning (defaults to false)
	 * @since 1.0.0
	 */
	public async sendRawLine(line: string, prependTime: boolean = true, timestamp: Date | null = null, errorIfDisconnected: boolean = false): Promise<void> {
		if (this.isDisconnected) {
			const msg = `Tried to send raw line to disconnected client ${this.nick ?? '<unauthenticated client>'} (connected from ${this.socket.remoteAddress}:${this.socket.remotePort})`

			if (errorIfDisconnected) {
				throw new Error(msg)
			} else {
				console.warn(msg)
			}

			return
		}

		if (this.socket.closed) {
			throw new Error(`BUG: Tried to send to closed socket, but isDisconnected was false`)
		}

		const ln =
			prependTime && this.capabilities.includes('server-time')
				? `@time=${(timestamp || new Date()).toISOString()} ${line}`
				: line
		await new Promise<void>((res, rej) => {
			this.socket.write(ln + '\n', err => {
				if (err) {
					rej(err)
				} else {
					res()
				}
			})
		})
	}

	/**
	 * Sends a server message to the client.
	 * @param metadata The message metadata
	 * @param content The message content or null for none (defaults to null)
	 * @param prependTime Whether to prepend the current timestamp (defaults to true)
	 * @since 1.0.0
	 */
	public async sendServerMessage(
		metadata: string,
		content: string | null = null,
		prependTime: boolean = true,
	): Promise<void> {
		await this.sendRawLine(
			`:${this.ircd.hostname} ${metadata}${content === null ? '' : ' :' + content}`,
			prependTime,
		)
	}

	/**
	 * Sends a notice to the client.
	 * @param message The notice
	 * @param name The name that will appear next to the announcement, or null for none (defaults to null)
	 * @since 1.0.0
	 */
	public async sendNotice(message: string, name: string | null = null): Promise<void> {
		const lns = message.split('\n')
		const senderPrefix = name === null ? '' : `${name}!${name}@`
		for (const ln of lns)
			if (ln.length > 0)
				await this.sendRawLine(
					`:${senderPrefix}${this.ircd.hostname} NOTICE ${this.nickOrAsterisk} :${ln}`,
					true,
				)
	}

	/**
	 * Sends an error message to the client.
	 * @param message The error message
	 * @since 1.0.0
	 */
	public async sendError(message: string): Promise<void> {
		const lns = message.split('\n')
		for (const ln of lns) {
			if (ln.length > 0) {
				await this.sendRawLine('ERROR :' + ln)
			}
		}
	}

	/**
	 * Sends server info to the client.
	 * Should be sent before MotD and initial mode setting.
	 * @param {string} welcomeMsg The welcome message (e.g. "Welcome to the network!")
	 * @param {string} hostMsg The host message (e.g. "Your host is example.com running FunnyServer v12")
	 * @param {string} creationDateMsg The server creation date message (e.g. "This server was created on 2022-07-24T19:35:08.101Z")
	 * @param {string} serverVersion The server version string
	 * @param {string} networkName The network name for the client to display
	 * @since 1.0.0
	 */
	public async sendServerInfo(
		welcomeMsg: string,
		hostMsg: string,
		creationDateMsg: string,
		serverVersion: string,
		networkName: string,
	): Promise<void> {
		await this.sendServerMessage(`001 ${this.nickOrAsterisk}`, welcomeMsg)
		await this.sendServerMessage(`002 ${this.nickOrAsterisk}`, hostMsg)
		await this.sendServerMessage(`003 ${this.nickOrAsterisk}`, creationDateMsg)
		await this.sendServerMessage(`004 ${this.nickOrAsterisk} ${this.ircd.hostname} ${serverVersion}`)
		await this.sendServerMessage(
			`005 ${this.nickOrAsterisk} MODES NETWORK=${networkName} NICKLEN=32 UTF8MAPPING=rfc8265 UTF8ONLY`,
			'are supported by this server',
		)
	}

	/**
	 * Sends Message Of The Day text to the client.
	 * @param motd The MotD text
	 * @since 1.0.0
	 */
	public async sendMotd(motd: string): Promise<void> {
		const lns = motd.split('\n')
		for (const ln of lns) {
			await this.sendServerMessage('372 ' + this.nickOrAsterisk, ln)
		}
		await this.sendServerMessage('376 ' + this.nickOrAsterisk, 'End of MOTD command')
	}

	/**
	 * Sends a user channel join to the client.
	 * @param channel The channel the user joined
	 * @param userInfo The info of the user that joined
	 * @since 1.0.0
	 */
	public async sendUserJoin(channel: string, userInfo: IrcUserInfo): Promise<void> {
		await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} JOIN ${channel} * ${userInfo.realname}`, true)
	}

	/**
	 * Sends a self channel join to the client (has no effect if the user is not authenticated).
	 * @param channel The channel to join
	 * @since 1.0.0
	 */
	public async sendSelfJoin(channel: string): Promise<void> {
		if (this.isAuthenticated) {
			if (this.userInfo === null) {
				throw new Error('BUG: User info is null, but isAuthenticated is true')
			}

			await this.sendUserJoin(channel, this.userInfo)
		}
	}

	/**
	 * Sends a user channel part to the client.
	 * @param channel The channel the user parted
	 * @param userInfo The info of the user that joined
	 * @param reason The reason the user left, or null for "Leaving" (defaults to null)
	 * @since 1.0.0
	 */
	public async sendUserPart(channel: string, userInfo: IrcUserInfo, reason: string | null = null): Promise<void> {
		await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} PART ${channel} ${reason || 'Leaving'}`)
	}

	/**
	 * Sends a self channel part to the client (has no effect if the user is not authenticated)
	 * @param {string} channel The channel to part
	 * @param {string|null} reason The reason to part, or null for "Leaving" (defaults to null)
	 * @returns {Promise<void>}
	 * @since 1.0.0
	 */
	public async sendSelfPart(channel: string, reason: string | null = null): Promise<void> {
		if (this.isAuthenticated) {
			if (this.userInfo === null) {
				throw new Error('BUG: User info is null, but isAuthenticated is true')
			}

			await this.sendUserPart(channel, this.userInfo, reason)
		}
	}

	/**
	 * Sends info about a channel to the client.
	 * @param channel The channel
	 * @param topic The channel topic, or null for none
	 * @param creatorInfo The channel creator's user info
	 * @param mode The channel mode (e.g. "+Cnt")
	 * @param creationDate The date when the channel was created
	 * @param users The channel users
	 * @since 1.0.0
	 */
	public async sendChannelInfo(
		channel: string,
		topic: string | null,
		creatorInfo: IrcUserInfo,
		mode: string,
		creationDate: Date,
		users: IrcUserInfo[],
	): Promise<void> {
		// Send topic if present
		if (topic !== null) {
			await this.sendServerMessage(`332 ${this.nick} ${channel}`, topic, true)
		}

		const timestamp = Math.floor(creationDate.getTime() / 1000)

		// Send general info
		await this.sendServerMessage(
			`333 ${this.nick} ${channel} ${creatorInfo.nick}!~u@${creatorInfo.hostname} ${timestamp}`,
			null,
			true,
		)

		// Send user list
		for (let i = 0; i < Math.ceil(users.length / 3); i++) {
			await this.sendServerMessage(
				`353 ${this.nick} = ${channel}`,
				users
					.slice(i * 3, i * 3 + 3)
					.map(user => `${(user.status || 'H').substring(1)}${user.nick}!~u@${user.hostname}`)
					.join(' '),
				true,
			)
		}
		await this.sendServerMessage(`336 ${this.nick} ${channel}`, 'End of NAMES list', true)

		// Send mode and timestamp
		await this.sendServerMessage(`324 ${this.nick} ${channel} ${mode}`, null, true)
		await this.sendServerMessage(`329 ${this.nick} ${channel} ${timestamp}`, null, true)
	}

	/**
	 * Sends a list of channel users to the client.
	 * @param channel The channel
	 * @param users An array of user info (and optionally user status like 'H', 'G' optionally suffixed with '@', '~', '&', '+', etc.)
	 * @since 1.0.0
	 */
	public async sendChannelUsers(channel: string, users: IrcUserInfo[]): Promise<void> {
		for (const user of users) {
			await this.sendServerMessage(
				`352 ${this.nickOrAsterisk} ${channel} ${user.username} ${user.hostname} ${this.ircd.hostname} ${user.nick} ${user.status || 'H'} :0 ${user.realname}`,
				null,
				true,
			)
		}

		await this.sendServerMessage(`315 ${this.nickOrAsterisk} ${channel}`, 'End of WHO list', true)
	}

	/**
	 * Sends a chat message to the client.
	 * Messages with newlines or over the message length limit will be broken up and sent as multiple messages.
	 * @param channel The channel (or user if no suffix is present) from which the message came
	 * @param senderInfo The sender's info
	 * @param message The message to send
	 * @param sentTime The time the message was sent or null for no particular time (can be used for chat history)
	 * @since 1.0.0
	 */
	public async sendChatMessage(
		channel: string,
		senderInfo: IrcUserInfo,
		message: string,
		sentTime: Date | null = null,
	): Promise<void> {
		// Split message by newlines
		const msgs = message.split('\n')

		// Send each message
		for (let msg of msgs) {
			// Skip empty messages
			if (msg.length < 1) {
				continue
			}

			// Send message in 512 character chunks until there is no remaining text to send
			while (msg.length > 0) {
				const toSend = msg.substring(0, 512)
				msg = msg.substring(toSend.length)
				await this.sendRawLine(
					`:${senderInfo.nick}!~u@${senderInfo.hostname} PRIVMSG ${channel} :${toSend}`,
					true,
					sentTime,
				)
			}
		}
	}

	/**
	 * Sends a "/me"-styled chat message to the client.
	 * Since "/me" messages are just normal messages with special styling, this method is just a wrapper around sendChatMessage with specific text formatting.
	 * Messages with newlines or over the message length limit will be broken up and sent as multiple messages.
	 * @param channel The channel (or user if no suffix is present) from which the message came
	 * @param sender The sender's info
	 * @param message The message to send
	 * @param sentTime The time the message was sent or null for no particular time (can be used for chat history)
	 * @since 1.1.0
	 */
	public async sendMeMessage(
		channel: string,
		sender: IrcUserInfo,
		message: string,
		sentTime: Date | null = null,
	): Promise<void> {
		await this.sendChatMessage(channel, sender, `ACTION ${message}`, sentTime)
	}

	/**
	 * Sends a user away message to the client.
	 * @param userInfo The away user's info
	 * @param message The away message, or null for "I'm away" (defaults to null)
	 * @since 1.0.0
	 */
	public async sendUserAway(userInfo: IrcUserInfo, message: string | null = null): Promise<void> {
		await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} AWAY :${message || "I'm away"}`)
	}

	/**
	 * Sends a self away message to the client (has no effect if the user is not authenticated).
	 * @param message The away message, or null for "I'm away" (defaults to null)
	 * @since 1.0.0
	 */
	public async sendSelfAway(message: string | null = null): Promise<void> {
		if (this.isAuthenticated) {
			if (this.userInfo === null) {
				throw new Error('BUG: User info is null, but isAuthenticated is true')
			}

			await this.sendServerMessage(`306 ${this.nick} :You have been marked as away`)
			await this.sendUserAway(this.userInfo, message)
		}
	}

	/**
	 * Sends a user back message to the client.
	 * @param userInfo The back user's info
	 * @since 1.0.0
	 */
	public async sendUserBack(userInfo: IrcUserInfo): Promise<void> {
		await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} AWAY`)
	}

	/**
	 * Sends a self back message to the client (has no effect if the user is not authenticated).
	 * @since 1.0.0
	 */
	public async sendSelfBack(): Promise<void> {
		if (this.isAuthenticated) {
			if (this.userInfo === null) {
				throw new Error('BUG: User info is null, but isAuthenticated is true')
			}

			await this.sendServerMessage(`305 ${this.nick} :You are no longer marked as away`)
			await this.sendUserBack(this.userInfo)
		}
	}

	/**
	 * Sends a user changed nick message to the client.
	 * @param userInfo The info of the user that is changing their nick
	 * @param newNick The user's new nick
	 * @since 1.0.0
	 */
	public async sendUserChangedNick(userInfo: IrcUserInfo, newNick: string): Promise<void> {
		await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} NICK ${newNick}`, true)
	}

	/**
	 * Sends a nick rejected message to the client.
	 * @param newNick The new nick that was rejected
	 * @param message The rejection message, or null for "Nick is already taken" (defaults to null)
	 * @since 1.0.0
	 */
	public async sendNickRejected(newNick: string, message: string | null = null): Promise<void> {
		await this.sendServerMessage(`433 ${this.nickOrAsterisk} ${newNick}`, message || 'Nick is already taken', true)
	}

	/**
	 * Sends an online users check response to the client.
	 * @param onlineNicks The list of nicks that are online
	 * @since 1.0.0
	 */
	public async sendOnlineCheckResponse(onlineNicks: string[]): Promise<void> {
		let prefix = `303 ${this.nickOrAsterisk}`
		if (onlineNicks.length === 1) {
			await this.sendServerMessage(`${prefix} ${onlineNicks[0]}`)
		} else {
			await this.sendServerMessage(prefix, onlineNicks.join(' '))
		}
	}

	/**
	 * Sends a user online notification to the client.
	 * @param nick The nick of the user that just came online
	 * @since 1.0.0
	 */
	public async sendUserOnline(nick: string): Promise<void> {
		await this.sendServerMessage(`730 ${this.nickOrAsterisk} ${nick}`)
	}

	/**
	 * Sends a no such nick message to the client.
	 * @param nick The nick that does not exist
	 * @param message The message to send, or null for "No such nick" (defaults to null)
	 * @since 1.1.1
	 */
	public async sendNoSuchNick(nick: string, message: string | null = null): Promise<void> {
		await this.sendServerMessage(`401 ${this.nickOrAsterisk} ${nick}`, message || 'No such nick')
	}

	/**
	 * Sends a not in channel message to the client.
	 * @param channel The channel in question
	 * @param message The message to send, or null for "Not in channel" (defaults to null)
	 * @since 1.1.1
	 */
	public async sendNotInChannel(channel: string, message: string | null = null): Promise<void> {
		await this.sendServerMessage(`441 ${this.nickOrAsterisk} ${channel}`, message || 'Not in channel')
	}

	/**
	 * Sends a user kicked message to the client.
	 * @param channel The channel from which the user was kicked
	 * @param nick The nick of the user who was kicked
	 * @param reason The kick reason, or null for none
	 * @param kickerInfo The kicker's user info
	 * @since 1.1.1
	 */
	public async sendUserKicked(
		channel: string,
		nick: string,
		kickerInfo: IrcUserInfo,
		reason: string | null = null,
	): Promise<void> {
		await this.sendRawLine(
			`:${kickerInfo.nick}!~u@${kickerInfo.hostname} KICK ${channel} ${nick} ${reason || nick}`,
		)
	}

	/**
	 * Sends a channel topic change to the client.
	 * @param channel The channel that had its topic changed
	 * @param newTopic The new topic
	 * @param changerInfo The info of the user who changed the topic
	 * @since 1.1.1
	 */
	public async sendTopicChanged(channel: string, newTopic: string, changerInfo: IrcUserInfo): Promise<void> {
		await this.sendRawLine(
			`:${changerInfo.nick}!~u@${changerInfo.hostname} TOPIC ${channel} ${newTopic.includes(' ') ? ':' + newTopic : newTopic}`,
		)
	}

	/**
	 * Sends a channel operator required message to the client.
	 * @param channel The channel
	 * @param message The message, or null for "You must be a channel operator" (defaults to null)
	 * @since 1.1.1
	 */
	public async sendChannelOpsRequired(channel: string, message: string | null = null): Promise<void> {
		await this.sendServerMessage(
			`482 ${this.nickOrAsterisk} ${channel}`,
			message || 'You must be a channel operator',
		)
	}

	/**
	 * Sends a user mode change message to the client.
	 * @param channel The channel in which the user's mode changed
	 * @param nick The user whose mode changed
	 * @param mode The mode delta string (e.g. "+v", "-o", "+vo", etc.)
	 * @param changerInfo The changer's info
	 * @since 1.1.3
	 */
	public async sendUserModeChange(
		channel: string,
		nick: string,
		mode: string,
		changerInfo: IrcUserInfo,
	): Promise<void> {
		await this.sendRawLine(`:${changerInfo.nick}!~u@${changerInfo.hostname} MODE ${channel} ${mode} ${nick}`)
	}

	/**
	 * Changes the client's nick (has no effect if the user is not authenticated).
	 * @param newNick The new nick
	 * @since 1.0.0
	 */
	public async setNick(newNick: string): Promise<void> {
		if (this.isAuthenticated) {
			if (this.userInfo === null) {
				throw new Error('BUG: User info is null, but isAuthenticated is true')
			}

			await this.sendUserChangedNick(this.userInfo, newNick)
			this.userInfo.nick = newNick
		}
	}

	/**
	 * Sets the user's new mode.
	 * @param mode The new mode string
	 * @since 1.0.0
	 */
	public async setMode(mode: string): Promise<void> {
		this.#mode = mode
		await this.sendServerMessage('221 ' + this.nickOrAsterisk, mode)
	}

	/**
	 * Sets the client's hostname (has no effect is the user is not authenticated).
	 * @param hostname The new hostname
	 * @since 1.0.0
	 */
	public async setHostname(hostname: string): Promise<void> {
		if (this.isAuthenticated) {
			if (this.userInfo === null) {
				throw new Error('BUG: User info is null, but isAuthenticated is true')
			}

			this.userInfo.hostname = hostname
		}
	}

	/**
	 * Pings the client and returns the number of milliseconds it took to receive a reply.
	 * @returns The number of milliseconds it took to receive a reply
	 * @since 1.0.0
	 */
	public async ping(): Promise<number> {
		const start = Date.now()

		// Send ping
		const pingData = start.toString()
		await this.sendServerMessage('PING ' + pingData)

		await new Promise<void>((res, _rej) => {
			let handler: IrcClientLineHandler

			handler = ln => {
				if (ln.name === 'PONG' && ln.metadata === pingData) {
					this.removeOnLine(handler)
					this.lastPingDate = new Date()
				}
				res()
			}

			this.onLine(handler)
		})

		return Date.now() - start
	}
}
