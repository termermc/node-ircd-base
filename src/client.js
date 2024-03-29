const { IRCD_CAPS } = require('./constants')
// @ts-expect-error
const carrier = require('carrier');
const { sleep } = require('./util/misc')

/**
 * @typedef IrcUserInfo
 * @property {string} nick The user's nick
 * @property {string} username The user's username
 * @property {string|null} realname The user's real name
 * @property {string} hostname The user's hostname (can be real or fake)
 * @property {`${'H'|'G'}${string}`|string?} status The user's status (optional, e.g. 'H@' for online op, 'G' for away, 'G+' for away voiced, 'H~' for online owner, etc)
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
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientQuitHandler
 * @param {string|null} message The quit message, or null if there was none
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientLineHandler
 * @param {IrcClientParsedLine} line The parsed line
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientLoginAttemptHandler
 * @param {IrcUserInfo} userInfo The user info the client provided
 * @param {string|null} password The password the client is logged in with (can be null)
 * @param {() => Promise<void>} accept Function to be called signifying that the client's attempt has been accepted
 * @param {(reason?: string) => Promise<void>} deny Function to be called signifying that the client's attempt has been denied (optionally providing a reason string)
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientSuccessfulLoginHandler
 * @param {IrcUserInfo} userInfo The user info the client provided
 * @param {string|null} password The password the client logged in with (or null if no password was provided)
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientFailedLoginHandler
 * @param {IrcUserInfo} userInfo The user info the client provided
 * @param {string|null} password The password the client logged in with (or null if no password was provided)
 * @param {string|null} reason The reason the login failed, or null if none was provided (provided by a login attempt handler)
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientSocketErrorHandler
 * @param {Error} error The error that occurred
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientPingHandler
 * @param {string} data The data sent by the client to be repeated by the server
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientAuthTimeoutHandler
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientOnlineCheckHandler
 * @param {string[]} nicks An array of nicks the client is requesting to check for
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientJoinHandler
 * @param {string[]} channels The names of the channels the client is requesting to join
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientPartHandler
 * @param {string} channel The name of the channel the client is requesting to part
 * @param {string|null} reason The part reason, or null if none
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientChannelInfoHandler
 * @param {string} channel The name of the channel the client is requesting info for
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientChannelUsersHandler
 * @param {string} channel The name of the channel the client is requesting users for
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientChatMessageHandler
 * @param {string} channel The channel (or nick, if there is no prefix) in which the client sent the message
 * @param {string} message The chat message
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientAwayHandler
 * @param {string} message The away message
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientBackHandler
 * @returns {Promise<void> | void}
 * @since 1.0.0
 */

/**
 * @callback IrcClientKickHandler
 * @param {string} channel The channel from which the nick is being kicked
 * @param {string} nick The nick that is being kicked
 * @param {string|null} reason The kick reason, or null if none
 * @returns {Promise<void> | void}
 * @since 1.1.1
 */

/**
 * @callback IrcClientTopicChangeHandler
 * @param {string} channel The channel that is having its topic changed
 * @param {string} newTopic The new topic
 * @returns {Promise<void> | void}
 * @since 1.1.1
 */

/**
 * @callback IrcClientUserModeChangeHandler
 * @param {string} channel The channel where the user is
 * @param {string} nick The user's nick
 * @param {string[]} addedModes The modes that were added to the user
 * @param {string[]} removedModes The modes that were removed from the user
 * @returns {Promise<void> | void}
 * @since 1.1.3
 */

/**
 * @callback IrcClientChannelModeChangeHandler
 * @param {string} channel The channel
 * @param {string[]} addedModes The modes that were added to the user
 * @param {string[]} removedModes The modes that were removed from the user
 * @returns {Promise<void> | void}
 * @since 1.1.3
 */

/**
 * @callback IrcClientInviteHandler
 * @param {string} nick The nick of the user that is being invited
 * @param {string} channel The channel the nick is being invited to
 * @returns {Promise<void> | void}
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
     * @type {import('./ircd')}
     * @readonly
     * @since 1.0.0
     */
    ircd

    /**
     * The underlying network socket for this client
     * @type {import('net').Socket}
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
     * Whether the client disconnected
     * @type {boolean}
     */
    #disconnected = false

    /**
     * Returns the user's current mode
     * @returns {string}
     */
    get mode() { return this.#mode }

    /**
     * Returns whether the client is disconnected
     * @returns {boolean}
     */
    get isDisconnected() { return this.#disconnected }

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
     * Online check handlers
     * @type {IrcClientOnlineCheckHandler[]}
     */
    #onlineCheckHandlers = []
    /**
     * Join handlers
     * @type {IrcClientJoinHandler[]}
     */
    #joinHandlers = []
    /**
     * Part handlers
     * @type {IrcClientPartHandler[]}
     */
    #partHandlers = []
    /**
     * Channel info handlers
     * @type {IrcClientChannelInfoHandler[]}
     */
    #channelInfoHandlers = []
    /**
     * Channel users handlers
     * @type {IrcClientChannelUsersHandler[]}
     */
    #channelUsersHandlers = []
    /**
     * Chat message handlers
     * @type {IrcClientChatMessageHandler[]}
     */
    #chatMessageHandlers = []
    /**
     * Away handlers
     * @type {IrcClientAwayHandler[]}
     */
    #awayHandlers = []
    /**
     * Back handlers
     * @type {IrcClientBackHandler[]}
     */
    #backHandlers = []
    /**
     * Kick handlers
     * @type {IrcClientKickHandler[]}
     */
    #kickHandlers = []
    /**
     * Topic change handlers
     * @type {IrcClientTopicChangeHandler[]}
     */
    #topicChangeHandlers = []
    /**
     * User mode change handlers
     * @type {IrcClientUserModeChangeHandler[]}
     */
    #userModeChangeHandlers = []
    /**
     * Channel mode change handlers
     * @type {IrcClientChannelModeChangeHandler[]}
     */
    #channelModeChangeHandlers = []
    /**
     * Invite handlers
     * @type {IrcClientInviteHandler[]}
     */
    #inviteHandlers = []

    /**
     * Removes a handler from an array of handlers
     * @param {function[]} handlers The handlers
     * @param {function} handler The handler
     */
    static #removeHandler(handlers, handler) {
        for (let i = 0; i < handlers.length; i++) {
            if (handlers[i] === handler) {
                handlers.splice(i, 1)
                break;
            }
        }
    }

    /**
     * Registers a disconnect handler.
     * Disconnect handlers are the last event to be called on a client.
     * @param {IrcClientDisconnectHandler} handler The handler
     * @since 1.0.0
     */
    onDisconnect(handler) {
        this.#disconnectHandlers.push(handler)
    }
    /**
     * Removes a disconnect handler
     * @param {IrcClientDisconnectHandler} handler The handler
     * @since 1.0.0
     */
    removeOnDisconnect(handler) {
        IrcClient.#removeHandler(this.#disconnectHandlers, handler)
    }

    /**
     * Registers a quit handler.
     * Quit handlers are called when the client sends a QUIT message and is disconnected.
     * Called before onDisconnect, and may not be called at all if the connection was closed without a QUIT message being sent
     * @param {IrcClientQuitHandler} handler The handler
     * @since 1.0.0
     */
    onQuit(handler) {
        this.#quitHandlers.push(handler)
    }
    /**
     * Removes a quit handler
     * @param {IrcClientQuitHandler} handler The handler
     * @since 1.0.0
     */
    removeOnQuit(handler) {
        IrcClient.#removeHandler(this.#quitHandlers, handler)
    }

    /**
     * Registers a line handler.
     * Line handlers are called when the client sends a line, and before it is handled by the server.
     * Since server logic must wait for all line handlers, avoid slow logic unless absolutely necessary.
     * @param {IrcClientLineHandler} handler The handler
     * @since 1.0.0
     */
    onLine(handler) {
        this.#lineHandlers.push(handler)
    }
    /**
     * Removes a line handler
     * @param {IrcClientLineHandler} handler The handler
     * @since 1.0.0
     */
    removeOnLine(handler) {
        IrcClient.#removeHandler(this.#lineHandlers, handler)
    }

    /**
     * Registers a login attempt handler.
     * Login attempt handlers are called when the client submits login details.
     * Note that once a handler has called accept() or deny(), no other handlers will be called.
     * Ideally only one handler will be registered to avoid confusing situations.
     * @param {IrcClientLoginAttemptHandler} handler The handler
     * @since 1.0.0
     */
    onLoginAttempt(handler) {
        this.#loginAttemptHandlers.push(handler)
    }
    /**
     * Removes a login attempt handler
     * @param {IrcClientLoginAttemptHandler} handler The handler
     * @since 1.0.0
     */
    removeOnLoginAttempt(handler) {
        IrcClient.#removeHandler(this.#loginAttemptHandlers, handler)
    }
    
    /**
     * Registers a successful login handler.
     * Successful login handlers are called when the client successfully logs in.
     * IMPORTANT: It is the obligation of the programmer to send the server info, send the MotD, and set the client's mode after a successful login to let the client know that it is now properly authenticated.
     * @param {IrcClientSuccessfulLoginHandler} handler The handler
     * @since 1.0.0
     */
    onSuccessfulLogin(handler) {
        this.#successfulLoginHandlers.push(handler)
    }
    /**
     * Removes a successful login handler
     * @param {IrcClientSuccessfulLoginHandler} handler The handler
     * @since 1.0.0
     */
    removeOnSuccessfulLogin(handler) {
        IrcClient.#removeHandler(this.#successfulLoginHandlers, handler)
    }

    /**
     * Registers a failed login handler.
     * Failed login handlers are called when the client failed a login attempt.
     * The login process is restarted after this point (although negotiated values are still temporarily held), but the programmer has the option of simply disconnecting the client or issuing a taken nick message.
     * @param {IrcClientFailedLoginHandler} handler The handler
     * @since 1.0.0
     */
    onFailedLogin(handler) {
        this.#failedLoginHandlers.push(handler)
    }
    /**
     * Removes a failed login handler
     * @param {IrcClientFailedLoginHandler} handler The handler
     * @since 1.0.0
     */
    removeOnFailedLogin(handler) {
        IrcClient.#removeHandler(this.#failedLoginHandlers, handler)
    }

    /**
     * Registers a socket error handler.
     * Socket error handlers are called when an error occurs on in socket connection.
     * May or may not be fatal; if it was fatal, disconnect handlers will be called after this.
     * @param {IrcClientSocketErrorHandler} handler The handler
     * @since 1.0.0
     */
    onSocketError(handler) {
        this.#socketErrorHandlers.push(handler)
    }
    /**
     * Removes a socket error handler
     * @param {IrcClientSocketErrorHandler} handler The handler
     * @since 1.0.0
     */
    removeOnSocketError(handler) {
        IrcClient.#removeHandler(this.#socketErrorHandlers, handler)
    }

    /**
     * Registers a ping handler.
     * Ping handlers are called when the client sends a ping request.
     * Handlers are called before the server responds, so if handlers are slow then it will reflect badly on the server's ping time.
     * @param {IrcClientPingHandler} handler The handler
     * @since 1.0.0
     */
    onPing(handler) {
        this.#pingHandlers.push(handler)
    }
    /**
     * Removes a ping handler
     * @param {IrcClientPingHandler} handler The handler
     * @since 1.0.0
     */
    removeOnPing(handler) {
        IrcClient.#removeHandler(this.#pingHandlers, handler)
    }

    /**
     * Registers an auth timeout handler.
     * Auth timeout handlers are called when the client fails to authenticate within a specified period of time.
     * Disconnect handlers are called afterwards.
     * @param {IrcClientAuthTimeoutHandler} handler The handler
     * @since 1.0.0
     */
    onAuthTimeout(handler) {
        this.#authTimeoutHandlers.push(handler)
    }
    /**
     * Removes an auth timeout handler
     * @param {IrcClientAuthTimeoutHandler} handler The handler
     * @since 1.0.0
     */
    removeOnAuthTimeout(handler) {
        IrcClient.#removeHandler(this.#authTimeoutHandlers, handler)
    }

    /**
     * Registers an online check handler.
     * Online check handlers are called when the user asks to know whether a user is online or not.
     * @param {IrcClientOnlineCheckHandler} handler The handler
     * @since 1.0.0
     */
    onOnlineCheck(handler) {
        this.#onlineCheckHandlers.push(handler)
    }
    /**
     * Removes an online check handler
     * @param {IrcClientOnlineCheckHandler} handler The handler
     * @since 1.0.0
     */
    removeOnOnlineCheck(handler) {
        IrcClient.#removeHandler(this.#onlineCheckHandlers, handler)
    }

    /**
     * Registers a join handler.
     * Join handlers are called when the user tries to join a channel.
     * @param {IrcClientJoinHandler} handler The handler
     * @since 1.0.0
     */
    onJoin(handler) {
        this.#joinHandlers.push(handler)
    }
    /**
     * Removes a join handler
     * @param {IrcClientJoinHandler} handler The handler
     * @since 1.0.0
     */
    removeOnJoin(handler) {
        IrcClient.#removeHandler(this.#joinHandlers, handler)
    }

    /**
     * Registers a part handler.
     * Part handlers are called when the user tries to part a channel.
     * @param {IrcClientPartHandler} handler The handler
     * @since 1.0.0
     */
    onPart(handler) {
        this.#partHandlers.push(handler)
    }
    /**
     * Removes a part handler
     * @param {IrcClientPartHandler} handler The handler
     * @since 1.0.0
     */
    removeOnPart(handler) {
        IrcClient.#removeHandler(this.#partHandlers, handler)
    }

    /**
     * Registers a channel info handler.
     * Channel info handlers are called when the user requests info about a channel.
     * @param {IrcClientChannelInfoHandler} handler The handler
     * @since 1.0.0
     */
    onChannelInfo(handler) {
        this.#channelInfoHandlers.push(handler)
    }
    /**
     * Removes a channel info handler
     * @param {IrcClientChannelInfoHandler} handler The handler
     * @since 1.0.0
     */
    removeOnChannelInfo(handler) {
        IrcClient.#removeHandler(this.#channelInfoHandlers, handler)
    }

    /**
     * Registers a channel users handler.
     * Channel users handlers are called when the user requests a channel's user list.
     * @param {IrcClientChannelUsersHandler} handler The handler
     * @since 1.0.0
     */
    onChannelUsers(handler) {
        this.#channelUsersHandlers.push(handler)
    }
    /**
     * Removes a channel users handler
     * @param {IrcClientChannelUsersHandler} handler The handler
     * @since 1.0.0
     */
    removeOnChannelUsers(handler) {
        IrcClient.#removeHandler(this.#channelUsersHandlers, handler)
    }

    /**
     * Registers a chat message handler.
     * Chat message handlers are called when the user sends a chat message, either in a channel or as a private message
     * @param {IrcClientChatMessageHandler} handler The handler
     * @since 1.0.0
     */
    onChatMessage(handler) {
        this.#chatMessageHandlers.push(handler)
    }
    /**
     * Removes a chat message handler
     * @param {IrcClientChatMessageHandler} handler The handler
     * @since 1.0.0
     */
    removeOnChatMessage(handler) {
        IrcClient.#removeHandler(this.#chatMessageHandlers, handler)
    }

    /**
     * Registers an away handler.
     * Away handlers are called when the user marks himself/herself as away
     * @param {IrcClientAwayHandler} handler The handler
     */
    onAway(handler) {
        this.#awayHandlers.push(handler)
    }
    /**
     * Removes an away handler
     * @param {IrcClientAwayHandler} handler The handler
     * @since 1.0.0
     */
    removeOnAway(handler) {
        IrcClient.#removeHandler(this.#awayHandlers, handler)
    }

    /**
     * Registers a back handler.
     * Back handlers are called when the user marks himself/herself as back (not away)
     * @param {IrcClientBackHandler} handler The handler
     * @since 1.0.0
     */
    onBack(handler) {
        this.#backHandlers.push(handler)
    }
    /**
     * Removes a back handler
     * @param {IrcClientBackHandler} handler The handler
     * @since 1.0.0
     */
    removeOnBack(handler) {
        IrcClient.#removeHandler(this.#backHandlers, handler)
    }

    /**
     * Registers a kick handler.
     * Kick handlers are called when the user kicks a user from a channel
     * @param {IrcClientKickHandler} handler The handler
     * @since 1.1.1
     */
    onKick(handler) {
        this.#kickHandlers.push(handler)
    }
    /**
     * Removes a kick handler
     * @param {IrcClientKickHandler} handler The handler
     * @since 1.1.1
     */
    removeOnKick(handler) {
        IrcClient.#removeHandler(this.#kickHandlers, handler)
    }

    /**
     * Registers a topic change handler.
     * Topic change handlers are called when the user changes a channel topic
     * @param {IrcClientTopicChangeHandler} handler The handler
     * @since 1.1.1
     */
    onTopicChange(handler) {
        this.#topicChangeHandlers.push(handler)
    }
    /**
     * Removes a topic change handler
     * @param {IrcClientTopicChangeHandler} handler The handler
     * @since 1.1.1
     */
    removeOnTopicChange(handler) {
        IrcClient.#removeHandler(this.#topicChangeHandlers, handler)
    }

    /**
     * Registers a user mode change handler.
     * User mode change handlers are called when the user changes a channel user's mode
     * @param {IrcClientUserModeChangeHandler} handler The handler
     * @since 1.1.3
     */
    onUserModeChange(handler) {
        this.#userModeChangeHandlers.push(handler)
    }
    /**
     * Removes a user mode change handler
     * @param {IrcClientUserModeChangeHandler} handler The handler
     * @since 1.1.3
     */
    removeOnUserModeChange(handler) {
        IrcClient.#removeHandler(this.#userModeChangeHandlers, handler)
    }

    /**
     * Registers a channel mode change handler.
     * User mode change handlers are called when the user changes a channel's mode
     * @param {IrcClientChannelModeChangeHandler} handler The handler
     * @since 1.1.3
     */
    onChannelModeChange(handler) {
        this.#channelModeChangeHandlers.push(handler)
    }
    /**
     * Removes a channel mode change handler
     * @param {IrcClientChannelModeChangeHandler} handler The handler
     * @since 1.1.3
     */
    removeOnChannelModeChange(handler) {
        IrcClient.#removeHandler(this.#channelModeChangeHandlers, handler)
    }

    /**
     * Registers an invite handler.
     * Invite handlers are called when the user invites another user to a channel
     * @param {IrcClientInviteHandler} handler The handler
     * @since 1.1.5
     */
    onInvite(handler) {
        this.#inviteHandlers.push(handler)
    }
    /**
     * Removes an invite handler
     * @param {IrcClientInviteHandler} handler The handler
     * @since 1.1.5
     */
    removeOnInvite(handler) {
        IrcClient.#removeHandler(this.#inviteHandlers, handler)
    }
    
    /**
     * Creates a new client object
     * @param {import('net').Socket} socket The client's socket
     * @param {import('./ircd')} ircd The IRCd this client is associated with
     * @since 1.0.0
     */
    constructor(socket, ircd) {
        this.socket = socket
        this.ircd = ircd
    }

    /**
     * Dispatches event handlers
     * @param {string} name The event name
     * @param {((...args: any) => Promise<any> | void)[]} handlers The handlers
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
     * Parses a mode delta string (e.g. "+v") into added and removed mode chars
     * @param {string} delta The delta string (e.g. "+v")
     * @returns {[string[], string[]]} A 2-element tuple containing the added mode chars and the removed mode chars
     */
    static #parseModeDelta(delta) {
        if(delta.length < 2)
            return [ [], [] ]

        const type = delta[0]
        const chars = delta.substring(1).split('')
        if(type === '+')
            return [ chars, [] ]
        else if(type === '-')
            return [ [], chars ]
        else
            return [ [], [] ]
    }

    /**
     * Parses the provided IRC client line
     * @param {string} ln The line to parse
     * @returns {IrcClientParsedLine|null} The parsed line or null if the line is malformed
     * @since 1.0.0
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
     * @since 1.0.0
     */
    async initialize() {
        // Periodically ping the client
        const pingInterval = setInterval(() => this.ping(), this.ircd.clientPingPeriod)

        // Setup socket handlers
        this.socket.on('close', () => {
            this.#disconnected = true
            IrcClient.#dispatchEvent('disconnect', this.#disconnectHandlers)
            clearInterval(pingInterval)
        })
        this.socket.on('error', err => IrcClient.#dispatchEvent('socket error', this.#socketErrorHandlers, [ err ]))

        // Malformed line error util
        const sendMalformedLnErr = () => this.sendError('Malformed line received')

        // Unfinished user info awaiting completion (only using during the authentication stage)
        /** @type {string | null} */
        let authNick = null
        /** @type {string | null} */
        let authUsername = null
        /** @type {string | null} */
        let authRealname = null
        /** @type {string | null} */
        let authPass = null
        /** @type {string[] | null} */
        let authCaps = null
        let authCapsEnded = false

        // Authentication timeout
        const authTimeoutFunc = async () => {
            await IrcClient.#dispatchEvent('auth timeout', this.#authTimeoutHandlers)
            await this.disconnect('You took too long to authenticate')
        }
        let authTimeout = setTimeout(authTimeoutFunc, this.ircd.authenticationTimeout)

        // Setup line reader
        const carry = carrier.carry(this.socket)
        carry.on('line', async (/** @type {string} */ ln) => {
            try {
                const parsed = IrcClient.parseLine(ln)
                if (parsed === null) {
                    await sendMalformedLnErr()
                    return
                }

                // Dispatch line event
                await IrcClient.#dispatchEvent('line', this.#lineHandlers, [parsed])

                // Handle QUITs
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
                            await IrcClient.#dispatchEvent('ping', this.#pingHandlers, [ pingData ])
                            await this.sendServerMessage(`PONG ${this.ircd.hostname} ${pingData}`, null, true)
                        } else if(parsed.name === 'JOIN') { // Channel join
                            const channels = parsed.metadata?.split(',')
                            if(channels)
                                await IrcClient.#dispatchEvent('join', this.#joinHandlers, [ channels ])
                        } else if(parsed.name === 'PART') { // Channel part
                            const channel = parsed.metadata
                            if(channel)
                                await IrcClient.#dispatchEvent('part', this.#partHandlers, [ channel, parsed.content ])
                        } else if(parsed.name === 'MODE') { // Mode commands
                            const parts = parsed.metadata.split(' ')

                            if(parts.length === 1) // Channel info request
                                await IrcClient.#dispatchEvent('channel info', this.#channelInfoHandlers, [ parts[0] ])
                            else if(parts.length === 2) // Channel mode change
                                await IrcClient.#dispatchEvent('channel mode change', this.#channelModeChangeHandlers, [ parts[0], ...IrcClient.#parseModeDelta(parts[1]) ])
                            else if(parts.length === 3) // Channel user mode change
                                await IrcClient.#dispatchEvent('user mode change', this.#userModeChangeHandlers, [ parts[0], parts[2], ...IrcClient.#parseModeDelta(parts[1]) ])
                        } else if(parsed.name === 'WHO') { // Channel user list
                            await IrcClient.#dispatchEvent('channel users', this.#channelUsersHandlers, [ parsed.metadata.split(' ')[0] ]) // Doesn't support the full spec, just fetches all users
                        } else if(parsed.name === 'PRIVMSG') { // Message
                            let chan
                            let content

                            if (parsed.content === null) {
                                [chan, content] = parsed.metadata.split(' ')
                            } else {
                                chan = parsed.metadata
                                content = parsed.content
                            }

                            await IrcClient.#dispatchEvent('chat message', this.#chatMessageHandlers, [ chan, content ])
                        } else if(parsed.name === 'AWAY') { // Away/back
                            if(parsed.content === null)
                                await IrcClient.#dispatchEvent('back', this.#backHandlers)
                            else
                                await IrcClient.#dispatchEvent('away', this.#awayHandlers, [ parsed.content ])
                        } else if(parsed.name === 'ISON') { // Online check
                            await IrcClient.#dispatchEvent('online check', this.#onlineCheckHandlers, [ parsed.metadata.split(' ') ])
                        } else if(parsed.name === 'KICK') { // Channel user kick
                            const [ channel, nick ] = parsed.metadata.split(' ')
                            await IrcClient.#dispatchEvent('kick', this.#kickHandlers, [ channel, nick, parsed.content ])
                        } else if(parsed.name === 'TOPIC') { // Channel topic change
                            await IrcClient.#dispatchEvent('topic change', this.#topicChangeHandlers, [ parsed.metadata, parsed.content ])
                        } else if(parsed.name === 'INVITE') { // Channel invite user
                            const [ nick, channel ] = parsed.metadata.split(' ')
                            if(nick && channel)
                                await IrcClient.#dispatchEvent('invite', this.#inviteHandlers, [ nick, channel ])
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
                            /**
                             * @param {IrcClientFailedLoginHandler[]} handlers
                             * @param {string} reason
                             * @returns {Promise<void>}
                             */
                            const commonResLogic = async (handlers, reason) => {
                                acceptedOrDenied = true

                                // Call handlers
                                for (const handler of handlers)
                                    await handler(userInfo, authPass, reason)
                            }
                            const accept = async () => {
                                // Set user info and capabilities
                                // @ts-expect-error
                                this.userInfo = userInfo
                                // @ts-expect-error
                                this.capabilities = authCaps

                                await commonResLogic(this.#successfulLoginHandlers, undefined)
                            }
                            /**
                             * @param {string} reason
                             * @returns {Promise<void>}
                             */
                            const deny = async (reason) => {
                                await commonResLogic(this.#failedLoginHandlers, reason || null)

                                // Because the authentication attempt was denied, reset the authentication timeout
                                authTimeout = setTimeout(authTimeoutFunc, this.ircd.authenticationTimeout)
                            }

                            // Create user info object
                            /**
                             * @type {IrcUserInfo}
                             */
                            const userInfo = {
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
                            for (let i = 0; i < handlers.length && !acceptedOrDenied; i++)
                                await handlers[i](userInfo, authPass, accept, deny)
                        }

                        if (parsed.name === 'NICK') { // Nick setting command
                            authNick = parsed.metadata

                            // If all metadata is already set, call auth logic
                            if(authNick !== null && authUsername !== null && authCaps !== null)
                                await authLogic()
                        } else if (parsed.name === 'PASS') { // Password command
                            authPass = parsed.metadata
                        } else if (parsed.name === 'USER') { // User info setting command
                            authUsername = parsed.metadata.split(' ')[0] || authNick
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
     * @since 1.0.0
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
     * @param {boolean} prependTime Whether to prepend the current timestamp (defaults to true)
     * @param {Date|null} timestamp The timestamp to prepend or null for now
     * @return {Promise<void>}
     * @since 1.0.0
     */
    async sendRawLine(line, prependTime = true, timestamp = null) {
        const ln = (prependTime && this.capabilities.includes('server-time')) ? `@time=${(timestamp || new Date()).toISOString()} ${line}` : line
        await new Promise((res, _rej) => {
            this.socket.write(ln+'\n', () => res())
        })
    }

    /**
     * Sends a server message to the client
     * @param {string} metadata The message metadata
     * @param {string|null} content The message content or null for none (defaults to null)
     * @param {boolean} prependTime Whether to prepend the current timestamp (defaults to true}
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendServerMessage(metadata, content = null, prependTime = true) {
        await this.sendRawLine(`:${this.ircd.hostname} ${metadata}${content === null ? '' : ' :'+content}`, prependTime)
    }

    /**
     * Sends a notice to the client
     * @param {string} message The notice
     * @param {string|null} name The name that will appear next to the announcement, or null for none (defaults to null)
     * @return {Promise<void>}
     * @since 1.0.0
     */
    async sendNotice(message, name = null) {
        const lns = message.split('\n')
        const senderPrefix = name === null ? '' : `${name}!${name}@`
        for(const ln of lns)
            if(ln.length > 0)
                await this.sendRawLine(`:${senderPrefix}${this.ircd.hostname} NOTICE ${this.nickOrAsterisk} :${ln}`, true)
    }

    /**
     * Sends an error message to the client
     * @param {string} message The error message
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendError(message) {
        const lns = message.split('\n')
        for(const ln of lns)
            if(ln.length > 0)
                await this.sendRawLine('ERROR :'+ln)
    }

    /**
     * Sends server info to the client.
     * Should be sent before MotD and initial mode setting
     * @param {string} welcomeMsg The welcome message (e.g. "Welcome to the network!")
     * @param {string} hostMsg The host message (e.g. "Your host is example.com running FunnyServer v12")
     * @param {string} creationDateMsg The server creation date message (e.g. "This server was created on 2022-07-24T19:35:08.101Z")
     * @param {string} serverVersion The server version string
     * @param {string} networkName The network name for the client to display
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendServerInfo(welcomeMsg, hostMsg, creationDateMsg, serverVersion, networkName) {
        await this.sendServerMessage(`001 ${this.nickOrAsterisk}`, welcomeMsg)
        await this.sendServerMessage(`002 ${this.nickOrAsterisk}`, hostMsg)
        await this.sendServerMessage(`003 ${this.nickOrAsterisk}`, creationDateMsg)
        await this.sendServerMessage(`004 ${this.nickOrAsterisk} ${this.ircd.hostname} ${serverVersion}`)
        await this.sendServerMessage(`005 ${this.nickOrAsterisk} MODES NETWORK=${networkName} NICKLEN=32 UTF8MAPPING=rfc8265 UTF8ONLY`, 'are supported by this server')
    }

    /**
     * Sends Message Of The Day text to the client
     * @param {string} motd The MotD text
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendMotd(motd) {
        const lns = motd.split('\n')
        for(const ln of lns)
            await this.sendServerMessage('372 '+this.nickOrAsterisk, ln)
        await this.sendServerMessage('376 '+this.nickOrAsterisk, 'End of MOTD command')
    }

    /**
     * Sends a user channel join to the client
     * @param {string} channel The channel the user joined
     * @param {IrcUserInfo} userInfo The info of the user that joined
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendUserJoin(channel, userInfo) {
        await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} JOIN ${channel} * ${userInfo.realname}`, true)
    }

    /**
     * Sends a self channel join to the client (has no effect if the user is not authenticated)
     * @param {string} channel The channel to join
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendSelfJoin(channel) {
        if(this.isAuthenticated)
            await this.sendUserJoin(channel, this.userInfo)
    }

    /**
     * Sends a user channel part to the client
     * @param {string} channel The channel the user parted
     * @param {IrcUserInfo} userInfo The info of the user that joined
     * @param {string|null} reason The reason the user left, or null for "Leaving" (defaults to null)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendUserPart(channel, userInfo, reason = null) {
        await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} PART ${channel} ${reason || 'Leaving'}`)
    }

    /**
     * Sends a self channel part to the client (has no effect if the user is not authenticated)
     * @param {string} channel The channel to part
     * @param {string|null} reason The reason to part, or null for "Leaving" (defaults to null)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendSelfPart(channel, reason = null) {
        if(this.isAuthenticated)
            await this.sendUserPart(channel, this.userInfo, reason)
    }

    /**
     * Sends info about a channel to the client
     * @param {string} channel The channel
     * @param {string|null} topic The channel topic, or null for none
     * @param {IrcUserInfo} creatorInfo The channel creator's user info
     * @param {string} mode The channel mode (e.g. "+Cnt")
     * @param {Date} creationDate The date when the channel was created
     * @param {IrcUserInfo[]} users The channel users
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendChannelInfo(channel, topic, creatorInfo, mode, creationDate, users) {
        // Send topic if present
        if(topic !== null)
            await this.sendServerMessage(`332 ${this.nick} ${channel}`, topic, true)

        const timestamp = Math.floor(creationDate.getTime()/1000)

        // Send general info
        await this.sendServerMessage(`333 ${this.nick} ${channel} ${creatorInfo.nick}!~u@${creatorInfo.hostname} ${timestamp}`, null, true)

        // Send user list
        for(let i = 0; i < Math.ceil(users.length/3); i++)
            await this.sendServerMessage(`353 ${this.nick} = ${channel}`, users.slice(i*3, (i*3)+3).map(user => `${(user.status || 'H').substring(1)}${user.nick}!~u@${user.hostname}`).join(' '), true)
        await this.sendServerMessage(`336 ${this.nick} ${channel}`, 'End of NAMES list', true)

        // Send mode and timestamp
        await this.sendServerMessage(`324 ${this.nick} ${channel} ${mode}`, null, true)
        await this.sendServerMessage(`329 ${this.nick} ${channel} ${timestamp}`, null, true)
    }

    /**
     * Sends a list of channel users to the client
     * @param {string} channel The channel
     * @param {IrcUserInfo[]} users An array of user info (and optionally user status like 'H', 'G' optionally suffixed with '@', '~', '&', '+', etc)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendChannelUsers(channel, users) {
        for(const user of users)
            await this.sendServerMessage(`352 ${this.nickOrAsterisk} ${channel} ${user.username} ${user.hostname} ${this.ircd.hostname} ${user.nick} ${user.status || 'H'} :0 ${user.realname}`, null, true)
        await this.sendServerMessage(`315 ${this.nickOrAsterisk} ${channel}`, 'End of WHO list', true)
    }

    /**
     * Sends a chat message to the client.
     * Messages with newlines or over the message length limit will be broken up and sent as multiple messages.
     * @param {string} channel The channel (or user if no suffix is present) from which the message came
     * @param {IrcUserInfo} senderInfo The sender's info
     * @param {string} message The message to send
     * @param {Date|null} sentTime The time the message was sent or null for no particular time (can be used for chat history)
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendChatMessage(channel, senderInfo, message, sentTime = null) {
        // Split message by newlines
        const msgs = message.split('\n')

        // Send each message
        for(let msg of msgs) {
            // Skip empty messages
            if(msg.length < 1)
                continue

            // Send message in 512 character chunks until there is no remaining text to send
            while(msg.length > 0) {
                const toSend = msg.substring(0, 512)
                msg = msg.substring(toSend.length)
                await this.sendRawLine(`:${senderInfo.nick}!~u@${senderInfo.hostname} PRIVMSG ${channel} :${toSend}`, true, sentTime)
            }
        }
    }

    /**
     * Sends a "/me"-styled chat message to the client.
     * Since "/me" messages are just normal messages with special styling, this method is just a wrapper around sendChatMessage with specific text formatting.
     * Messages with newlines or over the message length limit will be broken up and sent as multiple messages.
     * @param {string} channel The channel (or user if no suffix is present) from which the message came
     * @param {IrcUserInfo} sender The sender's info
     * @param {string} message The message to send
     * @param {Date|null} sentTime The time the message was sent or null for no particular time (can be used for chat history)
     * @return {Promise<void>}
     * @since 1.1.0
     */
    async sendMeMessage(channel, sender, message, sentTime = null) {
        await this.sendChatMessage(channel, sender, `ACTION ${message}`, sentTime)
    }

    /**
     * Sends a user away message to the client
     * @param {IrcUserInfo} userInfo The away user's info
     * @param {string|null} message The away message, or null for "I'm away" (defaults to null)
     * @return {Promise<void>}
     * @since 1.0.0
     */
    async sendUserAway(userInfo, message = null) {
        await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} AWAY :${message || 'I\'m away'}`)
    }

    /**
     * Sends a self away message to the client (has no effect if the user is not authenticated)
     * @param {string|null} message The away message, or null for "I'm away" (defaults to null)
     * @return {Promise<void>}
     * @since 1.0.0
     */
    async sendSelfAway(message = null) {
        if(this.isAuthenticated) {
            await this.sendServerMessage(`306 ${this.nick} :You have been marked as away`)
            await this.sendUserAway(this.userInfo, message)
        }
    }

    /**
     * Sends a user back message to the client
     * @param {IrcUserInfo} userInfo The back user's info
     * @return {Promise<void>}
     * @since 1.0.0
     */
    async sendUserBack(userInfo) {
        await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} AWAY`)
    }

    /**
     * Sends a self back message to the client (has no effect if the user is not authenticated)
     * @return {Promise<void>}
     * @since 1.0.0
     */
    async sendSelfBack() {
        if(this.isAuthenticated) {
            await this.sendServerMessage(`305 ${this.nick} :You are no longer marked as away`)
            await this.sendUserBack(this.userInfo)
        }
    }

    /**
     * Sends a user changed nick message to the client
     * @param {IrcUserInfo} userInfo The info of the user that is changing their nick
     * @param {string} newNick The user's new nick
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendUserChangedNick(userInfo, newNick) {
        await this.sendRawLine(`:${userInfo.nick}!~u@${userInfo.hostname} NICK ${newNick}`, true)
    }

    /**
     * Sends a nick rejected message to the client
     * @param {string} newNick The new nick that was rejected
     * @param {string|null} message The rejection message, or null for "Nick is already taken" (defaults to null)
     * @since 1.0.0
     */
    async sendNickRejected(newNick, message = null) {
        await this.sendServerMessage(`433 ${this.nickOrAsterisk} ${newNick}`, message || 'Nick is already taken', true)
    }

    /**
     * Sends an online users check response to the client
     * @param {string[]} onlineNicks The list of nicks that are online
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendOnlineCheckResponse(onlineNicks) {
        let prefix = `303 ${this.nickOrAsterisk}`
        if(onlineNicks.length === 1)
            await this.sendServerMessage(`${prefix} ${onlineNicks[0]}`)
        else
            await this.sendServerMessage(prefix, onlineNicks.join(' '))
    }

    /**
     * Sends a user online notification to the client
     * @param {string} nick The nick of the user that just came online
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async sendUserOnline(nick) {
        await this.sendServerMessage(`730 ${this.nickOrAsterisk} ${nick}`)
    }

    /**
     * Sends a no such nick message to the client
     * @param {string} nick The nick that does not exist
     * @param {string|null} message The message to send, or null for "No such nick" (defaults to null)
     * @returns {Promise<void>}
     * @since 1.1.1
     */
    async sendNoSuchNick(nick, message = null) {
        await this.sendServerMessage(`401 ${this.nickOrAsterisk} ${nick}`, message || 'No such nick')
    }

    /**
     * Sends a not in channel message to the client
     * @param {string} channel The channel in question
     * @param {string|null} message The message to send, or null for "Not in channel" (defaults to null)
     * @returns {Promise<void>}
     * @since 1.1.1
     */
    async sendNotInChannel(channel, message = null) {
        await this.sendServerMessage(`441 ${this.nickOrAsterisk} ${channel}`, message || 'Not in channel')
    }

    /**
     * Sends a user kicked message to the client
     * @param {string} channel The channel from which the user was kicked
     * @param {string} nick The nick of the user who was kicked
     * @param {string|null} reason The kick reason, or null for none
     * @param {IrcUserInfo} kickerInfo The kicker's user info
     * @returns {Promise<void>}
     * @since 1.1.1
     */
    async sendUserKicked(channel, nick, kickerInfo, reason = null) {
        await this.sendRawLine(`:${kickerInfo.nick}!~u@${kickerInfo.hostname} KICK ${channel} ${nick} ${reason || nick}`)
    }

    /**
     * Sends a channel topic change to the client
     * @param {string} channel The channel that had its topic changed
     * @param {string} newTopic The new topic
     * @param {IrcUserInfo} changerInfo The info of the user who changed the topic
     * @returns {Promise<void>}
     * @since 1.1.1
     */
    async sendTopicChanged(channel, newTopic, changerInfo) {
        await this.sendRawLine(`:${changerInfo.nick}!~u@${changerInfo.hostname} TOPIC ${channel} ${newTopic.includes(' ') ? ':'+newTopic : newTopic}`)
    }

    /**
     * Sends a channel operator required message to the client
     * @param {string} channel The channel
     * @param {string|null} message The message, or null for "You must be a channel operator" (defaults to null)
     * @returns {Promise<void>}
     * @since 1.1.1
     */
    async sendChannelOpsRequired(channel, message = null) {
        await this.sendServerMessage(`482 ${this.nickOrAsterisk} ${channel}`, message || 'You must be a channel operator')
    }

    /**
     * Sends a user mode change message to the client
     * @param {string} channel The channel in which the user's mode changed
     * @param {string} nick The user whose mode changed
     * @param {string} mode The mode delta string (e.g. "+v", "-o", "+vo", etc)
     * @param {IrcUserInfo} changerInfo The changer's info
     * @returns {Promise<void>}
     * @since 1.1.3
     */
    async sendUserModeChange(channel, nick, mode, changerInfo) {
        await this.sendRawLine(`:${changerInfo.nick}!~u@${changerInfo.hostname} MODE ${channel} ${mode} ${nick}`)
    }

    /**
     * Changes the client's nick (has no effect if the user is not authenticated)
     * @param {string} newNick The new nick
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async setNick(newNick) {
        if(this.isAuthenticated) {
            await this.sendUserChangedNick(this.userInfo, newNick)
            this.userInfo.nick = newNick
        }
    }

    /**
     * Sets the user's new mode
     * @param {string} mode The new mode string
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async setMode(mode) {
        this.#mode = mode
        await this.sendServerMessage('221 '+this.nickOrAsterisk, mode)
    }

    /**
     * Sets the client's hostname (has no effect is the user is not authenticated)
     * @param {string} hostname The new hostname
     * @returns {Promise<void>}
     * @since 1.0.0
     */
    async setHostname(hostname) {
        if(this.isAuthenticated)
            this.userInfo.hostname = hostname
    }

    /**
     * Pings the client and returns the number of milliseconds it took to receive a reply
     * @returns {Promise<number>} The number of milliseconds it took to receive a reply
     * @since 1.0.0
     */
    async ping() {
        const start = Date.now()

        // Send ping
        const pingData = start.toString()
        await this.sendServerMessage('PING '+pingData)

        await new Promise((res, _rej) => {
            /** @type {IrcClientLineHandler} */
            let handler

            handler = ln => {
                if(ln.name === 'PONG' && ln.metadata === pingData) {
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


/* Export class */
module.exports = IrcClient
